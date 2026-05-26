import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useSystemConfig } from '../hooks/useSystemConfig';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, getDoc, doc } from 'firebase/firestore';
import { Grade, Subject } from '../types';
import { toast } from 'react-hot-toast';
import PageHeader from '../components/layout/PageHeader';
import ConfigRequiredState from '../components/ConfigRequiredState';
import { motion } from 'motion/react';
import {
  filterGradesByTerm,
  buildGwaDisplay,
  formatGwaDisplay,
  formatGradeScore,
  YearFilter,
  SemFilter,
} from '../lib/gradesUtils';
import { formatSemesterFilterLabel, formatSemesterLabel } from '../lib/systemConfig';
import { useUrlSearchQuery } from '../hooks/useUrlSearchQuery';
import { subjectMatchesSearch } from '../lib/searchUtils';

/** Empty string when no GWA — avoids a large em dash in the hero. */
function gwaHeroValue(gwa: number | null | undefined): string {
  const text = formatGwaDisplay(gwa);
  return text === '—' ? '' : text;
}

export default function Grades() {
  const { profile } = useAuth();
  const { config, loading: configLoading } = useSystemConfig();
  const [grades, setGrades] = useState<(Grade & { subject?: Subject | null })[]>([]);
  const [yearFilter, setYearFilter] = useState<YearFilter>('current');
  const [semFilter, setSemFilter] = useState<SemFilter>('current');
  const [loading, setLoading] = useState(true);
  const [searchQuery] = useUrlSearchQuery();

  useEffect(() => {
    if (!profile) return;
    const load = async () => {
      try {
        const q = query(
          collection(db, 'grades'),
          where('userId', '==', profile.uid),
          where('status', '==', 'posted')
        );
        const snap = await getDocs(q);
        const data = await Promise.all(
          snap.docs.map(async (d) => {
            const grade = { id: d.id, ...d.data() } as Grade;
            const subjectSnap = await getDoc(doc(db, 'subjects', grade.subjectId));
            return {
              ...grade,
              subject: subjectSnap.exists() ? (subjectSnap.data() as Subject) : null,
            };
          })
        );
        setGrades(data);
      } catch {
        toast.error('Failed to load grades');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [profile]);

  const unitsBySubject = useMemo(() => {
    const m = new Map<string, number>();
    grades.forEach((g) => m.set(g.subjectId, g.subject?.units ?? 3));
    return m;
  }, [grades]);

  const yearOptions = useMemo(() => {
    const years = new Set(grades.map((g) => g.academicYear));
    return ['current', ...Array.from(years).sort()] as YearFilter[];
  }, [grades]);

  const termFiltered = config
    ? filterGradesByTerm(grades, yearFilter, semFilter, config)
    : grades;

  const filtered = searchQuery.trim()
    ? termFiltered.filter(
        (g) => g.subject && subjectMatchesSearch(g.subject, searchQuery)
      )
    : termFiltered;

  const gwaDisplay = config
    ? buildGwaDisplay(grades, yearFilter, semFilter, config, unitsBySubject)
    : null;

  const showTermOnCards = yearFilter === 'all' || semFilter === 'all';

  if (loading || configLoading) {
    return (
      <div className="flex justify-center py-32">
        <div className="w-8 h-8 border-2 border-primary/20 border-t-brand-blue rounded-full animate-spin" />
      </div>
    );
  }

  if (!config) {
    return <ConfigRequiredState title="Grades unavailable until term is configured" />;
  }

  return (
    <motion.div className="max-w-5xl mx-auto space-y-8 pb-20 md:pb-28">
      <PageHeader
        title="Scholastic Records"
        subtitle={`AY ${config.currentAcademicYear} · ${formatSemesterLabel(config.currentSemester)}`}
        backTo="/dashboard"
      />

      <div className="flex flex-wrap gap-3">
        <select
          value={yearFilter}
          onChange={(e) => setYearFilter(e.target.value as YearFilter)}
          className="px-4 py-2.5 rounded-xl border border-border bg-surface text-sm font-bold text-primary"
          aria-label="School year"
        >
          <option value="current">School year: {config.currentAcademicYear}</option>
          <option value="all">School year: All</option>
          {yearOptions
            .filter((y) => y !== 'all' && y !== 'current')
            .map((y) => (
              <option key={y} value={y}>
                School year: {y}
              </option>
            ))}
        </select>
        <select
          value={semFilter}
          onChange={(e) => setSemFilter(e.target.value as SemFilter)}
          className="px-4 py-2.5 rounded-xl border border-border bg-surface text-sm font-bold text-primary"
          aria-label="Semester"
        >
          <option value="current">
            Semester: {formatSemesterFilterLabel(config.currentSemester)}
          </option>
          <option value="1">Semester: {formatSemesterFilterLabel('1')}</option>
          <option value="2">Semester: {formatSemesterFilterLabel('2')}</option>
          <option value="Summer">Semester: {formatSemesterFilterLabel('Summer')}</option>
          <option value="all">Semester: All</option>
        </select>
      </div>

      {gwaDisplay && (
        <div
          className={
            gwaDisplay.breakdown.length > 0
              ? 'grid grid-cols-1 md:grid-cols-5 gap-4'
              : ''
          }
        >
          <div
            className={
              gwaDisplay.breakdown.length > 0
                ? 'md:col-span-2 bg-primary rounded-3xl px-6 py-8 sm:px-8 text-white flex flex-col items-center justify-center text-center'
                : 'bg-primary rounded-3xl px-6 py-8 sm:px-10 text-white flex flex-col items-center justify-center text-center'
            }
          >
            <p className="text-accent text-[10px] font-bold uppercase tracking-[0.2em]">
              {gwaDisplay.headline}
            </p>
            <p
              className="font-mono font-bold tabular-nums tracking-tight leading-none mt-3 mb-2 min-h-[1.15em] text-[clamp(1.75rem,4.5vw+0.25rem,2.75rem)] max-w-full"
              aria-label={
                gwaHeroValue(gwaDisplay.gwa)
                  ? `GWA ${gwaHeroValue(gwaDisplay.gwa)}`
                  : undefined
              }
            >
              {gwaHeroValue(gwaDisplay.gwa)}
            </p>
            <p className="text-white/50 text-xs font-medium max-w-sm">{gwaDisplay.meta}</p>
            <p className="text-white/35 text-[10px] mt-3 leading-relaxed max-w-sm">
              Lower is better · Weighted by subject units
            </p>
          </div>

          {gwaDisplay.breakdown.length > 0 && (
            <div className="md:col-span-3 bg-surface rounded-3xl border border-border divide-y divide-border overflow-hidden">
              <p className="px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-muted">
                Breakdown
              </p>
              {gwaDisplay.breakdown.map((row) => (
                <div
                  key={row.label}
                  className="flex items-center justify-between px-6 py-4 hover:bg-background/50 transition-colors"
                >
                  <span className="text-sm font-medium text-primary">{row.label}</span>
                  <span className="font-mono font-bold text-base tabular-nums text-primary min-w-[2.5rem] text-right">
                    {gwaHeroValue(row.gwa)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <section>
        <div className="flex items-baseline justify-between mb-4 px-1">
          <h2 className="text-sm font-bold uppercase tracking-widest text-muted">
            Posted grades
          </h2>
          <span className="text-xs text-muted font-medium">
            {filtered.length} course{filtered.length === 1 ? '' : 's'}
          </span>
        </div>

        {filtered.length === 0 ? (
          <p className="text-muted text-center py-16 bg-surface rounded-3xl border border-border">
            No posted grades match your filters.
          </p>
        ) : (
          <ul className="space-y-2">
            {filtered.map((g) => {
              const units = g.subject?.units ?? unitsBySubject.get(g.subjectId) ?? 3;
              return (
                <li key={g.id}>
                  <article className="flex items-center gap-4 bg-surface rounded-2xl border border-border px-5 py-4 hover:border-primary/20 transition-colors">
                    <div
                      className="shrink-0 w-14 h-14 rounded-xl bg-primary/5 border border-border flex items-center justify-center"
                      aria-hidden
                    >
                      <span className="font-mono text-base sm:text-lg font-bold tabular-nums text-primary">
                        {formatGradeScore(g.grade)}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-bold text-accent uppercase tracking-wider">
                        {g.subject?.code ?? '—'}
                      </p>
                      <p className="font-display font-bold text-primary truncate">
                        {g.subject?.title ?? 'Unknown subject'}
                      </p>
                      {showTermOnCards && (
                        <p className="text-xs text-muted mt-0.5">
                          AY {g.academicYear} · {formatSemesterLabel(g.semester)}
                        </p>
                      )}
                    </div>
                    <span className="shrink-0 text-xs font-bold text-muted tabular-nums">
                      {units} {units === 1 ? 'unit' : 'units'}
                    </span>
                  </article>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </motion.div>
  );
}
