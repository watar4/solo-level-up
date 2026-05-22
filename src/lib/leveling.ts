import type { Rank } from '../types';

// EXP needed to advance FROM level L to L+1.
// Rises smoothly so early levels feel fast and late levels meaningful.
export function expForLevel(level: number): number {
  return Math.floor(60 * Math.pow(level, 1.55) + 40);
}

export function rankForLevel(level: number): Rank {
  if (level >= 60) return 'SS';
  if (level >= 50) return 'S';
  if (level >= 40) return 'A';
  if (level >= 30) return 'B';
  if (level >= 20) return 'C';
  if (level >= 10) return 'D';
  return 'E';
}

export interface ApplyExpResult {
  level: number;
  exp: number;
  totalExp: number;
  levelsGained: number;
  statPointsGained: number;
}

// Apply EXP to a character, cascading level-ups if needed.
export function applyExp(level: number, exp: number, totalExp: number, gain: number): ApplyExpResult {
  let newLevel = level;
  let newExp = exp + gain;
  let levelsGained = 0;

  while (newExp >= expForLevel(newLevel)) {
    newExp -= expForLevel(newLevel);
    newLevel += 1;
    levelsGained += 1;
  }

  return {
    level: newLevel,
    exp: newExp,
    totalExp: totalExp + gain,
    levelsGained,
    statPointsGained: levelsGained * 5, // 5 points per level
  };
}

// Reverse of applyExp: given a target totalExp, derive level + in-level EXP.
// Used when refunding EXP (quest delete / uncheck) so that lifetime EXP stays
// the single source of truth and Lv comes out consistent.
export function levelFromTotalExp(totalExp: number): { level: number; exp: number } {
  let level = 1;
  let remaining = Math.max(0, totalExp);
  while (remaining >= expForLevel(level)) {
    remaining -= expForLevel(level);
    level += 1;
  }
  return { level, exp: remaining };
}

// Today as YYYY-MM-DD in the user's local timezone.
export function todayKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function yesterdayKey(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return formatDateKey(d);
}

function formatDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Given a YYYY-MM-DD date key, return the previous day's key.
export function previousDayKey(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() - 1);
  return formatDateKey(date);
}

// ISO week key, e.g. 2026-W21 — used to tell whether a weekly quest is done this week.
export function thisWeekKey(): string {
  const d = new Date();
  const target = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((target.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${target.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

// Days until the next ISO week starts (next Monday). If today is Monday, returns 7.
export function daysUntilWeekReset(): number {
  const day = new Date().getDay();          // 0=Sun .. 6=Sat
  const isoDay = day === 0 ? 7 : day;       // 1..7 with Sun=7
  const remaining = (8 - isoDay) % 7;
  return remaining === 0 ? 7 : remaining;
}

// Effective daily-quest streak based purely on completedDates.
// Returns 0 once today AND yesterday are both missing — i.e. the streak has
// expired even if the stored `streak` field still says 5.
export function effectiveStreak(completedDates: string[], type: 'daily' | 'weekly' | 'one-time'): number {
  if (type !== 'daily') return 0;
  const set = new Set(completedDates);
  const today = todayKey();
  const yest = yesterdayKey();
  if (!set.has(today) && !set.has(yest)) return 0;
  let cursor = set.has(today) ? today : yest;
  let count = 0;
  while (set.has(cursor)) {
    count++;
    cursor = previousDayKey(cursor);
  }
  return count;
}
