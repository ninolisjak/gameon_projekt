import {
  doc, setDoc, getDoc, onSnapshot, Timestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';

// ─── Types ────────────────────────────────────────────────────────────────────

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
  updatedAt?: any;
};

export type JoinResult =
  | { status: 'joined' }
  | { status: 'waitlisted'; position: number };

// ─── Constants ────────────────────────────────────────────────────────────────

export const STARTING_ELO = 700;
export const STARTING_REPUTATION = 50;
const ELO_K = 32;
const REP_ATTEND = 2;
const REP_NO_SHOW = 5;

export function requiredConfirmations(totalSpots: number): number {
  return Math.max(2, Math.ceil(totalSpots / 3));
}

// ─── In-memory store ──────────────────────────────────────────────────────────

let store: Match[] = [];
const matchListeners = new Map<string, Set<(m: Match | null) => void>>();
const allListeners = new Set<(ms: Match[]) => void>();

function getOpen(): Match[] {
  return store.filter(m => m.isPublic && m.status !== 'closed');
}

function notifyMatch(id: string) {
  const m = store.find(x => x.id === id) ?? null;
  matchListeners.get(id)?.forEach(fn => fn(m));
}

function notifyAll() {
  allListeners.forEach(fn => fn(getOpen()));
}

function syncCapacity(m: Match) {
  m.filledSpots = m.players.length;
  m.status = m.filledSpots >= m.totalSpots ? 'full' : 'open';
}

function genId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

// ─── Match operations (in-memory) ─────────────────────────────────────────────

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
  const id = genId();
  const base: Match = {
    id,
    sport: data.sport,
    location: { lat: data.lat, lng: data.lng, name: data.locationName },
    datetime: data.datetime,
    totalSpots: data.totalSpots,
    filledSpots: 1,
    status: data.totalSpots <= 1 ? 'full' : 'open',
    isPublic: true,
    players: [data.createdBy],
    waitlist: [],
    createdBy: data.createdBy,
    createdAt: new Date(),
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

  store.push(base);
  notifyAll();
  return { id };
}

export async function joinMatch(matchId: string, userId: string, opts?: { userIsPremium?: boolean }): Promise<JoinResult> {
  const m = store.find(x => x.id === matchId);
  if (!m) throw new Error('Tekma ne obstaja.');
  if (m.isPremium && !opts?.userIsPremium) throw new Error('Premium tekme so na voljo samo Premium uporabnikom.');
  if (m.players.includes(userId)) throw new Error('Že si prijavljen.');
  if (m.waitlist.includes(userId)) throw new Error('Že si na čakalni vrsti.');

  if (m.filledSpots < m.totalSpots) {
    m.players = [...m.players, userId];
    if (m.isPremium) {
      const half = Math.floor(m.totalSpots / 2);
      const teamA = m.teamA ?? [];
      const teamB = m.teamB ?? [];
      if (teamA.length <= teamB.length && teamA.length < half) m.teamA = [...teamA, userId];
      else m.teamB = [...(m.teamB ?? []), userId];
    }
    syncCapacity(m);
    notifyMatch(matchId);
    notifyAll();
    return { status: 'joined' };
  }

  m.waitlist = [...m.waitlist, userId];
  notifyMatch(matchId);
  notifyAll();
  return { status: 'waitlisted', position: m.waitlist.length };
}

export async function leaveMatch(matchId: string, userId: string) {
  const m = store.find(x => x.id === matchId);
  if (!m) throw new Error('Tekma ne obstaja.');
  if (!m.players.includes(userId)) throw new Error('Nisi prijavljen.');
  if (m.createdBy === userId) throw new Error('Ustvarjalec ne more zapustiti tekme.');

  m.players = m.players.filter(p => p !== userId);
  if (m.isPremium) {
    m.teamA = (m.teamA ?? []).filter(p => p !== userId);
    m.teamB = (m.teamB ?? []).filter(p => p !== userId);
  }

  if (m.waitlist.length > 0) {
    const [next, ...rest] = m.waitlist;
    m.players = [...m.players, next];
    m.waitlist = rest;
  }

  syncCapacity(m);
  notifyMatch(matchId);
  notifyAll();
}

