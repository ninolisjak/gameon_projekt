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

/* export type RecurringGroup = {
  id: string;
  name: string;
  sport: 'futsal' | 'basketball';
  location: { lat: number; lng: number; name: string };
  totalSpots: number;
  members: string[];
  createdBy: string;
  weekday: number;       // 0=ned, 1=pon ... 6=sob
  timeHHMM: string;      // '18:00'
  minQuorum: number;     // min players to confirm match
  inviteCode: string;
  createdAt?: any;
}; */

export type RecurringGroup = {
  id: string;
  name: string;
  sport: 'futsal' | 'basketball';
  location: { lat: number; lng: number; name: string };
  totalSpots: number;
  members: string[];
  createdBy: string;
  weekday: number;       // 0=ned, 1=pon ... 6=sob
  timeHHMM: string;      // '18:00'
  minQuorum: number;     // min players to confirm match
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
const GOAL_ELO_BONUS = 5;   // ELO gained per goal you personally scored
const REP_ATTEND = 2;       // reputation gained for showing up
const REP_NO_SHOW = 5;      // reputation lost for not showing up

export function requiredConfirmations(totalSpots: number): number {
  return Math.max(2, Math.ceil(totalSpots / 3));
}

function genId(): string {
   return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}
export type JoinResult =
  | { status: 'joined' }
  | { status: 'waitlisted'; position: number };

let store: Match[] = [];
let groupStore: RecurringGroup[] = [];
let slotStore: RecurringSlot[] = [];
const matchListeners = new Map<string, Set<(m: Match | null) => void>>();
const allListeners = new Set<(ms: Match[]) => void>();
const slotListeners = new Map<string, Set<(s: RecurringSlot | null) => void>>();
const groupListeners = new Set<(gs: RecurringGroup[]) => void>();

function getOpen(): Match[] {
  return store.filter(m => m.isPublic && !m.isPrivate && m.status !== 'closed');
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
}) {
  const id = genId();
  const base = {
    id,
    sport: data.sport,
    location: { lat: data.lat, lng: data.lng, name: data.locationName },
    datetime: data.datetime,
    totalSpots: data.totalSpots,
    filledSpots: 1,
    status: data.totalSpots <= 1 ? 'full' : 'open',
    isPublic: true,
    isPrivate: false,
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
/*   sport: 'futsal' | 'basketball'; 
  lat: number; 
  lng: number; 
  locationName: string;
  datetime: Date; 
  totalSpots: number; 
  createdBy: string; 
}) {
  const id = genId();
  const inviteCode = genInviteCode();
  store.push({
    id, sport: data.sport,
    location: { lat: data.lat, lng: data.lng, name: data.locationName },
    datetime: data.datetime,
    totalSpots: data.totalSpots,
    filledSpots: 1,
    status: data.totalSpots <= 1 ? 'full' : 'open',
    isPublic: false,
    isPrivate: true,
    inviteCode,
    players: [data.createdBy],
    waitlist: [],
    createdBy: data.createdBy,
    createdAt: new Date(),
  });
  notifyAll();
  const docRef = await addDoc(collection(db, 'matches'), base);
  //return { id: docRef.id, inviteCode };
  return { id, inviteCode }; */
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
        isPublic: true // Postane vidna uporabniku po uspešnem sprejemu povabila
      });
    } else {
      tx.update(ref, {
        waitlist: arrayUnion(userId)
      });
    }
  });

  return { matchId };
  /*
  const m = store.find(x => x.inviteCode === code.toUpperCase() && x.isPrivate);
  if (!m) throw new Error('Povabilo ni veljavno ali je poteklo.');
  if (m.players.includes(userId)) throw new Error('Že si prijavljen na to tekmo.');
  m.isPublic = true; // after accepting invite, match is visible to this user
  m.players = [...m.players, userId];
  syncCapacity(m);
  notifyMatch(m.id);
  notifyAll();
  return { matchId: m.id };
  */
}

