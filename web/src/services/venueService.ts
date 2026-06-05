import {
  collection, query, where, getDocs, addDoc, updateDoc, doc, deleteDoc,
  getDoc, Timestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import type { Venue } from '../types/models';

export async function listMyVenues(ownerId: string): Promise<Venue[]> {
  const q = query(collection(db, 'venues'), where('ownerId', '==', ownerId));
  const snap = await getDocs(q);
  const venues = snap.docs.map(d => ({ ...(d.data() as Venue), id: d.id }));
  return venues.sort((a, b) => {
    const ta = a.createdAt?.toDate?.()?.getTime() ?? 0;
    const tb = b.createdAt?.toDate?.()?.getTime() ?? 0;
    return tb - ta;
  });
}

export async function getVenue(venueId: string): Promise<Venue | null> {
  const snap = await getDoc(doc(db, 'venues', venueId));
  if (!snap.exists()) return null;
  return { ...(snap.data() as Venue), id: snap.id };
}

export async function createVenue(data: Omit<Venue, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
  const ref = await addDoc(collection(db, 'venues'), {
    ...data,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
  return ref.id;
}

export async function updateVenue(venueId: string, patch: Partial<Venue>): Promise<void> {
  await updateDoc(doc(db, 'venues', venueId), {
    ...patch,
    updatedAt: Timestamp.now(),
  });
}

export async function deleteVenue(venueId: string): Promise<void> {
  await deleteDoc(doc(db, 'venues', venueId));
  
}
