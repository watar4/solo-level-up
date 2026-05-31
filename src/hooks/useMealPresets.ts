import { useCallback, useEffect, useState } from 'react';
import {
  addMealPreset,
  deleteMealPreset,
  subscribeMealPresets,
  updateMealPreset,
} from '../lib/firestore';
import type { MealPreset } from '../types';

// Values supplied when saving a preset; uid/createdAt are filled in by the
// hook and id by Firestore.
export type MealPresetInput = Omit<MealPreset, 'id' | 'uid' | 'createdAt'>;

export interface MealPresetsData {
  presets: MealPreset[];
  // Upsert by (case-insensitive, trimmed) name so re-saving the same dish
  // overwrites its macros instead of creating a duplicate.
  savePreset: (input: MealPresetInput) => Promise<void>;
  removePreset: (id: string) => Promise<void>;
}

// Same normalisation policy as logged meals: calories are whole numbers, PFC
// keep one decimal place, and negatives / NaN collapse to 0.
function cleanPreset(input: MealPresetInput): MealPresetInput {
  const intClamp = (n: number) => (Number.isFinite(n) && n > 0 ? Math.round(n) : 0);
  const round1 = (n: number) =>
    Number.isFinite(n) && n > 0 ? Math.round(n * 10) / 10 : 0;
  return {
    name: input.name.trim() || '無名のプリセット',
    kcal: intClamp(input.kcal),
    protein: round1(input.protein),
    fat: round1(input.fat),
    carbs: round1(input.carbs),
  };
}

export function useMealPresets(uid: string | null): MealPresetsData {
  const [presets, setPresets] = useState<MealPreset[]>([]);

  useEffect(() => {
    if (!uid) {
      setPresets([]);
      return;
    }
    return subscribeMealPresets(uid, setPresets);
  }, [uid]);

  const savePreset = useCallback(
    async (input: MealPresetInput): Promise<void> => {
      if (!uid) return;
      const cleaned = cleanPreset(input);
      const existing = presets.find(
        (p) => p.name.toLowerCase() === cleaned.name.toLowerCase()
      );
      if (existing) {
        await updateMealPreset(existing.id, cleaned);
      } else {
        await addMealPreset({ uid, ...cleaned, createdAt: Date.now() });
      }
    },
    [uid, presets]
  );

  const removePreset = useCallback(async (id: string): Promise<void> => {
    await deleteMealPreset(id);
  }, []);

  return { presets, savePreset, removePreset };
}
