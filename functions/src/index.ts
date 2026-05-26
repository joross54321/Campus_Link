import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { FIRESTORE_DATABASE_ID } from './firestoreDatabaseId';
import { getIsatuTermSchedule, getNextSemester, isPastTermEnd } from './isatuAcademicCalendar';

initializeApp();
const db = getFirestore(FIRESTORE_DATABASE_ID);

async function maybeTransition(): Promise<boolean> {
  const configRef = db.doc('system/config');
  const snap = await configRef.get();
  if (!snap.exists) return false;

  const data = snap.data()!;
  if (data.semesterAutomationEnabled === false) {
    console.log('Semester automation disabled in system/config — skipping');
    return false;
  }

  if (!isPastTermEnd(data.semesterEndDate as string | undefined)) return false;

  return db.runTransaction(async (tx) => {
    const fresh = await tx.get(configRef);
    if (!fresh.exists) return false;
    const current = fresh.data()!;
    if (current.semesterAutomationEnabled === false) return false;

    if (!isPastTermEnd(current.semesterEndDate as string | undefined)) return false;

    const now = new Date();
    const next = getNextSemester(
      String(current.currentSemester ?? '1'),
      String(current.currentAcademicYear ?? '2025-2026')
    );
    const schedule = getIsatuTermSchedule(next.semester, next.academicYear);

    tx.set(
      configRef,
      {
        ...current,
        ...schedule,
        enrollmentOpen: false,
        lastTransitionAt: now.toISOString(),
        transitionedBy: 'auto-scheduled',
      },
      { merge: true }
    );
    return true;
  });
}

/** Daily at 00:05 Asia/Manila — advances term after ISAT-U semester end date. */
export const scheduledSemesterTransition = onSchedule(
  {
    schedule: '5 0 * * *',
    timeZone: 'Asia/Manila',
  },
  async () => {
    const transitioned = await maybeTransition();
    console.log(
      transitioned
        ? 'Semester transition completed (ISAT-U calendar)'
        : 'No transition needed'
    );
  }
);
