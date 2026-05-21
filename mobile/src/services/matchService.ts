import {
  doc, setDoc, getDoc, onSnapshot, Timestamp,
  collection, addDoc, runTransaction, query, where,
} from 'firebase/firestore';
import { db } from '../config/firebase';

// ─── Types ────────────────────────────────────────────────────────────────────

export type MatchResult = 'pending' | 'team_a_won' | 'team_b_won' | 'draw';

export type PendingEvent = {
  id: string;
  team: 'A' | 'B';
  scorerId: string;
  proposedBy: string;
  confirmedBy: string[];
  createdAt?: any;
};

export type ConfirmedEvent = {
  id: string;
  team: 'A' | 'B';
  scorerId: string;
  confirmedBy: string[];
  confirmedAt?: any;
};

export type Match = {
  id: string;
  sport: 'futsal' | 'basketball';
  location: { lat: number; lng: number; name: string };
  datetime: any;
  totalSpots: number;
  filledSpots: number;
  status: 'open' | 'full' | 'closed';
  isPublic: boolean;
  players: string[];
  waitlist: string[];
  createdBy: string;
  createdAt?: any;
  // Premium-only fields
  isPremium?: boolean;
  teamA?: string[];
  teamB?: string[];
  scoreA?: number;
  scoreB?: number;
  pendingEvents?: PendingEvent[];
  events?: ConfirmedEvent[];
  attended?: string[];
  result?: MatchResult;
  finalized?: boolean;
};

export type UserDoc = {
  uid: string;
  elo: number;
  reputation: number;
  isPremium: boolean;
  displayName?: string;
  email?: string;
  updatedAt?: any;
};

export type JoinResult =
  | { status: 'joined' }
  | { status: 'waitlisted'; position: number };

// ─── Constants ────────────────────────────────────────────────────────────────

export const STARTING_ELO = 700;
export const STARTING_REPUTATION = 50;
const ELO_K = 32;
const GOAL_ELO_BONUS = 5;
const REP_ATTEND = 2;
const REP_NO_SHOW = 5;

export function requiredConfirmations(totalSpots: number): number {
  return Math.max(2, Math.ceil(totalSpots / 3));
}

function genId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

// ─── Match operations (Firestore) ─────────────────────────────────────────────

export async function createMatch(data: {
  sport: 'futsal' | 'basketball';
  lat: number;
  lng: number;
  locationName: string;
  datetime: Date;
  totalSpots: number;
  createdBy: string;
  isPremium?: boolean;
}): Promise<{ id: string }> {
  const base: any = {
    sport: data.sport,
    location: { lat: data.lat, lng: data.lng, name: data.locationName },
    datetime: Timestamp.fromDate(data.datetime),
    totalSpots: data.totalSpots,
    filledSpots: 1,
    status: data.totalSpots <= 1 ? 'full' : 'open',
    isPublic: true,
    players: [data.createdBy],
    waitlist: [],
    createdBy: data.createdBy,
    createdAt: Timestamp.now(),
    isPremium: !!data.isPremium,
  };

  if (data.isPremium) {
    base.teamA = [data.createdBy];
    base.teamB = [];
    base.scoreA = 0;
    base.scoreB = 0;
    base.pendingEvents = [];
    base.events = [];
    base.attended = [];
    base.result = 'pending';
    base.finalized = false;
  }

  const ref = await addDoc(collection(db, 'matches'), base);
  return { id: ref.id };
}

export async function joinMatch(matchId: string, userId: string, opts?: { userIsPremium?: boolean }): Promise<JoinResult> {
  const ref = doc(db, 'matches', matchId);
  return runTransaction(db, async tx => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('Tekma ne obstaja.');
    const m = snap.data() as Omit<Match, 'id'>;
    if (m.isPremium && !opts?.userIsPremium) throw new Error('Premium tekme so na voljo samo Premium uporabnikom.');
    if (m.players.includes(userId)) throw new Error('Že si prijavljen.');
    if ((m.waitlist ?? []).includes(userId)) throw new Error('Že si na čakalni vrsti.');

    if (m.filledSpots < m.totalSpots) {
      const players = [...m.players, userId];
      const filledSpots = players.length;
      const status: 'open' | 'full' = filledSpots >= m.totalSpots ? 'full' : 'open';
      const update: any = { players, filledSpots, status };

      if (m.isPremium) {
        const half = Math.floor(m.totalSpots / 2);
        const teamA = m.teamA ?? [];
        const teamB = m.teamB ?? [];
        if (teamA.length <= teamB.length && teamA.length < half) {
          update.teamA = [...teamA, userId];
        } else {
          update.teamB = [...(m.teamB ?? []), userId];
        }
      }

      tx.update(ref, update);
      return { status: 'joined' as const };
    }

    const waitlist = [...(m.waitlist ?? []), userId];
    tx.update(ref, { waitlist });
    return { status: 'waitlisted' as const, position: waitlist.length };
  });
}

