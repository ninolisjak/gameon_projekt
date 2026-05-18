import React from 'react';
import { Colors, getColors } from '../styles/theme';

type PremiumContextValue = {
  isPremium: boolean;
  buyPremium: () => void;
  cancelPremium: () => void;
  colors: Colors;
  // Display-only stats — not backed by real logic yet.
  elo: number;
  reputation: number;
};

const PremiumContext = React.createContext<PremiumContextValue | undefined>(undefined);

export function PremiumProvider({ children }: { children: React.ReactNode }) {
  const [isPremium, setIsPremium] = React.useState(false);

  const value = React.useMemo<PremiumContextValue>(
    () => ({
      isPremium,
      buyPremium: () => setIsPremium(true),
      cancelPremium: () => setIsPremium(false),
      colors: getColors(isPremium),
      elo: 1240,
      reputation: 87,
    }),
    [isPremium]
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
