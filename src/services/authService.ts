import {
  setDoc,
  doc,
  collection,
  query,
  where,
  limit,
  getDocs,
  getDoc,
  type DocumentSnapshot,
} from 'firebase/firestore';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  type User,
  type UserCredential,
} from 'firebase/auth';
import { db, auth, getSeedAuth } from '../lib/firebase';
import { KNOWN_DEMO_ACCOUNTS, formatLoginPassword } from '../lib/knownDemoAccounts';
import { applyFoundationCatalog } from './foundationSeedService';
import { formatFoundationSeedLoginHint } from '../lib/accountCredentials';
import { campusAuthEmail } from '../lib/authEmail';
import { omitUndefined } from '../lib/utils';
import { resolveCurrentTermFromCalendar } from '../lib/isatuAcademicCalendar';
import { normalizeSemesterValue } from '../lib/studentEnrollments';
import { buildIsatuTermConfig } from '../lib/systemConfig';

/** Firebase requires at least 6 characters; short surnames are padded with `1`. */
export const getAuthPassword = formatLoginPassword;

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function formatSeedError(error: unknown): string {
  const e = error as { code?: string; message?: string };
  if (e.code === 'auth/operation-not-allowed') {
    return 'Enable Email/Password in Firebase Console → Authentication → Sign-in method.';
  }
  if (e.code === 'auth/network-request-failed') {
    return 'Network error talking to Firebase Auth. Check your connection and try again.';
  }
  if (e.code === 'auth/invalid-credential' || e.code === 'auth/wrong-password') {
    return 'A demo account already exists with a different password. Ask your teammate or reset Auth in Firebase Console.';
  }
  if (e.code === 'permission-denied') {
    return (
      'Firestore denied this action (insufficient permissions). Sign in as registrar 2026-0001-A / Admin1, ' +
      'then try Reset & seed again. If it persists, run: firebase deploy --only firestore:rules'
    );
  }
  if (e.message?.includes('already initialized')) {
    return e.message;
  }
  return e.message || 'Unknown error';
}

async function writeUserProfile(
  authUid: string,
  studentId: string,
  surname: string,
  profile: Record<string, unknown>
) {
  const campusId = studentId.toUpperCase().trim();
  const payload = omitUndefined({ studentId: campusId, surname, ...profile });
  await setDoc(doc(db, 'users', authUid), payload, { merge: true });
  await setDoc(doc(db, 'users', campusId), { ...payload, authUid }, { merge: true });
}

/**
 * Security rules key off users/{auth.uid}. After Auth-only login, profile may exist only at users/{studentId}.
 */
export async function ensureProfileForAuthUid(authUser: User, studentId: string) {
  const id = studentId.toUpperCase().trim();
  const uidRef = doc(db, 'users', authUser.uid);
  const byIdRef = doc(db, 'users', id);
  const [uidSnap, byIdSnap] = await Promise.all([getDoc(uidRef), getDoc(byIdRef)]);

  const fromId = byIdSnap.exists() ? byIdSnap.data() : null;
  const fromUid = uidSnap.exists() ? uidSnap.data() : null;
  if (!fromId && !fromUid) return;

  const payload = omitUndefined({
    ...(fromId ?? {}),
    ...(fromUid ?? {}),
    studentId: fromId?.studentId ?? fromUid?.studentId ?? id,
    authUid: authUser.uid,
    role: fromUid?.role ?? fromId?.role,
    program: fromUid?.program ?? fromId?.program,
    section: fromUid?.section ?? fromId?.section,
    yearLevel: fromUid?.yearLevel ?? fromId?.yearLevel,
    college: fromUid?.college ?? fromId?.college,
    firstName: fromUid?.firstName ?? fromId?.firstName,
    surname: fromUid?.surname ?? fromId?.surname,
    maxUnits: fromUid?.maxUnits ?? fromId?.maxUnits ?? 30,
  });

  const isStaff = payload.role === 'registrar' || payload.role === 'professor';

  // Firestore rules (isRegistrar) read users/{auth.uid} — staff must keep that doc in sync.
  if (!uidSnap.exists()) {
    await setDoc(uidRef, payload);
  } else if (isStaff) {
    await setDoc(uidRef, payload, { merge: true });
  }

  // Legacy profiles at users/{studentId} are read during login; linking authUid requires registrar rules.
  if (byIdSnap.exists() && !fromId?.authUid) {
    try {
      await setDoc(byIdRef, { authUid: authUser.uid, studentId: id }, { merge: true });
    } catch {
      // Non-fatal: useAuth still resolves profile from users/{studentId}
    }
  }
}

/**
 * Ensures users/{auth.uid} has role registrar so Firestore rules allow reset/seed.
 * Call before foundation clear/seed when the profile may only exist at users/{campusId}.
 */
