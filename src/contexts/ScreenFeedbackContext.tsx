import React, { createContext, useCallback, useContext, useState } from 'react';

type FeedbackKind = 'refresh' | 'navigate' | 'success';

type ScreenFeedbackContextValue = {
  pulseKey: number;
  pulseKind: FeedbackKind;
  triggerFeedback: (kind?: FeedbackKind) => void;
};

const ScreenFeedbackContext = createContext<ScreenFeedbackContextValue | null>(null);

export function ScreenFeedbackProvider({ children }: { children: React.ReactNode }) {
  const [pulseKey, setPulseKey] = useState(0);
  const [pulseKind, setPulseKind] = useState<FeedbackKind>('success');

  const triggerFeedback = useCallback((kind: FeedbackKind = 'success') => {
    setPulseKind(kind);
    setPulseKey((k) => k + 1);
  }, []);

  return (
    <ScreenFeedbackContext.Provider value={{ pulseKey, pulseKind, triggerFeedback }}>
      {children}
    </ScreenFeedbackContext.Provider>
  );
}

export function useScreenFeedback() {
  const ctx = useContext(ScreenFeedbackContext);
  if (!ctx) {
    return {
      pulseKey: 0,
      pulseKind: 'success' as FeedbackKind,
      triggerFeedback: () => {},
    };
  }
  return ctx;
}
