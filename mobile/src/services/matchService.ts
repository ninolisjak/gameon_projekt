import {
  collection, addDoc, Timestamp, doc, updateDoc, setDoc,
  arrayUnion, arrayRemove, increment, onSnapshot, getDoc,
  runTransaction, query, where, getDocs
} from 'firebase/firestore';
import { db } from '../config/firebase';

// ── Types ──────────────────────────────────────────────────────────────────
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

export type RSVP = 'coming' | 'not_coming' | 'maybe';

export type RecurringGroup = {
  id: string;
  name: string;
  sport: 'futsal' | 'basketball';
  location: { lat: number; lng: number; name: string };
  totalSpots: number;
  members: string[];
  createdBy: string;
  weekday: number;
  timeHHMM: string;
  minQuorum: number;
  inviteCode: string;
  createdAt?: any;
};

export type RecurringSlot = {
  id: string;
  groupId: string;
  datetime: any;
  rsvps: Record<string, RSVP>;
  status: 'pending' | 'confirmed' | 'cancelled';
  createdAt?: any;
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
  // Private match fields
  isPrivate?: boolean;
  inviteCode?: string;
  groupId?: string;
  // Recurring match
  isRecurring?: boolean;
  // Start-consent flow
  startRequested?: boolean;
  startConsent?: Record<string, 'yes' | 'no' | 'pending'>;
  matchStarted?: boolean;
  cancelReason?: string;
};