export async function leaveMatch(matchId: string, userId: string) {
  const ref = doc(db, 'matches', matchId);
  return runTransaction(db, async tx => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('Tekma ne obstaja.');
    const m = snap.data() as Omit<Match, 'id'>;
    if (!m.players.includes(userId)) throw new Error('Nisi prijavljen.');
    if (m.createdBy === userId) throw new Error('Ustvarjalec ne more zapustiti tekme.');

    let players = m.players.filter(p => p !== userId);
    const update: any = {};

    if (m.isPremium) {
      update.teamA = (m.teamA ?? []).filter(p => p !== userId);
      update.teamB = (m.teamB ?? []).filter(p => p !== userId);
    }

    const waitlist = [...(m.waitlist ?? [])];
    if (waitlist.length > 0) {
      const [next, ...rest] = waitlist;
      players = [...players, next];
      update.waitlist = rest;
      if (m.isPremium) {
        const teamA = update.teamA ?? (m.teamA ?? []).filter((p: string) => p !== userId);
        const teamB = update.teamB ?? (m.teamB ?? []).filter((p: string) => p !== userId);
        const half = Math.floor(m.totalSpots / 2);
        if (teamA.length <= teamB.length && teamA.length < half) {
          update.teamA = [...teamA, next];
        } else {
          update.teamB = [...teamB, next];
        }
      }
    } else {
      update.waitlist = [];
    }

    const filledSpots = players.length;
    const status: 'open' | 'full' = filledSpots >= m.totalSpots ? 'full' : 'open';
    tx.update(ref, { players, filledSpots, status, ...update });
  });
}

export async function leaveWaitlist(matchId: string, userId: string) {
  const ref = doc(db, 'matches', matchId);
  return runTransaction(db, async tx => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('Tekma ne obstaja.');
    const m = snap.data() as Omit<Match, 'id'>;
    if (!(m.waitlist ?? []).includes(userId)) throw new Error('Nisi na čakalni vrsti.');
    tx.update(ref, { waitlist: (m.waitlist ?? []).filter(p => p !== userId) });
  });
}

// ─── Premium live-scoring (Firestore) ─────────────────────────────────────────

export async function checkIn(matchId: string, userId: string) {
  const ref = doc(db, 'matches', matchId);
  return runTransaction(db, async tx => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('Tekma ne obstaja.');
    const m = snap.data() as Omit<Match, 'id'>;
    const attended = m.attended ?? [];
    if (!attended.includes(userId)) {
      tx.update(ref, { attended: [...attended, userId] });
    }
  });
}

export async function swapTeam(matchId: string, userId: string, requesterId: string) {
  const ref = doc(db, 'matches', matchId);
  return runTransaction(db, async tx => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('Tekma ne obstaja.');
    const m = snap.data() as Omit<Match, 'id'>;
    if (!m.isPremium) throw new Error('Samo Premium tekme imajo ekipe.');
    if (m.createdBy !== requesterId) throw new Error('Samo gostitelj lahko premika igralce.');
    if (m.finalized) throw new Error('Tekma je že zaključena.');

    const teamA = m.teamA ?? [];
    const teamB = m.teamB ?? [];
    if (teamA.includes(userId)) {
      tx.update(ref, { teamA: teamA.filter(p => p !== userId), teamB: [...teamB, userId] });
    } else if (teamB.includes(userId)) {
      tx.update(ref, { teamA: [...teamA, userId], teamB: teamB.filter(p => p !== userId) });
    }
  });
}

export async function proposeGoal(matchId: string, scorerId: string, proposerId: string) {
  const ref = doc(db, 'matches', matchId);
  return runTransaction(db, async tx => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('Tekma ne obstaja.');
    const m = snap.data() as Omit<Match, 'id'>;
    if (!m.isPremium) throw new Error('Samo Premium tekme imajo živo točkovanje.');
    if (m.finalized) throw new Error('Tekma je že zaključena.');
    if (!m.players.includes(proposerId)) throw new Error('Samo prijavljeni igralci lahko predlagajo gol.');
    if (!m.players.includes(scorerId)) throw new Error('Strelec ni prijavljen na tekmo.');

    const team: 'A' | 'B' = (m.teamA ?? []).includes(scorerId) ? 'A' : 'B';
    const event: PendingEvent = {
      id: genId(), team, scorerId, proposedBy: proposerId,
      confirmedBy: [proposerId], createdAt: Timestamp.now(),
    };

    const attended = [...(m.attended ?? [])];
    if (!attended.includes(scorerId)) attended.push(scorerId);
    if (!attended.includes(proposerId)) attended.push(proposerId);

    tx.update(ref, { pendingEvents: [...(m.pendingEvents ?? []), event], attended });
  });
}

