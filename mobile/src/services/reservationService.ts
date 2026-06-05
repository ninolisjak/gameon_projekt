import {
  collection, query, where, getDocs,
  runTransaction, doc, Timestamp, updateDoc,
} from 'firebase/firestore';
import { db } from '../config/firebase';

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

export async function fetchReservationsForDate(
  venueId: string,
  date: Date,
): Promise<Reservation[]> {
  const q = query(
    collection(db, 'reservations'),
    where('venueId', '==', venueId),
    where('status', '!=', 'cancelled'),
  );
  const snap = await getDocs(q);
  const startOfDay = new Date(date); startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date); endOfDay.setHours(23, 59, 59, 999);
  return snap.docs
    .map(d => ({ ...d.data(), id: d.id } as Reservation))
    .filter(r => {
      const d = r.date?.toDate ? r.date.toDate() : new Date(r.date);
      return d >= startOfDay && d <= endOfDay;
    });
}

export async function createReservation(data: {
  venueId: string;
  ownerId: string;
  bookedBy: string;
  matchId?: string;
  date: Date;
  startHHMM: string;
  endHHMM: string;
  price: number;
}): Promise<string> {
  const reservationsRef = collection(db, 'reservations');

  return runTransaction(db, async tx => {
    const conflictQuery = query(
      reservationsRef,
      where('venueId', '==', data.venueId),
      where('status', '!=', 'cancelled'),
    );
    const conflictSnap = await getDocs(conflictQuery);
    const startOfDay = new Date(data.date); startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(data.date); endOfDay.setHours(23, 59, 59, 999);
    const conflict = conflictSnap.docs.some(d => {
      const r = d.data() as Reservation;
      const rd = r.date?.toDate ? r.date.toDate() : new Date(r.date as any);
      return r.startHHMM === data.startHHMM && rd >= startOfDay && rd <= endOfDay;
    });
    if (conflict) throw new Error('Ta termin je že rezerviran. Izberi drug termin.');

    const newRef = doc(reservationsRef);
    tx.set(newRef, {
      ...data,
      date: Timestamp.fromDate(data.date),
      status: 'confirmed',
      createdAt: Timestamp.now(),
    });
    return newRef.id;
  });
}

export async function cancelReservation(reservationId: string): Promise<void> {
  await updateDoc(doc(db, 'reservations', reservationId), { status: 'cancelled' });
}

export async function markReservationPaid(reservationId: string): Promise<void> {
  await updateDoc(doc(db, 'reservations', reservationId), { paid: true });
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
