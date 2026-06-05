import {
  collection, addDoc, onSnapshot,
  query, orderBy, limit, Timestamp,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../config/firebase';

export type ChatMessage = {
  id: string;
  senderId: string;
  senderName: string;
  type: 'text' | 'image' | 'gif';
  text?: string;
  mediaUrl?: string;
  createdAt: any;
};

export function subscribeChatMessages(
  matchId: string,
  callback: (msgs: ChatMessage[]) => void,
): () => void {
  const q = query(
    collection(db, 'matches', matchId, 'messages'),
    orderBy('createdAt', 'asc'),
    limit(100),
  );
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => ({ ...d.data(), id: d.id } as ChatMessage)));
  });
}

export async function sendTextMessage(
  matchId: string,
  senderId: string,
  senderName: string,
  text: string,
): Promise<void> {
  await addDoc(collection(db, 'matches', matchId, 'messages'), {
    senderId, senderName, type: 'text', text,
    createdAt: Timestamp.now(),
  });
}

export async function sendGifMessage(
  matchId: string,
  senderId: string,
  senderName: string,
  gifUrl: string,
): Promise<void> {
  await addDoc(collection(db, 'matches', matchId, 'messages'), {
    senderId, senderName, type: 'gif', mediaUrl: gifUrl,
    createdAt: Timestamp.now(),
  });
}

export async function sendImageMessage(
  matchId: string,
  senderId: string,
  senderName: string,
  imageUri: string,
): Promise<void> {
  const response = await fetch(imageUri);
  const blob = await response.blob();
  const storageRef = ref(storage, `chat-media/${matchId}/${Date.now()}.jpg`);
  await uploadBytes(storageRef, blob);
  const mediaUrl = await getDownloadURL(storageRef);
  await addDoc(collection(db, 'matches', matchId, 'messages'), {
    senderId, senderName, type: 'image', mediaUrl,
    createdAt: Timestamp.now(),
  });
}
