import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '../config/firebase';

export async function createMatch(data: {
  sport: 'futsal' | 'basketball';
  lat: number;
  lng: number;
  locationName: string;
  datetime: Date;
  totalSpots: number;
  createdBy: string;
}) {
  return addDoc(collection(db, 'matches'), {
    ...data,
    location: { lat: data.lat, lng: data.lng, name: data.locationName },
    datetime: Timestamp.fromDate(data.datetime),
    filledSpots: 0,
    status: 'open',
    isPublic: true,
    players: [data.createdBy],
    createdAt: Timestamp.now(),
  });
}