export async function confirmGoal(matchId: string, eventId: string, userId: string) {
  const ref = doc(db, 'matches', matchId);
  return runTransaction(db, async tx => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('Tekma ne obstaja.');
    const m = snap.data() as Omit<Match, 'id'>;
    if (!m.isPremium) throw new Error('Samo Premium tekme.');
    if (m.finalized) throw new Error('Tekma je že zaključena.');
    if (!m.players.includes(userId)) throw new Error('Samo prijavljeni igralci lahko potrdijo gol.');

    const pending = [...(m.pendingEvents ?? [])];
    const idx = pending.findIndex(e => e.id === eventId);
    if (idx === -1) throw new Error('Dogodek ne obstaja.');
    const event = pending[idx];
    if (event.confirmedBy.includes(userId)) throw new Error('Že si potrdil ta gol.');

    const newConfirmedBy = [...event.confirmedBy, userId];
    const attended = [...(m.attended ?? [])];
    if (!attended.includes(userId)) attended.push(userId);

    const threshold = requiredConfirmations(m.totalSpots);
    const update: any = { attended };

    if (newConfirmedBy.length >= threshold) {
      pending.splice(idx, 1);
      const confirmed: ConfirmedEvent = {
        id: event.id, team: event.team, scorerId: event.scorerId,
        confirmedBy: newConfirmedBy, confirmedAt: Timestamp.now(),
      };
      update.events = [...(m.events ?? []), confirmed];
      update.pendingEvents = pending;
      if (event.team === 'A') update.scoreA = (m.scoreA ?? 0) + 1;
      else update.scoreB = (m.scoreB ?? 0) + 1;
    } else {
      pending[idx] = { ...event, confirmedBy: newConfirmedBy };
      update.pendingEvents = pending;
    }

    tx.update(ref, update);
  });
}

export async function dismissPendingEvent(matchId: string, eventId: string, requesterId: string) {
  const ref = doc(db, 'matches', matchId);
  return runTransaction(db, async tx => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('Tekma ne obstaja.');
    const m = snap.data() as Omit<Match, 'id'>;
    if (m.createdBy !== requesterId) throw new Error('Samo gostitelj lahko zavrne predlog.');
    tx.update(ref, { pendingEvents: (m.pendingEvents ?? []).filter(e => e.id !== eventId) });
  });
}

// ─── ELO + finalize (writes user docs to Firestore) ──────────────────────────

function eloDelta(playerElo: number, oppTeamAvg: number, actual: number): number {
  const expected = 1 / (1 + Math.pow(10, (oppTeamAvg - playerElo) / 400));
  return Math.round(ELO_K * (actual - expected));
}

