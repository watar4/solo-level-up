import { useCallback, useEffect, useState } from 'react';
import {
  addMeal as addMealDoc,
  deleteMeal,
  subscribeMeals,
} from '../lib/firestore';
import type { MealEntry } from '../types';

// Fields the caller supplies when logging a meal; uid/createdAt are filled in
// by the hook, id by Firestore.
export type MealInput = Omit<MealEntry, 'id' | 'uid' | 'createdAt'>;

export interface MealsData {
  meals: MealEntry[];
  addMeal: (input: MealInput) => Promise<void>;
  removeMeal: (id: string) => Promise<void>;
}

export function useMeals(uid: string | null): MealsData {
  const [meals, setMeals] = useState<MealEntry[]>([]);

  useEffect(() => {
    if (!uid) {
      setMeals([]);
      return;
    }
    return subscribeMeals(uid, setMeals);
  }, [uid]);

  const addMeal = useCallback(
    async (input: MealInput): Promise<void> => {
      if (!uid) return;
      // Clamp to non-negative integers — the form already validates, but this
      // protects the daily totals from stray negative/NaN values.
      const clean = (n: number) => (Number.isFinite(n) && n > 0 ? Math.round(n) : 0);
      await addMealDoc({
        uid,
        date: input.date,
        slot: input.slot,
        name: input.name.trim() || '無名の食事',
        kcal: clean(input.kcal),
        protein: clean(input.protein),
        fat: clean(input.fat),
        carbs: clean(input.carbs),
        createdAt: Date.now(),
      });
    },
    [uid]
  );

  const removeMeal = useCallback(async (id: string): Promise<void> => {
    await deleteMeal(id);
  }, []);

  return { meals, addMeal, removeMeal };
}
