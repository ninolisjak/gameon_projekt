import React from 'react';
import { Colors, getColors } from '../styles/theme';

type PremiumContextValue = {
  isPremium: boolean;
  buyPremium: () => void;
  cancelPremium: () => void;
  colors: Colors;
  // Stats only exist for Premium players. Lite version has no stats.
  // New Premium players start at these baseline values.
  elo: number;
  reputation: number;
};

// Baseline a player starts with the moment they buy Premium.
const STARTING_ELO = 700;
const STARTING_REPUTATION = 50;

const PremiumContext = React.createContext<PremiumContextValue | undefined>(undefined);

export function PremiumProvider({ children }: { children: React.ReactNode }) {
  const [isPremium, setIsPremium] = React.useState(false);

  const value = React.useMemo<PremiumContextValue>(
    () => ({
      isPremium,
      buyPremium: () => setIsPremium(true),
      cancelPremium: () => setIsPremium(false),
      colors: getColors(isPremium),
      elo: STARTING_ELO,
      reputation: STARTING_REPUTATION,
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
