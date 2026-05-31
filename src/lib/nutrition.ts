import type {
  ActivityLevel,
  DietType,
  MealEntry,
  NutritionTarget,
} from '../types';

// kcal per kg of bodyweight — a simplified daily-maintenance estimate that
// avoids asking for height/age/sex. Multiply by current weight to approximate
// maintenance calories (TDEE).
export const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  sedentary: 28,
  light: 30,
  moderate: 33,
  active: 35,
};

// 1 kg of body mass ≈ 7200 kcal. (The textbook 7700 figure is fat-only; 7200
// is a common practical value that accounts for some lean-mass change.) Used
// to spread the weight delta across the days remaining until the deadline.
export const KCAL_PER_KG = 7200;

export interface NutritionGoalInputs {
  currentWeight: number; // kg
  targetWeight: number;  // kg
  daysRemaining: number; // days until deadline (clamped to >= 1)
  activity: ActivityLevel;
  diet: DietType;
}

// Maintenance calories ≈ bodyweight × activity factor.
export function maintenanceCalories(weight: number, activity: ActivityLevel): number {
  return weight * ACTIVITY_FACTORS[activity];
}

// Number of whole days between today and an ISO date string (YYYY-MM-DD).
// Returns at least 1 so the back-calc never divides by zero. Past dates also
// clamp to 1 (i.e. "you need to do it all today").
export function daysUntil(targetDate: string, from: Date = new Date()): number {
  const target = new Date(`${targetDate}T00:00:00`);
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const ms = target.getTime() - start.getTime();
  const days = Math.ceil(ms / 86_400_000);
  return Math.max(1, days);
}

// Back-calculate the daily calorie + PFC target from a weight goal.
//   daily kcal = maintenance + (Δweight × 7200) / daysRemaining
// Δweight < 0 (cutting) yields a deficit; Δweight > 0 (bulking) a surplus.
// The result is clamped to a sane band so an aggressive deadline can't drive
// intake to dangerous extremes.
export function computeNutritionTarget(input: NutritionGoalInputs): NutritionTarget {
  const { currentWeight, targetWeight, daysRemaining, activity, diet } = input;
  const days = Math.max(1, daysRemaining);
  const maintenance = maintenanceCalories(currentWeight, activity);
  const delta = targetWeight - currentWeight; // kg, signed
  const dailyAdjust = (delta * KCAL_PER_KG) / days; // kcal/day, signed

  let kcal = maintenance + dailyAdjust;
  // Safety band: never below 1200 kcal (or 60% of maintenance, whichever is
  // higher) and never above 140% of maintenance for a "lean" bulk.
  const minKcal = Math.max(1200, maintenance * 0.6);
  const maxKcal = maintenance * 1.4;
  kcal = Math.min(maxKcal, Math.max(minKcal, kcal));

  return splitMacros(kcal, currentWeight, diet);
}

// Distribute a calorie budget into protein/fat/carbs grams per the diet preset.
// Protein is set per kg of bodyweight; the remaining calories go to fat/carbs
// according to each preset's policy.
export function splitMacros(
  kcal: number,
  weight: number,
  diet: DietType
): NutritionTarget {
  let proteinPerKg: number;
  let fatRatio: number | null = null;   // fraction of kcal from fat
  let carbRatioMax: number | null = null; // cap carbs at this fraction of kcal
  let carbGramsFixed: number | null = null; // hard carb gram target (keto)

  switch (diet) {
    case 'balanced':
      proteinPerKg = 1.8;
      fatRatio = 0.25;
      break;
    case 'highprotein':
      proteinPerKg = 2.2;
      fatRatio = 0.25;
      break;
    case 'lowcarb':
      proteinPerKg = 2.0;
      carbRatioMax = 0.2; // carbs capped, fat fills the rest
      break;
    case 'keto':
      proteinPerKg = 2.0;
      carbGramsFixed = 50; // fixed low carbs, fat fills the rest
      break;
    case 'leanbulk':
      proteinPerKg = 1.8;
      fatRatio = 0.2;
      break;
  }

  const protein = proteinPerKg * weight; // g
  const proteinKcal = protein * 4;

  let fat: number;
  let carbs: number;

  if (carbGramsFixed !== null) {
    // keto: carbs fixed, fat takes the remainder after protein.
    carbs = carbGramsFixed;
    const fatKcal = Math.max(0, kcal - proteinKcal - carbs * 4);
    fat = fatKcal / 9;
  } else if (carbRatioMax !== null) {
    // lowcarb: carbs capped at a fraction of kcal, fat takes the remainder.
    const carbKcal = kcal * carbRatioMax;
    carbs = carbKcal / 4;
    const fatKcal = Math.max(0, kcal - proteinKcal - carbKcal);
    fat = fatKcal / 9;
  } else {
    // fat ratio fixed, carbs take the remainder.
    const fatKcal = kcal * (fatRatio ?? 0.25);
    fat = fatKcal / 9;
    const carbKcal = Math.max(0, kcal - proteinKcal - fatKcal);
    carbs = carbKcal / 4;
  }

  return {
    kcal: Math.round(kcal),
    protein: Math.round(protein),
    fat: Math.round(fat),
    carbs: Math.round(carbs),
  };
}

