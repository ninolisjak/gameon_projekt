import React from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import type { OwnerUser } from '../types/models';

type AuthContextValue = {
  user: User | null;
  ownerProfile: OwnerUser | null;
  loading: boolean;
  refresh: () => Promise<void>;
};

const AuthContext = React.createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<User | null>(null);
  const [ownerProfile, setOwnerProfile] = React.useState<OwnerUser | null>(null);
  const [loading, setLoading] = React.useState(true);

  const loadProfile = React.useCallback(async (u: User | null) => {
    if (!u) { setOwnerProfile(null); return; }
    try {
      const snap = await getDoc(doc(db, 'users', u.uid));
      if (snap.exists()) {
        setOwnerProfile({ ...(snap.data() as OwnerUser), uid: u.uid });
      } else {
        setOwnerProfile(null);
      }
    } catch (e) {
      console.warn('loadProfile failed', e);
      setOwnerProfile(null);
    }
  }, []);

  React.useEffect(() => {
    const unsub = onAuthStateChanged(auth, async u => {
      setUser(u);
      await loadProfile(u);
      setLoading(false);
    });
    return unsub;
  }, [loadProfile]);

  const refresh = React.useCallback(async () => {
    await loadProfile(auth.currentUser);
  }, [loadProfile]);

  return (
    <AuthContext.Provider value={{ user, ownerProfile, loading, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
