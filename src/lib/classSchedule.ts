import type { Subject } from '../types';

export type ScheduleEvent = {
  id: string;
  title: string;
  code: string;
  section: string;
  room: string;
  /** 0 = Sunday … 6 = Saturday */
  dayOfWeek: number;
  startMinutes: number;
  endMinutes: number;
  color: string;
};

const COLORS = [
  'bg-brand-blue',
  'bg-emerald-600',
  'bg-violet-600',
  'bg-amber-600',
  'bg-rose-600',
  'bg-cyan-600',
  'bg-indigo-600',
];

const PATTERNS: { days: number[]; startHour: number; durationMin: number }[] = [
  { days: [1, 3, 5], startHour: 9, durationMin: 90 },
  { days: [2, 4], startHour: 10, durationMin: 90 },
  { days: [1, 3], startHour: 13, durationMin: 120 },
  { days: [2, 4], startHour: 14, durationMin: 120 },
  { days: [6], startHour: 8, durationMin: 180 },
];

function hashIndex(seed: string, mod: number): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h + seed.charCodeAt(i) * (i + 1)) % 9973;
  return h % mod;
}

export function buildScheduleEvents(
  enrollments: { id: string; subject: Subject | null }[]
): ScheduleEvent[] {
  const events: ScheduleEvent[] = [];
  enrollments.forEach((e, idx) => {
    if (!e.subject) return;
    const pattern = PATTERNS[hashIndex(e.subject.id, PATTERNS.length)];
    const color = COLORS[hashIndex(e.subject.code, COLORS.length)];
    const room = `Room ${100 + hashIndex(e.subject.section, 50)}`;
    pattern.days.forEach((day, dIdx) => {
      events.push({
        id: `${e.id}-${day}-${dIdx}`,
        title: e.subject!.title,
        code: e.subject!.code,
        section: e.subject!.section,
        room,
        dayOfWeek: day,
        startMinutes: pattern.startHour * 60,
        endMinutes: pattern.startHour * 60 + pattern.durationMin,
        color,
      });
    });
  });
  return events;
}

export const CALENDAR_START_HOUR = 7;
export const CALENDAR_END_HOUR = 19;
export const SLOT_HEIGHT_PX = 56;

export function minutesToTop(minutes: number): number {
  return ((minutes - CALENDAR_START_HOUR * 60) / 60) * SLOT_HEIGHT_PX;
}

export function eventHeight(startMinutes: number, endMinutes: number): number {
  return Math.max(((endMinutes - startMinutes) / 60) * SLOT_HEIGHT_PX, SLOT_HEIGHT_PX * 0.75);
}

export const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
