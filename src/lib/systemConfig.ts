import {
  doc,
  getDoc,
  runTransaction,
  Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import { SystemConfig } from '../types';
import {
  getIsatuTermSchedule,
  getNextSemester,
  isInEnrollmentWindow,
  isPastTermEnd,
  resolveCurrentTermFromCalendar,
  type IsatuSemester,
} from './isatuAcademicCalendar';
import { normalizeSemesterValue } from './studentEnrollments';

const CONFIG_REF = doc(db, 'system', 'config');

export function parseConfigDate(value?: string | Date): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function normalizeConfig(raw: Record<string, unknown>): SystemConfig {
  const midterm = raw.midtermDate;
  return {
    currentSemester: normalizeSemesterValue(raw.currentSemester ?? '1'),
    currentAcademicYear: String(raw.currentAcademicYear ?? '2025-2026'),
    midtermDate:
      typeof midterm === 'string'
        ? midterm
        : midterm instanceof Timestamp
          ? midterm.toDate().toISOString()
          : new Date().toISOString(),
    semesterStartDate: raw.semesterStartDate as string | undefined,
    semesterEndDate: raw.semesterEndDate as string | undefined,
    enrollmentStartDate: raw.enrollmentStartDate as string | undefined,
    enrollmentEndDate: raw.enrollmentEndDate as string | undefined,
    enrollmentOpen: raw.enrollmentOpen !== false,
    enrollmentPeriodForced: Boolean(raw.enrollmentPeriodForced),
    lastTransitionAt: raw.lastTransitionAt as string | undefined,
    transitionedBy: raw.transitionedBy as string | undefined,
    autoRejectStalePendingOnTransition: Boolean(raw.autoRejectStalePendingOnTransition),
    semesterAutomationEnabled: raw.semesterAutomationEnabled !== false,
    simulationDate:
      typeof raw.simulationDate === 'string' ? raw.simulationDate : undefined,
    dropLockDate:
      typeof raw.dropLockDate === 'string' ? raw.dropLockDate : undefined,
    allowPostEnrollmentAdds: Boolean(raw.allowPostEnrollmentAdds),
    allowPostEnrollmentDrops: Boolean(raw.allowPostEnrollmentDrops),
    simulationBaseline:
      raw.simulationBaseline &&
      typeof raw.simulationBaseline === 'object' &&
      typeof (raw.simulationBaseline as { savedAt?: string }).savedAt === 'string'
        ? (raw.simulationBaseline as SystemConfig['simulationBaseline'])
        : undefined,
  };
}

/** Effective "today" for portal time rules; uses registrar simulation date when set. */
export function getEffectiveNow(config?: SystemConfig | null): Date {
  const sim = config?.simulationDate;
  if (sim) {
    const d = parseConfigDate(sim);
    if (d) return d;
  }
  return new Date();
}

export async function fetchSystemConfig(): Promise<SystemConfig | null> {
  const snap = await getDoc(CONFIG_REF);
  if (!snap.exists()) return null;
  return normalizeConfig(snap.data());
}

export { getNextSemester } from './isatuAcademicCalendar';

function scheduleToConfigPatch(
  schedule: ReturnType<typeof getIsatuTermSchedule>,
  extra: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    currentSemester: schedule.currentSemester,
    currentAcademicYear: schedule.currentAcademicYear,
    semesterStartDate: schedule.semesterStartDate,
    semesterEndDate: schedule.semesterEndDate,
    enrollmentStartDate: schedule.enrollmentStartDate,
    enrollmentEndDate: schedule.enrollmentEndDate,
    midtermDate: schedule.midtermDate,
    dropLockDate: schedule.dropLockDate,
    ...extra,
  };
}

/** Build config dates for a term from the ISAT-U calendar (used on init and rollover). */
export function buildIsatuTermConfig(
  semester: IsatuSemester,
  academicYear: string,
  options?: { enrollmentOpen?: boolean }
): Record<string, unknown> {
  const schedule = getIsatuTermSchedule(semester, academicYear);
  return scheduleToConfigPatch(schedule, {
    enrollmentOpen: options?.enrollmentOpen ?? false,
  });
}

/** Registrar: align system/config with whichever term the ISAT-U calendar says is active today. */
export async function syncConfigToIsatuCalendar(): Promise<SystemConfig | null> {
  const snap = await getDoc(CONFIG_REF);
  if (!snap.exists()) return null;

  const now = new Date();
  const { semester, academicYear } = resolveCurrentTermFromCalendar(now);
  const schedule = getIsatuTermSchedule(semester, academicYear);
  const enrollmentOpen = isInEnrollmentWindow(schedule, now);

  const updated = scheduleToConfigPatch(schedule, {
    enrollmentOpen,
    lastTransitionAt: now.toISOString(),
    transitionedBy: 'isatu-calendar',
  });

  await runTransaction(db, async (tx) => {
    tx.set(CONFIG_REF, updated, { merge: true });
  });

  return normalizeConfig(updated);
}

