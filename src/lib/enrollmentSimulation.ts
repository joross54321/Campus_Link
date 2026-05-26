import { SystemConfig } from '../types';
import {
  canRequestStudyLoadAdd,
  canRequestStudyLoadDrop,
  getEffectiveNow,
  isEnrollmentWindowOpen,
  parseConfigDate,
} from './systemConfig';
import { getEnrollmentBlockReason } from './enrollmentUtils';
import type { Enrollment } from '../types';

export type SimulationPresetId =
  | 'enrollment_window'
  | 'add_drop_period'
  | 'drop_locked'
  | 'restore_baseline'
  | 'clear_simulation';

export interface SimulationBaseline {
  simulationDate?: string | null;
  enrollmentOpen?: boolean;
  enrollmentPeriodForced?: boolean;
  allowPostEnrollmentAdds?: boolean;
  allowPostEnrollmentDrops?: boolean;
  dropLockDate?: string;
  savedAt: string;
}

export interface EnrollmentSimulationStatus {
  effectiveNow: Date;
  usingSimulation: boolean;
  enrollmentWindowOpen: boolean;
  dropLocked: boolean;
  addDropPeriodActive: boolean;
  allowPostEnrollmentAdds: boolean;
  hasBaseline: boolean;
  enrollmentRange?: { start: Date; end: Date };
  dropLockAt?: Date | null;
}

function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

function midpoint(start: Date, end: Date): Date {
  return new Date((start.getTime() + end.getTime()) / 2);
}

export function getEnrollmentSimulationStatus(
  config: SystemConfig
): EnrollmentSimulationStatus {
  const effectiveNow = getEffectiveNow(config);
  const start = parseConfigDate(config.enrollmentStartDate);
  const end = parseConfigDate(config.enrollmentEndDate);
  const semStart = parseConfigDate(config.semesterStartDate);
  const dropLocked = !canRequestStudyLoadDrop(config);
  const enrollmentWindowOpen = isEnrollmentWindowOpen(config, effectiveNow);
  const addDropPeriodActive =
    canRequestStudyLoadAdd(config, effectiveNow) ||
    canRequestStudyLoadDrop(config);

  return {
    effectiveNow,
    usingSimulation: Boolean(config.simulationDate),
    enrollmentWindowOpen,
    dropLocked,
    addDropPeriodActive,
    allowPostEnrollmentAdds: Boolean(config.allowPostEnrollmentAdds),
    hasBaseline: Boolean(config.simulationBaseline?.savedAt),
    enrollmentRange:
      start && end ? { start, end } : undefined,
    dropLockAt: config.midtermDate
      ? (() => {
          const m = parseConfigDate(config.midtermDate);
          if (!m) return null;
          const lock = new Date(m);
          lock.setDate(lock.getDate() - 7);
          return lock;
        })()
      : null,
  };
}

export function studentCanTestWizard(
  enrollments: Enrollment[],
  config: SystemConfig,
  role?: string
): boolean {
  return getEnrollmentBlockReason(enrollments, config, role) === null;
}

export function buildSimulationBaseline(config: SystemConfig): SimulationBaseline {
  return {
    simulationDate: config.simulationDate ?? null,
    enrollmentOpen: config.enrollmentOpen,
    enrollmentPeriodForced: config.enrollmentPeriodForced ?? false,
    allowPostEnrollmentAdds: config.allowPostEnrollmentAdds ?? false,
    allowPostEnrollmentDrops: config.allowPostEnrollmentDrops ?? false,
    dropLockDate: config.dropLockDate,
    savedAt: new Date().toISOString(),
  };
}

