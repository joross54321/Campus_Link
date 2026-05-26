import type { Subject } from '../types';
import type { UserProfile } from '../types';

export function normalizeSearchQuery(query: string): string {
  return query.trim().toLowerCase();
}

/** True when query is empty or any field contains the query (case-insensitive). */
export function matchesSearch(
  query: string,
  ...fields: (string | number | undefined | null)[]
): boolean {
  const n = normalizeSearchQuery(query);
  if (!n) return true;
  return fields.some((f) => String(f ?? '').toLowerCase().includes(n));
}

export function subjectMatchesSearch(
  subject: Pick<Subject, 'code' | 'title' | 'section' | 'college'>,
  query: string
): boolean {
  return matchesSearch(
    query,
    subject.code,
    subject.title,
    subject.section,
    subject.college
  );
}

export function userProfileMatchesSearch(user: UserProfile, query: string): boolean {
  return matchesSearch(
    query,
    user.firstName,
    user.surname,
    `${user.firstName ?? ''} ${user.surname ?? ''}`,
    user.studentId,
    user.program,
    user.section,
    user.college,
    user.role,
    user.uid
  );
}

export function filterSubjectsBySearch<T extends Pick<Subject, 'code' | 'title' | 'section' | 'college'>>(
  items: T[],
  query: string
): T[] {
  const n = normalizeSearchQuery(query);
  if (!n) return items;
  return items.filter((s) => subjectMatchesSearch(s, query));
}

export function filterUsersBySearch(users: UserProfile[], query: string): UserProfile[] {
  const n = normalizeSearchQuery(query);
  if (!n) return users;
  return users.filter((u) => userProfileMatchesSearch(u, query));
}
