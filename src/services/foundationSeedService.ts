import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { collegeNameById } from '../lib/colleges';
import { normalizeCollegeName } from '../lib/directoryUtils';
import { resolveCurrentTermFromCalendar } from '../lib/isatuAcademicCalendar';
import { normalizeSemesterValue } from '../lib/studentEnrollments';
import { buildIsatuTermConfig } from '../lib/systemConfig';
import { ensureSeedUser, syncRegistrarFirestoreProfile } from './authService';
import {
  FOUNDATION_USERS,
  FOUNDATION_SUBJECTS,
  FOUNDATION_SUBJECT_DOC_IDS,
  FOUNDATION_ENROLLMENTS,
  FOUNDATION_GRADES,
  subjectIdFromSeed,
  foundationEnrollmentDocId,
  foundationGradeDocId,
} from '../lib/foundationSeedData';
import { formatFoundationSeedLoginHint } from '../lib/accountCredentials';
import {
  clearFoundationCatalog,
  pruneOrphanSubjects,
  type ClearFoundationResult,
} from './foundationClearService';

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

const CCI = collegeNameById('CCI')!;

/** Fix catalogs created before college names were standardized. */
async function repairLegacyCatalog() {
  const usersSnap = await getDocs(collection(db, 'users'));
  for (const d of usersSnap.docs) {
    const data = d.data();
    const normalized = normalizeCollegeName(data.college as string | undefined);
    if (normalized && normalized !== data.college) {
      await setDoc(doc(db, 'users', d.id), { college: normalized }, { merge: true });
    }
  }

  const subjectsSnap = await getDocs(collection(db, 'subjects'));
  for (const d of subjectsSnap.docs) {
    const data = d.data();
    const code = String(data.code ?? '');
    let college = normalizeCollegeName(data.college as string | undefined);
    if (code.startsWith('CS') || code.startsWith('IT')) {
      college = CCI;
    }
    if (college && college !== data.college) {
      await setDoc(doc(db, 'subjects', d.id), { college }, { merge: true });
    }
  }
}

export type FoundationCatalogOptions = {
  portalYear: string;
  portalSem: string;
  /** After a full clear, overwrite docs instead of merge (avoids stale fields). */
  replaceDocuments?: boolean;
};

/**
 * Writes foundation demo users, subjects, enrollments, and grades.
 * Auth accounts are created only when missing. Re-running merges and does not reset passwords.
 */
export async function applyFoundationCatalog(
  options: FoundationCatalogOptions
): Promise<{ loginHint: string }> {
  const portalYear = String(options.portalYear ?? '').trim();
  const portalSem = normalizeSemesterValue(options.portalSem);
  const mergeWrites = options.replaceDocuments !== true;

  const uidByStudentId: Record<string, string> = {};

  for (const user of FOUNDATION_USERS) {
    const { studentId, surname, firstName, role, college, ...rest } = user;
    uidByStudentId[studentId] = await ensureSeedUser(studentId, surname, {
      firstName,
      role,
      college,
      maxUnits: rest.maxUnits ?? 30,
      ...(rest.program ? { program: rest.program } : {}),
      ...(rest.section ? { section: rest.section } : {}),
      ...(rest.yearLevel != null ? { yearLevel: rest.yearLevel } : {}),
      ...(rest.handlingSections ? { handlingSections: rest.handlingSections } : {}),
    });
    await delay(250);
  }

  for (const s of FOUNDATION_SUBJECTS) {
    const id = subjectIdFromSeed(s);
    const professorId = uidByStudentId[s.professorStudentId];
    if (!professorId) {
      throw new Error(`Professor ${s.professorStudentId} missing — re-run seed.`);
    }
    await setDoc(
      doc(db, 'subjects', id),
      {
        id,
        code: s.code,
        title: s.title,
        units: s.units,
        prerequisites: s.prerequisites,
        yearLevel: s.yearLevel,
        semester: s.semester,
        status: s.status,
        college: s.college,
        section: s.section,
        sectionCapacity: s.sectionCapacity ?? 40,
        courseCapacity: s.courseCapacity ?? 120,
        professorId,
      },
      mergeWrites ? { merge: true } : undefined
    );
  }

  for (const en of FOUNDATION_ENROLLMENTS) {
    const userId = uidByStudentId[en.studentId];
    if (!userId) continue;

    const academicYear = String(en.academicYear ?? portalYear).trim();
    const semester = normalizeSemesterValue(en.semester ?? portalSem);
    const enrollmentId = foundationEnrollmentDocId(
      userId,
      en.subjectId,
      academicYear,
      semester
    );

    await setDoc(
      doc(db, 'enrollments', enrollmentId),
      {
        userId,
        subjectId: en.subjectId,
        academicYear,
        semester,
        status: en.status,
        requestType: en.requestType ?? 'initial',
        requestedAt: serverTimestamp(),
      },
      mergeWrites ? { merge: true } : undefined
    );
  }

  for (const g of FOUNDATION_GRADES) {
    const userId = uidByStudentId[g.studentId];
    if (!userId) continue;
    const subSnap = await getDoc(doc(db, 'subjects', g.subjectId));
    const professorId = subSnap.data()?.professorId ?? '';
    const academicYear = String(g.academicYear ?? portalYear).trim();
    const semester = normalizeSemesterValue(g.semester ?? portalSem);

    await setDoc(
      doc(db, 'grades', foundationGradeDocId(userId, g.subjectId, academicYear, semester)),
      {
        userId,
        subjectId: g.subjectId,
        professorId,
        grade: g.grade,
        status: g.status,
        academicYear,
        semester,
      },
      mergeWrites ? { merge: true } : undefined
    );
  }

  await repairLegacyCatalog();

  return { loginHint: formatFoundationSeedLoginHint() };
}

