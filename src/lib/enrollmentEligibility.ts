import { Enrollment, Subject, SystemConfig, UserProfile } from '../types';
import { collegeNameById } from './colleges';
import { formatSemesterLabel } from './systemConfig';
import {
  enrollmentMatchesPortalTermStrict,
  enrollmentMatchesTerm,
  normalizeSemesterValue,
} from './studentEnrollments';

export const DEFAULT_SECTION_CAPACITY = 40;
export const DEFAULT_COURSE_CAPACITY = 120;

export const CAPACITY_COUNT_STATUSES: Enrollment['status'][] = [
  'pending',
  'approved',
  'pending_drop',
];

export type EnrollmentScheduleIntent =
  | 'pre_enrollment'
  | 'add_drop'
  /** Post-enrollment add requests: back / missed courses only. */
  | 'add_back';

export type SubjectScheduleKind =
  | 'forward'
  | 'back'
  | 'wrong_semester'
  | 'ahead'
  | 'pre_enrollment_not_forward';

export type SubjectIneligibilityReason =
  | 'prerequisite'
  | 'section_full'
  | 'course_full'
  | 'already_enrolled'
  | 'already_passed'
  | 'not_back_subject'
  | 'wrong_term'
  | 'wrong_section'
  | 'closed';

export type SubjectEligibility = {
  eligible: boolean;
  reasons: SubjectIneligibilityReason[];
  scheduleKind: SubjectScheduleKind;
  missingPrerequisites: string[];
  sectionCount: number;
  courseCount: number;
  sectionCapacity: number;
  courseCapacity: number;
};

export type EnrollmentCapacitySnapshot = {
  bySubjectId: Record<string, number>;
  byCourseCode: Record<string, number>;
};

export function countsTowardCapacity(status: Enrollment['status']): boolean {
  return CAPACITY_COUNT_STATUSES.includes(status);
}

export function canChooseCollegeAndProgram(
  profile: Pick<UserProfile, 'yearLevel'>,
  config: SystemConfig
): boolean {
  const year = profile.yearLevel ?? 1;
  const sem = normalizeSemesterValue(config.currentSemester);
  return year === 1 && sem === '1';
}

export function subjectMatchesPortalSemester(
  subject: Pick<Subject, 'semester'>,
  config: SystemConfig
): boolean {
  return (
    normalizeSemesterValue(subject.semester) ===
    normalizeSemesterValue(config.currentSemester)
  );
}

/**
 * Forward = your year level, portal semester.
 * Back = lower year level, same portal semester (retake with that cohort, e.g. juniors in 1st sem).
 * Wrong semester = catalog row is for the other sem slot (not offered now).
 */
export function classifySubjectSchedule(
  subject: Pick<Subject, 'yearLevel' | 'semester'>,
  profile: Pick<UserProfile, 'yearLevel'>,
  config: SystemConfig
): SubjectScheduleKind {
  const studentYear = profile.yearLevel ?? 1;

  if (!subjectMatchesPortalSemester(subject, config)) {
    return 'wrong_semester';
  }
  if (subject.yearLevel > studentYear) {
    return 'ahead';
  }
  if (subject.yearLevel < studentYear) {
    return 'back';
  }
  if (subject.yearLevel === studentYear) {
    return 'forward';
  }
  return 'ahead';
}

export function subjectAllowedForIntent(
  kind: SubjectScheduleKind,
  intent: EnrollmentScheduleIntent
): boolean {
  if (kind === 'wrong_semester' || kind === 'ahead') return false;
  if (intent === 'pre_enrollment') {
    return kind === 'forward';
  }
  if (intent === 'add_back') {
    return kind === 'back';
  }
  return kind === 'forward' || kind === 'back';
}

/** Course not yet passed (failed or never completed with a passing grade). */
export function courseOutstandingForBackAdd(
  courseCode: string,
  passedCourseCodes: string[]
): boolean {
  return !passedCourseCodes.includes(courseCode);
}