export type UserDoc = {
  uid: string;
  elo: number;
  reputation: number;
  isPremium: boolean;
  displayName?: string;
  email?: string;
  expoPushToken?: string;
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

let store: Match[] = [];
let groupStore: RecurringGroup[] = [];
let slotStore: RecurringSlot[] = [];
const matchListeners = new Map<string, Set<(m: Match | null) => void>>();
const allListeners = new Set<(ms: Match[]) => void>();
const slotListeners = new Map<string, Set<(s: RecurringSlot | null) => void>>();
const groupListeners = new Set<(gs: RecurringGroup[]) => void>();

function getOpen(currentUserId?: string): Match[] {
  return store.filter(m => {
    if (m.status === 'closed') return false;
    if (!m.isPrivate) return m.isPublic;
    // Private match: show only to players who are already in it
    return currentUserId ? m.players.includes(currentUserId) : false;
  });
}

function notifyMatch(id: string) {
  const m = store.find(x => x.id === id) ?? null;
  matchListeners.get(id)?.forEach(fn => fn(m));
}

function notifyAll() {
  allListeners.forEach(fn => fn(getOpen()));
}

function notifySlot(id: string) { const s = slotStore.find(x => x.id === id) ?? null; slotListeners.get(id)?.forEach(fn => fn(s)); }
function notifyGroups() { groupListeners.forEach(fn => fn(groupStore)); }
function syncCapacity(m: Match) {
  m.filledSpots = m.players.length;
  m.status = m.filledSpots >= m.totalSpots ? 'full' : 'open';
}

function genInviteCode(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

// ── Public match CRUD ──────────────────────────────────────────────────────
export async function createMatch(data: {
  sport: 'futsal' | 'basketball';
  lat: number;
  lng: number;
  locationName: string;
  datetime: Date;
  totalSpots: number;
  createdBy: string;
  isPremium?: boolean;
  isRecurring?: boolean;
}) {
  const base = {
    sport: data.sport,
    location: { lat: data.lat, lng: data.lng, name: data.locationName },
    datetime: data.datetime,
    totalSpots: data.totalSpots,
    filledSpots: 1,
    status: data.totalSpots <= 1 ? 'full' : 'open',
    isPublic: true,
    isPrivate: false,
    isRecurring: data.isRecurring ?? false,
    players: [data.createdBy],
    waitlist: [],
    createdBy: data.createdBy,
    createdAt: Timestamp.now(),
    isPremium: data.isPremium ?? false,
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
  notifyAll();
  return addDoc(collection(db, 'matches'), { ...base, isPremium: false });
}

// ── Private match (GAM-11) ─────────────────────────────────────────────────
export async function createPrivateMatch(data: {
  sport: 'futsal' | 'basketball';
  lat: number;
  lng: number;
  locationName: string;
  datetime: Date;
  totalSpots: number;
  createdBy: string;
}) {
  const inviteCode = genInviteCode();
  const base = {
    sport: data.sport,
    location: { lat: data.lat, lng: data.lng, name: data.locationName },
    datetime: Timestamp.fromDate(data.datetime),
    totalSpots: data.totalSpots,
    filledSpots: 1,
    status: data.totalSpots <= 1 ? 'full' : 'open',
    isPublic: false,
    isPrivate: true,
    inviteCode,
    players: [data.createdBy],
    waitlist: [],
    createdBy: data.createdBy,
    createdAt: Timestamp.now(),
    isPremium: false,
  };

  const docRef = await addDoc(collection(db, 'matches'), base);
  return { id: docRef.id, inviteCode };
}

export async function joinMatchByInviteCode(code: string, userId: string): Promise<{ matchId: string }> {
  const q = query(collection(db, 'matches'), where('inviteCode', '==', code.toUpperCase()), where('isPrivate', '==', true));
  const snap = await getDocs(q);
  if (snap.empty) throw new Error('Povabilo ni veljavno ali je poteklo.');

  const matchDoc = snap.docs[0];
  const matchId = matchDoc.id;
  const data = matchDoc.data() as Match;

  if (data.players?.includes(userId)) throw new Error('Že si prijavljen na to tekmo.');
  if (data.waitlist?.includes(userId)) throw new Error('Že si na čakalni vrsti.');

  const ref = doc(db, 'matches', matchId);
  await runTransaction(db, async tx => {
    const txSnap = await tx.get(ref);
    const txData = txSnap.data() as Match;

    if (txData.filledSpots < txData.totalSpots) {
      const newFilled = txData.filledSpots + 1;
      tx.update(ref, {
        players: arrayUnion(userId),
        filledSpots: increment(1),
        status: newFilled >= txData.totalSpots ? 'full' : 'open',
        isPublic: true
      });
    } else {
      tx.update(ref, {
        waitlist: arrayUnion(userId)
      });
    }
  });

  return { matchId };
}

export async function getPrivateMatchByInviteCode(code: string): Promise<Match | undefined> {
  const q = query(collection(db, 'matches'), where('inviteCode', '==', code.toUpperCase()), where('isPrivate', '==', true));
  const snap = await getDocs(q);
  if (snap.empty) return undefined;
  return { ...snap.docs[0].data(), id: snap.docs[0].id } as Match;
}

// ── Recurring group (GAM-12) ───────────────────────────────────────────────
export async function createRecurringGroup(data: {
  name: string;
  sport: 'futsal' | 'basketball';
  lat: number;
  lng: number;
  locationName: string;
  totalSpots: number;
  weekday: number;
  timeHHMM: string;
  minQuorum: number;
  createdBy: string;
}) {
  const inviteCode = genInviteCode();
  const group = {
    name: data.name,
    sport: data.sport,
    location: { lat: data.lat, lng: data.lng, name: data.locationName },
    totalSpots: data.totalSpots,
    members: [data.createdBy],
    createdBy: data.createdBy,
    weekday: data.weekday,
    timeHHMM: data.timeHHMM,
    minQuorum: data.minQuorum,
    inviteCode,
    createdAt: Timestamp.now(),
  };

  const groupRef = await addDoc(collection(db, 'groups'), group);
  await _generateNextSlot(groupRef.id, group);
  notifyGroups();
  return { id: groupRef.id, inviteCode };
}

export async function joinGroupByInviteCode(code: string, userId: string): Promise<{ groupId: string }> {
  const q = query(collection(db, 'groups'), where('inviteCode', '==', code.toUpperCase()));
  const snap = await getDocs(q);
  if (snap.empty) throw new Error('Povabilo za skupino ni veljavno.');

  const groupDoc = snap.docs[0];
  const groupId = groupDoc.id;
  const g = groupDoc.data() as RecurringGroup;

  if (g.members.includes(userId)) throw new Error('Že si član te skupine.');

  const groupRef = doc(db, 'groups', groupId);
  await updateDoc(groupRef, {
    members: arrayUnion(userId)
  });

  const sq = query(collection(db, 'slots'), where('groupId', '==', groupId), where('status', '==', 'pending'));
  const slotSnap = await getDocs(sq);
  for (const slotDoc of slotSnap.docs) {
    const slotRef = doc(db, 'slots', slotDoc.id);
    await updateDoc(slotRef, {
      [`rsvps.${userId}`]: 'maybe'
    });
  }
  return { groupId };
}

async function _generateNextSlot(groupId: string, group: any) {
  const now = new Date();
  const target = new Date();
  const diff = (group.weekday - now.getDay() + 7) % 7 || 7;
  target.setDate(now.getDate() + diff);
  const [hh, mm] = group.timeHHMM.split(':').map(Number);
  target.setHours(hh, mm, 0, 0);

  const rsvps: Record<string, RSVP> = {};
  group.members.forEach((m: string) => {
    rsvps[m] = 'maybe';
  });

  await addDoc(collection(db, 'slots'), {
    groupId,
    datetime: Timestamp.fromDate(target),
    rsvps,
    status: 'pending',
    createdAt: Timestamp.now(),
  });
}

export async function joinMatch(matchId: string, userId: string, opts?: { userIsPremium?: boolean }): Promise<JoinResult> {
  const ref = doc(db, 'matches', matchId);
  return await runTransaction(db, async tx => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('Tekma ne obstaja.');
    const data = snap.data() as Match;

    if (data.isPremium && !opts?.userIsPremium) {
      throw new Error('Premium tekme so na voljo samo Premium uporabnikom.');
    }
    if (data.players?.includes(userId)) throw new Error('Že si prijavljen.');
    if (data.waitlist?.includes(userId)) throw new Error('Že si na čakalni vrsti.');

    if (data.filledSpots < data.totalSpots) {
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
      return { status: 'joined' as const };
    } else {
      tx.update(ref, {
        waitlist: arrayUnion(userId)
      });
      const currentPosition = (data.waitlist?.length ?? 0) + 1;
      return { status: 'waitlisted' as const, position: currentPosition };
    }
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

    let updatedPlayers = (data.players ?? []).filter(p => p !== userId);
    let updatedWaitlist = [...(data.waitlist ?? [])];
    let newFilled = data.filledSpots - 1;

    const update: any = {};

    if (updatedWaitlist.length > 0) {
      const nextPlayer = updatedWaitlist.shift();
      updatedPlayers.push(nextPlayer!);
      newFilled += 1;
      update.waitlist = updatedWaitlist;

      if (data.isPremium) {
        let teamA = (data.teamA ?? []).filter(p => p !== userId);
        let teamB = (data.teamB ?? []).filter(p => p !== userId);
        const half = Math.floor(data.totalSpots / 2);
        if (teamA.length <= teamB.length && teamA.length < half) {
          teamA.push(nextPlayer!);
        } else {
          teamB.push(nextPlayer!);
        }
        update.teamA = teamA;
        update.teamB = teamB;
      }
    } else {
      if (data.isPremium) {
        update.teamA = (data.teamA ?? []).filter(p => p !== userId);
        update.teamB = (data.teamB ?? []).filter(p => p !== userId);
      }
    }

    update.players = updatedPlayers;
    update.filledSpots = newFilled;
    update.status = newFilled >= data.totalSpots ? 'full' : 'open';

    tx.update(ref, update);
  });
}

export async function leaveWaitlist(matchId: string, userId: string) {
  const ref = doc(db, 'matches', matchId);
  await updateDoc(ref, {
    waitlist: arrayRemove(userId)
  });
}

export async function rsvpSlot(slotId: string, userId: string, rsvp: RSVP) {
  const slotRef = doc(db, 'slots', slotId);

  await runTransaction(db, async tx => {
    const slotSnap = await tx.get(slotRef);
    if (!slotSnap.exists()) throw new Error('Termin ne obstaja.');
    const slotData = slotSnap.data() as RecurringSlot;
    if (slotData.status !== 'pending') throw new Error('Termin ni več aktiven.');

    const updatedRsvps = { ...slotData.rsvps, [userId]: rsvp };

    const groupRef = doc(db, 'groups', slotData.groupId);
    const groupSnap = await tx.get(groupRef);
    if (!groupSnap.exists()) throw new Error('Skupina ne obstaja.');
    const groupData = groupSnap.data() as RecurringGroup;

    const coming = Object.values(updatedRsvps).filter(r => r === 'coming').length;
    const notComing = Object.values(updatedRsvps).filter(r => r === 'not_coming').length;
    const total = groupData.members.length;

    let newStatus: 'pending' | 'confirmed' | 'cancelled' = 'pending';
    let triggerNext = false;

    if (coming >= groupData.minQuorum) {
      newStatus = 'confirmed';
      triggerNext = true;
    } else if (notComing > total - groupData.minQuorum) {
      newStatus = 'cancelled';
      triggerNext = true;
    }

    tx.update(slotRef, {
      rsvps: updatedRsvps,
      status: newStatus
    });

    return { triggerNext, groupId: slotData.groupId, groupData };
  }).then(async result => {
    if (result && result.triggerNext) {
      await _generateNextSlot(result.groupId, result.groupData);
    }
  });
}

export async function getSlotsForGroup(groupId: string) {
  const q = query(collection(db, 'slots'), where('groupId', '==', groupId));
  const snap = await getDocs(q);
  return snap.docs
    .map(d => ({ ...d.data(), id: d.id } as RecurringSlot))
    .sort((a, b) => {
      const dateA = a.datetime?.toDate ? a.datetime.toDate().getTime() : new Date(a.datetime).getTime();
      const dateB = b.datetime?.toDate ? b.datetime.toDate().getTime() : new Date(b.datetime).getTime();
      return dateA - dateB;
    });
}

export async function getGroupsForUser(userId: string) {
  const q = query(collection(db, 'groups'), where('members', 'array-contains', userId));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ ...d.data(), id: d.id } as RecurringGroup));
}

