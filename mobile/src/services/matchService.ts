import {
  collection, addDoc, Timestamp, doc, updateDoc, setDoc,
  arrayUnion, arrayRemove, increment, onSnapshot, getDoc,
  runTransaction,
} from 'firebase/firestore';
import { db } from '../config/firebase';

export type MatchResult = 'pending' | 'team_a_won' | 'team_b_won' | 'draw';

export type PendingEvent = {
  id: string;
  team: 'A' | 'B';
  proposedBy: string;
  confirmedBy: string[];
  createdAt?: any;
};

export type ConfirmedEvent = {
  id: string;
  team: 'A' | 'B';
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
  createdBy: string;
  createdAt?: any;

  // Premium-match fields (only set when isPremium === true)
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
  updatedAt?: any;
};

export const STARTING_ELO = 700;
export const STARTING_REPUTATION = 50;
const ELO_K = 32;
const REP_ATTEND = 2;
const REP_NO_SHOW = 5;

export function requiredConfirmations(totalSpots: number): number {
  return Math.max(2, Math.ceil(totalSpots / 3));
}

function genId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export async function createMatch(data: {
  sport: 'futsal' | 'basketball';
  lat: number;
  lng: number;
  locationName: string;
  datetime: Date;
  totalSpots: number;
  createdBy: string;
  isPremium?: boolean;
}) {
  const base = {
    sport: data.sport,
    location: { lat: data.lat, lng: data.lng, name: data.locationName },
    datetime: Timestamp.fromDate(data.datetime),
    totalSpots: data.totalSpots,
    filledSpots: 1,
    status: 'open' as const,
    isPublic: true,
    players: [data.createdBy],
    createdBy: data.createdBy,
    createdAt: Timestamp.now(),
  };

  if (data.isPremium) {
    return addDoc(collection(db, 'matches'), {
      ...base,
      isPremium: true,
      teamA: [data.createdBy],
      teamB: [],
      scoreA: 0,
      scoreB: 0,
      pendingEvents: [],
      events: [],
      attended: [],
      result: 'pending' as MatchResult,
      finalized: false,
    });
  }

  return addDoc(collection(db, 'matches'), { ...base, isPremium: false });
}

export async function joinMatch(matchId: string, userId: string, opts?: { userIsPremium?: boolean }) {
  const ref = doc(db, 'matches', matchId);
  await runTransaction(db, async tx => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('Tekma ne obstaja.');
    const data = snap.data() as Match;
    if (data.isPremium && !opts?.userIsPremium) {
      throw new Error('Premium tekme so na voljo samo Premium uporabnikom.');
    }
    if (data.players?.includes(userId)) throw new Error('Že si prijavljen.');
    if (data.filledSpots >= data.totalSpots) throw new Error('Tekma je polna.');

    const newFilled = data.filledSpots + 1;
    const update: any = {
      players: arrayUnion(userId),
      filledSpots: increment(1),
      status: newFilled >= data.totalSpots ? 'full' : 'open',
    };

    if (data.isPremium) {
      const teamA = data.teamA ?? [];
      const teamB = data.teamB ?? [];
      const half = Math.floor(data.totalSpots / 2);
      if (teamA.length <= teamB.length && teamA.length < half) {
        update.teamA = [...teamA, userId];
      } else {
        update.teamB = [...teamB, userId];
      }
    }

    tx.update(ref, update);
  });
}

export async function leaveMatch(matchId: string, userId: string) {
  const ref = doc(db, 'matches', matchId);
  await runTransaction(db, async tx => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('Tekma ne obstaja.');
    const data = snap.data() as Match;
    if (!data.players?.includes(userId)) throw new Error('Nisi prijavljen.');
    if (data.createdBy === userId) throw new Error('Ustvarjalec ne more zapustiti tekme.');

    const update: any = {
      players: arrayRemove(userId),
      filledSpots: increment(-1),
      status: 'open',
    };

    if (data.isPremium) {
      const teamA = data.teamA ?? [];
      const teamB = data.teamB ?? [];
      update.teamA = teamA.filter(p => p !== userId);
      update.teamB = teamB.filter(p => p !== userId);
    }

    tx.update(ref, update);
  });
}