export function presetPatch(
  config: SystemConfig,
  preset: SimulationPresetId,
  options?: { saveBaseline?: boolean }
): Record<string, unknown> {
  const saveBaseline = options?.saveBaseline ?? !config.simulationBaseline?.savedAt;
  const baseline =
    saveBaseline && preset !== 'restore_baseline' && preset !== 'clear_simulation'
      ? buildSimulationBaseline(config)
      : config.simulationBaseline;

  if (preset === 'restore_baseline') {
    const b = config.simulationBaseline;
    if (!b?.savedAt) {
      return {
        simulationDate: null,
        allowPostEnrollmentAdds: false,
        allowPostEnrollmentDrops: false,
        enrollmentPeriodForced: false,
        simulationBaseline: null,
      };
    }
    return {
      simulationDate: b.simulationDate ?? null,
      enrollmentOpen: b.enrollmentOpen,
      enrollmentPeriodForced: b.enrollmentPeriodForced ?? false,
      allowPostEnrollmentAdds: b.allowPostEnrollmentAdds ?? false,
      allowPostEnrollmentDrops: b.allowPostEnrollmentDrops ?? false,
      ...(b.dropLockDate ? { dropLockDate: b.dropLockDate } : {}),
      simulationBaseline: null,
    };
  }

  if (preset === 'clear_simulation') {
    return {
      simulationDate: null,
      allowPostEnrollmentAdds: false,
      allowPostEnrollmentDrops: false,
      enrollmentPeriodForced: false,
      simulationBaseline: null,
    };
  }

  const start = parseConfigDate(config.enrollmentStartDate);
  const end = parseConfigDate(config.enrollmentEndDate);
  const semStart = parseConfigDate(config.semesterStartDate);
  const midterm = parseConfigDate(config.midtermDate);

  let simulationDate: string;
  let enrollmentOpen = true;
  let allowPostEnrollmentAdds = false;
  let allowPostEnrollmentDrops = false;
  let enrollmentPeriodForced = false;
  let dropLockDate: string | undefined;

  switch (preset) {
    case 'enrollment_window': {
      const when =
        start && end
          ? midpoint(start, end)
          : addDays(getEffectiveNow(config), 0);
      simulationDate = when.toISOString();
      enrollmentPeriodForced = true;
      allowPostEnrollmentAdds = true;
      allowPostEnrollmentDrops = true;
      dropLockDate =
        config.semesterEndDate ??
        (midterm ? addDays(midterm, 30).toISOString() : undefined);
      break;
    }
    case 'add_drop_period': {
      const when = semStart
        ? addDays(semStart, 14)
        : start && end
          ? addDays(end, 7)
          : addDays(getEffectiveNow(config), 0);
      simulationDate = when.toISOString();
      allowPostEnrollmentAdds = true;
      allowPostEnrollmentDrops = true;
      enrollmentPeriodForced = false;
      dropLockDate =
        config.semesterEndDate ??
        (midterm ? addDays(midterm, 30).toISOString() : undefined);
      break;
    }
    case 'drop_locked': {
      const when = midterm
        ? addDays(midterm, -5)
        : addDays(getEffectiveNow(config), 60);
      simulationDate = when.toISOString();
      enrollmentOpen = config.enrollmentOpen !== false;
      dropLockDate = when.toISOString().slice(0, 10);
      break;
    }
    default:
      simulationDate = getEffectiveNow(config).toISOString();
  }

  const patch: Record<string, unknown> = {
    simulationDate,
    enrollmentOpen,
    enrollmentPeriodForced,
    allowPostEnrollmentAdds,
    allowPostEnrollmentDrops,
  };
  if (dropLockDate) patch.dropLockDate = dropLockDate;
  if (baseline) patch.simulationBaseline = baseline;
  return patch;
}

export const SIMULATION_PRESETS: {
  id: SimulationPresetId;
  label: string;
  description: string;
}[] = [
  {
    id: 'enrollment_window',
    label: 'Force enrollment window',
    description:
      'Mock date inside the pre-enrollment window. Students who are not enrolled use the Pre-Enrollment wizard only.',
  },
  {
    id: 'add_drop_period',
    label: 'Force add/drop period',
    description:
      'Mock date early in the semester (drops allowed). Also allows additional course requests for students who already have an approved load (simulation only).',
  },
  {
    id: 'drop_locked',
    label: 'Simulate drop lockout',
    description:
      'Mock date within one week of midterm so Request Drop is disabled (institutional policy).',
  },
];
