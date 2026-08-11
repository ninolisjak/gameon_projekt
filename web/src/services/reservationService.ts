import {
  collection, query, where, getDocs,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import type { Reservation } from '../types/models';

function sortByDate(reservations: Reservation[]): Reservation[] {
  return reservations.sort((a, b) => {
    const ta = a.date?.toDate?.()?.getTime() ?? 0;
    const tb = b.date?.toDate?.()?.getTime() ?? 0;
    return tb - ta ;
  });
}

export async function listReservationsForOwner(ownerId: string): Promise<Reservation[]> {
  const q = query(collection(db, 'reservations'), where('ownerId', '==', ownerId));
  const snap = await getDocs(q);
  return sortByDate(snap.docs.map(d => ({ ...(d.data() as Reservation), id: d.id })));
}

export async function listReservationsForVenue(venueId: string): Promise<Reservation[]> {
  const q = query(collection(db, 'reservations'), where('venueId', '==', venueId));
  const snap = await getDocs(q);
  return sortByDate(snap.docs.map(d => ({ ...(d.data() as Reservation), id: d.id })));
}

export type RevenuePoint = { period: string; total: number; count: number };

export function aggregateRevenue(
  reservations: Reservation[],
  granularity: 'week' | 'month',
): RevenuePoint[] {
  const map = new Map<string, { total: number; count: number }>();
  for (const r of reservations) {
    if (r.status === 'cancelled') continue;
    const d = r.date?.toDate ? r.date.toDate() : new Date(r.date as any);
    if (!d || isNaN(d.getTime())) continue;
    let key: string;
    if (granularity === 'month') {
      key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    } else {
      const monday = new Date(d);
      const day = (monday.getDay() + 6) % 7;  // pon=0
      monday.setDate(monday.getDate() - day);
      key = monday.toISOString().slice(0, 10);
    }
    const prev = map.get(key) ?? { total: 0, count: 0 };
    map.set(key, { total: prev.total + (r.price ?? 0), count: prev.count + 1 });
  }
  return [...map.entries()]
    .map(([period, v]) => ({ period, ...v }))
    .sort((a, b) => a.period.localeCompare(b.period));
}
