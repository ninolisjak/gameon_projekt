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

/**
 * Sestavi determinističen ID rezervacije iz igrišča, datuma in začetne ure.
 *
 * Ključno za preprečevanje dvojnih rezervacij: ker je ID vnaprej znan,
 * lahko transakcija bere natanko ta dokument prek tx.get(). Firestore
 * transakcije ne podpirajo poizvedb, podpirajo pa branje dokumenta po
 * referenci — in prav to branje vključijo v nadzor sočasnosti.
 *
 * Primer: "abc123_2026-06-15_1800"
 */
export function buildReservationId(venueId: string, date: Date, startHHMM: string): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const time = startHHMM.replace(':', '');
  return `${venueId}_${year}-${month}-${day}_${time}`;
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

/**
 * Vrne nepreklicane rezervacije igrišča za dani dan.
 *
 * Poizvedba filtrira samo po venueId. Statusa namenoma ne filtriramo v
 * poizvedbi: Firestore pri operatorju "!=" izpusti dokumente, ki polja
 * sploh nimajo, zato bi rezervacija brez polja "status" izginila iz
 * rezultata in bi termin izgledal prost. Filtriranje v kodi je varnejše
 * in hkrati odpravi potrebo po sestavljenem indeksu.
 */
export async function fetchReservationsForDate(
  venueId: string,
  date: Date,
): Promise<Reservation[]> {
  const q = query(
    collection(db, 'reservations'),
    where('venueId', '==', venueId),
  );
  const snap = await getDocs(q);

  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  return snap.docs
    .map(d => ({ ...d.data(), id: d.id } as Reservation))
    .filter(r => r.status !== 'cancelled')
    .filter(r => {
      const rd = r.date?.toDate ? r.date.toDate() : new Date(r.date);
      return rd >= startOfDay && rd <= endOfDay;
    });
}

/**
 * Ustvari rezervacijo in atomarno prepreči dvojno rezervacijo istega termina.
 *
 * Zakaj determinističen ID namesto poizvedbe po konfliktih:
 * Firestore transakcije podpirajo izključno tx.get(documentRef). Klic
 * getDocs() znotraj runTransaction se izvede kot navadno branje zunaj
 * transakcije, zato ga nadzor sočasnosti ne zajame — dva hkratna klica
 * bi oba prebrala "ni konflikta" in oba zapisala.
 *
 * Z determinističnim ID-jem transakcija prebere natanko tisti dokument,
 * ki ga namerava zapisati. Če ga med izvajanjem kdo drug ustvari,
 * Firestore transakcijo ponovi; ob ponovitvi dokument obstaja in
 * funkcija vrne napako.
 */
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
  const reservationId = buildReservationId(data.venueId, data.date, data.startHHMM);
  const reservationRef = doc(db, 'reservations', reservationId);

  await runTransaction(db, async tx => {
    const snap = await tx.get(reservationRef);

    if (snap.exists()) {
      const existing = snap.data() as Reservation;
      if (existing.status !== 'cancelled') {
        throw new Error('Ta termin je že rezerviran. Izberi drug termin.');
      }
    }

    tx.set(reservationRef, {
      ...data,
      date: Timestamp.fromDate(data.date),
      status: 'confirmed',
      paid: false,
      createdAt: Timestamp.now(),
    });
  });

  return reservationId;
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
