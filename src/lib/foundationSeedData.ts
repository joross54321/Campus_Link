import { COLLEGES, buildSubjectDocId, collegeNameById } from './colleges';
import { KNOWN_DEMO_ACCOUNTS, formatLoginPassword } from './knownDemoAccounts';

const CCI = collegeNameById('CCI')!;
const CAS = collegeNameById('CAS')!;
const CEA = collegeNameById('CEA')!;

const P1 = '2026-1001-A';
const P2 = '2026-1002-A';
const P3 = '2026-1003-A';
const P4 = '2026-1004-A';

/** Historical terms for grade / enrollment backfill (portal may be AY 2025-2026 · 2nd sem). */
export const SEED_TERMS = {
  y2324_1: { academicYear: '2023-2024', semester: '1' as const },
  y2324_2: { academicYear: '2023-2024', semester: '2' as const },
  y2425_1: { academicYear: '2024-2025', semester: '1' as const },
  y2425_2: { academicYear: '2024-2025', semester: '2' as const },
  y2526_1: { academicYear: '2025-2026', semester: '1' as const },
  y2526_2: { academicYear: '2025-2026', semester: '2' as const },
};

export type FoundationUserSeed = {
  studentId: string;
  surname: string;
  firstName: string;
  role: 'student' | 'professor';
  college: string;
  program?: string;
  section?: string;
  yearLevel?: number;
  maxUnits?: number;
  handlingSections?: string[];
};

const KNOWN_IDS = new Set(
  KNOWN_DEMO_ACCOUNTS.filter((a) => a.role !== 'registrar').map((a) => a.studentId)
);

const EXTRA_FOUNDATION_USERS: FoundationUserSeed[] = [
  {
    studentId: P3,
    surname: 'Turing',
    firstName: 'Alan',
    role: 'professor',
    college: CCI,
    handlingSections: ['BSCS 1-A', 'BSEE 1-A', 'BSIT 3-A', 'BSCS 3-A'],
  },
  {
    studentId: P4,
    surname: 'Curie',
    firstName: 'Marie',
    role: 'professor',
    college: CAS,
    handlingSections: ['CAS-C'],
  },
  /**
   * Y2 — failed CS201 (blocks CS202/CS205 chain). Back CS106 open in BSCS 1-B.
   * CS205 BSCS 2-A full → enrolled in CS205 BSCS 2-B. Pending add CS106; pending drop CS212.
   */
  {
    studentId: '2026-2004-A',
    surname: 'Tan',
    firstName: 'Michelle',
    role: 'student',
    college: CCI,
    program: 'BS Computer Science',
    section: 'BSCS 2-A',
    yearLevel: 2,
    maxUnits: 30,
  },
  /** 3rd year IT — mixed pending / approved on current term. */
  {
    studentId: '2026-3001-A',
    surname: 'Reyes',
    firstName: 'Mark',
    role: 'student',
    college: CCI,
    program: 'BS Information Technology',
    section: 'BSIT 3-A',
    yearLevel: 3,
    maxUnits: 30,
  },
  /** 1st year — pre-enrollment pending (not enrolled yet). */
  {
    studentId: '2026-2005-A',
    surname: 'Villanueva',
    firstName: 'James',
    role: 'student',
    college: CCI,
    program: 'BS Computer Science',
    section: 'BSCS 1-A',
    yearLevel: 1,
    maxUnits: 30,
  },
  /** 1st year — partial pre-enrollment (one approved, one still pending). */
  {
    studentId: '2026-2006-A',
    surname: 'Cruz',
    firstName: 'Elena',
    role: 'student',
    college: CCI,
    program: 'BS Computer Science',
    section: 'BSCS 1-A',
    yearLevel: 1,
    maxUnits: 30,
  },
  {
    studentId: '2026-2001-A',
    surname: 'Devera',
    firstName: 'Julian',
    role: 'student',
    college: CCI,
    program: 'BS Computer Science',
    section: 'BSCS 2-A',
    yearLevel: 2,
    maxUnits: 30,
  },
  {
    studentId: '2026-2002-A',
    surname: 'Santos',
    firstName: 'Isabela',
    role: 'student',
    college: CCI,
    program: 'BS Computer Science',
    section: 'BSCS 2-A',
    yearLevel: 2,
    maxUnits: 30,
  },
  {
    studentId: '2026-4001-A',
    surname: 'Gomez',
    firstName: 'Roberto',
    role: 'student',
    college: CEA,
    program: 'BS Electrical Engineering',
    section: 'BSEE 1-A',
    yearLevel: 1,
    maxUnits: 30,
  },
  /**
   * Y2 — failed CS107 (back subject, portal 2nd sem). CS107 sections full (greyed on add).
   * Forward Y2 sem 2 partial load; CS205/CS206 blocked by missing CS202←CS201 chain.
   */
  {
    studentId: '2026-2003-A',
    surname: 'Lopez',
    firstName: 'Ana',
    role: 'student',
    college: CCI,
    program: 'BS Computer Science',
    section: 'BSCS 2-A',
    yearLevel: 2,
    maxUnits: 30,
  },
];

