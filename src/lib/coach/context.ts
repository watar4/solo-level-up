// AI coach — context assembly (docs/redesign/09-ai-coach.md §1).
//
// One structured snapshot of "what the coach can see": the character, quests,
// weight, meals and money, distilled into small primitives. All logic here is
// pure (no hooks, no Firebase, no Date.now) so it is fully unit-testable and so
// the LLM only ever receives facts computed by code — never numbers it made up.
//
// The `today` key is passed in (never read from the clock) to keep every
// function deterministic; callers pass todayKey() from lib/leveling.

import type {
  Character,
  Quest,
  WeightEntry,
  MealEntry,
  NutritionTarget,
  SavingsEntry,
} from '../../types';
import { rankForLevel } from '../leveling';
import { evaluateDay, sumMeals } from '../nutrition';
import { walletGold } from '../economy';
import { savingsTotal, monthSpending, monthKey } from '../savings';

export interface CoachContext {
  today: string; // YYYY-MM-DD
  character: {
    name: string;
    level: number;
    rank: string;
    daysSinceLastSeen: number; // 0 = seen today
    freezeStock: number;
  };
  quests: {
    dailyTotal: number;
    dailyDoneToday: number;
    topStreak: { title: string; streak: number } | null;
    // Dailies completed yesterday but not yet today: completing today keeps the
    // streak, missing it decays it (see lib/streak.ts). The actionable set.
    atRisk: { title: string; streak: number }[];
    recent7d: { date: string; done: number }[]; // oldest first
  };
  weight: {
    latest: number | null;
    delta14d: number | null; // latest − (value ~14d ago); negative = lost weight
    target: number | null;
    loggedToday: boolean;
  };
  meals: {
    gradeToday: string | null;
    avgScore7d: number | null;
    loggedToday: boolean;
  };
  economy: {
    gold: number;
    savingsProgress: number | null; // 0..1 toward the savings goal
    budgetLeft: number | null; // yen remaining in this month's budget (can go negative)
  };
  campaign: { chapter: number; medals: number } | null;
}

export interface CoachContextInput {
  today: string;
  character: Character;
  quests: Quest[];
  weights?: WeightEntry[];
  meals?: MealEntry[];
  nutritionTarget?: NutritionTarget | null;
  savings?: SavingsEntry[];
}

// Add `n` days (can be negative) to a YYYY-MM-DD key without touching the clock.
function addDays(key: string, n: number): string {
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(y, m - 1, d + n);
  const yy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

// Whole days between two YYYY-MM-DD keys (a − b), calendar-based.
function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  const ta = Date.UTC(ay, am - 1, ad);
  const tb = Date.UTC(by, bm - 1, bd);
  return Math.round((ta - tb) / 86_400_000);
}

