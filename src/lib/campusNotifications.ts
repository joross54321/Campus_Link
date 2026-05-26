import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from './firebase';
import type { CampusNotification, Enrollment } from '../types';

const COL = collection(db, 'notifications');

const ENROLLMENT_KINDS: CampusNotification['kind'][] = [
  'enrollment_approved',
  'enrollment_rejected',
  'drop_approved',
  'drop_rejected',
];

function subjectCodeFromNotificationBody(body: string): string | null {
  const idx = body.indexOf(' — ');
  if (idx > 0) return body.slice(0, idx).trim();
  return null;
}

export async function createCampusNotification(
  userId: string,
  payload: Omit<CampusNotification, 'id' | 'userId' | 'read' | 'createdAt'>
): Promise<void> {
  await addDoc(COL, {
    userId,
    ...payload,
    read: false,
    createdAt: new Date().toISOString(),
  });
}

export async function fetchNotificationsForUser(
  userId: string,
  max = 40
): Promise<CampusNotification[]> {
  const snap = await getDocs(query(COL, where('userId', '==', userId)));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() } as CampusNotification))
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .slice(0, max);
}

export async function markNotificationRead(id: string): Promise<void> {
  await updateDoc(doc(db, 'notifications', id), { read: true });
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  const snap = await getDocs(
    query(COL, where('userId', '==', userId), where('read', '==', false))
  );
  await Promise.all(snap.docs.map((d) => updateDoc(d.ref, { read: true })));
}

/** Remove enrollment/drop notifications for a subject once the registrar decides. */
export async function dismissEnrollmentDecisionNotifications(
  userId: string,
  subjectCode: string
): Promise<void> {
  const code = subjectCode.trim();
  if (!code) return;
  const snap = await getDocs(query(COL, where('userId', '==', userId)));
  await Promise.all(
    snap.docs
      .filter((d) => {
        const data = d.data() as CampusNotification;
        if (!ENROLLMENT_KINDS.includes(data.kind)) return false;
        const bodyCode = subjectCodeFromNotificationBody(data.body ?? '');
        return bodyCode === code || (data.body ?? '').startsWith(code);
      })
      .map((d) => deleteDoc(d.ref))
  );
}

/**
 * Delete notifications whose outcome already matches the student's enrollment records
 * (e.g. approval notice after the course is on the study load).
 */
export async function pruneResolvedEnrollmentNotifications(
  userId: string,
  enrollments: Enrollment[],
  subjectCodeById: Map<string, string>
): Promise<void> {
  const snap = await getDocs(query(COL, where('userId', '==', userId)));
  const toDelete: string[] = [];

  for (const d of snap.docs) {
    const n = d.data() as CampusNotification;
    if (!ENROLLMENT_KINDS.includes(n.kind)) continue;

    const code =
      subjectCodeFromNotificationBody(n.body ?? '') ??
      (() => {
        const match = (n.body ?? '').match(/^([A-Z]{2,}\s*\d+)/i);
        return match ? match[1].trim() : null;
      })();
    if (!code) continue;

    const related = enrollments.filter((e) => {
      const subCode = subjectCodeById.get(e.subjectId);
      return subCode === code;
    });

    if (n.kind === 'enrollment_approved' && related.some((e) => e.status === 'approved')) {
      toDelete.push(d.id);
    }
    if (n.kind === 'enrollment_rejected' && related.some((e) => e.status === 'rejected')) {
      toDelete.push(d.id);
    }
    if (n.kind === 'drop_approved' && related.some((e) => e.status === 'dropped')) {
      toDelete.push(d.id);
    }
    if (
      n.kind === 'drop_rejected' &&
      related.some((e) => e.status === 'approved' || e.status === 'pending_drop')
    ) {
      toDelete.push(d.id);
    }
  }

  await Promise.all(toDelete.map((id) => deleteDoc(doc(db, 'notifications', id))));
}

export function enrollmentNotificationCopy(
  status: 'approved' | 'rejected',
  subjectCode: string,
  subjectTitle: string,
  isDrop: boolean
): { title: string; body: string; kind: CampusNotification['kind'] } {
  if (isDrop) {
    if (status === 'approved') {
      return {
        title: 'Drop request approved',
        body: `${subjectCode} — ${subjectTitle} has been removed from your study load.`,
        kind: 'drop_approved',
      };
    }
    return {
      title: 'Drop request declined',
      body: `${subjectCode} — ${subjectTitle} remains on your study load.`,
      kind: 'drop_rejected',
    };
  }
  if (status === 'approved') {
    return {
      title: 'Enrollment approved',
      body: `${subjectCode} — ${subjectTitle} is now on your study load for this term.`,
      kind: 'enrollment_approved',
    };
  }
  return {
    title: 'Enrollment not approved',
    body: `${subjectCode} — ${subjectTitle} was not added. Contact your department for details.`,
    kind: 'enrollment_rejected',
  };
}
