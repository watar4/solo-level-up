import {
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  deleteDoc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { Character, Quest, StatKey } from '../types';
import { ALL_STATS } from '../types';

function requireDb() {
  if (!db) throw new Error('Firestore is not configured. See README for setup.');
  return db;
}

export async function loadCharacter(uid: string): Promise<Character | null> {
  const snap = await getDoc(doc(requireDb(), 'characters', uid));
  if (!snap.exists()) return null;
  return snap.data() as Character;
}

export async function createCharacter(uid: string, name: string): Promise<Character> {
  const stats = Object.fromEntries(ALL_STATS.map((s) => [s, 10])) as Record<StatKey, number>;
  const now = Date.now();
  const character: Character = {
    uid,
    name,
    level: 1,
    exp: 0,
    totalExp: 0,
    stats,
    statPoints: 0,
    createdAt: now,
    lastSeenAt: now,
  };
  await setDoc(doc(requireDb(), 'characters', uid), character);
  return character;
}

export async function updateCharacter(uid: string, patch: Partial<Character>): Promise<void> {
  await updateDoc(doc(requireDb(), 'characters', uid), patch as Record<string, unknown>);
}

export async function deleteCharacter(uid: string): Promise<void> {
  await deleteDoc(doc(requireDb(), 'characters', uid));
}

export function subscribeQuests(
  uid: string,
  onChange: (quests: Quest[]) => void,
  onError?: (err: Error) => void
): () => void {
  const q = query(collection(requireDb(), 'quests'), where('uid', '==', uid));
  return onSnapshot(
    q,
    (snap) => {
      const quests: Quest[] = [];
      snap.forEach((s) => {
        const data = s.data() as Omit<Quest, 'id'>;
        quests.push({ ...data, id: s.id });
      });
      // Sort: not-archived first, then by manual `order` (asc, undefined = MAX),
      // tiebreak by newest-created first so brand-new quests still appear at top
      // until the user has manually ordered them.
      quests.sort((a, b) => {
        if ((a.archived ? 1 : 0) !== (b.archived ? 1 : 0)) {
          return (a.archived ? 1 : 0) - (b.archived ? 1 : 0);
        }
        const ao = a.order ?? Number.MAX_SAFE_INTEGER;
        const bo = b.order ?? Number.MAX_SAFE_INTEGER;
        if (ao !== bo) return ao - bo;
        return b.createdAt - a.createdAt;
      });
      onChange(quests);
    },
    (err) => {
      console.error('[quests:subscribe] failed', err);
      onError?.(err);
    }
  );
}

export async function createQuest(quest: Omit<Quest, 'id'>): Promise<string> {
  const ref = await addDoc(collection(requireDb(), 'quests'), quest);
  return ref.id;
}

export async function updateQuest(id: string, patch: Partial<Quest>): Promise<void> {
  await updateDoc(doc(requireDb(), 'quests', id), patch as Record<string, unknown>);
}

export async function deleteQuest(id: string): Promise<void> {
  await deleteDoc(doc(requireDb(), 'quests', id));
}

export async function logCompletion(
  uid: string,
  questId: string,
  expGained: number,
  date: string
): Promise<void> {
  await addDoc(collection(requireDb(), 'completions'), {
    uid,
    questId,
    expGained,
    date,
    at: serverTimestamp() as unknown as Timestamp,
  });
}

export interface CompletionLog {
  id: string;
  expGained: number;
  date?: string;
}

export async function getCompletionsForQuest(
  uid: string,
  questId: string
): Promise<CompletionLog[]> {
  const q = query(
    collection(requireDb(), 'completions'),
    where('uid', '==', uid),
    where('questId', '==', questId)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data() as { expGained?: number; date?: string };
    return { id: d.id, expGained: data.expGained ?? 0, date: data.date };
  });
}

export interface CompletionLogRich {
  id: string;
  questId: string;
  expGained: number;
  date?: string;
  at?: number;
}

export async function getAllCompletions(uid: string): Promise<CompletionLogRich[]> {
  const q = query(collection(requireDb(), 'completions'), where('uid', '==', uid));
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data() as {
      questId?: string;
      expGained?: number;
      date?: string;
      at?: { seconds: number };
    };
    return {
      id: d.id,
      questId: data.questId ?? '',
      expGained: data.expGained ?? 0,
      date: data.date,
      at: data.at ? data.at.seconds * 1000 : undefined,
    };
  });
}

export async function deleteCompletions(ids: string[]): Promise<void> {
  await Promise.all(ids.map((id) => deleteDoc(doc(requireDb(), 'completions', id))));
}