// The local YYYY-MM-DD of a timestamp (matches leveling's local-date convention).
function dayOf(ts: number): string {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function buildCoachContext(input: CoachContextInput): CoachContext {
  const { today, character, quests } = input;
  const weights = input.weights ?? [];
  const meals = input.meals ?? [];
  const savings = input.savings ?? [];
  const target = input.nutritionTarget ?? null;
  const yesterday = addDays(today, -1);

  // ----- character -----
  const lastSeenDay = character.lastSeenAt ? dayOf(character.lastSeenAt) : today;
  const daysSinceLastSeen = Math.max(0, daysBetween(today, lastSeenDay));

  // ----- quests -----
  const dailies = quests.filter((q) => !q.archived && q.type === 'daily');
  const doneToday = dailies.filter((q) => q.completedDates.includes(today));
  let topStreak: { title: string; streak: number } | null = null;
  for (const q of dailies) {
    if (!topStreak || q.streak > topStreak.streak) {
      topStreak = { title: q.title, streak: q.streak };
    }
  }
  const atRisk = dailies
    .filter((q) => q.completedDates.includes(yesterday) && !q.completedDates.includes(today))
    .map((q) => ({ title: q.title, streak: q.streak }))
    .sort((a, b) => b.streak - a.streak);

  const recent7d: { date: string; done: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const date = addDays(today, -i);
    const done = dailies.filter((q) => q.completedDates.includes(date)).length;
    recent7d.push({ date, done });
  }

  // ----- weight -----
  const sortedW = [...weights].sort((a, b) => a.date.localeCompare(b.date));
  const latestW = sortedW.length ? sortedW[sortedW.length - 1] : null;
  let delta14d: number | null = null;
  if (latestW) {
    const cutoff = addDays(latestW.date, -14);
    // The earliest entry at or after the 14-day cutoff — the closest prior
    // baseline we have to compare the latest reading against.
    const baseline = sortedW.find((w) => w.date >= cutoff && w.date < latestW.date);
    if (baseline) delta14d = Math.round((latestW.weight - baseline.weight) * 10) / 10;
  }

  // ----- meals -----
  const mealsToday = meals.filter((m) => m.date === today);
  let gradeToday: string | null = null;
  if (target && mealsToday.length) {
    gradeToday = evaluateDay(sumMeals(mealsToday), target).grade;
  }
  let avgScore7d: number | null = null;
  if (target) {
    const scores: number[] = [];
    for (let i = 0; i < 7; i++) {
      const date = addDays(today, -i);
      const dayMeals = meals.filter((m) => m.date === date);
      if (dayMeals.length) scores.push(evaluateDay(sumMeals(dayMeals), target).score);
    }
    if (scores.length) {
      avgScore7d = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    }
  }

  // ----- economy -----
  let savingsProgress: number | null = null;
  if (character.savingsGoal && character.savingsGoal.targetAmount > 0) {
    savingsProgress = Math.min(1, savingsTotal(savings) / character.savingsGoal.targetAmount);
  }
  let budgetLeft: number | null = null;
  if (typeof character.monthlyBudget === 'number') {
    budgetLeft = character.monthlyBudget - monthSpending(savings, monthKey(today));
  }

  return {
    today,
    character: {
      name: character.name,
      level: character.level,
      rank: rankForLevel(character.level),
      daysSinceLastSeen,
      freezeStock: character.streakFreeze?.stock ?? 0,
    },
    quests: {
      dailyTotal: dailies.length,
      dailyDoneToday: doneToday.length,
      topStreak,
      atRisk,
      recent7d,
    },
    weight: {
      latest: latestW ? latestW.weight : null,
      delta14d,
      target: character.weightTarget ?? null,
      loggedToday: weights.some((w) => w.date === today),
    },
    meals: {
      gradeToday,
      avgScore7d,
      loggedToday: mealsToday.length > 0,
    },
    economy: {
      gold: walletGold(character),
      savingsProgress,
      budgetLeft,
    },
    campaign: character.campaign
      ? { chapter: character.campaign.chapter, medals: character.campaign.medals.length }
      : null,
  };
}

// Compact Japanese bullet text fed to the LLM. Kept terse (~600 chars max) to
// save the small local model's token budget. Only facts present in `ctx`.
export function contextToPrompt(ctx: CoachContext): string {
  const c = ctx.character;
  const q = ctx.quests;
  const lines: string[] = [];
  lines.push(`日付: ${ctx.today}`);
  lines.push(`プレイヤー: ${c.name} / Lv${c.level} / ${c.rank}ランク`);
  if (c.daysSinceLastSeen > 0) lines.push(`前回から ${c.daysSinceLastSeen}日ぶり`);
  lines.push(`今日のデイリー: ${q.dailyDoneToday}/${q.dailyTotal} 完了`);
  if (q.topStreak && q.topStreak.streak > 0) {
    lines.push(`最長連続: 「${q.topStreak.title}」${q.topStreak.streak}日`);
  }
  if (q.atRisk.length) {
    lines.push(
      `途切れそう: ${q.atRisk
        .slice(0, 3)
        .map((r) => `「${r.title}」(${r.streak}日)`)
        .join('、')}`
    );
  }
  lines.push(`継続の盾(フリーズ)在庫: ${c.freezeStock}`);
  const trend = q.recent7d.map((d) => d.done).join(',');
  lines.push(`直近7日の達成数: ${trend}`);
  if (ctx.weight.latest != null) {
    let w = `体重: ${ctx.weight.latest}kg`;
    if (ctx.weight.delta14d != null) {
      const sign = ctx.weight.delta14d > 0 ? '+' : '';
      w += `(2週で ${sign}${ctx.weight.delta14d}kg)`;
    }
    if (ctx.weight.target != null) w += ` / 目標 ${ctx.weight.target}kg`;
    lines.push(w);
  }
  if (ctx.meals.gradeToday) lines.push(`今日の食事評価: ${ctx.meals.gradeToday}`);
  else if (ctx.meals.avgScore7d != null) lines.push(`直近の食事平均: ${ctx.meals.avgScore7d}点`);
  if (ctx.economy.savingsProgress != null) {
    lines.push(`貯金目標の進捗: ${Math.round(ctx.economy.savingsProgress * 100)}%`);
  }
  if (ctx.economy.budgetLeft != null) {
    lines.push(`今月の予算残: ${ctx.economy.budgetLeft.toLocaleString('ja-JP')}円`);
  }
  if (ctx.campaign) lines.push(`物語: 第${ctx.campaign.chapter}章 / メダル${ctx.campaign.medals}個`);
  return lines.join('\n');
}