export async function getPrivateMatchByInviteCode(code: string): Promise<Match | undefined> {
  const q = query(collection(db, 'matches'), where('inviteCode', '==', code.toUpperCase()), where('isPrivate', '==', true));
  const snap = await getDocs(q);
  if (snap.empty) return undefined;
  return { id: snap.docs[0].id, ...snap.docs[0].data() } as Match;
  /*
  return store.find(x => x.inviteCode === code.toUpperCase() && x.isPrivate);
  */
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
  const id = genId();
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


  /*
  groupStore.push(group);
  // Generate next slot automatically
  _generateNextSlot(group);
  notifyGroups();
  return { id, inviteCode };
  */
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

  // user bo dodan v vse aktivne/termine s statusom 'maybe'
  const sq = query(collection(db, 'slots'), where('groupId', '==', groupId), where('status', '==', 'pending'));
  const slotSnap = await getDocs(sq);
  for (const slotDoc of slotSnap.docs) {
    const slotRef = doc(db, 'slots', slotDoc.id);
    await updateDoc(slotRef, {
      [`rsvps.${userId}`]: 'maybe'
    });
  
  /*const g = groupStore.find(x => x.inviteCode === code.toUpperCase());
  if (!g) throw new Error('Povabilo za skupino ni veljavno.');
  if (g.members.includes(userId)) throw new Error('Že si član te skupine.');
  g.members = [...g.members, userId];
  // Add user to all pending slots
  slotStore.filter(s => s.groupId === g.id && s.status === 'pending').forEach(s => {
    if (!s.rsvps[userId]) s.rsvps[userId] = 'maybe';
  });
  notifyGroups();
  return { groupId: g.id };*/
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
/*
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

    tx.update(ref, update);
  });
}*/

// Join / leave public match 
/*
export async function joinMatch(matchId: string, userId: string, _opts?: { userIsPremium?: boolean }): Promise<JoinResult> {
  const m = store.find(x => x.id === matchId);
  if (!m) throw new Error('Tekma ne obstaja.');
  if (m.players.includes(userId)) throw new Error('Že si prijavljen.');
  if (m.waitlist.includes(userId)) throw new Error('Že si na čakalni vrsti.');
  
  if (m.filledSpots < m.totalSpots) {
    m.players = [...m.players, userId];
    syncCapacity(m);
    notifyMatch(matchId);
    notifyAll();
    return { status: 'joined' };
  }

  m.waitlist = [...m.waitlist, userId];
  notifyMatch(matchId);
  notifyAll();
  return { status: 'waitlisted', position: m.waitlist.length };
}*/

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

  /*   const m = store.find(x => x.id === matchId);
  if (!m) throw new Error('Tekma ne obstaja.');
  //if (!m.waitlist.includes(userId)) throw new Error('Nisi na čakalni vrsti.');
  m.waitlist = m.waitlist.filter(p => p !== userId);
  notifyMatch(matchId);
  notifyAll(); */
}



/*
function _generateNextSlot(group: RecurringGroup): RecurringSlot {
  const now = new Date();
  const target = new Date();
  const diff = (group.weekday - now.getDay() + 7) % 7 || 7;
  target.setDate(now.getDate() + diff);
  const [hh, mm] = group.timeHHMM.split(':').map(Number);
  target.setHours(hh, mm, 0, 0);

  const id = genId();
  const rsvps: Record<string, RSVP> = {};
  group.members.forEach(m => { rsvps[m] = 'maybe'; });

  const slot: RecurringSlot = { id, groupId: group.id, datetime: target, rsvps, status: 'pending', createdAt: new Date() };
  slotStore.push(slot);
  return slot;
}*/

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


/*
function _checkQuorum(slot: RecurringSlot) {
  const group = groupStore.find(g => g.id === slot.groupId);
  if (!group) return;
  const coming = Object.values(slot.rsvps).filter(r => r === 'coming').length;
  const notComing = Object.values(slot.rsvps).filter(r => r === 'not_coming').length;
  const total = group.members.length;

  if (coming >= group.minQuorum) {
    slot.status = 'confirmed';
    notifySlot(slot.id);
    // Generate next slot for this group
    _generateNextSlot(group);
    notifyGroups();
  } else if (notComing > total - group.minQuorum) {
    // Not enough people can come → cancel
    slot.status = 'cancelled';
    notifySlot(slot.id);
    _generateNextSlot(group);
    notifyGroups();
  }
}*/

export async function getSlotsForGroup(groupId: string)/* : RecurringGroup[] */ {
  const q = query(collection(db, 'slots'), where('groupId', '==', groupId));
  const snap = await getDocs(q);
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() } as RecurringSlot))
    .sort((a, b) => {
      const dateA = a.datetime?.toDate ? a.datetime.toDate().getTime() : new Date(a.datetime).getTime();
      const dateB = b.datetime?.toDate ? b.datetime.toDate().getTime() : new Date(b.datetime).getTime();
      return dateA - dateB;
    });
}

