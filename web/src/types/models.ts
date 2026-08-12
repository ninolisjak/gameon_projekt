import type { Timestamp } from 'firebase/firestore';

export type Sport = 'futsal' | 'basketball' | 'both';

export type Venue = {
  id: string;
  ownerId: string;
  name: string;
  sport: Sport;
  location: { lat: number; lng: number; name: string; address?: string };
  imageUrl?: string;
  description?: string;
  totalSpots: number;
  amenities?: string[];
  active: boolean;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

export type ScheduleSlot = {
  id: string;
  venueId: string;
  weekday: number;
  startHHMM: string;
  endHHMM: string;
  pricePerSlot: number;
  active: boolean;
};

export type ReservationStatus = 'pending' | 'confirmed' | 'cancelled';

export type Reservation = {
  id: string;
  venueId: string;
  ownerId: string;
  bookedBy: string;
  bookedByName?: string;
  matchId?: string;
  date: Timestamp;
  startHHMM: string;
  endHHMM: string;
  price: number;
  status: ReservationStatus;
  createdAt?: Timestamp;
};

export type OwnerUser = {
  uid: string;
  email: string;
  displayName?: string;
  role: 'owner' | 'player' | 'admin';
  createdAt?: Timestamp;
};

export const WEEKDAY_LABELS = ['Ned', 'Pon', 'Tor', 'Sre', 'Čet', 'Pet', 'Sob'];
export const WEEKDAY_LABELS_FULL = ['Nedelja', 'Ponedeljek', 'Torek', 'Sreda', 'Četrtek', 'Petek', 'Sobota'];
