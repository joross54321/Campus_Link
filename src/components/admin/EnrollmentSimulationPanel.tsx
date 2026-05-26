import React, { useMemo, useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { format } from 'date-fns';
import { CalendarClock, RotateCcw, Sparkles } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { db } from '../../lib/firebase';
import { useSystemConfig } from '../../hooks/useSystemConfig';
import { formatFirestoreDate } from '../../lib/userLookup';
import {
  buildSimulationBaseline,
  getEnrollmentSimulationStatus,
  presetPatch,
  SIMULATION_PRESETS,
  type SimulationPresetId,
} from '../../lib/enrollmentSimulation';
import { cn } from '../../lib/utils';

type Props = {
  simulationDateInput: string;
  onSimulationDateInputChange: (value: string) => void;
  systemSaving: boolean;
  onSystemSavingChange: (busy: boolean) => void;
  className?: string;
};

export default function EnrollmentSimulationPanel({
  simulationDateInput,
  onSimulationDateInputChange,
  systemSaving,
  onSystemSavingChange,
  className,
}: Props) {
  const { config, refresh, alignWithIsatuCalendar } = useSystemConfig();
  const [presetBusy, setPresetBusy] = useState<string | null>(null);

  const status = useMemo(
    () => (config ? getEnrollmentSimulationStatus(config) : null),
    [config]
  );

  const applyPatch = async (patch: Record<string, unknown>, message: string) => {
    if (!config) return;
    onSystemSavingChange(true);
    try {
      await updateDoc(doc(db, 'system', 'config'), patch);
      await refresh();
      toast.success(message);
    } catch {
      toast.error('Could not update simulation settings');
    } finally {
      onSystemSavingChange(false);
      setPresetBusy(null);
    }
  };

  const runPreset = async (preset: SimulationPresetId) => {
    if (!config) return;
    setPresetBusy(preset);
    const patch = presetPatch(config, preset);
    const label =
      SIMULATION_PRESETS.find((p) => p.id === preset)?.label ?? 'Simulation';
    await applyPatch(patch, `${label} applied — refresh student tabs to see changes`);
  };

  if (!config || !status) return null;

  const busy = systemSaving || presetBusy !== null;

  return (
    <div className={cn('border-t border-white/10 pt-4 mt-4 space-y-4', className)}>
      <div className="flex items-center gap-2">
        <CalendarClock size={16} className="text-brand-gold" />
        <p className="text-white/80 text-[11px] font-bold uppercase tracking-widest">
          Enrollment & add/drop simulation
        </p>
      </div>
      <p className="text-white/50 text-[11px] leading-relaxed">
        One-click presets set a mock &quot;today&quot; and registrar flags so you can walk through
        the Enrollment Wizard, Request Add, and Request Drop on demo student accounts. Use{' '}
        <strong className="text-white/70">Restore baseline</strong> or{' '}
        <strong className="text-white/70">Sync real calendar</strong> when finished.
      </p>

      <div className="grid grid-cols-2 gap-2 text-[10px]">
        <StatusPill
          label="Effective date"
          value={
            status.usingSimulation
              ? format(status.effectiveNow, 'MMM d, yyyy') + ' (sim)'
              : format(status.effectiveNow, 'MMM d, yyyy') + ' (live)'
          }
        />
        <StatusPill
          label="Request Add"
          ok={status.enrollmentWindowOpen || status.allowPostEnrollmentAdds}
          value={
            status.allowPostEnrollmentAdds
              ? 'Add period (sim)'
              : status.enrollmentWindowOpen
                ? 'Enrollment window'
                : 'Closed'
          }
        />
        <StatusPill
          label="Request Drop"
          ok={!status.dropLocked}
          value={status.dropLocked ? 'Locked' : 'Drop period open'}
        />
        <StatusPill
          label="Baseline saved"
          ok={status.hasBaseline}
          value={status.hasBaseline ? 'Yes' : 'No'}
        />
      </div>

      {status.dropLockAt && (
        <p className="text-white/40 text-[10px]">
          Drop lock starts {format(status.dropLockAt, 'MMM d, yyyy')}
          {config.midtermDate ? ` (midterm ${formatFirestoreDate(config.midtermDate)})` : ''}
        </p>
      )}

      <div className="space-y-2">
        {SIMULATION_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            disabled={busy}
            onClick={() => runPreset(preset.id)}
            className="w-full text-left p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all disabled:opacity-50"
          >
            <span className="flex items-center gap-2 text-brand-gold text-[10px] font-bold uppercase tracking-widest">
              <Sparkles size={12} />
              {presetBusy === preset.id ? 'Applying…' : preset.label}
            </span>
            <span className="block mt-1 text-white/50 text-[10px] leading-relaxed">
              {preset.description}
            </span>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy || !status.hasBaseline}
          onClick={() => runPreset('restore_baseline')}
          className="flex-1 min-w-[8rem] py-3 rounded-xl border border-white/20 text-[10px] font-bold uppercase text-white/80 disabled:opacity-40 flex items-center justify-center gap-2"
        >
          <RotateCcw size={12} />
          Restore baseline
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setPresetBusy('sync');
            onSystemSavingChange(true);
            try {
              await updateDoc(
                doc(db, 'system', 'config'),
                {
                  ...presetPatch(config, 'clear_simulation'),
                  enrollmentPeriodForced: false,
                  allowPostEnrollmentDrops: false,
                }
              );
              await alignWithIsatuCalendar();
              onSimulationDateInputChange('');
              await refresh();
              toast.success('Simulation cleared and term synced to ISAT-U calendar');
            } catch {
              toast.error('Could not sync calendar');
            } finally {
              onSystemSavingChange(false);
              setPresetBusy(null);
            }
          }}
          className="flex-1 min-w-[8rem] py-3 rounded-xl bg-white/10 text-[10px] font-bold uppercase text-white/90 disabled:opacity-50"
        >
          {presetBusy === 'sync' ? 'Syncing…' : 'Sync real calendar'}
        </button>
      </div>

      <div className="border-t border-white/10 pt-3 space-y-2">
        <p className="text-white/60 text-[10px] font-bold uppercase tracking-widest">
          Custom mock date
        </p>
        <input
          type="date"
          value={simulationDateInput || (config.simulationDate?.slice(0, 10) ?? '')}
          onChange={(e) => onSimulationDateInputChange(e.target.value)}
          className="w-full px-3 py-2 rounded-lg text-brand-blue text-sm"
        />
        <div className="flex gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              if (!simulationDateInput) return;
              await applyPatch(
                {
                  simulationDate: new Date(simulationDateInput).toISOString(),
                  ...(config.simulationBaseline
                    ? {}
                    : { simulationBaseline: buildSimulationBaseline(config) }),
                },
                'Custom simulation date saved'
              );
            }}
            className="flex-1 py-3 rounded-xl bg-brand-gold text-brand-blue text-[10px] font-bold uppercase"
          >
            Apply date
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => runPreset('clear_simulation')}
            className="flex-1 py-3 rounded-xl border border-white/20 text-[10px] font-bold uppercase text-white/80"
          >
            Clear mock only
          </button>
        </div>
      </div>
    </div>
  );
}

function StatusPill({
  label,
  value,
  ok,
}: {
  label: string;
  value: string;
  ok?: boolean;
}) {
  return (
    <div className="p-3 rounded-lg bg-white/5 border border-white/10">
      <p className="text-white/40 uppercase tracking-widest mb-1">{label}</p>
      <p
        className={cn(
          'font-bold truncate',
          ok === true && 'text-emerald-300',
          ok === false && 'text-amber-200/90',
          ok === undefined && 'text-white/80'
        )}
      >
        {value}
      </p>
    </div>
  );
}
