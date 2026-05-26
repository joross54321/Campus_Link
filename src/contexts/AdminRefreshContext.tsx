import React, { createContext, useCallback, useContext, useRef, useState } from 'react';

type AdminRefreshContextValue = {
  registerRefresh: (fn: () => void | Promise<void>) => void;
  runRefresh: () => Promise<void>;
  refreshing: boolean;
  label: string;
  setLabel: (label: string) => void;
};

const AdminRefreshContext = createContext<AdminRefreshContextValue | null>(null);

export function AdminRefreshProvider({ children }: { children: React.ReactNode }) {
  const handlerRef = useRef<(() => void | Promise<void>) | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [label, setLabel] = useState('Refresh queue');

  const registerRefresh = useCallback((fn: () => void | Promise<void>) => {
    handlerRef.current = fn;
  }, []);

  const runRefresh = useCallback(async () => {
    if (!handlerRef.current || refreshing) return;
    setRefreshing(true);
    try {
      await handlerRef.current();
    } finally {
      setRefreshing(false);
    }
  }, [refreshing]);

  return (
    <AdminRefreshContext.Provider
      value={{ registerRefresh, runRefresh, refreshing, label, setLabel }}
    >
      {children}
    </AdminRefreshContext.Provider>
  );
}

export function useAdminRefresh() {
  const ctx = useContext(AdminRefreshContext);
  if (!ctx) {
    return {
      registerRefresh: () => {},
      runRefresh: async () => {},
      refreshing: false,
      label: 'Refresh',
      setLabel: () => {},
    };
  }
  return ctx;
}
