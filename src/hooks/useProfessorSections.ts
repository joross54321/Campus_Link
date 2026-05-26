import { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { subjectMatchesProfessor } from '../lib/enrollmentUtils';
import { Subject } from '../types';

/** Sections from profile.handlingSections plus any section on subjects assigned to this professor. */
export function useProfessorSections(
  professorUid: string | undefined,
  handlingSections?: string[]
) {
  const [sections, setSections] = useState<string[]>(() =>
    [...new Set(handlingSections ?? [])].sort()
  );
  const [loading, setLoading] = useState(Boolean(professorUid));

  useEffect(() => {
    if (!professorUid) {
      setSections([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const snap = await getDocs(collection(db, 'subjects'));
        const fromSubjects = snap.docs
          .map((d) => ({ id: d.id, ...d.data() } as Subject))
          .filter((s) => subjectMatchesProfessor(s, professorUid, handlingSections))
          .map((s) => s.section);
        const merged = [...new Set([...(handlingSections ?? []), ...fromSubjects])].sort();
        if (!cancelled) setSections(merged);
      } catch {
        if (!cancelled) setSections([...new Set(handlingSections ?? [])].sort());
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [professorUid, handlingSections?.join('|')]);

  return { sections, loading };
}
