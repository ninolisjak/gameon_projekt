import React from 'react';
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
  // Live values from Firestore once an auth'd Premium user exists; otherwise
  // fall back to starting baselines.
  elo: number;
  reputation: number;
};

const PremiumContext = React.createContext<PremiumContextValue | undefined>(undefined);

export function PremiumProvider({ children }: { children: React.ReactNode }) {
  const [isPremium, setIsPremium] = React.useState(false);
  const [userDoc, setUserDoc] = React.useState<UserDoc | null>(null);

  // Watch the current user's doc so ELO/reputation/Premium flag stay in sync
  // with whatever the match service writes.
  React.useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const unsub = subscribeUserDoc(uid, doc => {
      setUserDoc(doc);
      if (doc) setIsPremium(!!doc.isPremium);
    });
    return unsub;
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
