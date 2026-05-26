import { useEffect, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from './useAuth';
import { useStudentEnrollmentStatus } from './useStudentEnrollmentStatus';
import { Subject, UserProfile } from '../types';
import { dedupeUserProfiles } from '../lib/directoryUtils';
import { subjectMatchesProfessor } from '../lib/enrollmentUtils';
import {
  SearchSuggestion,
  suggestionFromSubject,
  suggestionFromUser,
} from '../lib/searchSuggestions';

export function useSearchIndex() {
  const { profile, user, isStudent, isAdmin } = useAuth();
  const { canEnroll } = useStudentEnrollmentStatus();
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!profile) {
      setSuggestions([]);
      return;
    }

    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const items: SearchSuggestion[] = [];

        if (isAdmin) {
          const [userSnap, subSnap] = await Promise.all([
            getDocs(collection(db, 'users')),
            getDocs(collection(db, 'subjects')),
          ]);
          if (cancelled) return;
          const users = dedupeUserProfiles(
            userSnap.docs.map((d) => ({ uid: d.id, ...d.data() } as UserProfile))
          );
          users.forEach((u) => items.push(suggestionFromUser(u)));
          subSnap.docs.forEach((d) => {
            const s = { id: d.id, ...d.data() } as Subject;
            items.push(suggestionFromSubject(s, 'registrar'));
          });
        } else if (profile.role === 'professor' && user) {
          const subSnap = await getDocs(collection(db, 'subjects'));
          if (cancelled) return;
          subSnap.docs
            .map((d) => ({ id: d.id, ...d.data() } as Subject))
            .filter((s) =>
              subjectMatchesProfessor(s, user.uid, profile.handlingSections)
            )
            .forEach((s) => items.push(suggestionFromSubject(s, 'professor')));
        } else if (isStudent && profile) {
          const subSnap = await getDocs(collection(db, 'subjects'));
          if (cancelled) return;
          subSnap.docs
            .map((d) => ({ id: d.id, ...d.data() } as Subject))
            .filter(
              (s) => !profile.college || s.college === profile.college
            )
            .forEach((s) =>
              items.push(
                suggestionFromSubject(s, 'student', { canEnroll })
              )
            );
        }

        if (!cancelled) setSuggestions(items);
      } catch {
        if (!cancelled) setSuggestions([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [profile, user, isStudent, isAdmin, canEnroll]);

  return { suggestions, loading };
}

/** Build suggestions from data already on the page (e.g. admin dashboard). */
export function buildLocalSearchIndex(
  users: UserProfile[],
  subjects: Subject[],
  role: 'registrar' | 'student' | 'professor' = 'registrar'
): SearchSuggestion[] {
  const items: SearchSuggestion[] = [];
  users.forEach((u) => items.push(suggestionFromUser(u)));
  subjects.forEach((s) => items.push(suggestionFromSubject(s, role)));
  return items;
}
