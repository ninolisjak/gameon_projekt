import { UserDoc, PlayerPosition, BalanceMeta, STARTING_ELO } from './matchService';

export type BalanceInput = {
  uid: string;
  elo: number;
  winRate: number;
  matchesPlayed: number;
  position?: PlayerPosition;
};

export type BalanceResult = {
  teamA: string[];
  teamB: string[];
  meta: BalanceMeta;
  score: number;
};

const W_ELO = 0.65;
const W_WINRATE = 0.25;
const W_EXPERIENCE = 0.10;

export function playerStrength(p: BalanceInput): number {
  const eloPart = p.elo;
  const winRatePart = p.winRate * 1000;
  const expPart = Math.min(p.matchesPlayed, 50) * 10;
  return W_ELO * eloPart + W_WINRATE * winRatePart + W_EXPERIENCE * expPart;
}

export function userToBalanceInput(u: UserDoc): BalanceInput {
  const wins = u.wins ?? 0;
  const losses = u.losses ?? 0;
  const draws = u.draws ?? 0;
  const played = u.matchesPlayed ?? (wins + losses + draws);
  const winRate = played > 0 ? (wins + 0.5 * draws) / played : 0.5;
  return {
    uid: u.uid,
    elo: u.elo ?? STARTING_ELO,
    winRate,
    matchesPlayed: played,
    position: u.position,
  };
}

function avg(team: BalanceInput[], key: (p: BalanceInput) => number): number {
  if (team.length === 0) return 0;
  return team.reduce((s, p) => s + key(p), 0) / team.length;
}

function positionBalanceScore(teamA: BalanceInput[], teamB: BalanceInput[]): number {
  const allPos = new Set<PlayerPosition>();
  teamA.forEach(p => p.position && allPos.add(p.position));
  teamB.forEach(p => p.position && allPos.add(p.position));
  if (allPos.size === 0) return 100;

  let totalDiff = 0;
  allPos.forEach(pos => {
    const a = teamA.filter(p => p.position === pos).length;
    const b = teamB.filter(p => p.position === pos).length;
    totalDiff += Math.abs(a - b);
  });
  const maxDiff = teamA.length + teamB.length;
  return Math.max(0, 100 - (totalDiff / maxDiff) * 100);
}

function snakeDraft(players: BalanceInput[]): { a: BalanceInput[]; b: BalanceInput[] } {
  const sorted = [...players].sort((x, y) => playerStrength(y) - playerStrength(x));
  const a: BalanceInput[] = [];
  const b: BalanceInput[] = [];
  sorted.forEach((p, i) => {
    const round = Math.floor(i / 2);
    const goesToA = round % 2 === 0 ? i % 2 === 0 : i % 2 === 1;
    if (goesToA) a.push(p); else b.push(p);
  });
  return { a, b };
}

function teamStrength(team: BalanceInput[]): number {
  return team.reduce((s, p) => s + playerStrength(p), 0);
}

function optimizeBySwap(a: BalanceInput[], b: BalanceInput[]): { a: BalanceInput[]; b: BalanceInput[] } {
  let curA = [...a];
  let curB = [...b];
  let improved = true;
  let iterations = 0;
  const MAX_ITER = 20;

  while (improved && iterations < MAX_ITER) {
    improved = false;
    iterations++;
    let currentDiff = Math.abs(teamStrength(curA) - teamStrength(curB));

    for (let i = 0; i < curA.length; i++) {
      for (let j = 0; j < curB.length; j++) {
        const newA = [...curA];
        const newB = [...curB];
        const tmp = newA[i];
        newA[i] = newB[j];
        newB[j] = tmp;
        const newDiff = Math.abs(teamStrength(newA) - teamStrength(newB));
        if (newDiff < currentDiff - 0.01) {
          curA = newA;
          curB = newB;
          currentDiff = newDiff;
          improved = true;
        }
      }
    }
  }
  return { a: curA, b: curB };
}

export function computeBalanceScore(eloDiff: number, positionBalance: number, avgElo: number): number {
  const eloRange = Math.max(100, avgElo * 0.3);
  const eloPart = Math.max(0, 100 - (eloDiff / eloRange) * 100);
  return Math.round(0.7 * eloPart + 0.3 * positionBalance);
}

export function balanceTeams(players: BalanceInput[]): BalanceResult {
  if (players.length < 2) {
    return {
      teamA: players.map(p => p.uid),
      teamB: [],
      meta: { avgEloA: 0, avgEloB: 0, eloDiff: 0, positionBalance: 100 },
      score: 100,
    };
  }

  const { a: draftedA, b: draftedB } = snakeDraft(players);
  const { a: finalA, b: finalB } = optimizeBySwap(draftedA, draftedB);

  const avgEloA = Math.round(avg(finalA, p => p.elo));
  const avgEloB = Math.round(avg(finalB, p => p.elo));
  const eloDiff = Math.abs(avgEloA - avgEloB);
  const positionBalance = Math.round(positionBalanceScore(finalA, finalB));
  const avgElo = (avgEloA + avgEloB) / 2;
  const score = computeBalanceScore(eloDiff, positionBalance, avgElo);

  return {
    teamA: finalA.map(p => p.uid),
    teamB: finalB.map(p => p.uid),
    meta: { avgEloA, avgEloB, eloDiff, positionBalance },
    score,
  };
}