export async function leaveWaitlist(matchId: string, userId: string) {
  const m = store.find(x => x.id === matchId);
  if (!m) throw new Error('Tekma ne obstaja.');
  if (!m.waitlist.includes(userId)) throw new Error('Nisi na čakalni vrsti.');
  m.waitlist = m.waitlist.filter(p => p !== userId);
  notifyMatch(matchId);
  notifyAll();
}

// ─── Premium live-scoring (in-memory) ────────────────────────────────────────

export async function checkIn(matchId: string, userId: string) {
  const m = store.find(x => x.id === matchId);
  if (!m) throw new Error('Tekma ne obstaja.');
  if (!m.attended) m.attended = [];
  if (!m.attended.includes(userId)) m.attended = [...m.attended, userId];
  notifyMatch(matchId);
}

export async function swapTeam(matchId: string, userId: string, requesterId: string) {
  const m = store.find(x => x.id === matchId);
  if (!m) throw new Error('Tekma ne obstaja.');
  if (!m.isPremium) throw new Error('Samo Premium tekme imajo ekipe.');
  if (m.createdBy !== requesterId) throw new Error('Samo gostitelj lahko premika igralce.');
  if (m.finalized) throw new Error('Tekma je že zaključena.');

  const teamA = m.teamA ?? [];
  const teamB = m.teamB ?? [];
  if (teamA.includes(userId)) {
    m.teamA = teamA.filter(p => p !== userId);
    m.teamB = [...teamB, userId];
  } else if (teamB.includes(userId)) {
    m.teamB = teamB.filter(p => p !== userId);
    m.teamA = [...teamA, userId];
  }
  notifyMatch(matchId);
}

export async function proposeGoal(matchId: string, team: 'A' | 'B', proposerId: string) {
  const m = store.find(x => x.id === matchId);
  if (!m) throw new Error('Tekma ne obstaja.');
  if (!m.isPremium) throw new Error('Samo Premium tekme imajo živo točkovanje.');
  if (m.finalized) throw new Error('Tekma je že zaključena.');
  if (!m.players.includes(proposerId)) throw new Error('Samo prijavljeni igralci lahko predlagajo gol.');

  const event: PendingEvent = {
    id: genId(), team, proposedBy: proposerId,
    confirmedBy: [proposerId], createdAt: new Date(),
  };
  m.pendingEvents = [...(m.pendingEvents ?? []), event];
  if (!m.attended) m.attended = [];
  if (!m.attended.includes(proposerId)) m.attended = [...m.attended, proposerId];
  notifyMatch(matchId);
}

export async function confirmGoal(matchId: string, eventId: string, userId: string) {
  const m = store.find(x => x.id === matchId);
  if (!m) throw new Error('Tekma ne obstaja.');
  if (!m.isPremium) throw new Error('Samo Premium tekme.');
  if (m.finalized) throw new Error('Tekma je že zaključena.');
  if (!m.players.includes(userId)) throw new Error('Samo prijavljeni igralci lahko potrdijo gol.');

  const pending = [...(m.pendingEvents ?? [])];
  const idx = pending.findIndex(e => e.id === eventId);
  if (idx === -1) throw new Error('Dogodek ne obstaja.');
  const event = pending[idx];
  if (event.confirmedBy.includes(userId)) throw new Error('Že si potrdil ta gol.');

  const newConfirmedBy = [...event.confirmedBy, userId];
  if (!m.attended) m.attended = [];
  if (!m.attended.includes(userId)) m.attended = [...m.attended, userId];

  const threshold = requiredConfirmations(m.totalSpots);
  if (newConfirmedBy.length >= threshold) {
    pending.splice(idx, 1);
    const confirmed: ConfirmedEvent = {
      id: event.id, team: event.team,
      confirmedBy: newConfirmedBy, confirmedAt: new Date(),
    };
    m.events = [...(m.events ?? []), confirmed];
    m.pendingEvents = pending;
    if (event.team === 'A') m.scoreA = (m.scoreA ?? 0) + 1;
    else m.scoreB = (m.scoreB ?? 0) + 1;
  } else {
    pending[idx] = { ...event, confirmedBy: newConfirmedBy };
    m.pendingEvents = pending;
  }
  notifyMatch(matchId);
}

