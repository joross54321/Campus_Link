import { Enrollment, Subject, SystemConfig, UserProfile } from '../types';

export {
  enrollmentMatchesTerm,
  enrollmentMatchesPortalTermStrict,
  normalizeSemesterValue,
  portalTermFromConfig,
  parseTermFromEnrollmentDocId,
} from './studentEnrollments';

export {
  buildEnrollmentCapacitySnapshot,
  canChooseCollegeAndProgram,
  classifySubjectSchedule,
  evaluateSubjectEligibility,
  listAddBackCatalog,
  listAddDropCatalog,
  listPreEnrollmentCatalog,
  scheduleKindLabel,
  subjectIneligibilityLabel,
  type SubjectEligibility,
} from './enrollmentEligibility';

export {
  enrollmentsForTerm,
  hasOfficialEnrollmentForTerm,
  isEnrolledForCurrentTerm,
  hasApprovedStudyLoadForTerm,
  hasActiveStudyLoadForTerm,
  hasPreEnrollmentSubmittedForTerm,
  hasPendingInitialEnrollmentForTerm,
  hasPendingEnrollmentForTerm,
  getStudentTermPhase,
  studentTermPhaseLabel,
  canAccessPreEnrollmentWizard,
  canAccessAddDropPortal,
  getPreEnrollmentBlockReason,
  getStudyLoadAddBlockReason,
  getStudyLoadDropBlockReason,
  getAddDropBlockReason,
  preEnrollmentBlockMessage,
  addDropBlockMessage,
  filterSubjectsForAddDrop,
  filterSubjectsForPreEnrollment,
  passedCourseCodesFromGrades,
  type StudentTermPhase,
  type PreEnrollmentBlockReason,
  type AddDropBlockReason,
} from './enrollmentPeriods';

export type EnrollmentBlockReason = import('./enrollmentPeriods').PreEnrollmentBlockReason;

export {
  getPreEnrollmentBlockReason as getEnrollmentBlockReason,
  canAccessPreEnrollmentWizard as canAccessEnrollmentWizard,
  preEnrollmentBlockMessage as enrollmentBlockMessage,
  addDropBlockMessage as studyLoadAddBlockMessage,
} from './enrollmentPeriods';

import { getStudyLoadAddBlockReason as getAddBlock } from './enrollmentPeriods';

export function canRequestStudyLoadAddAction(
  enrollments: Enrollment[],
  config: SystemConfig,
  role?: string
): boolean {
  return getAddBlock(enrollments, config, role) === null;
}

export function subjectMatchesProfessor(
  subject: Subject,
  professorUid: string,
  handlingSections?: string[]
): boolean {
  if (subject.professorId === professorUid) return true;
  if (handlingSections?.includes(subject.section)) return true;
  return false;
}

export function getProfessorFilterOptions(subjects: Subject[]): {
  yearLevels: number[];
  sections: string[];
} {
  const yearLevels = [...new Set(subjects.map((s) => s.yearLevel))].sort(
    (a, b) => a - b
  );
  const sections = [...new Set(subjects.map((s) => s.section))].sort();
  return { yearLevels, sections };
}
