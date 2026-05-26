import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

const PARAM = 'q';

/** Sync local search text with `?q=` in the URL (shareable, works with global header search). */
export function useUrlSearchQuery() {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get(PARAM) ?? '';

  const setQuery = useCallback(
    (value: string) => {
      const next = new URLSearchParams(searchParams);
      const trimmed = value.trim();
      if (trimmed) next.set(PARAM, trimmed);
      else next.delete(PARAM);
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  return [query, setQuery] as const;
}

export const SEARCHABLE_PATHS = [
  '/enrollment',
  '/study-load',
  '/study-load/add',
  '/study-load/drop',
  '/grades',
  '/schedule',
  '/services',
  '/dashboard',
  '/professor',
  '/professor/subjects',
  '/professor/grades',
  '/admin',
] as const;

export function isSearchablePath(pathname: string): boolean {
  return SEARCHABLE_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
}

export function defaultSearchPath(
  role: string | undefined,
  canPreEnroll: boolean
): { pathname: string; search: string } {
  if (role === 'registrar') return { pathname: '/admin', search: 'tab=users' };
  if (role === 'professor') return { pathname: '/professor/subjects', search: '' };
  if (role === 'student' && canPreEnroll) return { pathname: '/enrollment', search: '' };
  if (role === 'student') return { pathname: '/study-load', search: '' };
  return { pathname: '/dashboard', search: '' };
}