// Premium Features (Firestore)
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

// ─── Premium live-scoring ─────────────────────────────────────────────────────

export async function checkIn(matchId: string, userId: string) {
  const ref = doc(db, 'matches', matchId);
  await updateDoc(ref, { attended: arrayUnion(userId) });
}

export async function proposeGoal(matchId: string, scorerId: string, proposerId: string) {
  const ref = doc(db, 'matches', matchId);
  await runTransaction(db, async tx => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('Tekma ne obstaja.');
    const data = snap.data() as Match;
    if (!data.isPremium) throw new Error('Samo Premium tekme imajo živo točkovanje.');
    if (data.finalized) throw new Error('Tekma je že zaključena.');
    if (!data.players?.includes(proposerId)) throw new Error('Samo prijavljeni igralci lahko predlagajo gol.');
    if (!data.players?.includes(scorerId)) throw new Error('Strelec ni prijavljen na tekmo.');

    const team: 'A' | 'B' = (data.teamA ?? []).includes(scorerId) ? 'A' : 'B';
    const event: PendingEvent = {
      id: genId(), team, scorerId, proposedBy: proposerId,
      confirmedBy: [proposerId], createdAt: Timestamp.now(),
    };
    const pending = [...(data.pendingEvents ?? []), event];
    const attended = [...(data.attended ?? [])];
    if (!attended.includes(scorerId)) attended.push(scorerId);
    if (!attended.includes(proposerId)) attended.push(proposerId);
    tx.update(ref, { pendingEvents: pending, attended });
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
    const attended = [...(data.attended ?? [])];
    if (!attended.includes(userId)) attended.push(userId);

    const threshold = requiredConfirmations(data.totalSpots);
    const update: any = { attended };
    if (newConfirmedBy.length >= threshold) {
      pending.splice(idx, 1);
      const confirmed: ConfirmedEvent = {
        id: event.id, team: event.team, scorerId: event.scorerId,
        confirmedBy: newConfirmedBy, confirmedAt: Timestamp.now(),
      };
      update.events = [...(data.events ?? []), confirmed];
      update.pendingEvents = pending;
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

// ─── ELO + finalize (writes user docs to Firestore) ──────────────────────────

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
      try {
        const usnap = await getDoc(doc(db, 'users', uid));
        if (usnap.exists()) {
          const d = usnap.data() as UserDoc;
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
  for (const e of (data.events ?? [])) {
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
      uid: u.uid,
      goals,
      resultElo,
      goalElo,
      dElo,
      dRep,
      newElo: Math.max(0, u.elo + dElo),
      newRep: Math.max(0, u.reputation + dRep),
    };
  });

  const realUsers = updates.filter(u => !DEMO_USERS.includes(u.uid as any) && u.uid.length > 10);
  await Promise.allSettled(
    realUsers.map(u =>
      setDoc(doc(db, 'users', u.uid),
        { uid: u.uid, elo: u.newElo, reputation: u.newRep, updatedAt: Timestamp.now() },
        { merge: true })
    )
  );

  await updateDoc(ref, { result, finalized: true, status: 'closed' });

  return { result, perPlayer: updates };
}

// ── Invite eligible players ───────────────────────────────────────────────────

export async function fetchInvitablePlayers(
  minElo: number,
  minRep: number,
  excludeIds: string[],
): Promise<UserDoc[]> {
  const q = query(collection(db, 'users'), where('elo', '>=', minElo));
  const snap = await getDocs(q);
  return snap.docs
    .map(d => ({ ...d.data(), uid: d.id } as UserDoc))
    .filter(u => (u.reputation ?? 0) > minRep && !excludeIds.includes(u.uid));
}

export async function invitePlayerToMatch(
  matchId: string,
  targetUserId: string,
  team: 'A' | 'B',
): Promise<void> {
  const ref = doc(db, 'matches', matchId);
  await runTransaction(db, async tx => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('Tekma ne obstaja.');
    const data = snap.data() as Match;
    if (data.players?.includes(targetUserId)) throw new Error('Igralec je že prijavljen.');
    if (data.waitlist?.includes(targetUserId)) throw new Error('Igralec je že na čakalni vrsti.');

    const newFilled = data.filledSpots + 1;
    const teamField = team === 'A' ? 'teamA' : 'teamB';
    const currentTeam = (data[teamField] ?? []) as string[];
    tx.update(ref, {
      players: arrayUnion(targetUserId),
      filledSpots: increment(1),
      status: newFilled >= data.totalSpots ? 'full' : 'open',
      [teamField]: [...currentTeam, targetUserId],
    });
  });
}

// ── Start-consent flow ────────────────────────────────────────────────────────

export async function requestMatchStart(matchId: string, creatorId: string): Promise<string[]> {
  const ref = doc(db, 'matches', matchId);
  return runTransaction(db, async tx => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('Tekma ne obstaja.');
    const data = snap.data() as Match;
    if (data.createdBy !== creatorId) throw new Error('Samo gostitelj lahko začne tekmo.');
    if (data.matchStarted) throw new Error('Tekma je že začeta.');
    if (data.startRequested) throw new Error('Začetek je že bil zahtevan.');

    const players = data.players ?? [];
    const consent: Record<string, 'yes' | 'no' | 'pending'> = {};
    players.forEach(p => { consent[p] = 'pending'; });

    tx.update(ref, { startRequested: true, startConsent: consent });
    return players;
  });
}