export async function syncRegistrarFirestoreProfile(authUser: User): Promise<void> {
  const campusId = authUser.email?.split('@')[0]?.toUpperCase().trim();
  if (!campusId) {
    throw new Error('Sign in with your campus ID (e.g. 2026-0001-A), not a personal email.');
  }

  const [uidSnap, campusSnap] = await Promise.all([
    getDoc(doc(db, 'users', authUser.uid)),
    getDoc(doc(db, 'users', campusId)),
  ]);

  const campus = campusSnap.data();
  const uid = uidSnap.data();
  const role = uid?.role ?? campus?.role;

  if (role !== 'registrar') {
    throw new Error('Only a registrar can run foundation reset/seed.');
  }

  // Rules check users/{auth.uid} for isRegistrar — sync that doc first.
  await setDoc(
    doc(db, 'users', authUser.uid),
    omitUndefined({
      ...(campus ?? {}),
      ...(uid ?? {}),
      studentId: campusId,
      authUid: authUser.uid,
      role: 'registrar',
      surname: campus?.surname ?? uid?.surname ?? 'Admin',
      firstName: campus?.firstName ?? uid?.firstName ?? 'Project',
      maxUnits: campus?.maxUnits ?? uid?.maxUnits ?? 30,
    }),
    { merge: true }
  );

  try {
    await setDoc(
      doc(db, 'users', campusId),
      { authUid: authUser.uid, studentId: campusId },
      { merge: true }
    );
  } catch {
    // Non-fatal once users/{auth.uid} has registrar role
  }
}

async function finalizeLogin(studentId: string, cred: UserCredential) {
  try {
    await ensureProfileForAuthUid(cred.user, studentId);
  } catch (e) {
    console.warn('Profile sync after sign-in (non-fatal):', e);
  }
  return cred;
}

/**
 * Create or refresh a demo/provisioned user. Idempotent: re-running Foundation Seed
 * updates Firestore only when Auth is already linked — it does not rotate passwords.
 */
export async function ensureSeedUser(
  id: string,
  surname: string,
  profile: Record<string, unknown>
): Promise<string> {
  const campusId = id.toUpperCase().trim();
  const email = campusAuthEmail(campusId);
  const pass = getAuthPassword(surname);
  const seedAuth = getSeedAuth();

  const byCampusIdRef = doc(db, 'users', campusId);
  const byCampusIdSnap = await getDoc(byCampusIdRef);
  const linkedAuthUid = byCampusIdSnap.data()?.authUid as string | undefined;

  if (linkedAuthUid) {
    await writeUserProfile(linkedAuthUid, campusId, surname, profile);
    return linkedAuthUid;
  }

  const byUidSnap = await getDocs(
    query(
      collection(db, 'users'),
      where('studentId', '==', campusId),
      limit(1)
    )
  );
  const fromQuery = byUidSnap.empty ? null : byUidSnap.docs[0];
  const queryAuthUid = fromQuery?.data()?.authUid as string | undefined;
  const queryUid = fromQuery?.id;
  const resolvedUid =
    queryAuthUid ?? (queryUid && queryUid !== campusId ? queryUid : undefined);

  if (resolvedUid) {
    await writeUserProfile(resolvedUid, campusId, surname, profile);
    return resolvedUid;
  }

  try {
    const cred = await createUserWithEmailAndPassword(seedAuth, email, pass);
    await writeUserProfile(cred.user.uid, campusId, surname, profile);
    await signOutSeedAuth();
    return cred.user.uid;
  } catch (err: unknown) {
    const code = (err as { code?: string }).code;
    if (code === 'auth/email-already-in-use') {
      try {
        const cred = await signInWithEmailAndPassword(seedAuth, email, pass);
        await writeUserProfile(cred.user.uid, campusId, surname, profile);
        await signOutSeedAuth();
        return cred.user.uid;
      } catch {
        await signOutSeedAuth();
        throw new Error(
          `Auth user ${email} already exists with a different password than ${pass}. ` +
            `In Firebase Console → Authentication, delete that user, then run Foundation Seed once.`
        );
      }
    }
    await signOutSeedAuth();
    throw err;
  }
}

async function signOutSeedAuth() {
  try {
    await signOut(getSeedAuth());
  } catch {
    // ignore
  }
}

