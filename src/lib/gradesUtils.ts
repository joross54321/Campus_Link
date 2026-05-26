import { Grade, Subject, SystemConfig } from '../types';
import { formatSemesterLabel } from './systemConfig';

export type YearFilter = 'current' | 'all' | string;
export type SemFilter = 'current' | 'all' | '1' | '2' | 'Summer';

export type GradeWithSubject = Grade & { subject?: Subject | null };

/** Coerce Firestore / legacy values to a 1.0–5.0 scholastic grade. */
export function normalizeGradeScore(raw: unknown): number | null {
  if (raw == null || raw === '') return null;
  const n = typeof raw === 'number' ? raw : parseFloat(String(raw).trim());
  if (!Number.isFinite(n)) return null;
  if (n >= 1 && n <= 5) return Math.round(n * 100) / 100;
  if (n > 5 && n <= 100) {
    const gwa = 1 + (100 - n) * 0.04;
    return Math.round(gwa * 100) / 100;
  }
  if (n > 100 && n <= 500) {
    const scaled = n / 100;
    if (scaled >= 1 && scaled <= 5) return Math.round(scaled * 100) / 100;
  }
  return null;
}

export function formatGradeScore(raw: unknown): string {
  const n = normalizeGradeScore(raw);
  return n == null ? '—' : n.toFixed(2);
}

export function formatGwaDisplay(gwa: number | null | undefined): string {
  if (gwa == null) return '—';
  const n = typeof gwa === 'number' ? gwa : parseFloat(String(gwa));
  if (!Number.isFinite(n) || n < 1 || n > 5) return '—';
  return n.toFixed(2);
}

export function effectiveGradeTerm(
  g: GradeWithSubject,
  config: SystemConfig
): { academicYear: string; semester: string } {
  const semester =
    g.semester != null && String(g.semester).trim() !== ''
      ? String(g.semester)
      : g.subject?.semester != null
        ? String(g.subject.semester)
        : String(config.currentSemester);
  return {
    academicYear: g.academicYear?.trim() || config.currentAcademicYear,
    semester,
  };
}

export function filterGradesByTerm(
  grades: GradeWithSubject[],
  yearFilter: YearFilter,
  semFilter: SemFilter,
  config: SystemConfig
): GradeWithSubject[] {
  const currentYear = config.currentAcademicYear;
  const currentSem = String(config.currentSemester);

  return grades.filter((g) => {
    const { academicYear, semester } = effectiveGradeTerm(g, config);
    const yearOk =
      yearFilter === 'all' ||
      (yearFilter === 'current' ? academicYear === currentYear : academicYear === yearFilter);
    const semOk =
      semFilter === 'all' ||
      (semFilter === 'current' ? semester === currentSem : semester === String(semFilter));
    return yearOk && semOk;
  });
}

export function computeGwa(
  grades: GradeWithSubject[],
  unitsBySubject: Map<string, number>
): number | null {
  let totalPoints = 0;
  let totalUnits = 0;
  for (const g of grades) {
    const score = normalizeGradeScore(g.grade);
    if (score == null) continue;
    const units = unitsBySubject.get(g.subjectId) ?? g.subject?.units ?? 3;
    if (!Number.isFinite(units) || units <= 0) continue;
    totalPoints += score * units;
    totalUnits += units;
  }
  if (totalUnits === 0) return null;
  const gwa = totalPoints / totalUnits;
  return Math.round(gwa * 100) / 100;
}

export interface GwaDisplay {
  headline: string;
  gwa: number | null;
  meta: string;
  breakdown: { label: string; gwa: number | null }[];
}

function gradeStats(grades: GradeWithSubject[], unitsBySubject: Map<string, number>) {
  let units = 0;
  for (const g of grades) {
    units += unitsBySubject.get(g.subjectId) ?? 3;
  }
  const courses = grades.length;
  const meta =
    courses === 0
      ? 'No posted grades'
      : `${courses} course${courses === 1 ? '' : 's'} · ${units} unit${units === 1 ? '' : 's'}`;
  return { courses, units, meta };
}

function resolvedYear(yearFilter: YearFilter, config: SystemConfig): string {
  return yearFilter === 'current' ? config.currentAcademicYear : yearFilter;
}

