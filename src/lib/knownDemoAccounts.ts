import { collegeNameById } from './colleges';

const CCI = collegeNameById('CCI')!;

/**
 * Canonical demo / seed accounts. Passwords are derived from surname via getAuthPassword in authService.
 * Login uses ID Number + password (not email).
 */
export const KNOWN_DEMO_ACCOUNTS = [
  {
    studentId: '2026-0001-A',
    surname: 'Admin',
    firstName: 'Project',
    role: 'registrar' as const,
    maxUnits: 30,
  },
  {
    studentId: '2026-1001-A',
    surname: 'Sator',
    firstName: 'Julian',
    role: 'professor' as const,
    college: CCI,
    handlingSections: ['BSCS 1-A', 'BSCS 1-B', 'BSCS 2-A', 'BSCS 2-B'],
  },
  {
    studentId: '2026-1002-A',
    surname: 'Reyes',
    firstName: 'Maria',
    role: 'professor' as const,
    college: CCI,
    handlingSections: ['BSCS 2-A', 'BSCS 2-B', 'BSCS 3-A'],
  },
  {
    studentId: '2023-4364-A',
    surname: 'Simon',
    firstName: 'Joros',
    role: 'student' as const,
    yearLevel: 3,
    college: CCI,
    program: 'BS Computer Science',
    section: 'BSCS 3-A',
    maxUnits: 30,
  },
] as const;

/**
 * Firebase requires ≥6 characters. Short surnames use the standardized `surname1` pattern,
 * padded with trailing `1` only when still under six characters.
 */
export function formatLoginPassword(surname: string): string {
  const clean = surname.trim();
  if (clean.length >= 6) return clean;
  const base = `${clean}1`;
  return base.length >= 6 ? base : base.padEnd(6, '1');
}

export function getKnownDemoLoginSheet(): { id: string; password: string; role: string }[] {
  return KNOWN_DEMO_ACCOUNTS.map((a) => ({
    id: a.studentId,
    password: formatLoginPassword(a.surname),
    role: a.role,
  }));
}