export const seedInitialData = async () => {
  console.log("Starting bootstrap process...");
  
  // 1. Handle Registrar Account
  const registrarId = '2026-0001-A';
  const surname = 'Admin';
  const email = `${registrarId}@campuslink.isatu.edu.ph`.toLowerCase();
  const password = getAuthPassword(surname);

  try {
    let registrarUser: any = null;
    console.log(`Bootstrap: Handling registrar ${email}`);
    
    // Check if system config already exists with a small retry for "offline" error
    let configSnap;
    try {
      configSnap = await getDoc(doc(db, 'system', 'config'));
    } catch (e: any) {
      if (e.message?.includes('offline')) {
        console.warn("Bootstrap: Client offline during config check, retrying in 2s...");
        await delay(2000);
        configSnap = await getDoc(doc(db, 'system', 'config'));
      } else {
        throw e;
      }
    }

    if (configSnap.exists()) {
      throw new Error('System is already initialized.');
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      registrarUser = userCredential.user;
      console.log("Bootstrap: Registrar account created");
    } catch (authError: any) {
      if (authError.code === 'auth/email-already-in-use') {
        console.log("Bootstrap: Registrar already exists, signing in...");
        try {
          const userCredential = await signInWithEmailAndPassword(auth, email, password);
          registrarUser = userCredential.user;
          console.log("Bootstrap: Registrar signed in");
        } catch (signInErr: any) {
          if (auth.currentUser?.email === email) {
            registrarUser = auth.currentUser;
            console.log("Bootstrap: Already signed in as registrar");
          } else {
            console.error("Bootstrap: Sign in failed:", signInErr);
            throw signInErr;
          }
        }
      } else if (authError.code === 'auth/network-request-failed') {
        // Retry once after a delay
        await delay(1000);
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        registrarUser = cred.user;
      } else {
        throw authError;
      }
    }
    
    if (registrarUser) {
      await writeUserProfile(registrarUser.uid, registrarId, surname, {
        firstName: 'Project',
        role: 'registrar',
        maxUnits: 30,
      });
    }

    // Add delay between auth operations to prevent network-request-failed
    await delay(800);

    // Sign back in as registrar before writing config + full demo catalog
    await signInWithEmailAndPassword(auth, email, password);

    console.log('Bootstrap: Finalizing system config...');
    const { semester, academicYear } = resolveCurrentTermFromCalendar(new Date());
    await setDoc(doc(db, 'system', 'config'), {
      ...buildIsatuTermConfig(semester, academicYear, { enrollmentOpen: true }),
      semesterAutomationEnabled: false,
      initializedAt: new Date().toISOString(),
    });

    console.log('Bootstrap: Seeding foundation catalog (users, subjects, enrollments, grades)...');
    await applyFoundationCatalog({
      portalYear: academicYear,
      portalSem: normalizeSemesterValue(semester),
    });

    console.log('Bootstrap: COMPLETE');
    return {
      success: true,
      loginHint: formatFoundationSeedLoginHint(),
    };
  } catch (error: unknown) {
    console.error("Bootstrap FAILED:", error);
    throw new Error(formatSeedError(error));
  }
};

/** Load profile before sign-in: doc id = studentId, or query (registrar-only list). */
async function getProfileByStudentId(id: string): Promise<DocumentSnapshot | null> {
  const normalized = id.toUpperCase().trim();
  const byDocId = await getDoc(doc(db, 'users', normalized));
  if (byDocId.exists()) {
    const data = byDocId.data();
    const docStudentId = String(data?.studentId ?? normalized).toUpperCase().trim();
    if (docStudentId === normalized || byDocId.id.toUpperCase() === normalized) {
      return byDocId;
    }
  }
  try {
    const q = query(
      collection(db, 'users'),
      where('studentId', '==', normalized),
      limit(1)
    );
    const snap = await getDocs(q);
    return snap.empty ? null : snap.docs[0];
  } catch {
    return null;
  }
}

export const loginWithId = async (id: string, passwordInput: string) => {
  const campusId = id.toUpperCase().trim();
  const email = campusAuthEmail(campusId);
  const password = passwordInput.trim();

  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    return finalizeLogin(campusId, cred);
  } catch (error: unknown) {
    const authErr = error as { code?: string };
    const profileSnap = await getProfileByStudentId(campusId);
    const profile = profileSnap?.data();
    const surname = profile?.surname ? String(profile.surname) : undefined;

    // Firestore profile exists but Auth user missing — create Auth with canonical password
    if (surname && password === getAuthPassword(surname)) {
      try {
        const cred = await createUserWithEmailAndPassword(auth, email, getAuthPassword(surname));
        return finalizeLogin(campusId, cred);
      } catch (createErr: unknown) {
        const createCode = (createErr as { code?: string }).code;
        if (createCode === 'auth/email-already-in-use') {
          throw new Error(
            `Account ${campusId} exists in Authentication with a different password. ` +
              `Delete ${email} in Firebase Console → Authentication, then sign in again with ${getAuthPassword(surname)}.`
          );
        }
        throw createErr;
      }
    }

    if (authErr.code === 'auth/operation-not-allowed') {
      throw new Error(
        'Enable Email/Password in Firebase Console → Authentication → Sign-in method.'
      );
    }
    if (
      authErr.code === 'auth/invalid-credential' ||
      authErr.code === 'auth/wrong-password' ||
      authErr.code === 'auth/user-not-found'
    ) {
      if (profile) {
        throw new Error(
          `Wrong password for ${campusId}. Use ${getAuthPassword(surname ?? 'surname')} (surname padded to 6+ characters with "1").`
        );
      }
      throw new Error(
        `No profile for ${campusId}. Registrar: provision under Admin → Users, or run Initialize then Foundation Seed once.`
      );
    }
    throw error;
  }
};
