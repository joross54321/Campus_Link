import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  where,
  type Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';

export type UserRecord = Record<string, unknown>;

/** Resolve users/{authUid} or legacy users/{studentId} with authUid field. */
export async function fetchUserRecord(userId: string): Promise<UserRecord | null> {
  if (!userId) return null;

  const byUid = await getDoc(doc(db, 'users', userId));
  if (byUid.exists()) return byUid.data();

  const byAuth = await getDocs(
    query(collection(db, 'users'), where('authUid', '==', userId), limit(1))
  );
  if (!byAuth.empty) return byAuth.docs[0].data();

  const byCampusId = await getDoc(doc(db, 'users', userId));
  if (byCampusId.exists()) return byCampusId.data();

  return null;
}

export function formatUserDisplayName(
  data: UserRecord | null | undefined,
  fallback = 'Unknown'
): string {
  if (!data) return fallback;
  const first = String(data.firstName ?? '').trim();
  const last = String(data.surname ?? '').trim();
  const combined = `${first} ${last}`.trim();
  if (combined) return combined;
  const campusId = String(data.studentId ?? '').trim();
  return campusId || fallback;
}

export function safeNameInitial(name: string | undefined): string {
  const ch = (name ?? '').trim()[0];
  return ch ? ch.toUpperCase() : '';
}

/** Firestore Timestamp / ISO string → display date (never throws). */
export function formatFirestoreDate(value: unknown): string {
  if (value == null) return '—';
  try {
    if (
      typeof value === 'object' &&
      value !== null &&
      'toDate' in value &&
      typeof (value as Timestamp).toDate === 'function'
    ) {
      const d = (value as Timestamp).toDate();
      if (Number.isNaN(d.getTime())) return '—';
      return d.toISOString().split('T')[0];
    }
    if (typeof value === 'string' || typeof value === 'number') {
      const d = new Date(value);
      if (Number.isNaN(d.getTime())) return '—';
      return d.toISOString().split('T')[0];
    }
  } catch {
    return '—';
  }
  return '—';
}