export async function swapTeam(matchId: string, userId: string, requesterId: string) {
  const ref = doc(db, 'matches', matchId);
  await runTransaction(db, async tx => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('Tekma ne obstaja.');
    const data = snap.data() as Match;
    if (!data.isPremium) throw new Error('Samo Premium tekme imajo ekipe.');
    if (data.createdBy !== requesterId) throw new Error('Samo gostitelj lahko premika igralce.');
    if (data.finalized) throw new Error('Tekma je že zaključena.');
    const teamA = data.teamA ?? [];
    const teamB = data.teamB ?? [];
    if (teamA.includes(userId)) {
      tx.update(ref, { teamA: teamA.filter(p => p !== userId), teamB: [...teamB, userId] });
    } else if (teamB.includes(userId)) {
      tx.update(ref, { teamB: teamB.filter(p => p !== userId), teamA: [...teamA, userId] });
    }
  });
}

export async function checkIn(matchId: string, userId: string) {
  const ref = doc(db, 'matches', matchId);
  await updateDoc(ref, { attended: arrayUnion(userId) });
}

export async function proposeGoal(matchId: string, team: 'A' | 'B', proposerId: string) {
  const ref = doc(db, 'matches', matchId);
  await runTransaction(db, async tx => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('Tekma ne obstaja.');
    const data = snap.data() as Match;
    if (!data.isPremium) throw new Error('Samo Premium tekme imajo živo točkovanje.');
    if (data.finalized) throw new Error('Tekma je že zaključena.');
    if (!data.players?.includes(proposerId)) throw new Error('Samo prijavljeni igralci lahko predlagajo gol.');

    const event: PendingEvent = {
      id: genId(),
      team,
      proposedBy: proposerId,
      confirmedBy: [proposerId],
      createdAt: Timestamp.now(),
    };

    const pending = [...(data.pendingEvents ?? []), event];
    const attended = data.attended ?? [];
    const update: any = { pendingEvents: pending };
    if (!attended.includes(proposerId)) update.attended = [...attended, proposerId];
    tx.update(ref, update);
  });
}

export async function confirmGoal(matchId: string, eventId: string, userId: string) {
  const ref = doc(db, 'matches', matchId);
  await runTransaction(db, async tx => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('Tekma ne obstaja.');
    const data = snap.data() as Match;
    if (!data.isPremium) throw new Error('Samo Premium tekme.');
    if (data.finalized) throw new Error('Tekma je že zaključena.');
    if (!data.players?.includes(userId)) throw new Error('Samo prijavljeni igralci lahko potrdijo gol.');

    const pending = [...(data.pendingEvents ?? [])];
    const idx = pending.findIndex(e => e.id === eventId);
    if (idx === -1) throw new Error('Dogodek ne obstaja.');
    const event = pending[idx];
    if (event.confirmedBy.includes(userId)) throw new Error('Že si potrdil ta gol.');

    const newConfirmedBy = [...event.confirmedBy, userId];
    const threshold = requiredConfirmations(data.totalSpots);

    const update: any = {};
    const attended = data.attended ?? [];
    if (!attended.includes(userId)) update.attended = [...attended, userId];

    if (newConfirmedBy.length >= threshold) {
      pending.splice(idx, 1);
      const confirmed: ConfirmedEvent = {
        id: event.id,
        team: event.team,
        confirmedBy: newConfirmedBy,
        confirmedAt: Timestamp.now(),
      };
      const events = [...(data.events ?? []), confirmed];
      update.pendingEvents = pending;
      update.events = events;
      if (event.team === 'A') update.scoreA = (data.scoreA ?? 0) + 1;
      else update.scoreB = (data.scoreB ?? 0) + 1;
    } else {
      pending[idx] = { ...event, confirmedBy: newConfirmedBy };
      update.pendingEvents = pending;
    }

    tx.update(ref, update);
  });
}

export async function dismissPendingEvent(matchId: string, eventId: string, requesterId: string) {
  const ref = doc(db, 'matches', matchId);
  await runTransaction(db, async tx => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('Tekma ne obstaja.');
    const data = snap.data() as Match;
    if (data.createdBy !== requesterId) throw new Error('Samo gostitelj lahko zavrne predlog.');
    const pending = (data.pendingEvents ?? []).filter(e => e.id !== eventId);
    tx.update(ref, { pendingEvents: pending });
  });
}

