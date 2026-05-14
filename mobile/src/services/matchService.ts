import {
  collection, addDoc, Timestamp, doc, updateDoc,
  arrayUnion, arrayRemove, increment, onSnapshot, getDoc,
} from 'firebase/firestore';
import { db } from '../config/firebase';

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
};

export async function createMatch(data: {
  sport: 'futsal' | 'basketball';
  lat: number;
  lng: number;
  locationName: string;
  datetime: Date;
  totalSpots: number;
  createdBy: string;
}) {
  return addDoc(collection(db, 'matches'), {
    sport: data.sport,
    location: { lat: data.lat, lng: data.lng, name: data.locationName },
    datetime: Timestamp.fromDate(data.datetime),
    totalSpots: data.totalSpots,
    filledSpots: 1,
    status: 'open',
    isPublic: true,
    players: [data.createdBy],
    createdBy: data.createdBy,
    createdAt: Timestamp.now(),
  });
}

export async function joinMatch(matchId: string, userId: string) {
  const ref = doc(db, 'matches', matchId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Tekma ne obstaja.');
  const data = snap.data() as Match;
  if (data.players?.includes(userId)) throw new Error('Že si prijavljen.');
  if (data.filledSpots >= data.totalSpots) throw new Error('Tekma je polna.');

  const newFilled = data.filledSpots + 1;
  await updateDoc(ref, {
    players: arrayUnion(userId),
    filledSpots: increment(1),
    status: newFilled >= data.totalSpots ? 'full' : 'open',
  });
}

export async function leaveMatch(matchId: string, userId: string) {
  const ref = doc(db, 'matches', matchId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Tekma ne obstaja.');
  const data = snap.data() as Match;
  if (!data.players?.includes(userId)) throw new Error('Nisi prijavljen.');
  if (data.createdBy === userId) throw new Error('Ustvarjalec ne more zapustiti tekme.');

  await updateDoc(ref, {
    players: arrayRemove(userId),
    filledSpots: increment(-1),
    status: 'open',
  });
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
