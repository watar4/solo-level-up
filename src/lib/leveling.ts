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
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
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