export async function getGroupsForUser(userId: string)/*: RecurringGroup[]*/ {
  const q = query(collection(db, 'groups'), where('members', 'array-contains', userId));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as RecurringGroup));
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

export async function proposeGoal(matchId: string, scorerId: string, proposerId: string) {
  const m = store.find(x => x.id === matchId);
  if (!m) throw new Error('Tekma ne obstaja.');
  if (!m.isPremium) throw new Error('Samo Premium tekme imajo živo točkovanje.');
  if (m.finalized) throw new Error('Tekma je že zaključena.');
  if (!m.players.includes(proposerId)) throw new Error('Samo prijavljeni igralci lahko predlagajo gol.');
  if (!m.players.includes(scorerId)) throw new Error('Strelec ni prijavljen na tekmo.');

  const team: 'A' | 'B' = (m.teamA ?? []).includes(scorerId) ? 'A' : 'B';
  const event: PendingEvent = {
    id: genId(), team, scorerId, proposedBy: proposerId,
    confirmedBy: [proposerId], createdAt: new Date(),
  };
  m.pendingEvents = [...(m.pendingEvents ?? []), event];
  if (!m.attended) m.attended = [];
  if (!m.attended.includes(scorerId)) m.attended = [...m.attended, scorerId];
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
      id: event.id, team: event.team, scorerId: event.scorerId,
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
  const ref = doc(db, 'matches', matchId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Tekma ne obstaja.');
  const data = snap.data() as Match;
  if (data.createdBy !== requesterId) throw new Error('Samo gostitelj lahko zaključi tekmo.');
  if (!data.isPremium) throw new Error('Samo Premium tekme imajo ELO/reputacijo.');
  if (data.finalized) throw new Error('Tekma je že zaključena.');

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

  // Count confirmed goals per scorer.
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

    // ELO = win/loss outcome (chess formula) + bonus per goal scored. Only counts if you showed up.
    const resultElo = hasAttended ? eloDelta(u.elo, oppAvg, actual) : 0;
    const goalElo = hasAttended ? goals * GOAL_ELO_BONUS : 0;
    const dElo = resultElo + goalElo;

    // Reputation: reward showing up, penalise no-shows.
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

  // Write only real user docs (not demo short-ids). Use allSettled so a failed
  // write for one player doesn't abort the whole finalization.
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
/*   notifyAll();
  return { id };
 */
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
    onData({ id: snap.id, ...snap.data() } as Match);
  }, err => _onError?.(err));
/*   if (!matchListeners.has(matchId)) matchListeners.set(matchId, new Set());
  matchListeners.get(matchId)!.add(onData);
  onData(store.find(x => x.id === matchId) ?? null);
  return () => { matchListeners.get(matchId)?.delete(onData); }; */
}

export function subscribeMatches(onData: (ms: Match[]) => void) {
  const q = query(collection(db, 'matches'), where('isPublic', '==', true), where('isPrivate', '==', false));
  return onSnapshot(q, snap => {
    const matches = snap.docs.map(d => ({ id: d.id, ...d.data() } as Match));
    onData(matches.filter(m => m.status !== 'closed'));
  });
  /*   allListeners.add(onData);
  onData(getOpen());
  return () => { allListeners.delete(onData); }; */
}

export function subscribeSlot(slotId: string, onData: (s: RecurringSlot | null) => void) {
  const ref = doc(db, 'slots', slotId);
  return onSnapshot(ref, snap => {
    if (!snap.exists()) { onData(null); return; }
    onData({ id: snap.id, ...snap.data() } as RecurringSlot);
  });
  /*   if (!slotListeners.has(slotId)) slotListeners.set(slotId, new Set());
  slotListeners.get(slotId)!.add(onData);
  onData(slotStore.find(x => x.id === slotId) ?? null);
  return () => { slotListeners.get(slotId)?.delete(onData); }; */
}

export function subscribeGroups(userId: string, onData: (gs: RecurringGroup[]) => void) {
  const q = query(collection(db, 'groups'), where('members', 'array-contains', userId));
  return onSnapshot(q, snap => {
    onData(snap.docs.map(d => ({ id: d.id, ...d.data() } as RecurringGroup)));
  });
  /* groupListeners.add(onData);
  onData(getGroupsForUser(userId));
  return () => { groupListeners.delete(onData); }; */
}

// ── User docs ──────────────────────────────────────────────────────────────
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