export async function finalizeMatch(matchId: string, requesterId: string) {
  const ref = doc(db, 'matches', matchId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Tekma ne obstaja.');
  const m = snap.data() as Omit<Match, 'id'>;

  if (m.createdBy !== requesterId) throw new Error('Samo gostitelj lahko zaključi tekmo.');
  if (!m.isPremium) throw new Error('Samo Premium tekme imajo ELO/reputacijo.');
  if (m.finalized) throw new Error('Tekma je že zaključena.');

  const teamA = m.teamA ?? [];
  const teamB = m.teamB ?? [];
  const scoreA = m.scoreA ?? 0;
  const scoreB = m.scoreB ?? 0;
  const attended = m.attended ?? [];

  const result: MatchResult =
    scoreA > scoreB ? 'team_a_won' : scoreB > scoreA ? 'team_b_won' : 'draw';

  const allPlayers = [...teamA, ...teamB];
  const userDocs = await Promise.all(
    allPlayers.map(async uid => {
      try {
        const uSnap = await getDoc(doc(db, 'users', uid));
        if (uSnap.exists()) {
          const d = uSnap.data() as UserDoc;
          return { uid, elo: d.elo ?? STARTING_ELO, reputation: d.reputation ?? STARTING_REPUTATION };
        }
      } catch { /* no user doc yet */ }
      return { uid, elo: STARTING_ELO, reputation: STARTING_REPUTATION };
    })
  );
  const eloMap = new Map(userDocs.map(u => [u.uid, u.elo]));

  const avg = (team: string[]) =>
    team.length === 0 ? STARTING_ELO :
    team.reduce((s, uid) => s + (eloMap.get(uid) ?? STARTING_ELO), 0) / team.length;

  const avgA = avg(teamA);
  const avgB = avg(teamB);
  const actualA = result === 'team_a_won' ? 1 : result === 'draw' ? 0.5 : 0;

  const goalsByPlayer = new Map<string, number>();
  for (const e of (m.events ?? [])) {
    if (e.scorerId) goalsByPlayer.set(e.scorerId, (goalsByPlayer.get(e.scorerId) ?? 0) + 1);
  }

  const updates = userDocs.map(u => {
    const onA = teamA.includes(u.uid);
    const oppAvg = onA ? avgB : avgA;
    const actual = onA ? actualA : 1 - actualA;
    const hasAttended = attended.includes(u.uid);
    const goals = goalsByPlayer.get(u.uid) ?? 0;

    const resultElo = hasAttended ? eloDelta(u.elo, oppAvg, actual) : 0;
    const goalElo = hasAttended ? goals * GOAL_ELO_BONUS : 0;
    const dElo = resultElo + goalElo;
    const dRep = hasAttended ? REP_ATTEND : -REP_NO_SHOW;

    return {
      uid: u.uid, goals, resultElo, goalElo, dElo, dRep,
      newElo: Math.max(0, u.elo + dElo),
      newRep: Math.max(0, u.reputation + dRep),
    };
  });

  await setDoc(ref, { result, finalized: true, status: 'closed' }, { merge: true });

  const realUsers = updates.filter(u => !DEMO_USERS.includes(u.uid as any) && u.uid.length > 10);
  await Promise.allSettled(
    realUsers.map(u =>
      setDoc(doc(db, 'users', u.uid),
        { uid: u.uid, elo: u.newElo, reputation: u.newRep, updatedAt: Timestamp.now() },
        { merge: true })
    )
  );

  return { result, perPlayer: updates };
}

// ─── Subscriptions (Firestore) ────────────────────────────────────────────────

export function subscribeMatch(matchId: string, onData: (m: Match | null) => void, onError?: (e: Error) => void) {
  return onSnapshot(
    doc(db, 'matches', matchId),
    snap => onData(snap.exists() ? ({ id: snap.id, ...snap.data() } as Match) : null),
    err => onError?.(err as any)
  );
}

export function subscribeMatches(onData: (ms: Match[]) => void) {
  const q = query(collection(db, 'matches'), where('isPublic', '==', true));
  return onSnapshot(
    q,
    snap => {
      const matches = snap.docs
        .map(d => ({ id: d.id, ...d.data() } as Match))
        .filter(m => m.status !== 'closed');
      onData(matches);
    },
    () => onData([])
  );
}

// ─── User doc (Firestore) ─────────────────────────────────────────────────────

export async function ensureUserDoc(uid: string, patch?: Partial<UserDoc>) {
  const ref = doc(db, 'users', uid);
  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, { uid, elo: STARTING_ELO, reputation: STARTING_REPUTATION, isPremium: false, updatedAt: Timestamp.now(), ...patch });
    } else if (patch) {
      await setDoc(ref, { ...patch, updatedAt: Timestamp.now() }, { merge: true });
    }
  } catch (e) {
    console.warn('ensureUserDoc failed (no Firestore?)', e);
  }
}

export async function resolveUserNames(uids: string[]): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  const toFetch = uids.filter(uid => uid.length > 10);
  uids.filter(uid => uid.length <= 10).forEach(uid => result.set(uid, uid));

  const fetches = await Promise.allSettled(
    toFetch.map(async uid => {
      const snap = await getDoc(doc(db, 'users', uid));
      if (snap.exists()) {
        const d = snap.data() as UserDoc;
        const name = d.displayName || (d.email ? d.email.split('@')[0] : null) || uid.slice(0, 8);
        return { uid, name };
      }
      return { uid, name: uid.slice(0, 8) };
    })
  );

  for (const r of fetches) {
    if (r.status === 'fulfilled') result.set(r.value.uid, r.value.name);
  }
  return result;
}

export function subscribeUserDoc(uid: string, onData: (u: UserDoc | null) => void, onError?: (e: Error) => void) {
  try {
    const ref = doc(db, 'users', uid);
    return onSnapshot(ref, snap => {
      if (!snap.exists()) { onData(null); return; }
      onData(snap.data() as UserDoc);
    }, err => onError?.(err as any));
  } catch {
    onData(null);
    return () => {};
  }
}

// ─── Demo users (kept for MatchDetailsScreen switcher) ────────────────────────

export const DEMO_USERS = ['ana', 'marc', 'luka', 'niko'] as const;
