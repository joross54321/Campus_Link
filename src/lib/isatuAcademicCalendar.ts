/**
 * ISAT-U / Philippine SUC academic calendar (CHED-style three-term year).
 * Dates follow the usual pattern: 1st sem Aug–Dec, 2nd sem Jan–May, Summer Jun–Jul.
 * Registrar may still override stored dates in system/config when the official memo differs.
 */

export type IsatuSemester = '1' | '2' | 'Summer';

export type IsatuTermSchedule = {
  currentSemester: IsatuSemester;
  currentAcademicYear: string;
  semesterStartDate: string;
  semesterEndDate: string;
  enrollmentStartDate: string;
  enrollmentEndDate: string;
  midtermDate: string;
  dropLockDate: string;
};

/** AY label for a calendar date (e.g. Aug 2025 → 2025-2026). */
export function academicYearFromDate(date: Date): string {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  if (month < 8) return `${year - 1}-${year}`;
  return `${year}-${year + 1}`;
}

export function parseAcademicYearStart(academicYear: string): number {
  const start = parseInt(academicYear.split('-')[0] ?? '', 10);
  return Number.isFinite(start) ? start : new Date().getFullYear();
}

function utcIso(year: number, month: number, day: number): string {
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0)).toISOString();
}

function dropLockFromMidterm(midtermIso: string): string {
  const mid = new Date(midtermIso);
  mid.setUTCDate(mid.getUTCDate() - 7);
  return mid.toISOString().slice(0, 10);
}

/** Official-style term boundaries for a given AY + semester. */
export function getIsatuTermSchedule(
  semester: IsatuSemester,
  academicYear: string
): IsatuTermSchedule {
  const y0 = parseInt(academicYear.split('-')[0] ?? '', 10) || new Date().getFullYear();
  const y1 = y0 + 1;

  if (semester === '1') {
    const midtermDate = utcIso(y0, 10, 15);
    return {
      currentSemester: '1',
      currentAcademicYear: academicYear,
      enrollmentStartDate: utcIso(y0, 7, 1),
      enrollmentEndDate: utcIso(y0, 8, 10),
      semesterStartDate: utcIso(y0, 8, 12),
      semesterEndDate: utcIso(y0, 12, 20),
      midtermDate,
      dropLockDate: dropLockFromMidterm(midtermDate),
    };
  }

  if (semester === '2') {
    const midtermDate = utcIso(y1, 3, 15);
    return {
      currentSemester: '2',
      currentAcademicYear: academicYear,
      enrollmentStartDate: utcIso(y0, 12, 15),
      enrollmentEndDate: utcIso(y1, 1, 10),
      semesterStartDate: utcIso(y1, 1, 13),
      semesterEndDate: utcIso(y1, 5, 30),
      midtermDate,
      dropLockDate: dropLockFromMidterm(midtermDate),
    };
  }

  const midtermDate = utcIso(y1, 6, 20);
  return {
    currentSemester: 'Summer',
    currentAcademicYear: academicYear,
    enrollmentStartDate: utcIso(y1, 5, 20),
    enrollmentEndDate: utcIso(y1, 5, 31),
    semesterStartDate: utcIso(y1, 6, 2),
    semesterEndDate: utcIso(y1, 7, 25),
    midtermDate,
    dropLockDate: dropLockFromMidterm(midtermDate),
  };
}

/** Which term the ISAT-U calendar says is active today. */
export function resolveCurrentTermFromCalendar(now = new Date()): {
  semester: IsatuSemester;
  academicYear: string;
} {
  const month = now.getMonth() + 1;
  const academicYear = academicYearFromDate(now);

  if (month >= 8) return { semester: '1', academicYear };
  if (month >= 6) return { semester: 'Summer', academicYear };
  return { semester: '2', academicYear };
}

export function getNextSemester(
  semester: string,
  academicYear: string
): { semester: IsatuSemester; academicYear: string } {
  if (semester === '1') return { semester: '2', academicYear };
  if (semester === '2') return { semester: 'Summer', academicYear };
  const [start] = academicYear.split('-').map(Number);
  const nextStart = (start || 2025) + 1;
  return { semester: '1', academicYear: `${nextStart}-${nextStart + 1}` };
}

/** Sortable index for comparing how far ahead/behind a term is. */
export function termSortIndex(academicYear: string, semester: string): number {
  const start = parseInt(academicYear.split('-')[0] ?? '', 10) || 0;
  const sem = semester === 'Summer' ? 2 : semester === '2' ? 1 : 0;
  return start * 3 + sem;
}

export function isPastTermEnd(semesterEndDate: string | undefined, now = new Date()): boolean {
  if (!semesterEndDate) return false;
  const end = new Date(semesterEndDate);
  if (Number.isNaN(end.getTime())) return false;
  return now > end;
}

export function isInEnrollmentWindow(
  schedule: Pick<IsatuTermSchedule, 'enrollmentStartDate' | 'enrollmentEndDate'>,
  now = new Date()
): boolean {
  const start = new Date(schedule.enrollmentStartDate);
  const end = new Date(schedule.enrollmentEndDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return false;
  return now >= start && now <= end;
}
