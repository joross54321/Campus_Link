import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { toast } from 'react-hot-toast';
import { db } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { Subject } from '../types';
import {
  subjectMatchesProfessor,
  getProfessorFilterOptions,
} from '../lib/enrollmentUtils';
import { GraduationCap, ChevronRight } from 'lucide-react';
import PageHeader from '../components/layout/PageHeader';
import { useUrlSearchQuery } from '../hooks/useUrlSearchQuery';
import { filterSubjectsBySearch } from '../lib/searchUtils';

export default function ProfessorSubjects() {
  const { profile, user } = useAuth();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [yearFilter, setYearFilter] = useState<number | 'all'>('all');
  const [sectionFilter, setSectionFilter] = useState<string>('all');
  const [catalog, setCatalog] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery] = useUrlSearchQuery();

  const reload = async () => {
    if (!user) return;
    const snap = await getDocs(collection(db, 'subjects'));
    const all = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Subject));
    setCatalog(all);
    setSubjects(
      all.filter((s) =>
        subjectMatchesProfessor(s, user.uid, profile?.handlingSections)
      )
    );
    setLoading(false);
  };

  useEffect(() => {
    void reload();
  }, [user, profile]);

  const appendable = catalog.filter(
    (s) =>
      profile?.handlingSections?.includes(s.section) &&
      s.professorId !== user?.uid &&
      !subjects.some((mine) => mine.id === s.id)
  );

  const { yearLevels, sections } = useMemo(
    () => getProfessorFilterOptions(subjects),
    [subjects]
  );

  const filtered = filterSubjectsBySearch(
    subjects.filter((s) => {
      if (yearFilter !== 'all' && s.yearLevel !== yearFilter) return false;
      if (sectionFilter !== 'all' && s.section !== sectionFilter) return false;
      return true;
    }),
    searchQuery
  );

  if (loading) {
    return (
      <div className="flex justify-center py-32">
        <div className="w-8 h-8 border-2 border-brand-blue/20 border-t-brand-blue rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-10 pb-20 md:pb-28">
      <PageHeader
        title="My Subjects"
        subtitle="Assigned courses only"
        backTo="/professor"
      />

      <div className="flex flex-wrap gap-4">
        <select
          value={yearFilter === 'all' ? 'all' : String(yearFilter)}
          onChange={(e) =>
            setYearFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))
          }
          className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-bold"
        >
          <option value="all">All year levels</option>
          {yearLevels.map((y) => (
            <option key={y} value={y}>
              Year {y}
            </option>
          ))}
        </select>
        <select
          value={sectionFilter}
          onChange={(e) => setSectionFilter(e.target.value)}
          className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-bold"
        >
          <option value="all">All sections</option>
          {sections.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <p className="text-slate-400 text-center py-20">No assigned subjects match these filters.</p>
      ) : (
        <div className="grid gap-4">
          {filtered.map((s) => (
            <Link
              key={s.id}
              to={`/professor/management/${s.id}`}
              className="bg-white p-6 rounded-2xl border border-slate-100 flex items-center justify-between hover:border-brand-gold/40 transition-all group"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-brand-blue/5 flex items-center justify-center">
                  <GraduationCap className="text-brand-blue" size={22} />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-brand-gold uppercase tracking-widest">
                    {s.code} · {s.section}
                  </p>
                  <h3 className="text-lg font-display font-bold text-brand-blue">{s.title}</h3>
                  <p className="text-xs text-slate-400">
                    Year {s.yearLevel} · Sem {s.semester} · {s.units} units
                  </p>
                </div>
              </div>
              <ChevronRight className="text-slate-300 group-hover:text-brand-gold" />
            </Link>
          ))}
        </div>
      )}

      {appendable.length > 0 && (
        <div className="mt-12 pt-10 border-t border-slate-100">
          <h3 className="text-lg font-display font-bold text-brand-blue mb-4">Add instructional assets</h3>
          <p className="text-sm text-slate-500 mb-6">
            Sections you handle with no assigned instructor yet can be added to your profile grid.
          </p>
          <div className="grid gap-3">
            {appendable.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between p-4 rounded-2xl border border-slate-100 bg-slate-50"
              >
                <div>
                  <p className="text-[10px] font-bold text-brand-gold uppercase">{s.code} · {s.section}</p>
                  <p className="font-bold text-brand-blue">{s.title}</p>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    if (!user) return;
                    try {
                      await updateDoc(doc(db, 'subjects', s.id), { professorId: user.uid });
                      toast.success('Subject added to your load');
                      await reload();
                    } catch {
                      toast.error('Could not assign subject');
                    }
                  }}
                  className="px-4 py-2 rounded-xl bg-brand-blue text-white text-[10px] font-bold uppercase tracking-widest"
                >
                  Add to My Subjects
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
