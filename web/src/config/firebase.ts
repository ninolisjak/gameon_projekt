import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyAdJp9gBOIvunXssLu2JJ3aEh5ZDzHHcPw',
  authDomain: 'gameon-9d876.firebaseapp.com',
  databaseURL: 'https://gameon-9d876-default-rtdb.europe-west1.firebasedatabase.app',
  projectId: 'gameon-9d876',
  storageBucket: 'gameon-9d876.firebasestorage.app',
  messagingSenderId: '900495301978',
  appId: '1:900495301978:web:a7bc39ea4e5dfd1bd96763',
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
