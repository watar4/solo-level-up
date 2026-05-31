import { useCallback, useEffect, useState } from 'react';
import {
  addMeal as addMealDoc,
  deleteMeal,
  updateMeal,
  subscribeMeals,
} from '../lib/firestore';
import type { MealEntry } from '../types';

// Fields the caller supplies when logging a meal; uid/createdAt are filled in
// by the hook, id by Firestore.
export type MealInput = Omit<MealEntry, 'id' | 'uid' | 'createdAt'>;

export interface MealsData {
  meals: MealEntry[];
  addMeal: (input: MealInput) => Promise<void>;
  editMeal: (id: string, input: MealInput) => Promise<void>;
  removeMeal: (id: string) => Promise<void>;
}

// Normalise a raw form payload before it hits Firestore. Guards against
// negative/NaN values; calories stay whole numbers while PFC keep one decimal
// place (the form accepts decimals).
function cleanMeal(input: MealInput): MealInput {
  const intClamp = (n: number) => (Number.isFinite(n) && n > 0 ? Math.round(n) : 0);
  const round1 = (n: number) =>
    Number.isFinite(n) && n > 0 ? Math.round(n * 10) / 10 : 0;
  return {
    date: input.date,
    slot: input.slot,
    name: input.name.trim() || '無名の食事',
    kcal: intClamp(input.kcal),
    protein: round1(input.protein),
    fat: round1(input.fat),
    carbs: round1(input.carbs),
  };
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
      await addMealDoc({ uid, ...cleanMeal(input), createdAt: Date.now() });
    },
    [uid]
  );

  const editMeal = useCallback(
    async (id: string, input: MealInput): Promise<void> => {
      if (!uid) return;
      await updateMeal(id, cleanMeal(input));
    },
    [uid]
  );

  const removeMeal = useCallback(async (id: string): Promise<void> => {
    await deleteMeal(id);
  }, []);

  return { meals, addMeal, editMeal, removeMeal };
}