export const FOUNDATION_USERS: FoundationUserSeed[] = [
  ...KNOWN_DEMO_ACCOUNTS.filter((a) => a.role !== 'registrar').map((a) => ({
    studentId: a.studentId,
    surname: a.surname,
    firstName: a.firstName,
    role: a.role as 'student' | 'professor',
    college: 'college' in a ? String(a.college) : CCI,
    ...('program' in a && a.program ? { program: a.program } : {}),
    ...('section' in a && a.section ? { section: a.section } : {}),
    ...('yearLevel' in a && a.yearLevel != null ? { yearLevel: a.yearLevel } : {}),
    ...('handlingSections' in a && a.handlingSections
      ? { handlingSections: [...a.handlingSections] }
      : {}),
    maxUnits: 'maxUnits' in a && a.maxUnits != null ? a.maxUnits : 30,
  })),
  ...EXTRA_FOUNDATION_USERS.filter((u) => !KNOWN_IDS.has(u.studentId)),
];

export type FoundationSubjectSeed = {
  code: string;
  title: string;
  units: number;
  prerequisites: string[];
  yearLevel: number;
  semester: '1' | '2' | 'Summer';
  status: 'open' | 'full';
  college: string;
  section: string;
  sectionCapacity?: number;
  courseCapacity?: number;
  professorStudentId: string;
};

function cci(
  code: string,
  title: string,
  yearLevel: number,
  semester: '1' | '2',
  section: string,
  prerequisites: string[] = [],
  professorStudentId: string = P1,
  opts?: { sectionCapacity?: number; courseCapacity?: number; status?: 'open' | 'full' }
): FoundationSubjectSeed {
  return {
    code,
    title,
    units: 3,
    prerequisites,
    yearLevel,
    semester,
    status: opts?.status ?? 'open',
    college: CCI,
    section,
    sectionCapacity: opts?.sectionCapacity ?? 40,
    courseCapacity: opts?.courseCapacity ?? 120,
    professorStudentId,
  };
}

const sid = (code: string, section: string) => buildSubjectDocId(code, section);

/** Six distinct course codes per year level · semester (BSCS primary sections). */
const y1s1 = (section: 'BSCS 1-A' | 'BSCS 1-B', cap?: boolean) => [
  cci('CS101', 'Introduction to Computing', 1, '1', section, [], P1, cap ? { sectionCapacity: 8, courseCapacity: 24 } : undefined),
  cci('CS102', 'Computer Programming 1', 1, '1', section, ['CS101'], P1),
  cci('CS103', 'Discrete Mathematics', 1, '1', section, ['CS101'], P1),
  cci('GE101', 'Understanding the Self', 1, '1', section, [], P3),
  cci('CS110', 'Fundamentals of Information Technology', 1, '1', section, ['CS101'], P1),
  cci('GE112', 'Science, Technology and Society', 1, '1', section, ['CS103'], P3),
];

