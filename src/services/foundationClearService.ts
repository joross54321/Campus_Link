import {
  collection,
  documentId,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  writeBatch,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { db } from '../lib/firebase';

/** Firestore collections wiped before admin foundation reseed (keeps system/config). */
export const FOUNDATION_CLEAR_COLLECTIONS = [
  'enrollments',
  'grades',
  'subjects',
  'notifications',
  'admin_logs',
] as const;

const BATCH_SIZE = 400;

async function deleteCollectionByQuery(collectionName: string): Promise<number> {
  let total = 0;
  const colRef = collection(db, collectionName);
  let lastDoc: QueryDocumentSnapshot | undefined;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const pageQuery = lastDoc
      ? query(colRef, orderBy(documentId()), startAfter(lastDoc), limit(BATCH_SIZE))
      : query(colRef, orderBy(documentId()), limit(BATCH_SIZE));

    const snap = await getDocs(pageQuery);
    if (snap.empty) break;

    const batch = writeBatch(db);
    snap.docs.forEach((d) => batch.delete(d.ref));
    try {
      await batch.commit();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(
        `Could not delete "${collectionName}" (${total} removed so far). ` +
          `Deploy firestore rules and sign in as registrar. ${msg}`
      );
    }

    total += snap.size;
    lastDoc = snap.docs[snap.docs.length - 1];
  }

  const remaining = await getDocs(query(colRef, limit(1)));
  if (!remaining.empty) {
    throw new Error(
      `Clear incomplete: "${collectionName}" still has ${remaining.size}+ document(s). ` +
        'Check Firestore rules (registrar delete) and retry Reset & seed.'
    );
  }

  return total;
}

function shouldKeepRegistrarUserDoc(
  docId: string,
  data: Record<string, unknown>,
  keep: { uid: string; campusId?: string }
): boolean {
  const campus = keep.campusId?.toUpperCase().trim();
  if (docId === keep.uid) return true;
  if (campus && docId === campus) return true;
  if (data.authUid === keep.uid) return true;
  const sid = String(data.studentId ?? '').toUpperCase().trim();
  if (campus && sid === campus) return true;
  return false;
}

async function deleteUserProfilesExcept(keep: {
  uid: string;
  campusId?: string;
}): Promise<number> {
  const snap = await getDocs(collection(db, 'users'));
  let total = 0;
  let batch = writeBatch(db);
  let ops = 0;

  for (const d of snap.docs) {
    if (shouldKeepRegistrarUserDoc(d.id, d.data(), keep)) continue;
    batch.delete(d.ref);
    ops += 1;
    total += 1;
    if (ops >= BATCH_SIZE) {
      try {
        await batch.commit();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new Error(`Could not delete demo user profiles: ${msg}`);
      }
      batch = writeBatch(db);
      ops = 0;
    }
  }

  if (ops > 0) {
    try {
      await batch.commit();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`Could not delete demo user profiles: ${msg}`);
    }
  }

  return total;
}

export type ClearFoundationResult = {
  deletedByCollection: Record<string, number>;
  usersDeleted: number;
  total: number;
};

/**
 * Removes demo catalog data so the next foundation seed starts clean.
 * Preserves system/config and the signed-in registrar profile docs.
 */
export async function clearFoundationCatalog(keepRegistrar: {
  uid: string;
  campusId?: string;
}): Promise<ClearFoundationResult> {
  const deletedByCollection: Record<string, number> = {};

  for (const name of FOUNDATION_CLEAR_COLLECTIONS) {
    deletedByCollection[name] = await deleteCollectionByQuery(name);
  }

  const usersDeleted = await deleteUserProfilesExcept(keepRegistrar);
  deletedByCollection.users = usersDeleted;

  const total = Object.values(deletedByCollection).reduce((sum, n) => sum + n, 0);
  return { deletedByCollection, usersDeleted, total };
}

/** Delete subject docs whose id is not in the foundation catalog (legacy duplicates). */
export async function pruneOrphanSubjects(keepIds: ReadonlySet<string>): Promise<number> {
  const snap = await getDocs(collection(db, 'subjects'));
  let removed = 0;
  let batch = writeBatch(db);
  let ops = 0;

  for (const d of snap.docs) {
    if (keepIds.has(d.id)) continue;
    batch.delete(d.ref);
    ops += 1;
    removed += 1;
    if (ops >= BATCH_SIZE) {
      await batch.commit();
      batch = writeBatch(db);
      ops = 0;
    }
  }

  if (ops > 0) await batch.commit();
  return removed;
}