export async function respondToMatchStart(matchId: string, userId: string, response: 'yes' | 'no') {
  const ref = doc(db, 'matches', matchId);
  await runTransaction(db, async tx => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('Tekma ne obstaja.');
    const data = snap.data() as Match;
    if (!data.startRequested) return;

    const newConsent = { ...(data.startConsent ?? {}), [userId]: response };

    if (response === 'no') {
      tx.update(ref, { startRequested: false, startConsent: {} });
    } else {
      const players = data.players ?? [];
      const allAgreed = players.every(p => newConsent[p] === 'yes');
      if (allAgreed) {
        tx.update(ref, { startConsent: newConsent, matchStarted: true, startRequested: false });
      } else {
        tx.update(ref, { startConsent: newConsent });
      }
    }
  });
}

export async function getPlayerPushTokens(uids: string[]): Promise<string[]> {
  const results = await Promise.allSettled(
    uids.map(async uid => {
      const snap = await getDoc(doc(db, 'users', uid));
      if (snap.exists()) {
        const d = snap.data() as UserDoc;
        return d.expoPushToken ?? null;
      }
      return null;
    })
  );
  return results
    .filter((r): r is PromiseFulfilledResult<string> => r.status === 'fulfilled' && r.value !== null)
    .map(r => r.value);
}

