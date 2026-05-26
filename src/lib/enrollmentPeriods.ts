import { collegeNameById } from './colleges';
import { Enrollment, Subject, SystemConfig, UserProfile } from '../types';
import {
  canRequestInitialEnrollment,
  canRequestStudyLoadAdd,
  canRequestStudyLoadDrop,
} from './systemConfig';
import { enrollmentMatchesPortalTermStrict } from './studentEnrollments';
import {
  buildEnrollmentCapacitySnapshot,
  evaluateSubjectEligibility,
  listAddBackCatalog,
  listAddDropCatalog,
  listPreEnrollmentCatalog,
} from './enrollmentEligibility';

/**
 * Student status for the portal's current term:
 * - not_enrolled: may use pre-enrollment wizard (new term / first year)
 * - pre_enrollment_pending: submitted wizard; awaiting registrar (no add/drop)
 * - enrolled: at least one approved course (or drop in progress); add/drop when period open
 */
export type StudentTermPhase = 'not_enrolled' | 'pre_enrollment_pending' | 'enrolled';

export type PreEnrollmentBlockReason =
  | 'window_closed'
  | 'awaiting_approval'
  | 'already_enrolled'
  | 'not_student'
  | null;

export type AddDropBlockReason =
  | 'not_enrolled'
  | 'pre_enrollment_pending'
  | 'add_period_closed'
  | 'drop_period_closed'
  | 'not_student'
  | null;

export function enrollmentsForTerm(
  enrollments: Enrollment[],
  config: SystemConfig
): Enrollment[] {
  return enrollments.filter((e) => enrollmentMatchesPortalTermStrict(e, config));
}

export function isInitialPreEnrollmentRow(e: Enrollment): boolean {
  return e.requestType === 'initial' || e.requestType == null;
}

/** At least one registrar-approved course this term. */
export function hasApprovedStudyLoadForTerm(
  enrollments: Enrollment[],
  config: SystemConfig
): boolean {
  return enrollmentsForTerm(enrollments, config).some((e) => e.status === 'approved');
}

/** Approved courses and drops awaiting registrar (study load list). */
export function hasActiveStudyLoadForTerm(
  enrollments: Enrollment[],
  config: SystemConfig
): boolean {
  return enrollmentsForTerm(enrollments, config).some(
    (e) => e.status === 'approved' || e.status === 'pending_drop'
  );
}

/**
 * Enrolled for the current term — at least one approved/pending_drop course and
 * no outstanding initial pre-enrollment rows still awaiting registrar action.
 */
export function isEnrolledForCurrentTerm(
  enrollments: Enrollment[],
  config: SystemConfig
): boolean {
  if (hasPendingInitialEnrollmentForTerm(enrollments, config)) return false;
  return hasActiveStudyLoadForTerm(enrollments, config);
}

export function hasPendingInitialEnrollmentForTerm(
  enrollments: Enrollment[],
  config: SystemConfig
): boolean {
  return enrollmentsForTerm(enrollments, config).some(
    (e) => e.status === 'pending' && isInitialPreEnrollmentRow(e)
  );
}

export function hasPendingEnrollmentForTerm(
  enrollments: Enrollment[],
  config: SystemConfig
): boolean {
  return enrollmentsForTerm(enrollments, config).some((e) => e.status === 'pending');
}

export function getStudentTermPhase(
  enrollments: Enrollment[],
  config: SystemConfig
): StudentTermPhase {
  if (hasPendingInitialEnrollmentForTerm(enrollments, config)) {
    return 'pre_enrollment_pending';
  }
  if (isEnrolledForCurrentTerm(enrollments, config)) return 'enrolled';
  return 'not_enrolled';
}

/** @deprecated Use isEnrolledForCurrentTerm */
export function hasOfficialEnrollmentForTerm(
  enrollments: Enrollment[],
  config: SystemConfig
): boolean {
  return isEnrolledForCurrentTerm(enrollments, config);
}

