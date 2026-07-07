import { describe, it, expect } from 'vitest';
import type { Character, Quest, WeightEntry, MealEntry, NutritionTarget } from '../../../types';
import { buildCoachContext, contextToPrompt } from '../context';

const TODAY = '2026-07-07';
const YESTERDAY = '2026-07-06';

function char(partial: Partial<Character> = {}): Character {
  return {
    uid: 'u',
    name: 'ハンター',
    level: 5,
    exp: 0,
    totalExp: 0,
    stats: { STR: 1, AGI: 1, INT: 1, VIT: 1, PER: 1 },
    statPoints: 0,
    createdAt: 0,
    lastSeenAt: new Date(`${TODAY}T09:00:00`).getTime(),
    ...partial,
  };
}

function daily(partial: Partial<Quest> = {}): Quest {
  return {
    id: 'q',
    uid: 'u',
    title: 'デイリー',
    type: 'daily',
    targetStat: 'STR',
    difficulty: 'C',
    completedDates: [],
    streak: 0,
    createdAt: 0,
    ...partial,
  };
}

describe('buildCoachContext', () => {
  it('survives completely empty data', () => {
    const ctx = buildCoachContext({ today: TODAY, character: char(), quests: [] });
    expect(ctx.quests.dailyTotal).toBe(0);
    expect(ctx.quests.topStreak).toBeNull();
    expect(ctx.weight.latest).toBeNull();
    expect(ctx.meals.gradeToday).toBeNull();
    expect(ctx.economy.savingsProgress).toBeNull();
    expect(ctx.campaign).toBeNull();
  });

  it('flags only dailies completed yesterday but not today as at-risk', () => {
    const quests = [
      daily({ id: 'a', title: 'A', streak: 5, completedDates: [YESTERDAY] }), // at risk
      daily({ id: 'b', title: 'B', streak: 3, completedDates: [YESTERDAY, TODAY] }), // safe (done today)
      daily({ id: 'c', title: 'C', streak: 9, completedDates: ['2026-07-01'] }), // already broken, not at-risk
    ];
    const ctx = buildCoachContext({ today: TODAY, character: char(), quests });
    expect(ctx.quests.atRisk.map((r) => r.title)).toEqual(['A']);
    expect(ctx.quests.dailyDoneToday).toBe(1);
  });

  it('sorts at-risk by streak descending', () => {
    const quests = [
      daily({ id: 'a', title: 'A', streak: 2, completedDates: [YESTERDAY] }),
      daily({ id: 'b', title: 'B', streak: 8, completedDates: [YESTERDAY] }),
    ];
    const ctx = buildCoachContext({ today: TODAY, character: char(), quests });
    expect(ctx.quests.atRisk.map((r) => r.streak)).toEqual([8, 2]);
  });

  it('builds a 7-day completion trend oldest-first ending today', () => {
    const quests = [daily({ completedDates: [TODAY, '2026-07-04'] })];
    const ctx = buildCoachContext({ today: TODAY, character: char(), quests });
    expect(ctx.quests.recent7d).toHaveLength(7);
    expect(ctx.quests.recent7d[0].date).toBe('2026-07-01');
    expect(ctx.quests.recent7d[6].date).toBe(TODAY);
    expect(ctx.quests.recent7d[6].done).toBe(1);
    expect(ctx.quests.recent7d[3].done).toBe(1); // 2026-07-04
    expect(ctx.quests.recent7d[5].done).toBe(0); // 2026-07-06
  });

  it('computes weight delta over ~14 days with correct sign', () => {
    const weights: WeightEntry[] = [
      { id: '1', uid: 'u', date: '2026-06-25', weight: 72, createdAt: 0 },
      { id: '2', uid: 'u', date: '2026-07-07', weight: 70.5, createdAt: 0 },
    ];
    const ctx = buildCoachContext({ today: TODAY, character: char(), quests: [], weights });
    expect(ctx.weight.latest).toBe(70.5);
    expect(ctx.weight.delta14d).toBe(-1.5);
    expect(ctx.weight.loggedToday).toBe(true);
  });

  it('grades today meals against the target', () => {
    const target: NutritionTarget = { kcal: 2000, protein: 120, fat: 55, carbs: 250 };
    const meals: MealEntry[] = [
      { id: '1', uid: 'u', date: TODAY, slot: 'lunch', name: '定食', kcal: 2000, protein: 120, fat: 55, carbs: 250, createdAt: 0 },
    ];
    const ctx = buildCoachContext({ today: TODAY, character: char(), quests: [], meals, nutritionTarget: target });
    expect(ctx.meals.gradeToday).toBe('S');
    expect(ctx.meals.loggedToday).toBe(true);
    expect(ctx.meals.avgScore7d).toBeGreaterThan(0);
  });

  it('derives days-since-last-seen from lastSeenAt', () => {
    const ctx = buildCoachContext({
      today: TODAY,
      character: char({ lastSeenAt: new Date('2026-07-04T20:00:00').getTime() }),
      quests: [],
    });
    expect(ctx.character.daysSinceLastSeen).toBe(3);
  });

  it('computes savings progress and budget left', () => {
    const ctx = buildCoachContext({
      today: TODAY,
      character: char({ savingsGoal: { targetAmount: 100000 }, monthlyBudget: 50000 }),
      quests: [],
      savings: [
        { id: '1', uid: 'u', date: '2026-07-02', amount: 25000, kind: 'saving', memo: '', source: 'manual', createdAt: 0 },
        { id: '2', uid: 'u', date: '2026-07-03', amount: 12000, kind: 'spending', memo: '', source: 'manual', createdAt: 0 },
      ],
    });
    expect(ctx.economy.savingsProgress).toBeCloseTo(0.25);
    expect(ctx.economy.budgetLeft).toBe(38000);
  });
});

describe('contextToPrompt', () => {
  it('only emits lines for data that is present', () => {
    const text = contextToPrompt(buildCoachContext({ today: TODAY, character: char(), quests: [] }));
    expect(text).toContain('日付: 2026-07-07');
    expect(text).toContain('ハンター');
    expect(text).not.toContain('体重');
    expect(text).not.toContain('物語');
  });
});
