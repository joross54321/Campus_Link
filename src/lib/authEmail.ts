/** Firebase Auth email for a campus ID (login UI still uses ID + password). */
export function campusAuthEmail(campusId: string): string {
  return `${campusId.toUpperCase().trim()}@campuslink.isatu.edu.ph`.toLowerCase();
}
