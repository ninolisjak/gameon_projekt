const BADGE_RULES = [
  { id: 'first_match', unlocked: s => s.matchesPlayed >= 1 },
  { id: 'regular', unlocked: s => s.matchesPlayed >= 10 },
  { id: 'veteran', unlocked: s => s.matchesPlayed >= 50 },
  { id: 'first_win', unlocked: s => s.wins >= 1 },
  { id: 'winner_10', unlocked: s => s.wins >= 10 },
  { id: 'champion', unlocked: s => s.wins >= 25 },
  { id: 'rising', unlocked: s => s.elo >= 800 },
  { id: 'elite', unlocked: s => s.elo >= 1000 },
  { id: 'reliable', unlocked: s => s.reputation >= 70 },
  { id: 'pillar', unlocked: s => s.reputation >= 90 },
  { id: 'season_grinder', unlocked: s => s.matchesPlayed >= 20 && s.wins >= 5 },
];

function num(v) {
  return typeof v === 'number' && isFinite(v) ? v : 0;
}

function statsFromUser(u) {
  const d = u || {};
  return {
    matchesPlayed: num(d.matchesPlayed),
    wins: num(d.wins),
    goals: num(d.goals),
    elo: num(d.elo),
    reputation: num(d.reputation),
  };
}

function computeUnlockedBadgeIds(stats) {
  return BADGE_RULES.filter(b => b.unlocked(stats)).map(b => b.id);
}

function mergeUnlockedBadges(existing, stats) {
  const already = Array.isArray(existing) ? existing : [];
  const qualifies = computeUnlockedBadgeIds(stats);
  const merged = [...new Set([...already, ...qualifies])];
  const isNew = merged.length !== already.length;
  return { badges: merged, changed: isNew };
}

module.exports = {
  BADGE_RULES,
  statsFromUser,
  computeUnlockedBadgeIds,
  mergeUnlockedBadges,
};