const y1s2 = (section: 'BSCS 1-A' | 'BSCS 1-B') => [
  cci('CS104', 'Computer Programming 2', 1, '2', section, ['CS102'], P1),
  cci('CS105', 'Computer Architecture', 1, '2', section, ['CS101', 'CS103'], P1),
  cci('CS106', 'Digital Logic Design', 1, '2', section, ['CS103', 'CS105'], P1),
  cci(
    'CS107',
    'Human-Computer Interaction',
    1,
    '2',
    section,
    ['CS104'],
    P1,
    { sectionCapacity: 2, courseCapacity: 6 }
  ),
  cci('GE102', 'Purposive Communication', 1, '2', section, ['GE101'], P3),
  cci('GE103', 'Ethics in Information Technology', 1, '2', section, ['GE101', 'CS102'], P3),
];

const y2s1 = (section: 'BSCS 2-A' | 'BSCS 2-B') => [
  cci('CS201', 'Data Structures and Algorithms', 2, '1', section, ['CS102', 'CS104'], P2),
  cci('CS202', 'Database Management Systems', 2, '1', section, ['CS201'], P2),
  cci('CS203', 'Object-Oriented Programming', 2, '1', section, ['CS104', 'CS106'], P2),
  cci('CS210', 'Design and Analysis of Algorithms', 2, '1', section, ['CS201'], P2),
  cci('CS211', 'Systems Analysis and Design', 2, '1', section, ['CS202'], P2),
  cci('GE201', 'Art Appreciation', 2, '1', section, ['CS104'], P3),
];

const y2s2 = (section: 'BSCS 2-A' | 'BSCS 2-B') => [
  cci('CS204', 'Computer Networks', 2, '2', section, ['CS201'], P2),
  cci(
    'CS205',
    'Web Systems Development',
    2,
    '2',
    section,
    ['CS202'],
    P2,
    section === 'BSCS 2-A' ? { sectionCapacity: 4, courseCapacity: 12 } : undefined
  ),
  cci('CS206', 'Mobile Application Development', 2, '2', section, ['CS205'], P2),
  cci('CS212', 'Cloud Computing', 2, '2', section, ['CS204'], P2),
  cci('GE202', 'Life and Works of Rizal', 2, '2', section, ['GE102'], P3),
  cci('CS213', 'IT Project Management', 2, '2', section, ['CS201', 'CS204'], P2),
];

const y3s1 = [
  cci('CS301', 'Software Engineering', 3, '1', 'BSCS 3-A', ['CS203', 'CS211'], P2),
  cci('CS302', 'Operating Systems', 3, '1', 'BSCS 3-A', ['CS201', 'CS212'], P3),
  cci('CS303', 'Capstone Project 1', 3, '1', 'BSCS 3-A', ['CS301'], P3),
  cci('CS310', 'Distributed Systems', 3, '1', 'BSCS 3-A', ['CS301', 'CS302'], P3),
  cci('CS311', 'Machine Learning Fundamentals', 3, '1', 'BSCS 3-A', ['CS302', 'CS210'], P3),
  cci('CS312', 'Parallel and Concurrent Programming', 3, '1', 'BSCS 3-A', ['CS303', 'CS310'], P3),
];

const y3s2 = [
  cci('CS304', 'Capstone Project 2', 3, '2', 'BSCS 3-A', ['CS303'], P3),
  cci('CS305', 'Information Assurance', 3, '2', 'BSCS 3-A', ['CS302', 'CS212'], P3),
  cci('CS399', 'CS Elective', 3, '2', 'BSCS 3-A', ['CS301', 'GE202'], P3),
  cci('CS313', 'Professional Practice in IT', 3, '2', 'BSCS 3-A', ['CS304'], P3),
  cci('CS314', 'Entrepreneurship for Computer Science', 3, '2', 'BSCS 3-A', ['CS305', 'CS313'], P3),
  cci('CS315', 'Advanced Database Topics', 3, '2', 'BSCS 3-A', ['CS399', 'CS202'], P3),
];

