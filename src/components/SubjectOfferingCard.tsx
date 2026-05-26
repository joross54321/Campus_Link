import React from 'react';
import { Calendar, GraduationCap, Lock } from 'lucide-react';
import { Subject } from '../types';
import { SubjectEligibility, subjectIneligibilityLabel } from '../lib/enrollmentEligibility';
import { SystemConfig } from '../types';
import { UnitValue } from './UnitsDisplay';
import { cn } from '../lib/utils';

type Props = {
  subject: Subject;
  eligibility: SubjectEligibility;
  isSelected?: boolean;
  onToggle?: () => void;
  actionLabel?: string;
  compact?: boolean;
  config?: SystemConfig;
};

export default function SubjectOfferingCard({
  subject,
  eligibility,
  isSelected = false,
  onToggle,
  actionLabel = 'Add to pre-enrollment',
  compact = false,
  config,
}: Props) {
  const locked = !eligibility.eligible;
  const label = subjectIneligibilityLabel(
    eligibility.reasons,
    eligibility.missingPrerequisites,
    eligibility.scheduleKind,
    config,
    subject
  );

  if (compact) {
    return (
      <div
        className={cn(
          'bg-surface p-6 rounded-2xl border border-border flex flex-col md:flex-row md:items-center justify-between gap-4',
          locked && 'opacity-50'
        )}
      >
        <div>
          <p className="font-mono text-sm text-accent">{subject.code}</p>
          <p className="font-bold text-primary">{subject.title}</p>
          <p className="text-xs text-muted mt-1">
            Sec {subject.section} · {eligibility.sectionCount}/{eligibility.sectionCapacity} section
            · {eligibility.courseCount}/{eligibility.courseCapacity} course
          </p>
          {locked && <p className="text-xs text-danger mt-2 font-medium">{label}</p>}
        </div>
        <div className="flex items-center gap-4 shrink-0">
          <UnitValue value={subject.units} size="sm" />
          <button
            type="button"
            disabled={locked}
            onClick={onToggle}
            className={cn(
              'inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-[10px] uppercase tracking-widest',
              locked
                ? 'opacity-50 cursor-not-allowed border border-border text-muted'
                : 'bg-primary text-primary-foreground'
            )}
          >
            {locked ? <Lock size={14} /> : null}
            {locked ? 'Unavailable' : actionLabel}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      role="button"
      tabIndex={locked ? -1 : 0}
      onClick={() => !locked && onToggle?.()}
      onKeyDown={(e) => {
        if (!locked && (e.key === 'Enter' || e.key === ' ')) onToggle?.();
      }}
      className={cn(
        'bg-white p-8 rounded-[2.5rem] border border-slate-100 transition-all flex flex-col md:flex-row items-stretch gap-8 relative overflow-hidden',
        !locked && 'cursor-pointer group hover:border-slate-300 hover:translate-x-1',
        isSelected && !locked && 'border-brand-gold bg-brand-gold/[0.02] shadow-xl',
        locked && 'opacity-45 grayscale cursor-not-allowed'
      )}
    >
      <div className="w-1 md:w-2 bg-slate-50 group-hover:bg-brand-gold absolute left-0 inset-y-0 transition-colors" />
      <div className="flex-1 flex flex-col justify-between pl-2">
        <div>
          <div className="flex flex-wrap items-center gap-4 mb-4">
            <span className="text-sm font-bold text-brand-gold uppercase tracking-[0.2em]">
              {subject.code}
            </span>
            <div className="px-3 py-1 bg-slate-50 text-slate-400 rounded-full text-[9px] font-bold uppercase tracking-widest border border-slate-100">
              Sec {subject.section}
            </div>
            <div className="px-3 py-1 bg-slate-50 text-slate-500 rounded-full text-[9px] font-bold uppercase tracking-widest border border-slate-100">
              {eligibility.sectionCount}/{eligibility.sectionCapacity} sec ·{' '}
              {eligibility.courseCount}/{eligibility.courseCapacity} course
            </div>
          </div>
          <h4 className="text-2xl font-display font-bold text-brand-ink mb-4 tracking-tight leading-none">
            {subject.title}
          </h4>
        </div>
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-2 px-4 py-2 bg-brand-paper rounded-xl border border-slate-100 text-[11px] font-bold text-brand-blue">
            <Calendar size={14} className="text-brand-gold" />
            <span>Year {subject.yearLevel}</span>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-brand-paper rounded-xl border border-slate-100 text-[11px] font-bold text-brand-blue">
            <GraduationCap size={14} className="text-brand-gold" />
            <span>{subject.college}</span>
          </div>
        </div>
      </div>
      <div className="flex flex-col justify-between items-end gap-6 md:min-w-[160px] border-l border-slate-50 md:pl-8">
        <UnitValue value={subject.units} size="md" className="text-brand-ink" />
        {locked ? (
          <div className="flex flex-col items-end gap-2 w-full">
            <div className="flex items-center gap-2 text-rose-600 bg-rose-50 px-4 py-3 rounded-2xl w-full justify-center">
              <Lock size={16} />
              <span className="text-[10px] font-bold uppercase tracking-widest text-center">
                {label}
              </span>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggle?.();
            }}
            className={cn(
              'w-full py-4 rounded-2xl font-bold uppercase text-[10px] tracking-widest transition-all',
              isSelected
                ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                : 'bg-brand-gold text-brand-blue hover:shadow-xl'
            )}
          >
            {isSelected ? 'Selected' : actionLabel}
          </button>
        )}
      </div>
    </div>
  );
}