/** @deprecated Use getStudentTermPhase !== 'not_enrolled' */
export function hasPreEnrollmentSubmittedForTerm(
  enrollments: Enrollment[],
  config: SystemConfig
): boolean {
  return getStudentTermPhase(enrollments, config) !== 'not_enrolled';
}

/** Pre-enrollment wizard — only when not yet enrolled and no pending batch. */
export function getPreEnrollmentBlockReason(
  enrollments: Enrollment[],
  config: SystemConfig,
  role?: string
): PreEnrollmentBlockReason {
  if (role && role !== 'student') return 'not_student';
  if (isEnrolledForCurrentTerm(enrollments, config)) return 'already_enrolled';
  if (hasPendingInitialEnrollmentForTerm(enrollments, config)) {
    return 'awaiting_approval';
  }
  if (!canRequestInitialEnrollment(config)) return 'window_closed';
  return null;
}

export function canAccessPreEnrollmentWizard(
  enrollments: Enrollment[],
  config: SystemConfig,
  role?: string
): boolean {
  return getPreEnrollmentBlockReason(enrollments, config, role) === null;
}

export function getAddDropBlockReason(
  enrollments: Enrollment[],
  config: SystemConfig,
  role?: string
): AddDropBlockReason {
  if (role && role !== 'student') return 'not_student';
  if (hasPendingInitialEnrollmentForTerm(enrollments, config)) {
    return 'pre_enrollment_pending';
  }
  if (!isEnrolledForCurrentTerm(enrollments, config)) return 'not_enrolled';
  if (!canRequestStudyLoadAdd(config) && !canRequestStudyLoadDrop(config)) {
    return 'add_period_closed';
  }
  return null;
}

export function canAccessAddDropPortal(
  enrollments: Enrollment[],
  config: SystemConfig,
  role?: string
): boolean {
  return getAddDropBlockReason(enrollments, config, role) === null;
}

export function getStudyLoadAddBlockReason(
  enrollments: Enrollment[],
  config: SystemConfig,
  role?: string
): AddDropBlockReason | 'already_pending_add' | null {
  if (role && role !== 'student') return 'not_student';
  if (hasPendingInitialEnrollmentForTerm(enrollments, config)) {
    return 'pre_enrollment_pending';
  }
  if (!isEnrolledForCurrentTerm(enrollments, config)) return 'not_enrolled';
  if (!canRequestStudyLoadAdd(config)) return 'add_period_closed';

  const term = enrollmentsForTerm(enrollments, config);
  const pendingAdds = term.filter(
    (e) => e.status === 'pending' && e.requestType === 'add'
  );
  if (pendingAdds.length > 0) return 'already_pending_add';
  return null;
}

export function getStudyLoadDropBlockReason(
  enrollments: Enrollment[],
  config: SystemConfig,
  role?: string
): AddDropBlockReason | null {
  if (role && role !== 'student') return 'not_student';
  if (hasPendingInitialEnrollmentForTerm(enrollments, config)) {
    return 'pre_enrollment_pending';
  }
  if (!isEnrolledForCurrentTerm(enrollments, config)) return 'not_enrolled';
  if (!canRequestStudyLoadDrop(config)) return 'drop_period_closed';
  return null;
}

export function preEnrollmentBlockMessage(reason: PreEnrollmentBlockReason | null): string {
  if (!reason) return '';
  const messages: Record<Exclude<PreEnrollmentBlockReason, null>, string> = {
    window_closed: 'Pre-enrollment is closed for this term.',
    awaiting_approval:
      'Your pre-enrollment is pending registrar approval. You are not enrolled until every submitted course is approved or declined — then add/drop can open.',
    already_enrolled:
      'You are enrolled for this term. Use Add/Drop on Study Load to change your load when the period is open.',
    not_student: 'Pre-enrollment is only available to students.',
  };
  return messages[reason] ?? '';
}

