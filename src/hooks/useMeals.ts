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
      // Guard against stray negative/NaN values. Calories stay whole numbers;
      // PFC keep one decimal place so entries like "12.5 g" survive (the form
      // accepts decimals).
      const intClamp = (n: number) => (Number.isFinite(n) && n > 0 ? Math.round(n) : 0);
      const round1 = (n: number) =>
        Number.isFinite(n) && n > 0 ? Math.round(n * 10) / 10 : 0;
      await addMealDoc({
        uid,
        date: input.date,
        slot: input.slot,
        name: input.name.trim() || '無名の食事',
        kcal: intClamp(input.kcal),
        protein: round1(input.protein),
        fat: round1(input.fat),
        carbs: round1(input.carbs),
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
