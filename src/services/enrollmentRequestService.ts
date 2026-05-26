import {
  addDoc,
  collection,
  doc,
  getDoc,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import {
  canAccessPreEnrollmentWizard,
  enrollmentsForTerm,
  filterSubjectsForAddDrop,
  filterSubjectsForPreEnrollment,
  hasPendingInitialEnrollmentForTerm,
  isEnrolledForCurrentTerm,
  totalUnitsForSubjects,
} from '../lib/enrollmentPeriods';
import {
  buildEnrollmentCapacitySnapshot,
  evaluateSubjectEligibility,
  subjectIneligibilityLabel,
} from '../lib/enrollmentEligibility';
import { collegeNameById } from '../lib/colleges';
import { canRequestStudyLoadAdd, canRequestStudyLoadDrop } from '../lib/systemConfig';
import {
  enrollmentMatchesPortalTermStrict,
  studentEnrollmentUserIds,
} from '../lib/studentEnrollments';
import type { EnrollmentScheduleIntent } from '../lib/enrollmentEligibility';
import { Enrollment, Subject, SystemConfig, UserProfile } from '../types';

export class EnrollmentRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EnrollmentRequestError';
  }
}

function assertSubjectEnrollmentAllowed(
  subject: Subject | null,
  profile: UserProfile,
  config: SystemConfig,
  passedCodes: string[],
  enrolledIds: string[],
  allEnrollments: Enrollment[],
  allSubjects: Subject[],
  options?: {
    section?: string;
    collegeId?: string;
    intent?: EnrollmentScheduleIntent;
  }
) {
  if (!subject) throw new EnrollmentRequestError('Subject not found.');
  const snapshot = buildEnrollmentCapacitySnapshot(allEnrollments, allSubjects, config);
  const intent = options?.intent ?? 'add_drop';
  const result = evaluateSubjectEligibility(subject, {
    profile,
    config,
    passedCourseCodes: passedCodes,
    enrolledSubjectIds: enrolledIds,
    snapshot,
    section: options?.section,
    collegeName: options?.collegeId
      ? collegeNameById(options.collegeId)
      : profile.college,
    intent,
  });
  if (!result.eligible) {
    throw new EnrollmentRequestError(
      `${subject.code}: ${subjectIneligibilityLabel(
        result.reasons,
        result.missingPrerequisites,
        result.scheduleKind,
        config,
        subject
      )}`
    );
  }
}

/**
 * One-time pre-enrollment batch (registrar approval required).
 */
export async function submitInitialEnrollment(input: {
  profile: UserProfile;
  config: SystemConfig;
  enrollments: Enrollment[];
  subjects: Subject[];
  subjectIds: string[];
  passedCourseCodes: string[];
  wizardMeta?: { collegeId?: string; program?: string; section?: string };
}): Promise<void> {
  const {
    profile,
    config,
    enrollments,
    subjects,
    subjectIds,
    passedCourseCodes,
    wizardMeta,
  } = input;

  if (!canAccessPreEnrollmentWizard(enrollments, config, profile.role)) {
    throw new EnrollmentRequestError(
      'Pre-enrollment is not available. You may already be enrolled or have a pending request.'
    );
  }

  if (subjectIds.length === 0) {
    throw new EnrollmentRequestError('Select at least one subject.');
  }

  const enrolledIds = enrollmentsForTerm(enrollments, config).map((e) => e.subjectId);
  const allowed = filterSubjectsForPreEnrollment(
    subjects,
    profile,
    config,
    passedCourseCodes,
    enrolledIds,
    {
      collegeId: wizardMeta?.collegeId,
      program: wizardMeta?.program,
      section: wizardMeta?.section,
      yearLevel: profile.yearLevel,
    },
    enrollments
  );
  const allowedIds = new Set(allowed.map((s) => s.id));

  for (const id of subjectIds) {
    if (!allowedIds.has(id)) {
      const sub = subjects.find((s) => s.id === id);
      throw new EnrollmentRequestError(
        sub
          ? `${sub.code} is not eligible for pre-enrollment.`
          : 'Invalid subject selection.'
      );
    }
  }

  const units = totalUnitsForSubjects(subjects, subjectIds);
  if (units > (profile.maxUnits ?? 30)) {
    throw new EnrollmentRequestError(
      `Load exceeds maximum ${profile.maxUnits ?? 30} units.`
    );
  }

  const ay = config.currentAcademicYear;
  const sem = config.currentSemester;
  const now = new Date().toISOString();

  for (const subjectId of subjectIds) {
    const subject = subjects.find((s) => s.id === subjectId) ?? null;
    assertSubjectEnrollmentAllowed(
      subject,
      profile,
      config,
      passedCourseCodes,
      enrolledIds,
      enrollments,
      subjects,
      {
        section: wizardMeta?.section,
        collegeId: wizardMeta?.collegeId,
        intent: 'pre_enrollment',
      }
    );

    await addDoc(collection(db, 'enrollments'), {
      userId: profile.uid,
      subjectId,
      academicYear: ay,
      semester: sem,
      status: 'pending',
      requestType: 'initial',
      requestedAt: now,
      ...(wizardMeta?.section ? { section: wizardMeta.section } : {}),
      ...(wizardMeta?.program ? { program: wizardMeta.program } : {}),
    });
  }
}

