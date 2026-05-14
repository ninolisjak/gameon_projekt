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
};

export type JoinResult =
  | { status: 'joined' }
  | { status: 'waitlisted'; position: number };

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

export async function createMatch(data: {
  sport: 'futsal' | 'basketball';
  lat: number;
  lng: number;
  locationName: string;
  datetime: Date;
  totalSpots: number;
  createdBy: string;
}) {
  const id = Math.random().toString(36).slice(2, 10);
  store.push({
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
  });
  notifyAll();
  return { id };
}

export async function joinMatch(matchId: string, userId: string): Promise<JoinResult> {
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
}

export async function leaveMatch(matchId: string, userId: string) {
  const m = store.find(x => x.id === matchId);
  if (!m) throw new Error('Tekma ne obstaja.');
  if (!m.players.includes(userId)) throw new Error('Nisi prijavljen.');
  if (m.createdBy === userId) throw new Error('Ustvarjalec ne more zapustiti tekme.');

  m.players = m.players.filter(p => p !== userId);

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

export function subscribeMatch(matchId: string, onData: (m: Match | null) => void, _onError?: (e: Error) => void) {
  if (matchId === 'test') {
    onData(null);
    return () => {};
  }
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
  });
})();
