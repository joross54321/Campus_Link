import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useSystemConfig } from '../hooks/useSystemConfig';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, getDoc, doc } from 'firebase/firestore';
import { Enrollment, Subject } from '../types';
import { enrollmentMatchesTerm } from '../lib/enrollmentUtils';
import { formatSemesterLabel } from '../lib/systemConfig';
import PageHeader from '../components/layout/PageHeader';
import ConfigRequiredState from '../components/ConfigRequiredState';
import {
  buildScheduleEvents,
  CALENDAR_END_HOUR,
  CALENDAR_START_HOUR,
  eventHeight,
  minutesToTop,
  SLOT_HEIGHT_PX,
  WEEKDAY_LABELS,
} from '../lib/classSchedule';
import { cn } from '../lib/utils';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { addDays, addWeeks, format, parseISO, startOfWeek, isValid } from 'date-fns';

const HOURS = Array.from(
  { length: CALENDAR_END_HOUR - CALENDAR_START_HOUR + 1 },
  (_, i) => CALENDAR_START_HOUR + i
);

export default function ClassSchedule() {
  const { profile } = useAuth();
  const { config, loading: configLoading } = useSystemConfig();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 0 }));
  const [load, setLoad] = useState<{ id: string; subject: Subject | null }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLoad = async () => {
      if (!profile || !config) {
        setLoading(false);
        return;
      }
      try {
        const snap = await getDocs(
          query(
            collection(db, 'enrollments'),
            where('userId', '==', profile.uid),
            where('status', '==', 'approved')
          )
        );
        const data = await Promise.all(
          snap.docs.map(async (d) => {
            const enrollment = { id: d.id, ...d.data() } as Enrollment;
            const subjectSnap = await getDoc(doc(db, 'subjects', enrollment.subjectId));
            return {
              id: enrollment.id,
              subject: subjectSnap.exists() ? (subjectSnap.data() as Subject) : null,
              enrollment,
            };
          })
        );
        setLoad(
          data
            .filter((row) => enrollmentMatchesTerm(row.enrollment, config))
            .map(({ id, subject }) => ({ id, subject }))
        );
      } finally {
        setLoading(false);
      }
    };
    void fetchLoad();
  }, [profile, config]);

  const events = useMemo(() => buildScheduleEvents(load), [load]);
  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );

  const termWeekOptions = useMemo(() => {
    const startStr = config?.semesterStartDate;
    const endStr = config?.semesterEndDate;
    if (!startStr || !endStr) return null;
    const termStart = parseISO(startStr);
    const termEnd = parseISO(endStr);
    if (!isValid(termStart) || !isValid(termEnd)) return null;
    const weeks: { value: string; label: string }[] = [];
    let cursor = startOfWeek(termStart, { weekStartsOn: 0 });
    let n = 1;
    while (cursor <= termEnd && n <= 22) {
      const weekEnd = addDays(cursor, 6);
      weeks.push({
        value: format(cursor, 'yyyy-MM-dd'),
        label: `Week ${n} · ${format(cursor, 'MMM d')} – ${format(weekEnd, 'MMM d, yyyy')}`,
      });
      cursor = addWeeks(cursor, 1);
      n += 1;
    }
    return weeks.length ? weeks : null;
  }, [config?.semesterStartDate, config?.semesterEndDate]);

  const weekPickerValue = format(weekStart, 'yyyy-MM-dd');

  const jumpToWeek = (isoDate: string) => {
    const parsed = parseISO(isoDate);
    if (isValid(parsed)) {
      setWeekStart(startOfWeek(parsed, { weekStartsOn: 0 }));
    }
  };

  if (loading || configLoading) {
    return (
      <div className="flex justify-center py-32">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-gold border-t-transparent" />
      </div>
    );
  }

  if (!config) {
    return <ConfigRequiredState title="Schedule unavailable until term is configured" />;
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-16">
      <PageHeader
        title="Class Schedule"
        subtitle={`AY ${config.currentAcademicYear} · ${formatSemesterLabel(config.currentSemester)}`}
        backTo="/services"
        feedbackOnBack
      />

      <div className="bg-white rounded-2xl border border-slate-100 p-5 flex flex-wrap items-end gap-4 shadow-sm">
        <div className="flex-1 min-w-[12rem]">
          <label
            htmlFor="schedule-week-select"
            className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-2"
          >
            Jump to week
          </label>
          {termWeekOptions ? (
            <select
              id="schedule-week-select"
              value={weekPickerValue}
              onChange={(e) => jumpToWeek(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-brand-blue bg-surface"
            >
              {termWeekOptions.map((w) => (
                <option key={w.value} value={w.value}>
                  {w.label}
                </option>
              ))}
            </select>
          ) : (
            <input
              id="schedule-week-select"
              type="date"
              value={weekPickerValue}
              onChange={(e) => jumpToWeek(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-brand-blue"
            />
          )}
        </div>
        <div>
          <label
            htmlFor="schedule-week-date"
            className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-2"
          >
            Or pick a date
          </label>
          <input
            id="schedule-week-date"
            type="date"
            value={weekPickerValue}
            onChange={(e) => jumpToWeek(e.target.value)}
            className="px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-brand-blue"
          />
        </div>
        <div className="flex items-center gap-2 pb-0.5">
          <button
            type="button"
            onClick={() => setWeekStart((d) => addDays(d, -7))}
            className="p-2.5 rounded-xl border border-slate-200 hover:border-brand-gold text-brand-blue"
            aria-label="Previous week"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            type="button"
            onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 0 }))}
            className="px-4 py-2.5 rounded-xl bg-brand-blue text-white text-[10px] font-bold uppercase tracking-widest hover:bg-brand-blue/90"
          >
            This week
          </button>
          <button
            type="button"
            onClick={() => setWeekStart((d) => addDays(d, 7))}
            className="p-2.5 rounded-xl border border-slate-200 hover:border-brand-gold text-brand-blue"
            aria-label="Next week"
          >
            <ChevronRight size={18} />
          </button>
        </div>
        <p className="w-full text-sm text-slate-500 pt-1 border-t border-slate-50">
          Showing{' '}
          <span className="font-bold text-brand-blue">
            {format(weekStart, 'MMM d')} – {format(addDays(weekStart, 6), 'MMM d, yyyy')}
          </span>
          {' '}· {load.length} course{load.length === 1 ? '' : 's'}
        </p>
      </div>

      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="grid grid-cols-[4rem_repeat(7,1fr)] border-b border-slate-100 bg-slate-50/80">
          <div className="p-3" />
          {weekDays.map((day, i) => (
            <div key={i} className="p-3 text-center border-l border-slate-100">
              <p className="text-[10px] font-bold uppercase text-slate-400">{WEEKDAY_LABELS[i]}</p>
              <p className="text-sm font-bold text-brand-blue">{format(day, 'd')}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-[4rem_repeat(7,1fr)] relative">
          <div className="border-r border-slate-100">
            {HOURS.map((h) => (
              <div
                key={h}
                className="text-[10px] font-mono text-slate-400 pr-2 text-right border-b border-slate-50"
                style={{ height: SLOT_HEIGHT_PX }}
              >
                {h === 12 ? '12 PM' : h < 12 ? `${h} AM` : `${h - 12} PM`}
              </div>
            ))}
          </div>

          {weekDays.map((_, dayIndex) => (
            <div
              key={dayIndex}
              className="relative border-l border-slate-100"
              style={{ height: HOURS.length * SLOT_HEIGHT_PX }}
            >
              {HOURS.map((h) => (
                <div
                  key={h}
                  className="border-b border-slate-50"
                  style={{ height: SLOT_HEIGHT_PX }}
                />
              ))}
              {events
                .filter((e) => e.dayOfWeek === dayIndex)
                .map((ev) => (
                  <div
                    key={ev.id}
                    className={cn(
                      'absolute left-1 right-1 rounded-lg px-2 py-1.5 text-white shadow-md overflow-hidden z-10 border border-white/20',
                      ev.color
                    )}
                    style={{
                      top: minutesToTop(ev.startMinutes),
                      height: eventHeight(ev.startMinutes, ev.endMinutes),
                    }}
                    title={`${ev.code} — ${ev.title}`}
                  >
                    <p className="text-[10px] font-bold font-mono leading-tight">{ev.code}</p>
                    <p className="text-[9px] leading-tight opacity-90 line-clamp-2">{ev.title}</p>
                    <p className="text-[8px] opacity-75 mt-0.5">{ev.room}</p>
                  </div>
                ))}
            </div>
          ))}
        </div>
      </div>

      {load.length === 0 && (
        <p className="text-center text-slate-400 text-sm">
          No approved courses this term. Complete enrollment to see your calendar.
        </p>
      )}
    </div>
  );
}