export type FoundationSeedResult = {
  loginHint: string;
  cleared?: ClearFoundationSummary;
};

export type ClearFoundationSummary = Pick<
  ClearFoundationResult,
  'total' | 'deletedByCollection'
>;

async function assertRegistrarMaySeed(): Promise<{
  uid: string;
  campusId?: string;
  portalYear: string;
  portalSem: string;
}> {
  const me = auth.currentUser;
  if (!me) throw new Error('Sign in as registrar before seeding.');

  await syncRegistrarFirestoreProfile(me);

  let myProfile = (await getDoc(doc(db, 'users', me.uid))).data();
  if (!myProfile?.role) {
    const campusId = me.email?.split('@')[0]?.toUpperCase().trim();
    if (campusId) {
      myProfile = (await getDoc(doc(db, 'users', campusId))).data();
    }
  }
  if (myProfile?.role !== 'registrar') {
    throw new Error('Only a registrar can run foundation seed.');
  }

  const configSnap = await getDoc(doc(db, 'system', 'config'));
  if (!configSnap.exists()) {
    throw new Error('Run Initialize on the login page first (system/config missing).');
  }
  const sys = configSnap.data();
  return {
    uid: me.uid,
    campusId: String(myProfile?.studentId ?? '').trim() || undefined,
    portalYear: String(sys.currentAcademicYear ?? '2025-2026'),
    portalSem: normalizeSemesterValue(sys.currentSemester ?? '1'),
  };
}

/**
 * Registrar-only: wipe demo Firestore data, then re-apply foundation catalog.
 * Keeps portal term (system/config) and your registrar login.
 */
export async function runFoundationSeedWithClear(): Promise<FoundationSeedResult> {
  const ctx = await assertRegistrarMaySeed();
  const cleared = await clearFoundationCatalog({
    uid: ctx.uid,
    campusId: ctx.campusId,
  });

  const { semester, academicYear } = resolveCurrentTermFromCalendar(new Date());
  const portalSem = normalizeSemesterValue(semester);
  await setDoc(
    doc(db, 'system', 'config'),
    {
      ...buildIsatuTermConfig(semester, academicYear, { enrollmentOpen: true }),
      semesterAutomationEnabled: false,
    },
    { merge: true }
  );

  const { loginHint } = await applyFoundationCatalog({
    portalYear: academicYear,
    portalSem,
    replaceDocuments: true,
  });

  const keepSubjectIds = new Set(FOUNDATION_SUBJECT_DOC_IDS);
  const orphansRemoved = await pruneOrphanSubjects(keepSubjectIds);

  return {
    loginHint,
    cleared: {
      total: cleared.total + orphansRemoved,
      deletedByCollection: {
        ...cleared.deletedByCollection,
        ...(orphansRemoved > 0 ? { subject_orphans: orphansRemoved } : {}),
      },
    },
  };
}

/**
 * Registrar-only refresh (Admin → System). Login-page Initialize calls applyFoundationCatalog directly.
 */
export async function runFoundationSeed(): Promise<FoundationSeedResult> {
  const ctx = await assertRegistrarMaySeed();
  const { loginHint } = await applyFoundationCatalog({
    portalYear: ctx.portalYear,
    portalSem: ctx.portalSem,
  });
  return { loginHint };
}