export const FOUNDATION_SUBJECTS: FoundationSubjectSeed[] = [
  ...y1s1('BSCS 1-A', true),
  ...y1s1('BSCS 1-B'),
  ...y1s2('BSCS 1-A'),
  ...y1s2('BSCS 1-B'),
  ...y2s1('BSCS 2-A'),
  ...y2s1('BSCS 2-B'),
  ...y2s2('BSCS 2-A'),
  ...y2s2('BSCS 2-B'),
  ...y3s1,
  ...y3s2,
  cci('IT301', 'Web Systems and Technologies', 3, '1', 'BSIT 3-A', ['CS205'], P3),

  // —— Other colleges ——
  {
    code: 'EE101',
    title: 'Engineering Fundamentals',
    units: 3,
    prerequisites: [],
    yearLevel: 1,
    semester: '1',
    status: 'open',
    college: CEA,
    section: 'BSEE 1-A',
    sectionCapacity: 35,
    courseCapacity: 105,
    professorStudentId: P3,
  },
  {
    code: 'MATH101',
    title: 'Calculus 1',
    units: 3,
    prerequisites: [],
    yearLevel: 1,
    semester: '1',
    status: 'open',
    college: CAS,
    section: 'CAS-C',
    sectionCapacity: 30,
    courseCapacity: 90,
    professorStudentId: P4,
  },
];

export function subjectIdFromSeed(s: FoundationSubjectSeed): string {
  return buildSubjectDocId(s.code, s.section);
}

/** Canonical Firestore subject doc ids written by foundation seed. */
export const FOUNDATION_SUBJECT_DOC_IDS: string[] = FOUNDATION_SUBJECTS.map((s) =>
  subjectIdFromSeed(s)
);

export type FoundationEnrollmentSeed = {
  studentId: string;
  subjectId: string;
  status: 'approved' | 'pending' | 'pending_drop';
  requestType?: 'initial' | 'add';
  academicYear?: string;
  semester?: string;
};

type Term = (typeof SEED_TERMS)[keyof typeof SEED_TERMS];

function en(
  studentId: string,
  code: string,
  section: string,
  status: FoundationEnrollmentSeed['status'],
  term?: Term,
  requestType: FoundationEnrollmentSeed['requestType'] = 'initial'
): FoundationEnrollmentSeed {
  return {
    studentId,
    subjectId: sid(code, section),
    status,
    requestType,
    ...(term ? { academicYear: term.academicYear, semester: term.semester } : {}),
  };
}

function enrollAll(
  studentId: string,
  section: string,
  codes: string[],
  status: FoundationEnrollmentSeed['status'],
  term?: Term,
  requestType?: FoundationEnrollmentSeed['requestType']
): FoundationEnrollmentSeed[] {
  return codes.map((code) => en(studentId, code, section, status, term, requestType));
}

function gradeAll(
  studentId: string,
  section: string,
  codes: string[],
  grade: number,
  term: Term
): FoundationGradeSeed[] {
  return codes.map((code) => gr(studentId, code, section, grade, 'posted', term));
}

/** Omit `term` on rows to stamp portal AY/sem from registrar config at seed time. */
const Y1_SEM2 = ['CS104', 'CS105', 'CS106', 'CS107', 'GE102', 'GE103'] as const;
const Y2_SEM2 = ['CS204', 'CS205', 'CS206', 'CS212', 'GE202', 'CS213'] as const;

function fillSection(
  code: string,
  section: string,
  studentIds: string[],
  term?: Term
): FoundationEnrollmentSeed[] {
  return studentIds.map((id) => en(id, code, section, 'approved', term));
}

/**
 * Portal-term demo matrix (enroll / add / drop / capacity / prereqs).
 * Omit term on rows to stamp current AY + sem from registrar config at seed time.
 */
