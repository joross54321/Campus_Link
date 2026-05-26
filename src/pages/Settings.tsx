import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { useSystemConfig } from '../hooks/useSystemConfig';
import { formatSemesterLabel } from '../lib/systemConfig';
import { getHomePathForRole } from '../lib/authRoutes';
import PageHeader from '../components/layout/PageHeader';
import { toast } from 'react-hot-toast';
import {
  User,
  Shield,
  Calendar,
  RefreshCw,
  ArrowRight,
  Database,
  Bell,
} from 'lucide-react';
import { cn } from '../lib/utils';

function SettingRow({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-6 border-b border-slate-100 last:border-0">
      <div>
        <p className="font-bold text-brand-blue text-sm">{label}</p>
        {description && <p className="text-xs text-slate-400 mt-1 max-w-md break-words">{description}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export default function Settings() {
  const { profile, loading: authLoading } = useAuth();
  const { config, enrollmentWindowOpen, refresh, runSemesterTransition, alignWithIsatuCalendar } =
    useSystemConfig();
  const [busy, setBusy] = useState(false);
  const [simulationDate, setSimulationDate] = useState('');
  const home = getHomePathForRole(profile?.role);
  const isRegistrar = profile?.role === 'registrar';

  if (authLoading || !profile) {
    return (
      <div className="flex justify-center py-32">
        <div className="w-8 h-8 border-2 border-primary/20 border-t-brand-blue rounded-full animate-spin" />
      </div>
    );
  }

  const toggleEnrollment = async () => {
    if (!config) return;
    setBusy(true);
    try {
      await updateDoc(doc(db, 'system', 'config'), {
        enrollmentOpen: !config.enrollmentOpen,
      });
      await refresh();
      toast.success(config.enrollmentOpen ? 'Enrollment closed' : 'Enrollment opened');
    } catch {
      toast.error('Could not update enrollment setting');
    } finally {
      setBusy(false);
    }
  };

  const toggleAutomation = async () => {
    if (!config) return;
    setBusy(true);
    try {
      const enabled = config.semesterAutomationEnabled !== false;
      await updateDoc(doc(db, 'system', 'config'), {
        semesterAutomationEnabled: !enabled,
      });
      await refresh();
      toast.success(enabled ? 'Automatic semester rollover paused' : 'Automatic rollover resumed');
    } catch {
      toast.error('Could not update automation');
    } finally {
      setBusy(false);
    }
  };

  const runTransition = async () => {
    setBusy(true);
    try {
      const ok = await runSemesterTransition(true);
      await refresh();
      toast.success(ok ? 'Advanced to next term (ISAT-U calendar dates)' : 'No transition was needed');
    } catch {
      toast.error('Transition failed');
    } finally {
      setBusy(false);
    }
  };

  const alignCalendar = async () => {
    setBusy(true);
    try {
      const next = await alignWithIsatuCalendar();
      await refresh();
      if (next) {
        toast.success(
          `Aligned to ISAT-U calendar: AY ${next.currentAcademicYear} · ${formatSemesterLabel(next.currentSemester)}`
        );
      } else {
        toast.error('Could not align calendar');
      }
    } catch {
      toast.error('Calendar alignment failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-10 pb-16">
      <PageHeader title="Settings" subtitle="Account and portal preferences" backTo={home} />

      <section className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8">
        <h2 className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-400 mb-2 flex items-center gap-2">
          <User size={14} />
          Account
        </h2>
        <SettingRow
          label="Profile & password"
          description="Update your name, contact info, and sign-in password."
        >
          <Link
            to="/profile"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-blue text-white text-[10px] font-bold uppercase tracking-widest"
          >
            Open profile
            <ArrowRight size={14} />
          </Link>
        </SettingRow>
        <SettingRow label="Signed in as" description={profile?.studentId}>
          <span className="text-sm font-mono font-bold text-brand-blue capitalize">
            {profile?.role}
          </span>
        </SettingRow>
      </section>

      {isRegistrar && config && (
        <section className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8">
          <h2 className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-400 mb-2 flex items-center gap-2">
            <Calendar size={14} />
            Academic term
          </h2>
          <SettingRow
            label="ISAT-U calendar"
            description="1st sem Aug–Dec · 2nd sem Jan–May · Summer Jun–Jul. Dates reset from the official term pattern."
          >
            <button
              type="button"
              disabled={busy}
              onClick={alignCalendar}
              className="px-5 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest bg-brand-gold/10 text-brand-blue border border-brand-gold/30 disabled:opacity-50"
            >
              Align to today
            </button>
          </SettingRow>
          <SettingRow
            label="Current term"
            description={`AY ${config.currentAcademicYear} · ${formatSemesterLabel(config.currentSemester)}`}
          >
            <span className="text-sm font-bold text-brand-blue">
              {enrollmentWindowOpen ? 'Enrollment open' : 'Enrollment closed'}
            </span>
          </SettingRow>
          <SettingRow
            label="Student enrollment window"
            description="Allow students to submit new enrollment requests for the current term."
          >
            <button
              type="button"
              disabled={busy}
              onClick={toggleEnrollment}
              className={cn(
                'px-5 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all disabled:opacity-50',
                config.enrollmentOpen !== false
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-slate-100 text-slate-500 border border-slate-200'
              )}
            >
              {config.enrollmentOpen !== false ? 'Open — click to close' : 'Closed — click to open'}
            </button>
          </SettingRow>
          <SettingRow
            label="Automatic semester rollover"
            description="When paused, logins will not auto-advance after the term end date on the ISAT-U calendar."
          >
            <button
              type="button"
              disabled={busy}
              onClick={toggleAutomation}
              className="px-5 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest bg-brand-gold/10 text-brand-blue border border-brand-gold/30 disabled:opacity-50"
            >
              {config.semesterAutomationEnabled !== false
                ? 'Halt automatic rollover'
                : 'Resume automatic rollover'}
            </button>
          </SettingRow>
          <SettingRow
            label="Simulation calendar date"
            description="Mock “today” for testing drop lockout and term automation (stored in system/config)."
          >
            <div className="flex flex-col gap-2 items-end">
              <input
                type="date"
                value={simulationDate || (config.simulationDate?.slice(0, 10) ?? '')}
                onChange={(e) => setSimulationDate(e.target.value)}
                className="px-3 py-2 rounded-lg border text-sm"
              />
              <button
                type="button"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await updateDoc(doc(db, 'system', 'config'), {
                      simulationDate: simulationDate
                        ? new Date(simulationDate).toISOString()
                        : null,
                    });
                    await refresh();
                    toast.success(simulationDate ? 'Simulation date applied' : 'Simulation cleared');
                  } catch {
                    toast.error('Could not update simulation date');
                  } finally {
                    setBusy(false);
                  }
                }}
                className="px-4 py-2 rounded-xl bg-brand-blue text-white text-[10px] font-bold uppercase"
              >
                Save
              </button>
            </div>
          </SettingRow>
          <SettingRow
            label="Manual semester transition"
            description="Advance one term (1st → 2nd → Summer → next AY) using ISAT-U start/end dates."
          >
            <button
              type="button"
              disabled={busy}
              onClick={runTransition}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-blue text-white text-[10px] font-bold uppercase tracking-widest disabled:opacity-50"
            >
              <RefreshCw size={14} className={busy ? 'animate-spin' : ''} />
              Run transition
            </button>
          </SettingRow>
        </section>
      )}

      {isRegistrar && (
        <section className="bg-brand-blue rounded-3xl p-8 text-white">
          <h2 className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/40 mb-4 flex items-center gap-2">
            <Database size={14} />
            Advanced (registrar)
          </h2>
          <p className="text-sm text-white/60 mb-6">
            Seed demo data, foundation users with Auth, and other system tools live in the admin
            console.
          </p>
          <Link
            to="/admin?tab=system"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-brand-gold text-brand-blue text-[10px] font-bold uppercase tracking-widest"
          >
            Open system tools
            <ArrowRight size={14} />
          </Link>
        </section>
      )}

      {!isRegistrar && (
        <section className="bg-slate-50 rounded-3xl border border-slate-100 p-8">
          <h2 className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-400 mb-2 flex items-center gap-2">
            <Bell size={14} />
            Notifications
          </h2>
          <p className="text-sm text-slate-500">
            Enrollment and grade alerts are shown on your dashboard and study load when the
            registrar updates your records.
          </p>
        </section>
      )}

      <section className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 flex items-start gap-3">
        <Shield size={18} className="text-brand-gold shrink-0 mt-0.5" />
        <p className="text-xs text-slate-500 leading-relaxed">
          System-wide changes (enrollment dates, catalog, user provisioning) are managed by the
          registrar. Contact your campus office if something looks incorrect.
        </p>
      </section>
    </div>
  );
}