export function buildEnrollmentCapacitySnapshot(
  enrollments: Enrollment[],
  subjects: Subject[],
  config: SystemConfig
): EnrollmentCapacitySnapshot {
  const bySubjectId: Record<string, number> = {};
  const byCourseCode: Record<string, number> = {};
  const codeBySubjectId = new Map(subjects.map((s) => [s.id, s.code]));

  for (const e of enrollments) {
    if (!countsTowardCapacity(e.status)) continue;
    if (!enrollmentMatchesPortalTermStrict(e, config)) continue;

    bySubjectId[e.subjectId] = (bySubjectId[e.subjectId] ?? 0) + 1;
    const code = codeBySubjectId.get(e.subjectId);
    if (code) {
      byCourseCode[code] = (byCourseCode[code] ?? 0) + 1;
    }
  }

  return { bySubjectId, byCourseCode };
}

export function getSectionCapacity(subject: Subject): number {
  const cap = subject.sectionCapacity;
  return typeof cap === 'number' && cap > 0 ? cap : DEFAULT_SECTION_CAPACITY;
}

export function getCourseCapacity(subject: Subject): number {
  const cap = subject.courseCapacity;
  return typeof cap === 'number' && cap > 0 ? cap : DEFAULT_COURSE_CAPACITY;
}

export function isSectionFull(
  subject: Subject,
  snapshot: EnrollmentCapacitySnapshot,
  extraPending = 0
): boolean {
  const count = (snapshot.bySubjectId[subject.id] ?? 0) + extraPending;
  return count >= getSectionCapacity(subject);
}

export function isCourseFull(
  subject: Subject,
  snapshot: EnrollmentCapacitySnapshot,
  extraPending = 0
): boolean {
  const count = (snapshot.byCourseCode[subject.code] ?? 0) + extraPending;
  return count >= getCourseCapacity(subject);
}

export function evaluateSubjectEligibility(
  subject: Subject,
  options: {
    profile: UserProfile;
    config: SystemConfig;
    passedCourseCodes: string[];
    enrolledSubjectIds: string[];
    snapshot: EnrollmentCapacitySnapshot;
    section?: string;
    collegeName?: string;
    intent?: EnrollmentScheduleIntent;
  }
): SubjectEligibility {
  const {
    profile,
    config,
    passedCourseCodes,
    enrolledSubjectIds,
    snapshot,
    section,
    collegeName,
    intent = 'add_drop',
  } = options;

  const reasons: SubjectIneligibilityReason[] = [];
  const scheduleKind = classifySubjectSchedule(subject, profile, config);

  if (enrolledSubjectIds.includes(subject.id)) {
    reasons.push('already_enrolled');
  }

  if (!subjectAllowedForIntent(scheduleKind, intent)) {
    if (intent === 'add_back' && scheduleKind === 'forward') {
      reasons.push('not_back_subject');
    } else {
      reasons.push('wrong_term');
    }
  }

  if (
    intent === 'add_back' &&
    scheduleKind === 'back' &&
    !courseOutstandingForBackAdd(subject.code, passedCourseCodes)
  ) {
    reasons.push('already_passed');
  }

  if (
    intent === 'pre_enrollment' &&
    section &&
    subject.section !== section
  ) {
    reasons.push('wrong_section');
  }

  const college = collegeName ?? profile.college;
  if (college && subject.college && subject.college !== college) {
    reasons.push('wrong_term');
  }

  const missingPrerequisites = (subject.prerequisites ?? []).filter(
    (p) => !passedCourseCodes.includes(p)
  );
  if (missingPrerequisites.length > 0) {
    reasons.push('prerequisite');
  }

  if (subject.status === 'full') {
    reasons.push('section_full');
  }

  const sectionCount = snapshot.bySubjectId[subject.id] ?? 0;
  const courseCount = snapshot.byCourseCode[subject.code] ?? 0;
  const sectionCapacity = getSectionCapacity(subject);
  const courseCapacity = getCourseCapacity(subject);

  if (sectionCount >= sectionCapacity) {
    reasons.push('section_full');
  }
  if (courseCount >= courseCapacity) {
    reasons.push('course_full');
  }

  const eligible = reasons.length === 0;

  return {
    eligible,
    reasons: [...new Set(reasons)],
    scheduleKind,
    missingPrerequisites,
    sectionCount,
    courseCount,
    sectionCapacity,
    courseCapacity,
  };
}

