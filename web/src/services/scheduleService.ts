import {
  collection, query, getDocs, addDoc, updateDoc, doc, deleteDoc, orderBy,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import type { ScheduleSlot } from '../types/models';

export async function listSchedule(venueId: string): Promise<ScheduleSlot[]> {
  const q = query(collection(db, 'venues', venueId, 'schedule'), orderBy('weekday', 'asc'));
  const snap = await getDocs(q);
  return snap.docs
    .map(d => ({ ...(d.data() as ScheduleSlot), id: d.id, venueId }))
    .sort((a, b) => a.weekday - b.weekday || a.startHHMM.localeCompare(b.startHHMM));
}

export async function addSlot(venueId: string, slot: Omit<ScheduleSlot, 'id' | 'venueId'>): Promise<string> {
  const ref = await addDoc(collection(db, 'venues', venueId, 'schedule'), slot);
  return ref.id;
}

export async function updateSlot(venueId: string, slotId: string, patch: Partial<ScheduleSlot>): Promise<void> {
  await updateDoc(doc(db, 'venues', venueId, 'schedule', slotId), patch);
}

export async function deleteSlot(venueId: string, slotId: string): Promise<void> {
  await deleteDoc(doc(db, 'venues', venueId, 'schedule', slotId));
}