// ----- daily totals + evaluation -----

export interface DailyTotals {
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
}

export function sumMeals(meals: MealEntry[]): DailyTotals {
  return meals.reduce<DailyTotals>(
    (acc, m) => ({
      kcal: acc.kcal + (m.kcal || 0),
      protein: acc.protein + (m.protein || 0),
      fat: acc.fat + (m.fat || 0),
      carbs: acc.carbs + (m.carbs || 0),
    }),
    { kcal: 0, protein: 0, fat: 0, carbs: 0 }
  );
}

export type NutritionGrade = 'E' | 'D' | 'C' | 'B' | 'A' | 'S';

export interface NutritionEvaluation {
  grade: NutritionGrade;
  score: number;       // 0..100
  metProtein: boolean; // hit >= 90% of the protein target
  kcalRatio: number;   // actual / target (for the UI bars)
  proteinRatio: number;
  fatRatio: number;
  carbsRatio: number;
}

// How close `actual` is to `target`, as a 0..1 score. Exact = 1; deviating by
// `tolerance` fraction (e.g. 0.3 = 30%) or more = 0.
function closeness(actual: number, target: number, tolerance: number): number {
  if (target <= 0) return 0;
  const dev = Math.abs(actual / target - 1);
  return Math.max(0, 1 - dev / tolerance);
}

// Grade a day's intake against the target. Calories and protein dominate the
// score; fat and carbs contribute less. Protein is rewarded for *meeting* the
// target (overshooting protein isn't penalised — it's rarely harmful).
export function evaluateDay(
  totals: DailyTotals,
  target: NutritionTarget
): NutritionEvaluation {
  const kcalClose = closeness(totals.kcal, target.kcal, 0.25);
  const proteinScore = target.protein > 0 ? Math.min(1, totals.protein / target.protein) : 0;
  const fatClose = closeness(totals.fat, target.fat, 0.5);
  const carbClose = closeness(totals.carbs, target.carbs, 0.5);

  const score = Math.round(
    100 * (0.4 * kcalClose + 0.35 * proteinScore + 0.125 * fatClose + 0.125 * carbClose)
  );

  return {
    grade: gradeFromScore(score),
    score,
    metProtein: target.protein > 0 && totals.protein >= target.protein * 0.9,
    kcalRatio: target.kcal > 0 ? totals.kcal / target.kcal : 0,
    proteinRatio: target.protein > 0 ? totals.protein / target.protein : 0,
    fatRatio: target.fat > 0 ? totals.fat / target.fat : 0,
    carbsRatio: target.carbs > 0 ? totals.carbs / target.carbs : 0,
  };
}

export function gradeFromScore(score: number): NutritionGrade {
  if (score >= 90) return 'S';
  if (score >= 80) return 'A';
  if (score >= 65) return 'B';
  if (score >= 50) return 'C';
  if (score >= 35) return 'D';
  return 'E';
}

// A day "meets the goal" (and earns the once-daily EXP reward) at grade B+.
export function dayMeetsGoal(evalResult: NutritionEvaluation): boolean {
  return evalResult.score >= 65;
}
