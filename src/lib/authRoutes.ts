import { UserRole } from '../types';

export function getHomePathForRole(role?: UserRole | string): string {
  if (role === 'registrar') return '/admin';
  if (role === 'professor') return '/professor';
  return '/dashboard';
}
