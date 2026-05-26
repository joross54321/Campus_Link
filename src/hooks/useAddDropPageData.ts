import { useEffect, useState } from 'react';
import { collection, getDoc, getDocs, doc, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Subject, Enrollment, SystemConfig, UserProfile } from '../types';
import { filterStudyLoadEnrollments } from '../lib/studentEnrollments';
import {
  buildEnrollmentCapacitySnapshot,
  type EnrollmentCapacitySnapshot,
} from '../lib/enrollmentEligibility';

export function useAddDropPageData(
  profile: UserProfile | null | undefined,
  enrollments: Enrollment[],
  config: SystemConfig | null
) {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [passedCodes, setPassedCodes] = useState<string[]>([]);
  const [loadByEnrollmentId, setLoadByEnrollmentId] = useState<Record<string, Subject>>({});
  const [capacitySnapshot, setCapacitySnapshot] = useState<EnrollmentCapacitySnapshot>({
    bySubjectId: {},
    byCourseCode: {},
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.uid) {
      setLoading(false);
      return;
    }
    const load = async () => {
      setLoading(true);
      try {
        const subSnap = await getDocs(collection(db, 'subjects'));
        const subjectsData = subSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Subject));
        setSubjects(subjectsData);

        const enrollSnap = await getDocs(collection(db, 'enrollments'));
        const allEnrolls = enrollSnap.docs.map(
          (d) => ({ id: d.id, ...d.data() } as Enrollment)
        );
        if (config) {
          setCapacitySnapshot(
            buildEnrollmentCapacitySnapshot(allEnrolls, subjectsData, config)
          );
        }

        const gradesSnap = await getDocs(
          query(
            collection(db, 'grades'),
            where('userId', '==', profile.uid),
            where('status', '==', 'posted')
          )
        );
        const codes: string[] = [];
        for (const gd of gradesSnap.docs) {
          const grade = gd.data().grade as number;
          if (grade > 3.0) continue;
          const s = await getDoc(doc(db, 'subjects', gd.data().subjectId));
          if (s.exists()) codes.push(s.data().code);
        }
        setPassedCodes(codes);

        if (config) {
          const rows = filterStudyLoadEnrollments(enrollments, config);
          const map: Record<string, Subject> = {};
          await Promise.all(
            rows.map(async (e) => {
              const snap = await getDoc(doc(db, 'subjects', e.subjectId));
              if (snap.exists()) map[e.id] = { id: snap.id, ...snap.data() } as Subject;
            })
          );
          setLoadByEnrollmentId(map);
        }
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [profile?.uid, enrollments, config?.currentAcademicYear, config?.currentSemester]);

  return { subjects, passedCodes, loadByEnrollmentId, capacitySnapshot, loading };
}
