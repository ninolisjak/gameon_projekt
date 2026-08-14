import { collection, query, where, getDocs } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../config/firebase';

export type ScheduleSlot = {
  id: string;
  venueId: string;
  weekday: number;
  startHHMM: string;
  endHHMM: string;
  pricePerSlot: number;
  active: boolean;
};

export type Venue = {
  id: string;
  ownerId: string;
  name: string;
  sport: 'futsal' | 'basketball' | 'both';
  location: { lat: number; lng: number; name: string; address?: string };
  description?: string;
  totalSpots: number;
  active: boolean;
};

export type Reservation = {
  id: string;
  venueId: string;
  ownerId: string;
  bookedBy: string;
  matchId?: string;
  date: any;
  startHHMM: string;
  endHHMM: string;
  price: number;
  status: 'pending' | 'confirmed' | 'cancelled';
  paid?: boolean;
  createdAt?: any;
};

export function hhmmToMinutes(hhmm: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm ?? '');
  if (!m) return NaN;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return NaN;
  return h * 60 + min;
}

export function rangesOverlap(
  startA: string, endA: string,
  startB: string, endB: string,
): boolean {
  const aS = hhmmToMinutes(startA);
  const aE = hhmmToMinutes(endA);
  const bS = hhmmToMinutes(startB);
  const bE = hhmmToMinutes(endB);
  if ([aS, aE, bS, bE].some(Number.isNaN)) return false;
  return aS < bE && bS < aE;
}

export async function fetchActiveVenues(sport?: 'futsal' | 'basketball'): Promise<Venue[]> {
  const q = query(collection(db, 'venues'), where('active', '==', true));
  const snap = await getDocs(q);
  const all = snap.docs.map(d => ({ ...d.data(), id: d.id } as Venue));
  if (!sport) return all;
  return all.filter(v => v.sport === sport || v.sport === 'both');
}

export async function fetchVenueSchedule(venueId: string): Promise<ScheduleSlot[]> {
  const q = query(
    collection(db, 'venues', venueId, 'schedule'),
    where('active', '==', true),
  );
  const snap = await getDocs(q);
  return snap.docs
    .map(d => ({ ...d.data(), id: d.id, venueId } as ScheduleSlot))
    .sort((a, b) => a.weekday - b.weekday || a.startHHMM.localeCompare(b.startHHMM));
}

export function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function buildReservationId(venueId: string, date: Date, startHHMM: string): string {
  return `${venueId}_${toDateKey(date)}_${startHHMM.replace(':', '')}`;
}

export type BookedSlot = {
  id: string;
  dateKey: string;
  startHHMM: string;
  endHHMM: string;
};

export async function fetchBookedSlots(venueId: string, date: Date): Promise<BookedSlot[]> {
  const q = query(
    collection(db, 'venues', venueId, 'booked'),
    where('dateKey', '==', toDateKey(date)),
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ ...(d.data() as Omit<BookedSlot, 'id'>), id: d.id }));
}

export async function createReservation(data: {
  venueId: string;
  date: Date;
  startHHMM: string;
  endHHMM: string;
  matchId?: string;
}): Promise<{ reservationId: string; price: number }> {
  const fn = httpsCallable<unknown, { reservationId: string; price: number }>(
    functions,
    'createReservation',
  );
  const payload: Record<string, unknown> = {
    venueId: data.venueId,
    dateKey: toDateKey(data.date),
    startHHMM: data.startHHMM,
    endHHMM: data.endHHMM,
  };
  if (typeof data.matchId === 'string') payload.matchId = data.matchId;
  const res = await fn(payload);
  return res.data;
}

export async function cancelReservation(reservationId: string): Promise<void> {
  const fn = httpsCallable(functions, 'cancelReservation');
  await fn({ reservationId });
}

export async function markReservationPaid(reservationId: string): Promise<void> {
  const fn = httpsCallable(functions, 'markReservationPaid');
  await fn({ reservationId });
}

export async function fetchMyReservations(userId: string): Promise<Reservation[]> {
  const q = query(
    collection(db, 'reservations'),
    where('bookedBy', '==', userId),
  );
  const snap = await getDocs(q);
  return snap.docs
    .map(d => ({ ...d.data(), id: d.id } as Reservation))
    .filter(r => r.status !== 'cancelled')
    .sort((a, b) => {
      const ta = a.date?.toDate?.()?.getTime() ?? 0;
      const tb = b.date?.toDate?.()?.getTime() ?? 0;
      return ta - tb;
    });
}