function eloDelta(playerElo: number, oppTeamAvg: number, actual: number): number {
  const expected = 1 / (1 + Math.pow(10, (oppTeamAvg - playerElo) / 400));
  return Math.round(ELO_K * (actual - expected));
}

export async function finalizeMatch(matchId: string, requesterId: string) {
  const ref = doc(db, 'matches', matchId);

  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Tekma ne obstaja.');
  const data = snap.data() as Match;
  if (data.createdBy !== requesterId) throw new Error('Samo gostitelj lahko zaključi tekmo.');
  if (!data.isPremium) throw new Error('Samo Premium tekme imajo ELO/reputacijo.');
  if (data.finalized) throw new Error('Tekma je že zaključena.');

  const teamA = data.teamA ?? [];
  const teamB = data.teamB ?? [];
  const scoreA = data.scoreA ?? 0;
  const scoreB = data.scoreB ?? 0;
  const attended = data.attended ?? [];

  const result: MatchResult =
    scoreA > scoreB ? 'team_a_won' : scoreB > scoreA ? 'team_b_won' : 'draw';

  const allPlayers = [...teamA, ...teamB];
  const userDocs = await Promise.all(
    allPlayers.map(async uid => {
      const u = await getDoc(doc(db, 'users', uid));
      if (u.exists()) {
        const d = u.data() as UserDoc;
        return { uid, elo: d.elo ?? STARTING_ELO, reputation: d.reputation ?? STARTING_REPUTATION };
      }
      return { uid, elo: STARTING_ELO, reputation: STARTING_REPUTATION };
    })
  );
  const eloMap = new Map(userDocs.map(u => [u.uid, u.elo]));

  function avg(team: string[]): number {
    if (team.length === 0) return STARTING_ELO;
    const sum = team.reduce((s, uid) => s + (eloMap.get(uid) ?? STARTING_ELO), 0);
    return sum / team.length;
  }
  const avgA = avg(teamA);
  const avgB = avg(teamB);

  const actualA = result === 'team_a_won' ? 1 : result === 'draw' ? 0.5 : 0;
  const actualB = 1 - actualA;

  const updates = userDocs.map(u => {
    const onA = teamA.includes(u.uid);
    const oppAvg = onA ? avgB : avgA;
    const actual = onA ? actualA : actualB;
    const hasAttended = attended.includes(u.uid);

    const dElo = hasAttended ? eloDelta(u.elo, oppAvg, actual) : 0;
    const dRep = hasAttended ? REP_ATTEND : -REP_NO_SHOW;

    return {
      uid: u.uid,
      newElo: Math.max(0, u.elo + dElo),
      newRep: Math.max(0, u.reputation + dRep),
      dElo,
      dRep,
    };
  });

  await Promise.all(
    updates.map(u =>
      setDoc(
        doc(db, 'users', u.uid),
        { uid: u.uid, elo: u.newElo, reputation: u.newRep, updatedAt: Timestamp.now() },
        { merge: true }
      )
    )
  );

  await updateDoc(ref, { result, finalized: true, status: 'closed' });

  return { result, perPlayer: updates };
}

export function subscribeMatch(matchId: string, onData: (m: Match | null) => void, onError?: (e: Error) => void) {
  if (matchId === 'test') {
    onData(null);
    return () => {};
  }
  const ref = doc(db, 'matches', matchId);
  return onSnapshot(ref, snap => {
    if (!snap.exists()) { onData(null); return; }
    onData({ id: snap.id, ...(snap.data() as any) });
  }, err => onError?.(err as any));
}

export async function ensureUserDoc(uid: string, patch?: Partial<UserDoc>) {
  const ref = doc(db, 'users', uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      uid,
      elo: STARTING_ELO,
      reputation: STARTING_REPUTATION,
      isPremium: false,
      updatedAt: Timestamp.now(),
      ...patch,
    });
  } else if (patch) {
    await setDoc(ref, { ...patch, updatedAt: Timestamp.now() }, { merge: true });
  }
}

export function subscribeUserDoc(uid: string, onData: (u: UserDoc | null) => void, onError?: (e: Error) => void) {
  const ref = doc(db, 'users', uid);
  return onSnapshot(ref, snap => {
    if (!snap.exists()) { onData(null); return; }
    onData(snap.data() as UserDoc);
  }, err => onError?.(err as any));
}
