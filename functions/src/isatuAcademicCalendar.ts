/**
 * Mirror of src/lib/isatuAcademicCalendar.ts for Cloud Functions — keep in sync.
 */

export type IsatuSemester = '1' | '2' | 'Summer';

export function academicYearFromDate(date: Date): string {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  if (month < 8) return `${year - 1}-${year}`;
  return `${year}-${year + 1}`;
}

function utcIso(year: number, month: number, day: number): string {
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0)).toISOString();
}

function dropLockFromMidterm(midtermIso: string): string {
  const mid = new Date(midtermIso);
  mid.setUTCDate(mid.getUTCDate() - 7);
  return mid.toISOString().slice(0, 10);
}

export function getIsatuTermSchedule(semester: IsatuSemester, academicYear: string) {
  const y0 = parseInt(academicYear.split('-')[0] ?? '', 10) || new Date().getFullYear();
  const y1 = y0 + 1;

  if (semester === '1') {
    const midtermDate = utcIso(y0, 10, 15);
    return {
      currentSemester: '1' as const,
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
      currentSemester: '2' as const,
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
    currentSemester: 'Summer' as const,
    currentAcademicYear: academicYear,
    enrollmentStartDate: utcIso(y1, 5, 20),
    enrollmentEndDate: utcIso(y1, 5, 31),
    semesterStartDate: utcIso(y1, 6, 2),
    semesterEndDate: utcIso(y1, 7, 25),
    midtermDate,
    dropLockDate: dropLockFromMidterm(midtermDate),
  };
}

export function getNextSemester(semester: string, academicYear: string) {
  if (semester === '1') return { semester: '2' as IsatuSemester, academicYear };
  if (semester === '2') return { semester: 'Summer' as IsatuSemester, academicYear };
  const [start] = academicYear.split('-').map(Number);
  const nextStart = (start || 2025) + 1;
  return { semester: '1' as IsatuSemester, academicYear: `${nextStart}-${nextStart + 1}` };
}

export function isPastTermEnd(semesterEndDate: string | undefined, now = new Date()): boolean {
  if (!semesterEndDate) return false;
  const end = new Date(semesterEndDate);
  return !Number.isNaN(end.getTime()) && now > end;
}
