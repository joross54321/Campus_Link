import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, doc, getDoc, getDocs, limit, query, where } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { ensureProfileForAuthUid } from '../services/authService';
import { UserProfile } from '../types';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  isAdmin: boolean;
  isProfessor: boolean;
  isStudent: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  isAdmin: false,
  isProfessor: false,
  isStudent: false,
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      try {
        setUser(user);
        if (user) {
          const academicId = user.email?.split('@')[0]?.toUpperCase();
          if (academicId) {
            try {
              await ensureProfileForAuthUid(user, academicId);
            } catch (syncErr) {
              console.error('Profile sync failed (login continues):', syncErr);
            }
          }
          const docSnap = await getDoc(doc(db, 'users', user.uid));
          const legacySnap =
            academicId && academicId !== user.uid
              ? await getDoc(doc(db, 'users', academicId))
              : null;
          let linkedSnap = legacySnap;
          if (!docSnap.exists() && !legacySnap?.exists()) {
            const byAuthUid = await getDocs(
              query(
                collection(db, 'users'),
                where('authUid', '==', user.uid),
                limit(1)
              )
            );
            if (!byAuthUid.empty) {
              linkedSnap = byAuthUid.docs[0];
            }
          }
          const merged = {
            ...(linkedSnap?.exists() ? linkedSnap.data() : {}),
            ...(docSnap.exists() ? docSnap.data() : {}),
          };
          if (docSnap.exists() || linkedSnap?.exists()) {
            setProfile({
              uid: user.uid,
              ...merged,
              studentId: merged.studentId ?? academicId,
            } as UserProfile);
          } else {
            setProfile(null);
          }
        } else {
          setProfile(null);
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
        if (user) {
          try {
            const docSnap = await getDoc(doc(db, 'users', user.uid));
            if (docSnap.exists()) {
              setProfile({ uid: user.uid, ...docSnap.data() } as UserProfile);
            } else {
              setProfile(null);
            }
          } catch {
            setProfile(null);
          }
        } else {
          setProfile(null);
        }
      } finally {
        setLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  const value = {
    user,
    profile,
    loading,
    isAdmin: profile?.role === 'registrar',
    isProfessor: profile?.role === 'professor',
    isStudent: profile?.role === 'student',
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