export function addDropBlockMessage(
  reason: AddDropBlockReason | 'already_pending_add' | null
): string {
  if (!reason) return '';
  if (reason === 'already_pending_add') {
    return 'You already have a pending add request for this term.';
  }
  const messages: Record<Exclude<AddDropBlockReason, null>, string> = {
    not_enrolled:
      'You must be enrolled for this term before using add/drop. Complete pre-enrollment and receive registrar approval first.',
    pre_enrollment_pending:
      'Pre-enrollment must be fully approved first. Add/drop opens after the registrar finishes reviewing your submitted courses.',
    add_period_closed:
      'The post-enrollment add period is closed (not the pre-enrollment window). It opens after classes begin and closes before midterm lockout.',
    drop_period_closed: 'The drop period is closed for this term.',
    not_student: 'Add/drop is only available to students.',
  };
  return messages[reason] ?? '';
}

export function studentTermPhaseLabel(phase: StudentTermPhase): string {
  const labels: Record<StudentTermPhase, string> = {
    not_enrolled: 'Not enrolled this term',
    pre_enrollment_pending: 'Pre-enrollment pending approval',
    enrolled: 'Enrolled this term',
  };
  return labels[phase];
}

/** Passed course codes from posted grades (grade ≤ 3.0). */
export function passedCourseCodesFromGrades(
  gradeRows: { grade: number; subjectCode?: string }[]
): string[] {
  return gradeRows
    .filter((g) => g.grade <= 3.0 && g.subjectCode)
    .map((g) => g.subjectCode as string);
}

/**
 * Post-enrollment add requests: back / missed courses only (failed or never passed),
 * same portal semester slot, prerequisites and capacity satisfied.
 */
export function filterSubjectsForAddDrop(
  subjects: Subject[],
  profile: UserProfile,
  passedCourseCodes: string[],
  enrolledSubjectIds: string[],
  config?: SystemConfig,
  allEnrollments: Enrollment[] = []
): Subject[] {
  if (!config) return [];

  const snapshot = buildEnrollmentCapacitySnapshot(allEnrollments, subjects, config);
  const pool = listAddBackCatalog(subjects, profile, config, passedCourseCodes);

  return pool.filter((s) =>
    evaluateSubjectEligibility(s, {
      profile,
      config,
      passedCourseCodes,
      enrolledSubjectIds,
      snapshot,
      intent: 'add_back',
    }).eligible
  );
}

/**
 * Pre-enrollment wizard catalog: current year level and semester only — no back subjects.
 * Back subjects are added later via the add portal after the student is enrolled.
 */
export function filterSubjectsForPreEnrollment(
  subjects: Subject[],
  profile: UserProfile,
  config: SystemConfig,
  passedCourseCodes: string[],
  enrolledSubjectIds: string[],
  options?: {
    collegeId?: string;
    program?: string;
    section?: string;
    yearLevel?: number;
  },
  allEnrollments: Enrollment[] = []
): Subject[] {
  const snapshot = buildEnrollmentCapacitySnapshot(allEnrollments, subjects, config);
  const collegeName = options?.collegeId
    ? collegeNameById(options.collegeId)
    : profile.college;

  const pool = listPreEnrollmentCatalog(subjects, profile, config, {
    collegeId: options?.collegeId,
    program: options?.program,
    section: options?.section,
  });

  const profileForCheck: UserProfile = {
    ...profile,
    yearLevel: options?.yearLevel ?? profile.yearLevel,
  };

  return pool.filter((s) =>
    evaluateSubjectEligibility(s, {
      profile: profileForCheck,
      config,
      passedCourseCodes,
      enrolledSubjectIds,
      snapshot,
      section: options?.section,
      collegeName: collegeName ?? profile.college,
      intent: 'pre_enrollment',
    }).eligible
  );
}

export function enrollmentRequestLabel(
  enrollment: Pick<Enrollment, 'status' | 'requestType'>
): string {
  if (enrollment.status === 'pending_drop') return 'Drop';
  if (enrollment.requestType === 'add') return 'Add';
  if (enrollment.requestType === 'initial') return 'Pre-enrollment';
  return 'Pre-enrollment';
}

export function totalUnitsForSubjects(
  subjects: Subject[],
  subjectIds: string[]
): number {
  return subjectIds.reduce((sum, id) => {
    const s = subjects.find((x) => x.id === id);
    return sum + (s?.units ?? 0);
  }, 0);
}
