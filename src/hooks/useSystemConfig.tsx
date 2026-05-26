import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { SystemConfig } from '../types';
import {
  fetchSystemConfig,
  maybeAutoTransitionSemester,
  isEnrollmentWindowOpen,
  normalizeConfig,
  syncConfigToIsatuCalendar,
} from '../lib/systemConfig';
import { db } from '../lib/firebase';
import { useAuth } from './useAuth';

const CONFIG_PATH = doc(db, 'system', 'config');

function isSimulationActive(config: SystemConfig | null): boolean {
  if (!config) return false;
  return Boolean(
    config.simulationDate ||
    config.allowPostEnrollmentAdds ||
    config.enrollmentPeriodForced ||
    config.allowPostEnrollmentDrops
  );
}

interface SystemConfigContextType {
  config: SystemConfig | null;
  loading: boolean;
  enrollmentWindowOpen: boolean;
  refresh: () => Promise<void>;
  runSemesterTransition: (manual?: boolean) => Promise<boolean>;
  alignWithIsatuCalendar: () => Promise<SystemConfig | null>;
}

const SystemConfigContext = createContext<SystemConfigContextType>({
  config: null,
  loading: true,
  enrollmentWindowOpen: false,
  refresh: async () => {},
  runSemesterTransition: async () => false,
  alignWithIsatuCalendar: async () => null,
});

export const useSystemConfig = () => useContext(SystemConfigContext);

export const SystemConfigProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { user, profile, loading: authLoading } = useAuth();
  const [config, setConfig] = useState<SystemConfig | null>(null);
  const [loading, setLoading] = useState(true);

  const applyConfig = useCallback((next: SystemConfig | null) => {
    setConfig(next);
    setLoading(false);
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const catalystAccountsOk = Boolean(
        user && profile && ['student', 'professor'].includes(profile.role)
      );
      const current = await fetchSystemConfig();

      if (catalystAccountsOk && !isSimulationActive(current)) {
        const { config: next } = await maybeAutoTransitionSemester(false);
        applyConfig(next ?? (await fetchSystemConfig()));
      } else {
        applyConfig(current);
      }
    } catch (e) {
      console.error('System config load failed', e);
      applyConfig(await fetchSystemConfig());
    }
  }, [user, profile?.role, applyConfig]);

  const runSemesterTransition = useCallback(async (manual = true) => {
    const { transitioned, config: next } = await maybeAutoTransitionSemester(manual);
    if (next) applyConfig(next);
    return transitioned;
  }, [applyConfig]);

  const alignWithIsatuCalendar = useCallback(async () => {
    const next = await syncConfigToIsatuCalendar();
    if (next) applyConfig(next);
    return next;
  }, [applyConfig]);

  useEffect(() => {
    if (authLoading) return;

    const unsub = onSnapshot(
      CONFIG_PATH,
      (snap) => {
        if (!snap.exists()) {
          applyConfig(null);
          return;
        }
        const live = normalizeConfig(snap.data());
        setConfig(live);
        setLoading(false);
      },
      (err) => {
        console.error('system/config listener failed', err);
        void refresh();
      }
    );

    void refresh();

    return () => unsub();
  }, [authLoading, refresh, applyConfig]);

  const enrollmentWindowOpen = config ? isEnrollmentWindowOpen(config) : false;

  return (
    <SystemConfigContext.Provider
      value={{
        config,
        loading,
        enrollmentWindowOpen,
        refresh,
        runSemesterTransition,
        alignWithIsatuCalendar,
      }}
    >
      {children}
    </SystemConfigContext.Provider>
  );
};
