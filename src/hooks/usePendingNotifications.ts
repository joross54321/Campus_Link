import { useCallback, useEffect, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from './useAuth';

export type PendingCounts = {
  enrollments: number;
  grades: number;
  total: number;
};

export function usePendingNotifications(pollMs = 45_000) {
  const { profile } = useAuth();
  const isRegistrar = profile?.role === 'registrar';
  const [counts, setCounts] = useState<PendingCounts>({
    enrollments: 0,
    grades: 0,
    total: 0,
  });
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!isRegistrar) {
      setCounts({ enrollments: 0, grades: 0, total: 0 });
      return;
    }
    setLoading(true);
    try {
      const [pendingSnap, dropSnap, gradesSnap] = await Promise.all([
        getDocs(query(collection(db, 'enrollments'), where('status', '==', 'pending'))),
        getDocs(query(collection(db, 'enrollments'), where('status', '==', 'pending_drop'))),
        getDocs(query(collection(db, 'grades'), where('status', '==', 'pending'))),
      ]);
      const enrollments = pendingSnap.size + dropSnap.size;
      const grades = gradesSnap.size;
      setCounts({ enrollments, grades, total: enrollments + grades });
    } catch {
      setCounts({ enrollments: 0, grades: 0, total: 0 });
    } finally {
      setLoading(false);
    }
  }, [isRegistrar]);

  useEffect(() => {
    void refresh();
    if (!isRegistrar || pollMs <= 0) return;
    const id = window.setInterval(() => void refresh(), pollMs);
    return () => window.clearInterval(id);
  }, [refresh, isRegistrar, pollMs]);

  return { counts, loading, refresh, isRegistrar };
}
