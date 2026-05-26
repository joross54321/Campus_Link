import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from './useAuth';
import {
  markAllNotificationsRead,
  markNotificationRead,
} from '../lib/campusNotifications';
import type { CampusNotification } from '../types';

const COL = collection(db, 'notifications');

export function useCampusNotifications() {
  const { profile } = useAuth();
  const [items, setItems] = useState<CampusNotification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.uid) {
      setItems([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const q = query(COL, where('userId', '==', profile.uid));

    const unsub = onSnapshot(
      q,
      (snap) => {
        const next = snap.docs
          .map((d) => ({ id: d.id, ...d.data() } as CampusNotification))
          .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
        setItems(next);
        setLoading(false);
      },
      () => {
        setItems([]);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [profile?.uid]);

  const unread = items.filter((n) => !n.read).length;

  const markRead = async (id: string) => {
    await markNotificationRead(id);
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  };

  const markAllRead = async () => {
    if (!profile?.uid) return;
    await markAllNotificationsRead(profile.uid);
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  return { items, unread, loading, markRead, markAllRead };
}
