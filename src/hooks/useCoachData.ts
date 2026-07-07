import { useMemo } from 'react';
import type { Character, Quest, SavingsEntry } from '../types';
import { useMeals } from './useMeals';
import { useWeights } from './useWeights';
import { todayKey } from '../lib/leveling';
import { resolveNutritionTarget } from '../lib/nutrition';
import { buildCoachContext, type CoachContext } from '../lib/coach/context';

// Assembles the full CoachContext the AI coach reads from. It owns the meal /
// weight subscriptions the dashboard doesn't already have, so the coach can
// reference every log without each panel being open. `character`, `quests` and
// `savings` come from hooks the dashboard already holds (passed in to avoid
// duplicate Firestore subscriptions). Returns null until a character exists.
export function useCoachData(
  uid: string | null,
  character: Character | null,
  quests: Quest[],
  savings: SavingsEntry[]
): CoachContext | null {
  const { meals } = useMeals(uid);
  const { entries: weights } = useWeights(uid);

  return useMemo(() => {
    if (!character) return null;
    const nutritionTarget = resolveNutritionTarget(character, weights);
    return buildCoachContext({
      today: todayKey(),
      character,
      quests,
      weights,
      meals,
      nutritionTarget,
      savings,
    });
  }, [character, quests, weights, meals, savings]);
}
