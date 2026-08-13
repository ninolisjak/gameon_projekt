import { doc, setDoc, Timestamp } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../config/firebase';
import { UserDoc } from './matchService';

export type BadgeTier = 'bronze' | 'silver' | 'gold' | 'seasonal';

export type Badge = {
  id: string;
  title: string;
  description: string;
  icon: string;
  tier: BadgeTier;
  unlocked: (s: BadgeStats) => boolean;
};

export type BadgeStats = {
  matchesPlayed: number;
  wins: number;
  goals: number;
  elo: number;
  reputation: number;
};

export const TIER_META: Record<BadgeTier, { label: string; color: string }> = {
  bronze: { label: 'Bron', color: '#cd7f32' },
  silver: { label: 'Srebro', color: '#c0c0c0' },
  gold: { label: 'Zlato', color: '#e6b325' },
  seasonal: { label: 'Sezonski', color: '#a855f7' },
};

export const BADGES: Badge[] = [
  {
    id: 'first_match',
    title: 'Novinec',
    description: 'Odigraj svojo prvo tekmo',
    icon: 'football',
    tier: 'bronze',
    unlocked: s => s.matchesPlayed >= 1,
  },
  {
    id: 'regular',
    title: 'Redni igralec',
    description: 'Odigraj 10 tekem',
    icon: 'calendar',
    tier: 'silver',
    unlocked: s => s.matchesPlayed >= 10,
  },
  {
    id: 'veteran',
    title: 'Veteran',
    description: 'Odigraj 50 tekem',
    icon: 'ribbon',
    tier: 'gold',
    unlocked: s => s.matchesPlayed >= 50,
  },
  {
    id: 'first_win',
    title: 'Prva zmaga',
    description: 'Zmagaj na tekmi',
    icon: 'trophy',
    tier: 'bronze',
    unlocked: s => s.wins >= 1,
  },
  {
    id: 'winner_10',
    title: 'Zmagovalec',
    description: 'Zmagaj na 10 tekmah',
    icon: 'trophy',
    tier: 'silver',
    unlocked: s => s.wins >= 10,
  },
  {
    id: 'champion',
    title: 'Prvak',
    description: 'Zmagaj na 25 tekmah',
    icon: 'medal',
    tier: 'gold',
    unlocked: s => s.wins >= 25,
  },
  {
    id: 'scorer',
    title: 'Strelec',
    description: 'Doseži 5 golov',
    icon: 'flash',
    tier: 'bronze',
    unlocked: s => s.goals >= 5,
  },
  {
    id: 'sharpshooter',
    title: 'Ostrostrelec',
    description: 'Doseži 25 golov',
    icon: 'flame',
    tier: 'silver',
    unlocked: s => s.goals >= 25,
  },
  {
    id: 'goal_machine',
    title: 'Golgeter',
    description: 'Doseži 50 golov',
    icon: 'rocket',
    tier: 'gold',
    unlocked: s => s.goals >= 50,
  },
  {
    id: 'rising',
    title: 'V vzponu',
    description: 'Doseži 800 ELO',
    icon: 'trending-up',
    tier: 'silver',
    unlocked: s => s.elo >= 800,
  },
  {
    id: 'elite',
    title: 'Elita',
    description: 'Doseži 1000 ELO',
    icon: 'star',
    tier: 'gold',
    unlocked: s => s.elo >= 1000,
  },
  {
    id: 'reliable',
    title: 'Zanesljiv',
    description: 'Doseži 70 točk reputacije',
    icon: 'shield-checkmark',
    tier: 'silver',
    unlocked: s => s.reputation >= 70,
  },
  {
    id: 'pillar',
    title: 'Steber ekipe',
    description: 'Doseži 90 točk reputacije',
    icon: 'shield',
    tier: 'gold',
    unlocked: s => s.reputation >= 90,
  },
  {
    id: 'season_grinder',
    title: 'Sezonski borec',
    description: 'Odigraj 20 tekem in zmagaj na 5',
    icon: 'sparkles',
    tier: 'seasonal',
    unlocked: s => s.matchesPlayed >= 20 && s.wins >= 5,
  },
];

const BADGE_BY_ID = new Map(BADGES.map(b => [b.id, b]));

export function getBadge(id: string): Badge | undefined {
  return BADGE_BY_ID.get(id);
}

export function statsFromUserDoc(u: Partial<UserDoc> | null | undefined): BadgeStats {
  return {
    matchesPlayed: u?.matchesPlayed ?? 0,
    wins: u?.wins ?? 0,
    goals: u?.goals ?? 0,
    elo: u?.elo ?? 0,
    reputation: u?.reputation ?? 0,
  };
}

export function computeUnlockedBadgeIds(stats: BadgeStats): string[] {
  return BADGES.filter(b => b.unlocked(stats)).map(b => b.id);
}

function isRealUid(uid: string): boolean {
  return uid.length > 10;
}

export async function syncBadges(uid: string): Promise<Badge[]> {
  if (!isRealUid(uid)) return [];
  try {
    const fn = httpsCallable<unknown, { unlocked: string[]; newlyUnlocked: string[] }>(
      functions,
      'syncBadges',
    );
    const res = await fn({});
    return (res.data.newlyUnlocked ?? [])
      .map(id => BADGE_BY_ID.get(id))
      .filter((b): b is Badge => !!b);
  } catch (e) {
    console.warn('syncBadges failed', e);
    return [];
  }
}

export async function selectBadge(uid: string, badgeId: string | null): Promise<void> {
  if (!isRealUid(uid)) return;
  const ref = doc(db, 'users', uid);
  await setDoc(
    ref,
    { selectedBadge: badgeId, updatedAt: Timestamp.now() },
    { merge: true },
  );
}