function isEnrollmentCalendarOpen(
  config: SystemConfig,
  now = getEffectiveNow(config)
): boolean {
  const start = parseConfigDate(config.enrollmentStartDate);
  const end = parseConfigDate(config.enrollmentEndDate);
  if (!start || !end) return true;
  return now >= start && now <= end;
}

/** Initial pre-enrollment wizard (new students, no approved load yet). */
export function canRequestInitialEnrollment(
  config: SystemConfig,
  now = getEffectiveNow(config)
): boolean {
  if (config.enrollmentOpen === false) return false;
  if (config.enrollmentPeriodForced) return true;
  if (isSimulationActive(config)) return true;
  return isEnrollmentCalendarOpen(config, now);
}

/** Legacy alias for admin status chips. */
export function isEnrollmentWindowOpen(
  config: SystemConfig,
  now = getEffectiveNow(config)
): boolean {
  return canRequestInitialEnrollment(config, now);
}

/** Registrar mock calendar is active (system/config.simulationDate). */
export function isSimulationActive(config: SystemConfig): boolean {
  return Boolean(config.simulationDate?.trim());
}

/** Midterm −7 lock using effective (simulated) today. */
export function isMidtermDropLocked(
  config: SystemConfig,
  now = getEffectiveNow(config)
): boolean {
  const midterm = parseConfigDate(config.midtermDate);
  if (!midterm) return false;
  const lockAt = new Date(midterm);
  lockAt.setDate(lockAt.getDate() - 7);
  return now >= lockAt;
}

/**
 * Post-enrollment add/drop window (after classes begin, before midterm drop lock).
 * Not the pre-enrollment calendar (enrollmentStartDate / enrollmentEndDate).
 */
export function isAddDropPeriodOpen(
  config: SystemConfig,
  now = getEffectiveNow(config)
): boolean {
  if (config.enrollmentOpen === false) return false;
  if (config.allowPostEnrollmentAdds || config.allowPostEnrollmentDrops) {
    return !isMidtermDropLocked(config, now);
  }
  const semStart = parseConfigDate(config.semesterStartDate);
  if (!semStart) return false;
  if (now < semStart) return false;
  if (isMidtermDropLocked(config, now)) return false;
  if (isDropLocked(config.midtermDate, now, config)) return false;
  return true;
}

/** Study load — request add (add/drop period only, not pre-enrollment window). */
export function canRequestStudyLoadAdd(
  config: SystemConfig,
  now = getEffectiveNow(config)
): boolean {
  if (config.enrollmentOpen === false) return false;
  if (config.allowPostEnrollmentAdds) return !isMidtermDropLocked(config, now);
  return isAddDropPeriodOpen(config, now);
}

/** Study load — request drop (add/drop period: after classes start, before midterm lock). */
export function canRequestStudyLoadDrop(config: SystemConfig): boolean {
  if (config.enrollmentOpen === false) return false;
  if (config.allowPostEnrollmentDrops) {
    return !isMidtermDropLocked(config);
  }
  return isAddDropPeriodOpen(config);
}

export function getAddPeriodStatus(config: SystemConfig): {
  open: boolean;
  reason: string;
} {
  if (config.enrollmentOpen === false) {
    return { open: false, reason: 'Registrar closed enrollment' };
  }
  if (canRequestStudyLoadAdd(config)) {
    if (config.allowPostEnrollmentAdds) {
      return { open: true, reason: 'Add/drop simulation active' };
    }
    return { open: true, reason: 'Add period open (post-enrollment)' };
  }
  const semStart = parseConfigDate(config.semesterStartDate);
  const now = getEffectiveNow(config);
  if (semStart && now < semStart) {
    return { open: false, reason: 'Before semester start (add/drop not open yet)' };
  }
  if (isMidtermDropLocked(config)) {
    return { open: false, reason: 'Add period closed (midterm lockout)' };
  }
  return { open: false, reason: 'Add/drop period closed' };
}

export function getDropPeriodStatus(config: SystemConfig): {
  open: boolean;
  reason: string;
} {
  if (config.enrollmentOpen === false) {
    return { open: false, reason: 'Registrar closed enrollment' };
  }
  if (isMidtermDropLocked(config)) {
    return { open: false, reason: 'Within one week of midterm (lockout)' };
  }
  if (canRequestStudyLoadDrop(config)) {
    if (config.allowPostEnrollmentDrops) {
      return { open: true, reason: 'Add/drop simulation active' };
    }
    if (isSimulationActive(config)) {
      return { open: true, reason: 'Mock calendar active' };
    }
    return { open: true, reason: 'Drop period open' };
  }
  return { open: false, reason: 'Before semester start (classes not begun)' };
}

