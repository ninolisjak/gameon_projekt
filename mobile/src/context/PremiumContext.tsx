import React from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { Colors, getColors } from '../styles/theme';
import { auth } from '../config/firebase';
import {
  ensureUserDoc, subscribeUserDoc, UserDoc,
  STARTING_ELO, STARTING_REPUTATION,
} from '../services/matchService';

type PremiumContextValue = {
  isPremium: boolean;
  buyPremium: () => Promise<void>;
  cancelPremium: () => Promise<void>;
  colors: Colors;
  elo: number;
  reputation: number;
};

const PremiumContext = React.createContext<PremiumContextValue | undefined>(undefined);

export function PremiumProvider({ children }: { children: React.ReactNode }) {
  const [isPremium, setIsPremium] = React.useState(false);
  const [userDoc, setUserDoc] = React.useState<UserDoc | null>(null);

  React.useEffect(() => {
    let unsubDoc: (() => void) | undefined;

    const unsubAuth = onAuthStateChanged(auth, user => {
      if (unsubDoc) { unsubDoc(); unsubDoc = undefined; }
      if (!user) { setUserDoc(null); setIsPremium(false); return; }
      unsubDoc = subscribeUserDoc(user.uid, d => {
        setUserDoc(d);
        if (d) setIsPremium(!!d.isPremium);
      });
    });

    return () => { unsubAuth(); if (unsubDoc) unsubDoc(); };
  }, []);

  const buyPremium = React.useCallback(async () => {
    setIsPremium(true);
    const uid = auth.currentUser?.uid;
    if (uid) {
      try { await ensureUserDoc(uid, { isPremium: true }); }
      catch (e) { console.warn('ensureUserDoc failed', e); }
    }
  }, []);

  const cancelPremium = React.useCallback(async () => {
    setIsPremium(false);
    const uid = auth.currentUser?.uid;
    if (uid) {
      try { await ensureUserDoc(uid, { isPremium: false }); }
      catch (e) { console.warn('ensureUserDoc failed', e); }
    }
  }, []);

  const value = React.useMemo<PremiumContextValue>(
    () => ({
      isPremium,
      buyPremium,
      cancelPremium,
      colors: getColors(isPremium),
      elo: userDoc?.elo ?? STARTING_ELO,
      reputation: userDoc?.reputation ?? STARTING_REPUTATION,
    }),
    [isPremium, userDoc, buyPremium, cancelPremium]
  );

  return <PremiumContext.Provider value={value}>{children}</PremiumContext.Provider>;
}

export function usePremium(): PremiumContextValue {
  const ctx = React.useContext(PremiumContext);
  if (!ctx) throw new Error('usePremium must be used within a PremiumProvider');
  return ctx;
}

export function useColors(): Colors {
  return usePremium().colors;
}
