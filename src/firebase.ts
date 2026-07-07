import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const firebaseReady = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);

// Exposed for UI surfaces that need to show the Firestore REST URL the user
// must paste into iOS Shortcut (e.g. the API keys panel).
export const firebaseProjectId: string = firebaseConfig.projectId ?? '';

// Initialise lazily so the app can still render a configuration warning when env is missing.
const app = firebaseReady ? initializeApp(firebaseConfig) : null;

export const auth = app ? getAuth(app) : null;

// `ignoreUndefinedProperties: true` — without this, any updateDoc/setDoc call
// containing `field: undefined` throws and rejects the whole batch. That hits
// us on quest completion because we always send `unlocked` / `title`, both of
// which are `undefined` for brand-new characters. Toggling this flag lets the
// SDK drop those fields silently so the EXP/stat update goes through.
//
// `persistentLocalCache` — IndexedDB-backed offline cache. Reads resolve from
// cache when offline and writes queue and replay on reconnect, so the app is
// usable with no network (the service worker already caches the app shell).
// `persistentMultipleTabManager` keeps multiple open tabs consistent.
// Persistence can throw when IndexedDB is unavailable (private mode, old
// browsers, or a second app instance grabbing the lock without the multi-tab
// manager), so we fall back to the default in-memory cache instead of leaving
// `db` null and breaking the whole app.
function makeDb(a: FirebaseApp): Firestore {
  try {
    return initializeFirestore(a, {
      ignoreUndefinedProperties: true,
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    });
  } catch (err) {
    console.error('[firebase] persistent cache unavailable, using memory cache', err);
    return initializeFirestore(a, { ignoreUndefinedProperties: true });
  }
}

export const db = app ? makeDb(app) : null;
export const googleProvider = new GoogleAuthProvider();
