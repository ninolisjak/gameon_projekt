const baseColors = {
  text: '#ffffff',
  success: '#22c55e',
  successBg: '#0d2a1a',
  warning: '#f59e0b',
  danger: '#ef4444',
  dangerBg: '#2a0d0d',
};

const standardColors = {
  ...baseColors,

  bg: '#0a0e1a',
  bgElevated: '#131929',
  bgSelected: '#1a2540',
  border: '#2a3550',
  borderSubtle: '#1e2a45',

  primary: '#3b82f6',
  primaryDark: '#1d4ed8',
  primaryLight: '#60a5fa',
  primaryTint: '#1a2540',

  textMuted: '#8896aa',
  textFaint: '#4a5568',
};

const premiumColors = {
  ...baseColors,

  bg: '#13100a',
  bgElevated: '#1f1a0d',
  bgSelected: '#2c2410',
  border: '#4a3d18',
  borderSubtle: '#332b12',

  primary: '#e6b325',
  primaryDark: '#b8860b',
  primaryLight: '#f5d020',
  primaryTint: '#2c2410',

  textMuted: '#bcaa78',
  textFaint: '#6e6038',
};

export type Colors = typeof standardColors;

export function getColors(isPremium: boolean): Colors {
  return isPremium ? premiumColors : standardColors;
}

// Default palette kept for any non-themed module that imports `colors` directly.
export const colors: Colors = standardColors;
