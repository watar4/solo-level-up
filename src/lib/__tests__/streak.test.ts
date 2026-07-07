import { describe, it, expect } from 'vitest';
import type { Quest } from '../../types';
import {
  nextStreak,
  reconcileFreeze,
  weekStartKey,
  WEEKLY_FREEZE_STOCK,
} from '../streak';

function daily(partial: Partial<Quest> = {}): Quest {
  return {
    id: 'q1', uid: 'u', title: 't', type: 'daily', targetStat: 'STR',
    difficulty: 'C', completedDates: [], streak: 0, createdAt: 0,
    ...partial,
  };
}

const TODAY = '2026-07-07';
const YESTERDAY = '2026-07-06';

describe('nextStreak — three-day-quitter recovery (docs 08 §2)', () => {
  it('continues (+1) when yesterday was completed', () => {
    const q = daily({ streak: 4, completedDates: [YESTERDAY] });
    expect(nextStreak(q, TODAY, YESTERDAY, { stock: 1 })).toEqual({ streak: 5, freezeUsed: false });
  });

  it('starts a brand-new streak at 1 without spending a freeze', () => {
    const q = daily({ streak: 0, completedDates: [] });
    expect(nextStreak(q, TODAY, YESTERDAY, { stock: 1 })).toEqual({ streak: 1, freezeUsed: false });
  });

  it('spends a freeze to keep the streak alive when yesterday was missed', () => {
    const q = daily({ streak: 10, completedDates: ['2026-07-01'] });
    expect(nextStreak(q, TODAY, YESTERDAY, { stock: 1 })).toEqual({ streak: 11, freezeUsed: true });
  });

  it('decays (halves) instead of resetting to 1 when no freeze is left', () => {
    const q = daily({ streak: 10, completedDates: ['2026-07-01'] });
    expect(nextStreak(q, TODAY, YESTERDAY, { stock: 0 })).toEqual({ streak: 5, freezeUsed: false });
  });

  it('never decays below 1', () => {
    const q = daily({ streak: 1, completedDates: ['2026-07-01'] });
    expect(nextStreak(q, TODAY, YESTERDAY, { stock: 0 })).toEqual({ streak: 1, freezeUsed: false });
  });

  it('is idempotent when already completed today', () => {
    const q = daily({ streak: 3, completedDates: [YESTERDAY, TODAY] });
    // yesterday present → normal +1 path wins; ensure the today-guard only
    // triggers when yesterday is absent.
    expect(nextStreak(q, TODAY, YESTERDAY, { stock: 1 })).toEqual({ streak: 4, freezeUsed: false });
    const q2 = daily({ streak: 3, completedDates: [TODAY] });
    expect(nextStreak(q2, TODAY, YESTERDAY, { stock: 1 })).toEqual({ streak: 3, freezeUsed: false });
  });

  it('leaves non-daily quests unchanged', () => {
    const q = daily({ type: 'weekly', streak: 7, completedDates: [] });
    expect(nextStreak(q, TODAY, YESTERDAY, { stock: 0 })).toEqual({ streak: 7, freezeUsed: false });
  });
});

describe('reconcileFreeze + weekStartKey', () => {
  it('anchors the week to Monday', () => {
    // 2026-07-07 is a Tuesday → Monday is 2026-07-06.
    expect(weekStartKey(new Date(2026, 6, 7))).toBe('2026-07-06');
    // Sunday 2026-07-12 still belongs to the week starting Monday 2026-07-06.
    expect(weekStartKey(new Date(2026, 6, 12))).toBe('2026-07-06');
    // Monday 2026-07-13 starts a new week.
    expect(weekStartKey(new Date(2026, 6, 13))).toBe('2026-07-13');
  });

  it('refills the stock when the week rolls over', () => {
    const prev = { stock: 0, weekStartDate: '2026-06-29' };
    expect(reconcileFreeze(prev, '2026-07-06')).toEqual({ stock: WEEKLY_FREEZE_STOCK, weekStartDate: '2026-07-06' });
  });

  it('keeps the current stock within the same week', () => {
    const cur = { stock: 0, weekStartDate: '2026-07-06' };
    expect(reconcileFreeze(cur, '2026-07-06')).toBe(cur);
  });

  it('grants a full stock when there is no prior state', () => {
    expect(reconcileFreeze(undefined, '2026-07-06')).toEqual({ stock: WEEKLY_FREEZE_STOCK, weekStartDate: '2026-07-06' });
  });
});
