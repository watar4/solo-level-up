import { useEffect, useState } from 'react';
import {
  signInWithPopup,
  signOut as fbSignOut,
  onAuthStateChanged,
  type User,
} from 'firebase/auth';
import { auth, googleProvider, firebaseReady } from '../firebase';

export interface AuthState {
  user: User | null;
  loading: boolean;
  ready: boolean; // firebase env present
}

export function useAuth(): AuthState & {
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
} {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
  }, []);

  return {
    user,
    loading,
    ready: firebaseReady,
    signIn: async () => {
      if (!auth) throw new Error('Firebase auth not configured');
      await signInWithPopup(auth, googleProvider);
    },
    signOut: async () => {
      if (!auth) return;
      await fbSignOut(auth);
    },
  };
}