export function scheduleKindLabel(
  kind: SubjectScheduleKind,
  subject: Pick<Subject, 'yearLevel' | 'semester'>,
  config: SystemConfig
): string {
  if (kind === 'wrong_semester') {
    return `Runs in ${formatSemesterLabel(subject.semester)} — portal is ${formatSemesterLabel(config.currentSemester)} only`;
  }
  if (kind === 'back') {
    return `Back subject (Year ${subject.yearLevel}) — ${formatSemesterLabel(config.currentSemester)} section with that cohort`;
  }
  if (kind === 'ahead') {
    return 'Above your current year level';
  }
  return 'Not available this term';
}

export function subjectIneligibilityLabel(
  reasons: SubjectIneligibilityReason[],
  missingPrerequisites: string[],
  scheduleKind?: SubjectScheduleKind,
  config?: SystemConfig,
  subject?: Pick<Subject, 'yearLevel' | 'semester'>
): string {
  if (reasons.includes('prerequisite')) {
    return `Prerequisite: ${missingPrerequisites.join(', ')}`;
  }
  if (reasons.includes('section_full')) return 'Section full';
  if (reasons.includes('course_full')) return 'Course capacity full';
  if (reasons.includes('already_enrolled')) return 'Already on your load';
  if (reasons.includes('already_passed')) return 'Already passed this course';
  if (reasons.includes('not_back_subject')) {
    return 'Current-year courses are set during pre-enrollment, not add requests';
  }
  if (reasons.includes('wrong_section')) return 'Different section';
  if (reasons.includes('wrong_term') && scheduleKind && config) {
    if (subject) {
      return scheduleKindLabel(scheduleKind, subject, config);
    }
    return scheduleKindLabel(scheduleKind, { yearLevel: 0, semester: '1' }, config);
  }
  if (reasons.includes('wrong_term')) return 'Not offered this term';
  if (reasons.includes('closed')) return 'Closed';
  return 'Not available';
}

/** Pre-enrollment: forward curriculum for portal semester only. */
export function listPreEnrollmentCatalog(
  subjects: Subject[],
  profile: UserProfile,
  config: SystemConfig,
  options: {
    collegeId?: string;
    program?: string;
    section?: string;
  }
): Subject[] {
  const collegeName = options.collegeId
    ? collegeNameById(options.collegeId) ?? profile.college
    : profile.college;

  return subjects.filter((s) => {
    if (classifySubjectSchedule(s, profile, config) !== 'forward') return false;
    if (collegeName && s.college && s.college !== collegeName) return false;
    if (options.section && s.section !== options.section) return false;
    return true;
  });
}

/**
 * Add/drop catalog: portal semester only; forward or back (back = lower year, same sem).
 */
export function listAddDropCatalog(
  subjects: Subject[],
  profile: UserProfile,
  config: SystemConfig
): Subject[] {
  return subjects.filter((s) => {
    const kind = classifySubjectSchedule(s, profile, config);
    if (!subjectAllowedForIntent(kind, 'add_drop')) return false;
    if (profile.college && s.college && s.college !== profile.college) return false;
    return true;
  });
}

/**
 * Post-enrollment add portal: back subjects only (lower year, same portal semester).
 * Student must still need the course (not passed with grade ≤ 3.0).
 */
export function listAddBackCatalog(
  subjects: Subject[],
  profile: UserProfile,
  config: SystemConfig,
  passedCourseCodes: string[]
): Subject[] {
  return subjects.filter((s) => {
    const kind = classifySubjectSchedule(s, profile, config);
    if (kind !== 'back') return false;
    if (profile.college && s.college && s.college !== profile.college) return false;
    if (!courseOutstandingForBackAdd(s.code, passedCourseCodes)) return false;
    return true;
  });
}

/** Lenient match for “hidden other term” banners only. */
export function hasOffPortalTermEnrollment(
  enrollments: Enrollment[],
  config: SystemConfig
): boolean {
  return enrollments.some(
    (e) =>
      (e.status === 'approved' || e.status === 'pending_drop') &&
      !enrollmentMatchesPortalTermStrict(e, config)
  );
}
