import type { Subject } from '../types';
import type { UserProfile } from '../types';
import { COLLEGES, collegeNameById, collegeIdByName } from './colleges';

/** Legacy Initialize / demo labels → canonical Firestore college names. */
const COLLEGE_ALIASES: Record<string, string> = {
  'College of Engineering': 'CEA',
  'College of Computing': 'CCI',
  'College of Arts and Sciences': 'CAS',
};

export function normalizeCollegeName(college?: string): string | undefined {
  if (!college) return undefined;
  const trimmed = college.trim();
  const aliasId = COLLEGE_ALIASES[trimmed];
  if (aliasId) return collegeNameById(aliasId);
  if (collegeIdByName(trimmed)) return trimmed;
  const byId = collegeNameById(trimmed);
  if (byId) return byId;
  return trimmed;
}

export function normalizeUserProfile(u: UserProfile): UserProfile {
  return {
    ...u,
    college: normalizeCollegeName(u.college),
  };
}

/** One row per campus ID; prefer the Auth UID document when duplicates exist. */
export function dedupeUserProfiles(rows: UserProfile[]): UserProfile[] {
  const byCampusId = new Map<string, UserProfile>();

  for (const raw of rows) {
    const u = normalizeUserProfile(raw);
    const campusId = (u.studentId || u.uid || '').toUpperCase();
    if (!campusId) continue;

    const existing = byCampusId.get(campusId);
    if (!existing) {
      byCampusId.set(campusId, u);
      continue;
    }

    const uIsAuthDoc = Boolean(u.uid && u.uid !== campusId && u.uid.length > 12);
    const exIsAuthDoc = Boolean(existing.uid && existing.uid !== campusId && existing.uid.length > 12);
    if (uIsAuthDoc && !exIsAuthDoc) {
      byCampusId.set(campusId, { ...existing, ...u, uid: u.uid });
    } else if (!uIsAuthDoc && exIsAuthDoc) {
      byCampusId.set(campusId, { ...u, ...existing, uid: existing.uid });
    } else {
      byCampusId.set(campusId, { ...existing, ...u });
    }
  }

  return [...byCampusId.values()];
}

export function professorsForCollege(
  userList: UserProfile[],
  collegeId: string | undefined
): UserProfile[] {
  const collegeName = collegeId ? collegeNameById(collegeId) : undefined;
  if (!collegeName) return [];

  return userList.filter(
    (u) => u.role === 'professor' && normalizeCollegeName(u.college) === collegeName
  );
}

export function subjectsForCollege(
  subjects: Subject[],
  collegeId: string | undefined
): Subject[] {
  const collegeName = collegeId ? collegeNameById(collegeId) : undefined;
  if (!collegeName) return [];
  return subjects.filter((s) => normalizeCollegeName(s.college) === collegeName);
}

const PROGRAM_SECTION_HINTS: Record<string, RegExp[]> = {
  'BS Computer Science': [/^BSCS/i, /^BS\s*CS/i],
  'BS Information Technology': [/^BSIT/i, /^BS\s*IT/i],
  'BS Electrical Engineering': [/^BSEE/i, /^EE/i],
  'BS Data Science': [/^BSDS/i],
};

export function sectionMatchesProgram(section: string, program: string): boolean {
  const hints = PROGRAM_SECTION_HINTS[program];
  if (!hints?.length) return true;
  return hints.some((re) => re.test(section));
}

/** Sections for admin directory drill-down (from student profiles + course catalog). */
export function sectionsForProgram(
  userList: UserProfile[],
  subjects: Subject[],
  collegeId: string | undefined,
  program: string | undefined
): string[] {
  const collegeName = collegeId ? collegeNameById(collegeId) : undefined;
  if (!collegeName || !program) return [];

  const fromUsers = userList
    .filter(
      (u) =>
        u.role === 'student' &&
        normalizeCollegeName(u.college) === collegeName &&
        u.program === program &&
        Boolean(u.section)
    )
    .map((u) => u.section as string);

  const fromSubjects = subjects
    .filter(
      (s) =>
        normalizeCollegeName(s.college) === collegeName &&
        s.section &&
        sectionMatchesProgram(s.section, program)
    )
    .map((s) => s.section);

  return [...new Set([...fromUsers, ...fromSubjects])].sort();
}

export function studentsInDirectory(
  userList: UserProfile[],
  collegeId: string | undefined,
  program?: string,
  section?: string
): UserProfile[] {
  const collegeName = collegeId ? collegeNameById(collegeId) : undefined;
  if (!collegeName) return [];

  return userList.filter((u) => {
    if (u.role !== 'student' || normalizeCollegeName(u.college) !== collegeName) return false;
    if (program && u.program !== program) return false;
    if (section && u.section !== section) return false;
    return true;
  });
}

export function pendingCountForCollege(
  enrollments: { subjectId: string }[],
  subjects: Subject[],
  collegeId: string
): number {
  const collegeName = collegeId ? collegeNameById(collegeId) : undefined;
  if (!collegeName) return 0;
  return enrollments.filter((e) => {
    const sub = subjects.find((s) => s.id === e.subjectId);
    return sub && normalizeCollegeName(sub.college) === collegeName;
  }).length;
}

export function hasPendingForCollege(
  enrollments: { subjectId: string }[],
  subjects: Subject[],
  collegeId: string
): boolean {
  return pendingCountForCollege(enrollments, subjects, collegeId) > 0;
}

export { COLLEGES };
