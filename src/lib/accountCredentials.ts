import { KNOWN_DEMO_ACCOUNTS, formatLoginPassword } from './knownDemoAccounts';
import { FOUNDATION_USERS, type FoundationUserSeed } from './foundationSeedData';

export type DemoCredential = {
  id: string;
  password: string;
  role: 'registrar' | 'professor' | 'student';
  firstName: string;
  surname: string;
  college?: string;
  program?: string;
  section?: string;
  /** Created by login-page Initialize (minimal seed). */
  fromInitialize: boolean;
  /** Created by registrar Foundation seed (full demo). */
  fromFoundation: boolean;
};

const AUTH_EMAIL_DOMAIN = 'campuslink.isatu.edu.ph';

/** Firebase Auth email for a campus ID (login UI still uses ID + password). */
export function authEmailForId(id: string): string {
  return `${id.trim().toLowerCase()}@${AUTH_EMAIL_DOMAIN}`;
}

function toCredential(
  user: { studentId: string; surname: string; firstName: string; role: string; college?: string; program?: string; section?: string },
  opts: { fromInitialize: boolean; fromFoundation: boolean }
): DemoCredential {
  return {
    id: user.studentId,
    password: formatLoginPassword(user.surname),
    role: user.role as DemoCredential['role'],
    firstName: user.firstName,
    surname: user.surname,
    ...(user.college ? { college: user.college } : {}),
    ...(user.program ? { program: user.program } : {}),
    ...(user.section ? { section: user.section } : {}),
    ...opts,
  };
}

const INITIALIZE_IDS = new Set(
  KNOWN_DEMO_ACCOUNTS.map((a) => a.studentId)
);

const foundationById = (): Map<string, FoundationUserSeed> => {
  const map = new Map<string, FoundationUserSeed>();
  for (const u of FOUNDATION_USERS) {
    map.set(u.studentId, u);
  }
  return map;
};

/** Accounts created by login-page Initialize. */
export function getInitializeCredentials(): DemoCredential[] {
  return KNOWN_DEMO_ACCOUNTS.map((a) =>
    toCredential(a, { fromInitialize: true, fromFoundation: false })
  );
}

/** All foundation-seed users plus registrar (deduped by campus ID). */
export function getFoundationCredentials(): DemoCredential[] {
  const registrar = KNOWN_DEMO_ACCOUNTS.find((a) => a.role === 'registrar')!;
  const users = [registrar, ...FOUNDATION_USERS];
  const seen = new Set<string>();
  const out: DemoCredential[] = [];
  for (const u of users) {
    if (seen.has(u.studentId)) continue;
    seen.add(u.studentId);
    out.push(
      toCredential(u, {
        fromInitialize: INITIALIZE_IDS.has(u.studentId),
        fromFoundation: true,
      })
    );
  }
  return out;
}

/** Full demo credential reference (registrar + foundation catalog). */
export function getFullDemoCredentials(): DemoCredential[] {
  return getFoundationCredentials();
}

export function formatCredentialLoginSummary(credentials: DemoCredential[] = getFullDemoCredentials()): string {
  return credentials
    .map((c) => `${c.id} / ${c.password} (${c.role})`)
    .join('\n');
}

/** Multiline sheet for foundation seed toast (excludes registrar). */
export function formatFoundationSeedLoginHint(): string {
  const foundationMap = foundationById();
  const lines: string[] = [];
  const seen = new Set<string>();
  for (const u of FOUNDATION_USERS) {
    if (seen.has(u.studentId)) continue;
    seen.add(u.studentId);
    const row = foundationMap.get(u.studentId)!;
    lines.push(`${row.studentId} / ${formatLoginPassword(row.surname)} (${row.role})`);
  }
  return lines.join('\n');
}

export function getRegistrarCredential(): DemoCredential {
  const registrar = KNOWN_DEMO_ACCOUNTS.find((a) => a.role === 'registrar')!;
  return toCredential(registrar, { fromInitialize: true, fromFoundation: true });
}