export const FOUNDATION_ENROLLMENTS: FoundationEnrollmentSeed[] = [
  // —— Capacity fillers (CS107 back sections full; CS205 2-A full) ——
  ...fillSection('CS107', 'BSCS 1-A', ['2026-2001-A', '2026-2002-A'], undefined),
  ...fillSection('CS107', 'BSCS 1-B', ['2026-2006-A', '2023-4364-A'], undefined),
  ...fillSection('CS205', 'BSCS 2-A', [
    '2026-2001-A',
    '2026-2002-A',
    '2026-2006-A',
    '2026-2005-A',
  ], undefined),

  // CS101 1-A nearly full (legacy cap demo)
  en('2026-2001-A', 'CS101', 'BSCS 1-A', 'approved'),
  en('2026-2002-A', 'CS101', 'BSCS 1-A', 'approved'),
  en('2026-2006-A', 'CS101', 'BSCS 1-A', 'approved'),

  // Villanueva — Y1 pre-enrollment: all portal-sem courses still pending
  ...enrollAll('2026-2005-A', 'BSCS 1-A', [...Y1_SEM2], 'pending'),

  // Cruz — partial pre-enrollment (one approved, two pending)
  en('2026-2006-A', 'CS104', 'BSCS 1-A', 'approved'),
  en('2026-2006-A', 'CS105', 'BSCS 1-A', 'pending'),
  en('2026-2006-A', 'GE102', 'BSCS 1-A', 'pending'),

  en('2026-4001-A', 'EE101', 'BSEE 1-A', 'approved'),

  // Ana López — Y2: forward partial; back CS107 full (not enrolled)
  ...enrollAll(
    '2026-2003-A',
    'BSCS 1-A',
    ['CS101', 'CS102', 'CS103', 'GE101', 'CS110', 'GE112'],
    'approved',
    SEED_TERMS.y2324_1
  ),
  ...enrollAll(
    '2026-2003-A',
    'BSCS 1-A',
    ['CS104', 'CS105', 'CS106', 'GE102', 'GE103'],
    'approved',
    SEED_TERMS.y2324_2
  ),
  en('2026-2003-A', 'CS107', 'BSCS 1-A', 'approved', SEED_TERMS.y2324_2),
  ...enrollAll(
    '2026-2003-A',
    'BSCS 2-A',
    ['CS201', 'CS202', 'CS203', 'CS210', 'CS211', 'GE201'],
    'approved',
    SEED_TERMS.y2526_1
  ),
  ...enrollAll('2026-2003-A', 'BSCS 2-A', ['CS204', 'CS212', 'GE202', 'CS213'], 'approved'),

  // Devera / Santos — typical Y2 sem 2 load (2-A)
  ...enrollAll('2026-2001-A', 'BSCS 2-A', [...Y2_SEM2], 'approved'),
  ...enrollAll('2026-2002-A', 'BSCS 2-A', [...Y2_SEM2], 'approved'),

  // Reyes (IT) — pending grade on CS201; drop request on current IT301
  en('2026-3001-A', 'CS201', 'BSCS 2-A', 'approved', SEED_TERMS.y2526_1),
  en('2026-3001-A', 'IT301', 'BSIT 3-A', 'pending_drop'),

  // Tan — failed CS201; back CS106 pending add (1-B); CS205 in 2-B; drop pending on CS212
  ...enrollAll(
    '2026-2004-A',
    'BSCS 1-A',
    ['CS101', 'CS102', 'CS103', 'GE101', 'CS110', 'GE112'],
    'approved',
    SEED_TERMS.y2324_1
  ),
  ...enrollAll(
    '2026-2004-A',
    'BSCS 1-A',
    ['CS104', 'CS105', 'CS107', 'GE102', 'GE103'],
    'approved',
    SEED_TERMS.y2324_2
  ),
  en('2026-2004-A', 'CS106', 'BSCS 1-A', 'approved', SEED_TERMS.y2324_2),
  ...enrollAll(
    '2026-2004-A',
    'BSCS 2-A',
    ['CS202', 'CS203', 'CS210', 'CS211', 'GE201'],
    'approved',
    SEED_TERMS.y2526_1
  ),
  en('2026-2004-A', 'CS201', 'BSCS 2-A', 'approved', SEED_TERMS.y2526_1),
  en('2026-2004-A', 'CS205', 'BSCS 2-B', 'approved'),
  en('2026-2004-A', 'CS212', 'BSCS 2-A', 'pending_drop'),
  en('2026-2004-A', 'GE202', 'BSCS 2-A', 'approved'),
  en('2026-2004-A', 'CS106', 'BSCS 1-B', 'pending', undefined, 'add'),

  // Simon — full progression + pending drop on capstone
  ...enrollAll(
    '2023-4364-A',
    'BSCS 1-A',
    ['CS101', 'CS102', 'CS103', 'GE101', 'CS110', 'GE112'],
    'approved',
    SEED_TERMS.y2324_1
  ),
  ...enrollAll(
    '2023-4364-A',
    'BSCS 1-A',
    ['CS104', 'CS105', 'CS106', 'CS107', 'GE102', 'GE103'],
    'approved',
    SEED_TERMS.y2324_2
  ),
  ...enrollAll(
    '2023-4364-A',
    'BSCS 2-A',
    ['CS201', 'CS202', 'CS203', 'CS210', 'CS211', 'GE201'],
    'approved',
    SEED_TERMS.y2425_1
  ),
  ...enrollAll(
    '2023-4364-A',
    'BSCS 2-A',
    ['CS204', 'CS205', 'CS206', 'CS212', 'GE202', 'CS213'],
    'approved',
    SEED_TERMS.y2425_2
  ),
  ...enrollAll(
    '2023-4364-A',
    'BSCS 3-A',
    ['CS301', 'CS302', 'CS303', 'CS310', 'CS311', 'CS312'],
    'approved',
    SEED_TERMS.y2526_1
  ),
  ...enrollAll(
    '2023-4364-A',
    'BSCS 3-A',
    ['CS305', 'CS399', 'CS313', 'CS314', 'CS315'],
    'approved'
  ),
  en('2023-4364-A', 'CS304', 'BSCS 3-A', 'pending_drop'),
];

