import {
  collection, doc, addDoc, getDoc, getDocs, query, orderBy, limit,
  runTransaction, Timestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import {
  UserDoc, ReputationEntry, ReputationReason,
  STARTING_REPUTATION,
} from './matchService';

export const REP_DELTA = {
  attended: 2,
  no_show: -5,
  late_cancel: -2,
  on_time_cancel: 0,
  manual: 0,
} as const;

export const DEMO_USERS_LOWER = new Set(['ana', 'marc', 'luka', 'niko']);

function isRealUid(uid: string): boolean {
  return uid.length > 10 && !DEMO_USERS_LOWER.has(uid);
}

export async function applyReputationChange(
  uid: string,
  delta: number,
  reason: ReputationReason,
  matchId?: string,
): Promise<{ balanceAfter: number; entryId: string } | null> {
  if (!isRealUid(uid)) return null;
  if (delta === 0 && reason !== 'on_time_cancel') return null;

  const userRef = doc(db, 'users', uid);
  const balanceAfter = await runTransaction(db, async tx => {
    const snap = await tx.get(userRef);
    const current = snap.exists()
      ? ((snap.data() as UserDoc).reputation ?? STARTING_REPUTATION)
      : STARTING_REPUTATION;
    const next = Math.max(0, Math.min(100, current + delta));
    if (snap.exists()) {
      tx.update(userRef, { reputation: next, updatedAt: Timestamp.now() });
    } else {
      tx.set(userRef, { uid, reputation: next, updatedAt: Timestamp.now() }, { merge: true });
    }
    return next;
  });

  const logRef = collection(db, 'users', uid, 'reputationLog');
  const entry: Omit<ReputationEntry, 'id'> = {
    delta,
    reason,
    matchId,
    balanceAfter,
    createdAt: Timestamp.now(),
  };
  const docRef = await addDoc(logRef, entry);
  return { balanceAfter, entryId: docRef.id };
}

export async function getReputationHistory(uid: string, max = 20): Promise<ReputationEntry[]> {
  if (!isRealUid(uid)) return [];
  try {
    const q = query(
      collection(db, 'users', uid, 'reputationLog'),
      orderBy('createdAt', 'desc'),
      limit(max),
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ ...(d.data() as Omit<ReputationEntry, 'id'>), id: d.id }));
  } catch (e) {
    console.warn('getReputationHistory failed', e);
    return [];
  }
}

export async function getReputation(uid: string): Promise<number> {
  if (!isRealUid(uid)) return STARTING_REPUTATION;
  const snap = await getDoc(doc(db, 'users', uid));
  if (!snap.exists()) return STARTING_REPUTATION;
  return (snap.data() as UserDoc).reputation ?? STARTING_REPUTATION;
}

export function reasonLabel(reason: ReputationReason): string {
  switch (reason) {
    case 'attended': return 'Prisotnost na tekmi';
    case 'no_show': return 'Neudeležba (no-show)';
    case 'late_cancel': return 'Pozna odjava';
    case 'on_time_cancel': return 'Pravočasna odjava';
    case 'manual': return 'Ročna sprememba';
  }
}
