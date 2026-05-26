import type { Subject, UserProfile } from '../types';
import { normalizeSearchQuery, matchesSearch } from './searchUtils';

export type SearchSuggestionKind = 'student' | 'professor' | 'registrar' | 'subject';

export type SearchSuggestion = {
  id: string;
  kind: SearchSuggestionKind;
  label: string;
  hint?: string;
  keywords: string;
  navigateTo: string;
};

export function suggestionFromUser(user: UserProfile): SearchSuggestion {
  const name = `${user.firstName ?? ''} ${user.surname ?? ''}`.trim();
  const label = name || user.studentId;
  const roleLabel =
    user.role === 'registrar'
      ? 'Registrar'
      : user.role === 'professor'
        ? 'Faculty'
        : 'Student';

  return {
    id: `user-${user.uid}`,
    kind: user.role === 'professor' ? 'professor' : user.role === 'registrar' ? 'registrar' : 'student',
    label,
    hint: `${user.studentId} · ${roleLabel}${user.program ? ` · ${user.program}` : ''}`,
    keywords: [label, user.studentId, user.program, user.section, user.college, user.role]
      .filter(Boolean)
      .join(' '),
    navigateTo: `/admin?tab=users&userId=${encodeURIComponent(user.uid)}`,
  };
}

export function suggestionFromSubject(
  subject: Subject,
  role: 'student' | 'professor' | 'registrar',
  opts?: { canEnroll?: boolean }
): SearchSuggestion {
  const label = `${subject.code} — ${subject.title}`;
  const hint = `Sec ${subject.section} · ${subject.units} units · ${subject.college}`;

  let navigateTo = `/enrollment?q=${encodeURIComponent(subject.code)}`;
  if (role === 'professor') {
    navigateTo = `/professor/management/${subject.id}`;
  } else if (role === 'registrar') {
    navigateTo = `/admin?tab=approvals&q=${encodeURIComponent(subject.code)}`;
  } else if (!opts?.canEnroll) {
    navigateTo = `/study-load?q=${encodeURIComponent(subject.code)}`;
  }

  return {
    id: `subject-${subject.id}`,
    kind: 'subject',
    label,
    hint,
    keywords: [subject.code, subject.title, subject.section, subject.college].join(' '),
    navigateTo,
  };
}

export function scoreSuggestion(s: SearchSuggestion, query: string): number {
  const q = normalizeSearchQuery(query);
  if (!q) return 0;
  const label = s.label.toLowerCase();
  const hint = (s.hint ?? '').toLowerCase();
  const keys = s.keywords.toLowerCase();
  if (label.startsWith(q)) return 100;
  if (keys.split(/\s+/).some((w) => w.startsWith(q))) return 80;
  if (label.includes(q)) return 60;
  if (hint.includes(q)) return 40;
  if (keys.includes(q)) return 20;
  return 0;
}

export function filterAndRankSuggestions(
  items: SearchSuggestion[],
  query: string,
  limit = 8
): SearchSuggestion[] {
  const q = normalizeSearchQuery(query);
  if (!q) return [];

  return items
    .filter((s) => matchesSearch(query, s.label, s.hint, s.keywords))
    .map((s) => ({ s, score: scoreSuggestion(s, query) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.s.label.localeCompare(b.s.label))
    .slice(0, limit)
    .map((x) => x.s);
}

/** Split label for inline highlight of the matched substring. */
/** Value to put in `?q=` when a suggestion is picked. */
export function suggestionQueryValue(s: SearchSuggestion): string {
  if (s.kind === 'subject') {
    const code = s.label.split(' — ')[0]?.trim();
    return code || s.label;
  }
  const idPart = s.hint?.split(' · ')[0]?.trim();
  return idPart || s.label;
}

export function highlightParts(
  text: string,
  query: string
): { text: string; match: boolean }[] {
  const q = normalizeSearchQuery(query);
  if (!q) return [{ text, match: false }];
  const lower = text.toLowerCase();
  const idx = lower.indexOf(q);
  if (idx < 0) return [{ text, match: false }];
  return [
    { text: text.slice(0, idx), match: false },
    { text: text.slice(idx, idx + q.length), match: true },
    { text: text.slice(idx + q.length), match: false },
  ].filter((p) => p.text.length > 0);
}