export type FoundationGradeSeed = {
  studentId: string;
  subjectId: string;
  grade: number;
  status: 'posted' | 'pending';
  academicYear?: string;
  semester?: string;
};

function gr(
  studentId: string,
  code: string,
  section: string,
  grade: number,
  status: FoundationGradeSeed['status'] = 'posted',
  term?: Term
): FoundationGradeSeed {
  return {
    studentId,
    subjectId: sid(code, section),
    grade,
    status,
    ...(term ? { academicYear: term.academicYear, semester: term.semester } : {}),
  };
}

export const FOUNDATION_GRADES: FoundationGradeSeed[] = [
  gr('2026-2001-A', 'CS101', 'BSCS 1-A', 1.25),
  gr('2026-2002-A', 'CS101', 'BSCS 1-A', 2.0),
  gr('2026-2002-A', 'CS201', 'BSCS 2-A', 1.5),
  gr('2026-2001-A', 'CS201', 'BSCS 2-A', 1.75),

  // Ana — failed CS107 (back, sections full); Y2 sem 1 clear; portal sem 2 partial posted
  ...gradeAll(
    '2026-2003-A',
    'BSCS 1-A',
    ['CS101', 'CS102', 'CS103', 'GE101', 'CS110', 'GE112'],
    2.25,
    SEED_TERMS.y2324_1
  ),
  ...gradeAll(
    '2026-2003-A',
    'BSCS 1-A',
    ['CS104', 'CS105', 'CS106', 'GE102', 'GE103'],
    2.0,
    SEED_TERMS.y2324_2
  ),
  gr('2026-2003-A', 'CS107', 'BSCS 1-A', 4.0, 'posted', SEED_TERMS.y2324_2),
  ...gradeAll(
    '2026-2003-A',
    'BSCS 2-A',
    ['CS201', 'CS202', 'CS203', 'CS210', 'CS211', 'GE201'],
    1.75,
    SEED_TERMS.y2526_1
  ),
  gr('2026-2003-A', 'CS204', 'BSCS 2-A', 2.0, 'posted'),
  gr('2026-2003-A', 'CS212', 'BSCS 2-A', 2.25, 'pending'),
  gr('2026-2003-A', 'GE202', 'BSCS 2-A', 2.0, 'posted'),
  gr('2026-2003-A', 'CS213', 'BSCS 2-A', 1.75, 'posted'),

  // Reyes — pending grade on CS201; posted IT301
  gr('2026-3001-A', 'CS201', 'BSCS 2-A', 2.25, 'pending', SEED_TERMS.y2526_1),
  gr('2026-3001-A', 'IT301', 'BSIT 3-A', 1.5, 'posted'),
  gr('2026-4001-A', 'EE101', 'BSEE 1-A', 2.75, 'posted'),

  // Tan — failed CS201 + CS106 (back retake); passed other terms
  ...gradeAll(
    '2026-2004-A',
    'BSCS 1-A',
    ['CS101', 'CS102', 'CS103', 'GE101', 'CS110', 'GE112'],
    2.0,
    SEED_TERMS.y2324_1
  ),
  ...gradeAll(
    '2026-2004-A',
    'BSCS 1-A',
    ['CS104', 'CS105', 'CS107', 'GE102', 'GE103'],
    1.75,
    SEED_TERMS.y2324_2
  ),
  gr('2026-2004-A', 'CS106', 'BSCS 1-A', 4.0, 'posted', SEED_TERMS.y2324_2),
  gr('2026-2004-A', 'CS201', 'BSCS 2-A', 4.0, 'posted', SEED_TERMS.y2526_1),
  gr('2026-2004-A', 'CS202', 'BSCS 2-A', 2.5, 'posted', SEED_TERMS.y2526_1),
  gr('2026-2004-A', 'CS203', 'BSCS 2-A', 2.25, 'posted', SEED_TERMS.y2526_1),
  gr('2026-2004-A', 'CS210', 'BSCS 2-A', 2.0, 'posted', SEED_TERMS.y2526_1),
  gr('2026-2004-A', 'CS211', 'BSCS 2-A', 2.75, 'posted', SEED_TERMS.y2526_1),
  gr('2026-2004-A', 'GE201', 'BSCS 2-A', 2.0, 'posted', SEED_TERMS.y2526_1),

  // Simon — passing record (6 per term)
  ...gradeAll(
    '2023-4364-A',
    'BSCS 1-A',
    ['CS101', 'CS102', 'CS103', 'GE101', 'CS110', 'GE112'],
    1.5,
    SEED_TERMS.y2324_1
  ),
  ...gradeAll(
    '2023-4364-A',
    'BSCS 1-A',
    ['CS104', 'CS105', 'CS106', 'CS107', 'GE102', 'GE103'],
    1.75,
    SEED_TERMS.y2324_2
  ),
  ...gradeAll(
    '2023-4364-A',
    'BSCS 2-A',
    ['CS201', 'CS202', 'CS203', 'CS210', 'CS211', 'GE201'],
    1.5,
    SEED_TERMS.y2425_1
  ),
  ...gradeAll(
    '2023-4364-A',
    'BSCS 2-A',
    ['CS204', 'CS205', 'CS206', 'CS212', 'GE202', 'CS213'],
    1.75,
    SEED_TERMS.y2425_2
  ),
  ...gradeAll(
    '2023-4364-A',
    'BSCS 3-A',
    ['CS301', 'CS302', 'CS303', 'CS310', 'CS311', 'CS312'],
    1.5,
    SEED_TERMS.y2526_1
  ),
];

