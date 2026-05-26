export type UserRole = 'student' | 'professor' | 'registrar';

export interface UserProfile {
  uid: string;
  studentId: string;
  surname: string;
  firstName: string;
  role: UserRole;
  college?: string;
  program?: string;
  section?: string;
  yearLevel?: number;
  address?: string;
  contact?: string;
  maxUnits: number;
  handlingSections?: string[];
  photoUrl?: string;
}

export interface Subject {
  id: string;
  code: string;
  title: string;
  units: number;
  prerequisites: string[];
  yearLevel: number;
  semester: '1' | '2' | 'Summer';
  status: 'open' | 'full';
  college: string;
  section: string;
  /** Max students in this section offering (subject doc). */
  sectionCapacity?: number;
  /** Max students across all sections of this course code for the term. */
  courseCapacity?: number;
  professorId?: string;
  academicYear?: string;
}

export type EnrollmentRequestType = 'initial' | 'add' | 'drop';

export interface Enrollment {
  id: string;
  userId: string;
  subjectId: string;
  academicYear: string;
  semester: string;
  status: 'pending' | 'approved' | 'dropped' | 'pending_drop' | 'rejected';
  requestType?: EnrollmentRequestType;
  requestedAt: Date | string;
  dropRequestedAt?: Date | string;
  section?: string;
  program?: string;
}

export interface Grade {
  id: string;
  userId: string;
  subjectId: string;
  professorId: string;
  grade: number;
  status: 'pending' | 'posted';
  academicYear: string;
  semester: string;
}

export type NotificationKind =
  | 'enrollment_approved'
  | 'enrollment_rejected'
  | 'drop_approved'
  | 'drop_rejected'
  | 'grade_posted';

export interface CampusNotification {
  id: string;
  userId: string;
  title: string;
  body: string;
  kind: NotificationKind;
  read: boolean;
  createdAt: string;
  link?: string;
}

export interface SystemConfig {
  currentSemester: string;
  currentAcademicYear: string;
  midtermDate: string;
  semesterStartDate?: string;
  semesterEndDate?: string;
  enrollmentStartDate?: string;
  enrollmentEndDate?: string;
  enrollmentOpen?: boolean;
  /** Registrar override: bypass enrollment calendar dates for student add/wizard. */
  enrollmentPeriodForced?: boolean;
  lastTransitionAt?: string;
  transitionedBy?: string;
  autoRejectStalePendingOnTransition?: boolean;
  /** When false, scheduled + registrar-session auto rollover are skipped. Manual "Commit Automated Pipeline" still works. Default: on (missing = enabled). */
  semesterAutomationEnabled?: boolean;
  /** Registrar-only mock calendar (ISO date) for testing time-based rules (e.g. drop lockout). */
  simulationDate?: string;
  dropLockDate?: string;
  /** When true (registrar simulation), students with an approved load may still open the enrollment wizard to add courses. */
  allowPostEnrollmentAdds?: boolean;
  /** When true (registrar simulation), students may request drops outside the default calendar check. */
  allowPostEnrollmentDrops?: boolean;
  /** Snapshot saved before applying a simulation preset; used by Restore baseline. */
  simulationBaseline?: {
    simulationDate?: string | null;
    enrollmentOpen?: boolean;
    enrollmentPeriodForced?: boolean;
    allowPostEnrollmentAdds?: boolean;
    allowPostEnrollmentDrops?: boolean;
    dropLockDate?: string;
    savedAt: string;
  };
}
