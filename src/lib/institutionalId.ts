/** Institutional campus ID pattern: YYYY-XXXX-A (e.g. 2023-4364-A). */
export const INSTITUTIONAL_ID_PATTERN = /^\d{4}-\d{4}-[A-Z]$/;

export function isInstitutionalId(id: string): boolean {
  return INSTITUTIONAL_ID_PATTERN.test(id.trim().toUpperCase());
}

export function normalizeInstitutionalId(id: string): string {
  return id.trim().toUpperCase();
}
