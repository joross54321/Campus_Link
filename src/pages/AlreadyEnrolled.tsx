import React from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Plus, Trash2, CheckCircle2 } from 'lucide-react';
import { useSystemConfig } from '../hooks/useSystemConfig';
import { useStudentEnrollmentStatus } from '../hooks/useStudentEnrollmentStatus';
import { formatSemesterLabel } from '../lib/systemConfig';
import PageHeader from '../components/layout/PageHeader';
import { cn } from '../lib/utils';

export default function AlreadyEnrolled() {
  const { config } = useSystemConfig();
  const { canRequestAdd, canRequestDrop } = useStudentEnrollmentStatus();

  return (
    <div className="max-w-2xl mx-auto space-y-10 pb-20">
      <PageHeader
        title="Already enrolled"
        subtitle={
          config
            ? `AY ${config.currentAcademicYear} · ${formatSemesterLabel(config.currentSemester)}`
            : undefined
        }
        backTo="/services"
      />

      <div className="bg-white rounded-3xl border border-slate-100 p-12 text-center shadow-sm space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto">
          <CheckCircle2 size={32} className="text-emerald-600" />
        </div>
        <h2 className="text-2xl font-display font-bold text-brand-blue">
          You are enrolled for this term
        </h2>
        <p className="text-slate-500 text-sm leading-relaxed max-w-md mx-auto">
          Pre-enrollment is only for students who are not yet enrolled. Use study load to view your
          courses, or add/drop during the open period (including back subjects).
        </p>

        <div className="flex flex-col sm:flex-row flex-wrap gap-3 justify-center pt-4">
          <Link
            to="/study-load"
            className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-brand-blue text-white font-bold text-[10px] uppercase tracking-widest"
          >
            <BookOpen size={14} />
            Study load
          </Link>
          <Link
            to="/study-load/add"
            className={cn(
              'inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl font-bold text-[10px] uppercase tracking-widest',
              canRequestAdd
                ? 'bg-brand-gold text-brand-blue'
                : 'border border-slate-200 text-slate-400 pointer-events-none opacity-60'
            )}
          >
            <Plus size={14} />
            Adding subjects
          </Link>
          <Link
            to="/study-load/drop"
            className={cn(
              'inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl border font-bold text-[10px] uppercase tracking-widest',
              canRequestDrop
                ? 'border-rose-200 text-rose-600 hover:bg-rose-50'
                : 'border-slate-200 text-slate-400 pointer-events-none opacity-60'
            )}
          >
            <Trash2 size={14} />
            Dropping subjects
          </Link>
        </div>
      </div>
    </div>
  );
}
