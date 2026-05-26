import React, { useEffect, useState, useMemo } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { toast } from 'react-hot-toast';
import { db } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { useSystemConfig } from '../hooks/useSystemConfig';
import { Grade, Subject } from '../types';
import { subjectMatchesProfessor } from '../lib/enrollmentUtils';
import { formatSemesterFilterLabel, formatSemesterLabel } from '../lib/systemConfig';
import PageHeader from '../components/layout/PageHeader';
import ConfigRequiredState from '../components/ConfigRequiredState';
import { fetchUserRecord, formatUserDisplayName } from '../lib/userLookup';
import { useUrlSearchQuery } from '../hooks/useUrlSearchQuery';
import { matchesSearch } from '../lib/searchUtils';

type GradeRow = Grade & {
  subject?: Subject | null;
  studentName?: string;
  studentId?: string;
};

export default function ProfessorGrades() {
  const { profile, user } = useAuth();
  const { config, loading: configLoading } = useSystemConfig();
  const [rows, setRows] = useState<GradeRow[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [yearFilter, setYearFilter] = useState<string>('current');
  const [semFilter, setSemFilter] = useState<string>('current');
  const [sectionFilter, setSectionFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [searchQuery] = useUrlSearchQuery();

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      setLoading(true);
      try {
        const subSnap = await getDocs(collection(db, 'subjects'));
        const mine = subSnap.docs
          .map((d) => ({ id: d.id, ...d.data() } as Subject))
          .filter((s) => subjectMatchesProfessor(s, user.uid, profile?.handlingSections));
        setSubjects(mine);

        if (mine.length === 0) {
          setRows([]);
          return;
        }

        const gradeSnaps = await Promise.all(
          mine.map((subject) =>
            getDocs(
              query(
                collection(db, 'grades'),
                where('subjectId', '==', subject.id),
                where('status', '==', 'posted')
              )
            )
          )
        );

        const data: GradeRow[] = [];
        for (const snap of gradeSnaps) {
          for (const gd of snap.docs) {
            const grade = { id: gd.id, ...gd.data() } as Grade;
            const sub = mine.find((s) => s.id === grade.subjectId);
            const userData = await fetchUserRecord(grade.userId);
            data.push({
              ...grade,
              subject: sub ?? null,
              studentName: formatUserDisplayName(userData),
              studentId: userData?.studentId ? String(userData.studentId) : '—',
            });
          }
        }
        setRows(data);
      } catch {
        toast.error('Failed to load grades');
        setRows([]);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [user, profile]);

  const sections = useMemo(
    () => [...new Set(subjects.map((s) => s.section))].sort(),
    [subjects]
  );

  const filtered = useMemo(() => {
    if (!config) return rows;
    return rows.filter((g) => {
      const yearOk =
        yearFilter === 'all' ||
        (yearFilter === 'current'
          ? g.academicYear === config.currentAcademicYear
          : g.academicYear === yearFilter);
      const semOk =
        semFilter === 'all' ||
        (semFilter === 'current'
          ? g.semester === config.currentSemester
          : g.semester === semFilter);
      const sectionOk =
        sectionFilter === 'all' || g.subject?.section === sectionFilter;
      const searchOk = matchesSearch(
        searchQuery,
        g.studentName,
        g.studentId,
        g.subject?.code,
        g.subject?.title,
        g.subject?.section
      );
      return yearOk && semOk && sectionOk && searchOk;
    });
  }, [rows, yearFilter, semFilter, sectionFilter, config, searchQuery]);

  const years = useMemo(() => {
    const set = new Set(rows.map((r) => r.academicYear));
    return ['current', 'all', ...Array.from(set).sort()];
  }, [rows]);

  if (configLoading || loading) {
    return (
      <div className="flex justify-center py-32">
        <div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!config) {
    return (
      <ConfigRequiredState title="Grades overview unavailable until term is configured" />
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-20 md:pb-28">
      <PageHeader
        title="Student Grades"
        subtitle="Posted grades for your assigned sections"
        backTo="/professor"
      />

      <div className="flex flex-wrap gap-4 bg-surface p-6 rounded-2xl border border-border">
        <div>
          <label className="text-[10px] font-bold text-muted uppercase tracking-widest block mb-2">
            School year
          </label>
          <select
            value={yearFilter}
            onChange={(e) => setYearFilter(e.target.value)}
            className="px-4 py-2 rounded-xl border border-border text-sm font-bold"
          >
            <option value="current">Current ({config.currentAcademicYear})</option>
            <option value="all">All years</option>
            {years
              .filter((y) => y !== 'current' && y !== 'all')
              .map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
          </select>
        </div>
        <div>
          <label className="text-[10px] font-bold text-muted uppercase tracking-widest block mb-2">
            Semester
          </label>
          <select
            value={semFilter}
            onChange={(e) => setSemFilter(e.target.value)}
            className="px-4 py-2 rounded-xl border border-border text-sm font-bold"
          >
            <option value="current">
              Current ({formatSemesterFilterLabel(config.currentSemester)})
            </option>
            <option value="all">All semesters</option>
            <option value="1">1st sem</option>
            <option value="2">2nd sem</option>
            <option value="Summer">Summer</option>
          </select>
        </div>
        <div>
          <label className="text-[10px] font-bold text-muted uppercase tracking-widest block mb-2">
            Section
          </label>
          <select
            value={sectionFilter}
            onChange={(e) => setSectionFilter(e.target.value)}
            className="px-4 py-2 rounded-xl border border-border text-sm font-bold"
          >
            <option value="all">All sections</option>
            {sections.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-surface rounded-2xl border border-border overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-background text-[10px] font-bold uppercase tracking-widest text-muted">
            <tr>
              <th className="px-6 py-4">Student ID</th>
              <th className="px-6 py-4">Name</th>
              <th className="px-6 py-4">Course</th>
              <th className="px-6 py-4">Section</th>
              <th className="px-6 py-4">AY / Sem</th>
              <th className="px-6 py-4 text-right">Grade</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-16 text-center text-muted">
                  No posted grades match these filters.
                </td>
              </tr>
            ) : (
              filtered.map((g) => (
                <tr key={g.id} className="hover:bg-background/50">
                  <td className="px-6 py-4 font-mono text-xs">{g.studentId}</td>
                  <td className="px-6 py-4 font-bold text-primary">{g.studentName}</td>
                  <td className="px-6 py-4">
                    <span className="text-accent font-bold text-xs">{g.subject?.code}</span>
                    <span className="block text-muted text-xs">{g.subject?.title}</span>
                  </td>
                  <td className="px-6 py-4">{g.subject?.section}</td>
                  <td className="px-6 py-4 text-muted text-xs">
                    {g.academicYear} · {formatSemesterLabel(g.semester)}
                  </td>
                  <td className="px-6 py-4 text-right font-mono font-bold text-primary text-lg">
                    {typeof g.grade === 'number' && !Number.isNaN(g.grade)
                      ? g.grade.toFixed(2)
                      : '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