/** Unique Firestore doc id per student + offering + term. */
export function foundationEnrollmentDocId(
  userId: string,
  subjectId: string,
  academicYear: string,
  semester: string
): string {
  const ay = academicYear.replace(/-/g, '');
  return `${userId}_${subjectId}_${ay}_${semester}`;
}

export function foundationGradeDocId(
  userId: string,
  subjectId: string,
  academicYear: string,
  semester: string
): string {
  return foundationEnrollmentDocId(userId, subjectId, academicYear, semester);
}

export function foundationLoginSummary(): string {
  const seen = new Set<string>();
  const lines: string[] = [];
  for (const u of FOUNDATION_USERS) {
    if (seen.has(u.studentId)) continue;
    seen.add(u.studentId);
    const note =
      u.studentId === '2023-4364-A'
        ? ' — 3rd yr; pending drop CS304'
        : u.studentId === '2026-2004-A'
          ? ' — back CS106; CS205 in 2-B; failed CS201'
          : u.studentId === '2026-2003-A'
            ? ' — back CS107 full; failed CS107'
            : u.studentId === '2026-2005-A'
              ? ' — pre-enroll pending (Y1 sem 2)'
              : u.studentId === '2026-2006-A'
                ? ' — partial pre-enroll'
                : u.studentId === '2026-3001-A'
                  ? ' — pending grade; pending drop'
                  : '';
    lines.push(`${u.studentId} / ${formatLoginPassword(u.surname)} (${u.role})${note}`);
  }
  return lines.join('\n');
}

export { COLLEGES };