export async function cancelMatchLowAttendance(matchId: string) {
  const ref = doc(db, 'matches', matchId);
  await updateDoc(ref, { status: 'closed', cancelReason: 'low_attendance' });
}

// ── Subscriptions ──────────────────────────────────────────────────────────
export function subscribeMatch(matchId: string, onData: (m: Match | null) => void, _onError?: (e: Error) => void) {
  if (matchId === 'test') {
    onData(null);
    return () => {};
  }
  const ref = doc(db, 'matches', matchId);
  return onSnapshot(ref, snap => {
    if (!snap.exists()) { onData(null); return; }
    onData({ ...snap.data(), id: snap.id } as Match);
  }, err => _onError?.(err));
}

export function subscribeMatches(userId: string, onData: (ms: Match[]) => void) {
  // Query 1: public matches
  const publicQ = query(
    collection(db, 'matches'),
    where('isPublic', '==', true),
    where('isPrivate', '==', false)
  );
  // Query 2: private matches where user is a player
  const privateQ = query(
    collection(db, 'matches'),
    where('isPrivate', '==', true),
    where('players', 'array-contains', userId)
  );

  let publicMatches: Match[] = [];
  let privateMatches: Match[] = [];

  function emit() {
    const all = [...publicMatches, ...privateMatches].filter(m => m.status !== 'closed');
    onData(all);
  }

  const unsubPublic = onSnapshot(publicQ, snap => {
    publicMatches = snap.docs.map(d => ({ ...d.data(), id: d.id } as Match));
    emit();
  });

  const unsubPrivate = onSnapshot(privateQ, snap => {
    privateMatches = snap.docs.map(d => ({ ...d.data(), id: d.id } as Match));
    emit();
  });

  return () => { unsubPublic(); unsubPrivate(); };
}

