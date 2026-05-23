import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { initializeFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const firebaseReady = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);

// Initialise lazily so the app can still render a configuration warning when env is missing.
const app = firebaseReady ? initializeApp(firebaseConfig) : null;

export const auth = app ? getAuth(app) : null;
// `ignoreUndefinedProperties: true` — without this, any updateDoc/setDoc call
// containing `field: undefined` throws and rejects the whole batch. That hits
// us on quest completion because we always send `unlocked` / `title`, both of
// which are `undefined` for brand-new characters. Toggling this flag lets the
// SDK drop those fields silently so the EXP/stat update goes through.
export const db = app
  ? initializeFirestore(app, { ignoreUndefinedProperties: true })
  : null;
export const googleProvider = new GoogleAuthProvider();
