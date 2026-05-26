import { addDoc, collection, getDocs, limit, orderBy, query } from 'firebase/firestore';
import { db } from './firebase';

export type AdminLogAction =
  | 'user_provisioned'
  | 'enrollment_approved'
  | 'enrollment_rejected'
  | 'grade_approved'
  | 'grade_rejected'
  | 'foundation_seed'
  | 'foundation_reset';

export interface AdminActivityLog {
  id: string;
  actorUid: string;
  actorName: string;
  action: AdminLogAction;
  targetId?: string;
  details: string;
  createdAt: string;
}

const COL = collection(db, 'admin_logs');

export async function appendAdminLog(
  entry: Omit<AdminActivityLog, 'id' | 'createdAt'> & { createdAt?: string }
): Promise<void> {
  await addDoc(COL, {
    ...entry,
    createdAt: entry.createdAt ?? new Date().toISOString(),
  });
}

export async function fetchAdminLogs(max = 50): Promise<AdminActivityLog[]> {
  try {
    const snap = await getDocs(
      query(COL, orderBy('createdAt', 'desc'), limit(max))
    );
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as AdminActivityLog));
  } catch {
    const snap = await getDocs(COL);
    return snap.docs
      .map((d) => ({ id: d.id, ...d.data() } as AdminActivityLog))
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
      .slice(0, max);
  }
}

export function adminLogActionLabel(action: AdminLogAction): string {
  const labels: Record<AdminLogAction, string> = {
    user_provisioned: 'User provisioned',
    enrollment_approved: 'Enrollment approved',
    enrollment_rejected: 'Enrollment rejected',
    grade_approved: 'Grade approved',
    grade_rejected: 'Grade rejected',
    foundation_seed: 'Foundation seed',
    foundation_reset: 'Foundation reset & seed',
  };
  return labels[action] ?? action;
}