export function subscribeSlot(slotId: string, onData: (s: RecurringSlot | null) => void) {
  const ref = doc(db, 'slots', slotId);
  return onSnapshot(ref, snap => {
    if (!snap.exists()) { onData(null); return; }
    onData({ ...snap.data(), id: snap.id } as RecurringSlot);
  });
}

export function subscribeGroups(userId: string, onData: (gs: RecurringGroup[]) => void) {
  const q = query(collection(db, 'groups'), where('members', 'array-contains', userId));
  return onSnapshot(q, snap => {
    onData(snap.docs.map(d => ({ ...d.data(), id: d.id } as RecurringGroup)));
  });
}

// ── User docs ──────────────────────────────────────────────────────────────
export async function ensureUserDoc(uid: string, patch?: Partial<UserDoc>) {
  const ref = doc(db, 'users', uid);
  try {
    const usnap = await getDoc(ref);
    if (!usnap.exists()) {
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
  const ref = doc(db, 'users', uid);
  return onSnapshot(ref, snap => {
    if (!snap.exists()) { onData(null); return; }
    onData(snap.data() as UserDoc);
  }, err => onError?.(err));
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
    isPrivate: false,
    players: ['ana', 'marc'],
    waitlist: ['luka'],
    createdBy: 'ana',
    createdAt: new Date(),
    isPremium: false,
  });
})();
