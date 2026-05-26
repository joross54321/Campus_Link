import {
  collection,
  getDocs,
  onSnapshot,
  query,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from './firebase';
import { Enrollment, SystemConfig, UserProfile } from '../types';

/** All Firestore userId values that may reference this student (legacy + auth uid). */
export function studentEnrollmentUserIds(profile: Pick<UserProfile, 'uid' | 'studentId'>): string[] {
  const ids = new Set<string>();
  if (profile.uid) ids.add(profile.uid);
  const campusId = profile.studentId?.trim().toUpperCase();
  if (campusId && campusId !== profile.uid) ids.add(campusId);
  if (profile.studentId?.trim() && profile.studentId.trim() !== campusId) {
    ids.add(profile.studentId.trim());
  }
  return [...ids];
}

export function normalizeSemesterValue(sem: unknown): string {
  if (sem == null || sem === '') return '';
  const s = String(sem).trim();
  if (s === '1' || s === '1st' || /^1(st)?\s*sem/i.test(s)) return '1';
  if (s === '2' || s === '2nd' || /^2(nd)?\s*sem/i.test(s)) return '2';
  if (/summer/i.test(s)) return 'Summer';
  return s;
}

export function enrollmentMatchesTerm(
  e: Pick<Enrollment, 'academicYear' | 'semester'>,
  config: SystemConfig
): boolean {
  const year = String(e.academicYear ?? '').trim();
  const cfgYear = String(config.currentAcademicYear ?? '').trim();
  const sem = normalizeSemesterValue(e.semester);
  const cfgSem = normalizeSemesterValue(config.currentSemester);

  if (!year && !sem) return true;
  if (!year && sem && sem === cfgSem) return true;
  if (year && !sem && year === cfgYear) return true;

  return year === cfgYear && sem === cfgSem;
}

/** Parse AY/sem encoded in foundation enrollment doc ids (`…_20252026_2`). */
export function parseTermFromEnrollmentDocId(
  enrollmentId: string
): { academicYear?: string; semester?: string } {
  const parts = enrollmentId.split('_');
  if (parts.length < 2) return {};
  const semRaw = parts[parts.length - 1];
  const ayCompact = parts[parts.length - 2];
  if (!/^\d{8}$/.test(ayCompact)) return {};
  const semester = normalizeSemesterValue(semRaw);
  const academicYear = `${ayCompact.slice(0, 4)}-${ayCompact.slice(4, 8)}`;
  return { academicYear, semester };
}

function resolveEnrollmentTermFields(
  e: Pick<Enrollment, 'academicYear' | 'semester' | 'id'>
): { academicYear: string; semester: string } {
  let year = String(e.academicYear ?? '').trim();
  let sem = normalizeSemesterValue(e.semester);
  if ((!year || !sem) && e.id) {
    const parsed = parseTermFromEnrollmentDocId(e.id);
    year = year || parsed.academicYear || '';
    sem = sem || parsed.semester || '';
  }
  return { academicYear: year, semester: sem };
}

/** Portal term from system/config (normalized). */
export function portalTermFromConfig(config: SystemConfig): {
  academicYear: string;
  semester: string;
} {
  return {
    academicYear: String(config.currentAcademicYear ?? '').trim(),
    semester: normalizeSemesterValue(config.currentSemester),
  };
}

/** Actions (enroll, add, drop, study load) use exact portal AY + semester only. */
export function enrollmentMatchesPortalTermStrict(
  e: Pick<Enrollment, 'academicYear' | 'semester' | 'id'>,
  config: SystemConfig
): boolean {
  const { academicYear: year, semester: sem } = resolveEnrollmentTermFields(e);
  const portal = portalTermFromConfig(config);
  return year === portal.academicYear && sem === portal.semester;
}

export const STUDY_LOAD_STATUSES = ['approved', 'pending_drop'] as const;

export function isStudyLoadEnrollment(e: Enrollment): boolean {
  return (
    e.status === 'approved' ||
    e.status === 'pending_drop'
  );
}

export function filterStudyLoadEnrollments(
  enrollments: Enrollment[],
  config: SystemConfig
): Enrollment[] {
  return enrollments.filter(
    (e) => isStudyLoadEnrollment(e) && enrollmentMatchesPortalTermStrict(e, config)
  );
}

async function queryAllEnrollmentsForUserId(userId: string): Promise<Enrollment[]> {
  const snap = await getDocs(
    query(collection(db, 'enrollments'), where('userId', '==', userId))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Enrollment));
}

/** Fetch all enrollments for a student (all statuses), merged across userId keys. */
export async function fetchStudentEnrollments(
  profile: Pick<UserProfile, 'uid' | 'studentId'>
): Promise<Enrollment[]> {
  const userIds = studentEnrollmentUserIds(profile);
  const byId = new Map<string, Enrollment>();
  await Promise.all(
    userIds.map(async (uid) => {
      const list = await queryAllEnrollmentsForUserId(uid);
      list.forEach((e) => byId.set(e.id, e));
    })
  );
  return [...byId.values()];
}

/** @deprecated Use fetchStudentEnrollments + filterStudyLoadEnrollments */
export async function fetchStudentStudyLoadEnrollments(
  profile: Pick<UserProfile, 'uid' | 'studentId'>
): Promise<Enrollment[]> {
  const all = await fetchStudentEnrollments(profile);
  return all.filter((e) => isStudyLoadEnrollment(e));
}

/** Live listener — all enrollment docs for this student (any status). */
export function subscribeStudentEnrollments(
  profile: Pick<UserProfile, 'uid' | 'studentId'>,
  onChange: (rows: Enrollment[]) => void,
  onError?: (err: unknown) => void
): Unsubscribe {
  const userIds = studentEnrollmentUserIds(profile);
  const byId = new Map<string, Enrollment>();

  const emit = () => onChange([...byId.values()]);

  const unsubs: Unsubscribe[] = userIds.map((userId) =>
    onSnapshot(
      query(collection(db, 'enrollments'), where('userId', '==', userId)),
      (snap) => {
        snap.docChanges().forEach((change) => {
          if (change.type === 'removed') {
            byId.delete(change.doc.id);
          } else {
            byId.set(change.doc.id, {
              id: change.doc.id,
              ...change.doc.data(),
            } as Enrollment);
          }
        });
        emit();
      },
      (err) => onError?.(err)
    )
  );

  return () => unsubs.forEach((u) => u());
}

/** Live study-load rows (approved / pending_drop) for current term. */
export function subscribeStudentStudyLoadEnrollments(
  profile: Pick<UserProfile, 'uid' | 'studentId'>,
  config: SystemConfig,
  onChange: (rows: Enrollment[]) => void,
  onError?: (err: unknown) => void
): Unsubscribe {
  return subscribeStudentEnrollments(
    profile,
    (all) => onChange(filterStudyLoadEnrollments(all, config)),
    onError
  );
}