export async function dismissPendingEvent(matchId: string, eventId: string, requesterId: string) {
  const m = store.find(x => x.id === matchId);
  if (!m) throw new Error('Tekma ne obstaja.');
  if (m.createdBy !== requesterId) throw new Error('Samo gostitelj lahko zavrne predlog.');
  m.pendingEvents = (m.pendingEvents ?? []).filter(e => e.id !== eventId);
  notifyMatch(matchId);
}

// ─── ELO + finalize (writes user docs to Firestore) ──────────────────────────

function eloDelta(playerElo: number, oppTeamAvg: number, actual: number): number {
  const expected = 1 / (1 + Math.pow(10, (oppTeamAvg - playerElo) / 400));
  return Math.round(ELO_K * (actual - expected));
}

export async function finalizeMatch(matchId: string, requesterId: string) {
  const m = store.find(x => x.id === matchId);
  if (!m) throw new Error('Tekma ne obstaja.');
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
        const snap = await getDoc(doc(db, 'users', uid));
        if (snap.exists()) {
          const d = snap.data() as UserDoc;
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

  const updates = userDocs.map(u => {
    const onA = teamA.includes(u.uid);
    const oppAvg = onA ? avgB : avgA;
    const actual = onA ? actualA : 1 - actualA;
    const hasAttended = attended.includes(u.uid);
    const dElo = hasAttended ? eloDelta(u.elo, oppAvg, actual) : 0;
    const dRep = hasAttended ? REP_ATTEND : -REP_NO_SHOW;
    return { uid: u.uid, newElo: Math.max(0, u.elo + dElo), newRep: Math.max(0, u.reputation + dRep), dElo, dRep };
  });

  await Promise.all(
    updates.map(u =>
      setDoc(doc(db, 'users', u.uid),
        { uid: u.uid, elo: u.newElo, reputation: u.newRep, updatedAt: Timestamp.now() },
        { merge: true })
    )
  );

  m.result = result;
  m.finalized = true;
  m.status = 'closed';
  notifyMatch(matchId);
  notifyAll();

  return { result, perPlayer: updates };
}

// ─── Subscriptions ────────────────────────────────────────────────────────────

export function subscribeMatch(matchId: string, onData: (m: Match | null) => void, _onError?: (e: Error) => void) {
  if (!matchListeners.has(matchId)) matchListeners.set(matchId, new Set());
  matchListeners.get(matchId)!.add(onData);
  onData(store.find(x => x.id === matchId) ?? null);
  return () => { matchListeners.get(matchId)?.delete(onData); };
}

export function subscribeMatches(onData: (ms: Match[]) => void) {
  allListeners.add(onData);
  onData(getOpen());
  return () => { allListeners.delete(onData); };
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

// ─── Demo seed ────────────────────────────────────────────────────────────────

export const DEMO_USERS = ['ana', 'marc', 'luka', 'niko'] as const;

(function seedDemo() {
  if (store.length > 0) return;
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(18, 0, 0, 0);
  store.push({
    id: 'demo-seed',
    sport: 'futsal',
    location: { lat: 46.5617, lng: 15.6386, name: 'Demo: tekma s čakalno vrsto' },
    datetime: tomorrow,
    totalSpots: 2,
    filledSpots: 2,
    status: 'full',
    isPublic: true,
    players: ['ana', 'marc'],
    waitlist: ['luka'],
    createdBy: 'ana',
    createdAt: new Date(),
    isPremium: false,
  });
})();