/**
 * Post-enrollment add (single subject, separate from wizard).
 */
export async function submitAddEnrollment(input: {
  profile: UserProfile;
  config: SystemConfig;
  enrollments: Enrollment[];
  subjects: Subject[];
  subjectId: string;
  passedCourseCodes: string[];
}): Promise<string> {
  const { profile, config, enrollments, subjects, subjectId, passedCourseCodes } =
    input;

  if (hasPendingInitialEnrollmentForTerm(enrollments, config)) {
    throw new EnrollmentRequestError(
      'Pre-enrollment must be fully approved before you can request adds.'
    );
  }
  if (!isEnrolledForCurrentTerm(enrollments, config)) {
    throw new EnrollmentRequestError(
      'You must be enrolled for this term before requesting adds. Back subjects are added here after approval.'
    );
  }

  if (!canRequestStudyLoadAdd(config)) {
    throw new EnrollmentRequestError(
      'The add period is closed. Adds are only allowed during the post-enrollment add/drop window.'
    );
  }

  const term = enrollmentsForTerm(enrollments, config);
  const enrolledIds = term
    .filter((e) => e.status === 'approved' || e.status === 'pending_drop' || e.status === 'pending')
    .map((e) => e.subjectId);

  const allowed = filterSubjectsForAddDrop(
    subjects,
    profile,
    passedCourseCodes,
    enrolledIds,
    config,
    enrollments
  );
  if (!allowed.some((s) => s.id === subjectId)) {
    throw new EnrollmentRequestError(
      'This subject is not eligible to add. Adds are only for back subjects you failed or have not yet passed (earlier year, same semester slot).'
    );
  }

  const subject = subjects.find((s) => s.id === subjectId) ?? null;
  assertSubjectEnrollmentAllowed(
    subject,
    profile,
    config,
    passedCourseCodes,
    enrolledIds,
    enrollments,
    subjects,
    { intent: 'add_back' }
  );

  const currentUnits = term
    .filter((e) => e.status === 'approved' || e.status === 'pending_drop')
    .reduce((sum, e) => {
      const s = subjects.find((x) => x.id === e.subjectId);
      return sum + (s?.units ?? 0);
    }, 0);

  if (currentUnits + (subject?.units ?? 0) > (profile.maxUnits ?? 30)) {
    throw new EnrollmentRequestError('Adding this course would exceed your unit cap.');
  }

  const ref = await addDoc(collection(db, 'enrollments'), {
    userId: profile.uid,
    subjectId,
    academicYear: config.currentAcademicYear,
    semester: config.currentSemester,
    status: 'pending',
    requestType: 'add',
    requestedAt: new Date().toISOString(),
  });

  return ref.id;
}

/**
 * Post-enrollment drop request (registrar approval).
 */
export async function submitDropEnrollment(input: {
  profile: UserProfile;
  config: SystemConfig;
  enrollmentId: string;
  enrollments?: Enrollment[];
}): Promise<void> {
  const { profile, config, enrollmentId, enrollments = [] } = input;

  if (hasPendingInitialEnrollmentForTerm(enrollments, config)) {
    throw new EnrollmentRequestError(
      'Pre-enrollment must be fully approved before you can request drops.'
    );
  }

  if (!canRequestStudyLoadDrop(config)) {
    throw new EnrollmentRequestError('The drop period is closed.');
  }

  const snap = await getDoc(doc(db, 'enrollments', enrollmentId));
  if (!snap.exists()) throw new EnrollmentRequestError('Enrollment not found.');

  const data = snap.data() as Enrollment;
  const ownerIds = new Set(studentEnrollmentUserIds(profile));
  if (!ownerIds.has(data.userId)) {
    throw new EnrollmentRequestError('Not authorized to drop this enrollment.');
  }
  if (data.status !== 'approved') {
    throw new EnrollmentRequestError('Only approved courses can be dropped.');
  }
  if (!enrollmentMatchesPortalTermStrict(data, config)) {
    throw new EnrollmentRequestError(
      'Only courses for the current academic year and semester can be dropped.'
    );
  }

  try {
    await updateDoc(doc(db, 'enrollments', enrollmentId), {
      status: 'pending_drop',
    });
  } catch (err: unknown) {
    const code =
      err && typeof err === 'object' && 'code' in err
        ? String((err as { code: string }).code)
        : '';
    if (code === 'permission-denied') {
      throw new EnrollmentRequestError(
        'Drop could not be saved (portal permissions or drop lock). Contact the registrar if this continues.'
      );
    }
    throw err;
  }
}
