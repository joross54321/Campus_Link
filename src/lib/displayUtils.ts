/** Standard missing value in tables and detail rows (matches profile fields). */
export const EMPTY = '—';

/** Compact missing label for IDs and tight cells. */
export const EMPTY_SHORT = 'N/A';

export function displayText(
  value: string | number | null | undefined,
  fallback: string = EMPTY
): string {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'string' && !value.trim()) return fallback;
  return String(value);
}

export function parseDisplayName(full: string): { firstName: string; surname: string } {
  const t = full.trim();
  if (!t) return { firstName: '', surname: '' };
  const space = t.lastIndexOf(' ');
  if (space === -1) return { firstName: t, surname: '' };
  return { firstName: t.slice(0, space), surname: t.slice(space + 1) };
}
