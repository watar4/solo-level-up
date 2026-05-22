import { useCallback, useEffect, useState } from 'react';
import {
  addWeightEntry,
  deleteWeightEntry,
  subscribeWeights,
} from '../lib/firestore';
import type { WeightEntry } from '../types';

export interface WeightsData {
  entries: WeightEntry[];
  recordWeight: (weight: number, date: string) => Promise<void>;
  removeEntry: (id: string) => Promise<void>;
}

export function useWeights(uid: string | null): WeightsData {
  const [entries, setEntries] = useState<WeightEntry[]>([]);

  useEffect(() => {
    if (!uid) {
      setEntries([]);
      return;
    }
    return subscribeWeights(uid, setEntries);
  }, [uid]);

  const recordWeight = useCallback(
    async (weight: number, date: string): Promise<void> => {
      if (!uid) return;
      // Snap to one decimal — both rounds the value and protects the
      // chart math from spurious 0.123456789-style noise.
      const rounded = Math.round(weight * 10) / 10;
      await addWeightEntry({
        uid,
        date,
        weight: rounded,
        createdAt: Date.now(),
      });
    },
    [uid]
  );

  const removeEntry = useCallback(async (id: string): Promise<void> => {
    await deleteWeightEntry(id);
  }, []);

  return { entries, recordWeight, removeEntry };
}
