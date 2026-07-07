// Streak recovery (三日坊主救済) — docs/redesign/08-retention-reliability.md §2.
//
// The app's core message is "三日坊主でいい、四日目を始めよう" (miss a day, come
// back on the fourth). The old rule reset a broken daily streak straight to 1,
// which contradicts that. Instead a missed day is either covered by a weekly
// "freeze" token or the streak *decays* (halves) rather than collapsing.
//
// All logic here is pure so it can be unit-tested without Firebase.

import type { Quest } from '../types';

// How many freeze tokens are granted per (Monday-anchored) week.
export const WEEKLY_FREEZE_STOCK = 1;
// A missed day with no freeze halves the streak instead of resetting to 1.
export const STREAK_DECAY = 0.5;

export interface FreezeState {
  stock: number;
  weekStartDate: string; // Monday, YYYY-MM-DD
}

export interface StreakResult {
  streak: number;
  freezeUsed: boolean;
}

// The Monday (local) of the week containing `d`, as YYYY-MM-DD. Matches the
// local-date convention used by todayKey/yesterdayKey in lib/leveling.ts.
export function weekStartKey(d: Date): string {
  const daysSinceMonday = (d.getDay() + 6) % 7; // getDay(): 0=Sun … 6=Sat
  const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - daysSinceMonday);
  const y = monday.getFullYear();
  const m = String(monday.getMonth() + 1).padStart(2, '0');
  const dd = String(monday.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

// Refill freeze tokens when the week rolls over; otherwise keep the current
// stock. Returns a fresh object only when something changed.
export function reconcileFreeze(cur: FreezeState | undefined, weekStart: string): FreezeState {
  if (cur && cur.weekStartDate === weekStart) return cur;
  return { stock: WEEKLY_FREEZE_STOCK, weekStartDate: weekStart };
}

// Compute the new streak for completing `quest` today.
//   - non-daily quests are unaffected (their `streak` is carried as-is)
//   - completed yesterday        → +1 (normal continuation)
//   - already completed today     → unchanged (idempotent re-complete)
//   - no streak to protect (≤0)  → start at 1 (never spends a freeze)
//   - missed yesterday, freeze    → +1 and consume a freeze
//   - missed yesterday, no freeze → decay: max(1, floor(streak * DECAY))
export function nextStreak(
  quest: Quest,
  today: string,
  yesterday: string,
  freeze: Pick<FreezeState, 'stock'>
): StreakResult {
  if (quest.type !== 'daily') return { streak: quest.streak, freezeUsed: false };
  if (quest.completedDates.includes(yesterday)) return { streak: quest.streak + 1, freezeUsed: false };
  if (quest.completedDates.includes(today)) return { streak: quest.streak, freezeUsed: false };
  if (quest.streak <= 0) return { streak: 1, freezeUsed: false };
  if (freeze.stock > 0) return { streak: quest.streak + 1, freezeUsed: true };
  return { streak: Math.max(1, Math.floor(quest.streak * STREAK_DECAY)), freezeUsed: false };
}