function resolvedSem(semFilter: SemFilter, config: SystemConfig): string {
  return semFilter === 'current' ? String(config.currentSemester) : semFilter;
}

/** One primary GWA for the active filters; breakdown only when it adds clarity (no duplicate rows). */
export function buildGwaDisplay(
  grades: GradeWithSubject[],
  yearFilter: YearFilter,
  semFilter: SemFilter,
  config: SystemConfig,
  unitsBySubject: Map<string, number>
): GwaDisplay {
  const filtered = filterGradesByTerm(grades, yearFilter, semFilter, config);
  const gwa = computeGwa(filtered, unitsBySubject);
  const { meta } = gradeStats(filtered, unitsBySubject);
  const breakdown: GwaDisplay['breakdown'] = [];

  const yearAll = yearFilter === 'all';
  const semAll = semFilter === 'all';

  if (yearAll && semAll) {
    const years = [
      ...new Set(filtered.map((g) => effectiveGradeTerm(g, config).academicYear)),
    ].sort();
    for (const year of years) {
      const yearGrades = filtered.filter(
        (g) => effectiveGradeTerm(g, config).academicYear === year
      );
      breakdown.push({
        label: `AY ${year}`,
        gwa: computeGwa(yearGrades, unitsBySubject),
      });
    }
    return {
      headline: 'Cumulative GWA',
      gwa,
      meta,
      breakdown,
    };
  }

  if (!yearAll && semAll) {
    const year = resolvedYear(yearFilter, config);
    const yearGrades = filtered.filter(
      (g) => effectiveGradeTerm(g, config).academicYear === year
    );
    const sems = [
      ...new Set(yearGrades.map((g) => effectiveGradeTerm(g, config).semester)),
    ].sort();
    for (const sem of sems) {
      const semGrades = yearGrades.filter(
        (g) => effectiveGradeTerm(g, config).semester === sem
      );
      breakdown.push({
        label: formatSemesterLabel(sem),
        gwa: computeGwa(semGrades, unitsBySubject),
      });
    }
    return {
      headline: `AY ${year} GWA`,
      gwa,
      meta,
      breakdown: breakdown.length > 1 ? breakdown : [],
    };
  }

  if (yearAll && !semAll) {
    const sem = resolvedSem(semFilter, config);
    const years = [
      ...new Set(filtered.map((g) => effectiveGradeTerm(g, config).academicYear)),
    ].sort();
    for (const year of years) {
      const semGrades = filtered.filter((g) => {
        const term = effectiveGradeTerm(g, config);
        return term.academicYear === year && term.semester === sem;
      });
      if (semGrades.length === 0) continue;
      breakdown.push({
        label: `AY ${year}`,
        gwa: computeGwa(semGrades, unitsBySubject),
      });
    }
    return {
      headline: `${formatSemesterLabel(sem)} GWA (all years)`,
      gwa,
      meta,
      breakdown: breakdown.length > 1 ? breakdown : [],
    };
  }

  const year = resolvedYear(yearFilter, config);
  const sem = resolvedSem(semFilter, config);
  return {
    headline: `AY ${year} · ${formatSemesterLabel(sem)}`,
    gwa,
    meta,
    breakdown: [],
  };
}

/** @deprecated Use buildGwaDisplay */
export function buildGwaSummary(
  grades: GradeWithSubject[],
  yearFilter: YearFilter,
  semFilter: SemFilter,
  config: SystemConfig,
  unitsBySubject: Map<string, number>
) {
  const d = buildGwaDisplay(grades, yearFilter, semFilter, config, unitsBySubject);
  return [
    { label: d.headline, gwa: d.gwa, variant: 'hero' as const },
    ...d.breakdown.map((b) => ({ label: b.label, gwa: b.gwa, variant: 'row' as const })),
  ];
}

export function getGradeFilterOptions(grades: Grade[], config: SystemConfig) {
  const years = [
    'current',
    ...new Set(grades.map((g) => g.academicYear)),
  ].filter((v, i, a) => a.indexOf(v) === i);
  const semesters: SemFilter[] = ['current', '1', '2', 'Summer', 'all'];
  return { years, semesters, config };
}