/** Active registrar simulation (any mock calendar override). */
export function isRegistrarEnrollmentOverride(config: SystemConfig): boolean {
  return Boolean(
    config.simulationDate ||
    config.enrollmentPeriodForced ||
    config.allowPostEnrollmentAdds ||
    config.allowPostEnrollmentDrops
  );
}

export function isDropLocked(
  midtermDate: string | Date,
  now = new Date(),
  config?: SystemConfig | null
): boolean {
  const effectiveNow = config ? getEffectiveNow(config) : now;
  if (config && isSimulationActive(config)) {
    return isMidtermDropLocked(config, effectiveNow);
  }
  if (config?.dropLockDate) {
    const lockAt = parseConfigDate(config.dropLockDate);
    if (lockAt) return effectiveNow >= lockAt;
  }
  const midterm = parseConfigDate(midtermDate);
  if (!midterm) return false;
  const lockAt = new Date(midterm);
  lockAt.setDate(lockAt.getDate() - 7);
  return effectiveNow >= lockAt;
}

export function getDropLockDate(midtermDate: string | Date): Date | null {
  const midterm = parseConfigDate(midtermDate);
  if (!midterm) return null;
  const lockAt = new Date(midterm);
  lockAt.setDate(lockAt.getDate() - 7);
  return lockAt;
}

function applyTermTransition(
  data: SystemConfig,
  semester: IsatuSemester,
  academicYear: string,
  now: Date,
  transitionedBy: string,
  enrollmentOpen = false
): SystemConfig {
  const schedule = getIsatuTermSchedule(semester, academicYear);
  const updated = {
    ...data,
    ...scheduleToConfigPatch(schedule, {
      enrollmentOpen,
      lastTransitionAt: now.toISOString(),
      transitionedBy,
    }),
  };
  return normalizeConfig(updated as Record<string, unknown>);
}

/**
 * Advance or catch up using the ISAT-U calendar.
 * Auto: after term end → next term; may loop until aligned with today's calendar term.
 * Manual: advance one term in sequence (registrar control).
 */
export async function maybeAutoTransitionSemester(
  manual = false
): Promise<{ transitioned: boolean; config: SystemConfig | null }> {
  const snap = await getDoc(CONFIG_REF);
  if (!snap.exists()) return { transitioned: false, config: null };

  let current = normalizeConfig(snap.data());
  const now = new Date();

  if (!manual && current.semesterAutomationEnabled === false) {
    return { transitioned: false, config: current };
  }

  if (manual) {
    let transitioned = false;
    let resultConfig = current;

    await runTransaction(db, async (tx) => {
      const fresh = await tx.get(CONFIG_REF);
      if (!fresh.exists()) return;
      const data = normalizeConfig(fresh.data());
      const n = getNextSemester(data.currentSemester, data.currentAcademicYear);
      const nextConfig = applyTermTransition(
        data,
        n.semester,
        n.academicYear,
        now,
        'manual',
        false
      );
      tx.set(CONFIG_REF, nextConfig, { merge: true });
      resultConfig = nextConfig;
      transitioned = true;
    });

    return { transitioned, config: resultConfig };
  }

  let transitioned = false;
  let resultConfig = current;
  const maxSteps = 6;

  for (let step = 0; step < maxSteps; step++) {
    if (!isPastTermEnd(current.semesterEndDate, now)) break;

    let stepDone = false;

    await runTransaction(db, async (tx) => {
      const fresh = await tx.get(CONFIG_REF);
      if (!fresh.exists()) return;
      const data = normalizeConfig(fresh.data());

      if (data.semesterAutomationEnabled === false) {
        resultConfig = data;
        return;
      }

      if (!isPastTermEnd(data.semesterEndDate, now)) {
        resultConfig = data;
        return;
      }

      const target = getNextSemester(data.currentSemester, data.currentAcademicYear);
      const nextConfig = applyTermTransition(
        data,
        target.semester,
        target.academicYear,
        now,
        'auto',
        false
      );
      tx.set(CONFIG_REF, nextConfig, { merge: true });
      resultConfig = nextConfig;
      stepDone = true;
      transitioned = true;
    });

    if (!stepDone) break;
    current = resultConfig;
  }

  return { transitioned, config: resultConfig };
}

export function formatSemesterLabel(sem: string): string {
  if (sem === '1') return '1st sem';
  if (sem === '2') return '2nd sem';
  if (sem === 'Summer') return 'Summer';
  return sem;
}

/** Short labels for filter dropdowns (avoids duplicating "2nd sem" vs "2nd"). */
export function formatSemesterFilterLabel(sem: string): string {
  if (sem === '1') return '1st';
  if (sem === '2') return '2nd';
  if (sem === 'Summer') return 'Summer';
  return sem;
}
