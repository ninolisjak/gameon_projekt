import { doc, setDoc, Timestamp } from 'firebase/firestore';
import { db } from '../config/firebase';

export async function ensureOwnerProfile(uid: string, email: string, displayName?: string) {
  await setDoc(doc(db, 'users', uid), {
    uid,
    email,
    displayName: displayName ?? email.split('@')[0],
    role: 'owner',
    createdAt: Timestamp.now(),
  }, { merge: true });
}
