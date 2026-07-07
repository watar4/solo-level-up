import { describe, it, expect } from 'vitest';
import { evaluateGate, highestUnlockedChapter, type ProgressSnapshot } from '../chapterGate';
import { CHAPTERS, CHAPTER_BY_ID } from '../chapters';

const zero: ProgressSnapshot = {
  level: 1,
  totalQuestsCompleted: 0,
  bestStreak: 0,
  weeklyQuestsCompleted: 0,
  focusGateDays: 0,
  mealLogDays: 0,
  savingsWeeks: 0,
  weightLogDays: 0,
  achievementsUnlocked: 0,
  medalsOwned: 0,
};

describe('chapter gates', () => {
  it('chapter 1 is always open (tutorial)', () => {
    expect(evaluateGate(CHAPTER_BY_ID[1], zero).unlocked).toBe(true);
  });

  it('requires both level AND a continuity condition', () => {
    const ch2 = CHAPTER_BY_ID[2]; // Lv5 AND (15 quests OR streak 3)
    expect(evaluateGate(ch2, { ...zero, level: 5 }).unlocked).toBe(false); // no continuity
    expect(evaluateGate(ch2, { ...zero, level: 4, totalQuestsCompleted: 15 }).unlocked).toBe(false); // no level
    expect(evaluateGate(ch2, { ...zero, level: 5, totalQuestsCompleted: 15 }).unlocked).toBe(true);
    expect(evaluateGate(ch2, { ...zero, level: 5, bestStreak: 3 }).unlocked).toBe(true); // either branch
  });

  it('reports the closest remaining condition when locked', () => {
    const ch2 = CHAPTER_BY_ID[2];
    const ev=  evaluateGate(ch2, { ...zero, level: 5, totalQuestsCompleted: 12, bestStreak: 0 });
    expect(ev.unlocked).toBe(false);
    // 12/15 (0.8) is closer than 0/3 streak
    expect(ev.remaining?.have).toBe(12);
    expect(ev.remaining?.need).toBe(15);
  });

  it('highestUnlockedChapter stops at the first uncleared, ungated chapter', () => {
    // Cleared ch1; strong enough for ch2 but not ch3.
    const s: ProgressSnapshot = { ...zero, level: 6, totalQuestsCompleted: 20, bestStreak: 3 };
    expect(highestUnlockedChapter(CHAPTERS, [1], s)).toBe(2);
  });

  it('does not skip ahead even if a far chapter would otherwise qualify', () => {
    // Meets ch2's gate but ch2 not cleared → cannot reach ch3 regardless.
    const s: ProgressSnapshot = { ...zero, level: 40, totalQuestsCompleted: 999, bestStreak: 99, achievementsUnlocked: 99 };
    expect(highestUnlockedChapter(CHAPTERS, [1], s)).toBe(2);
  });

  it('advances as chapters are cleared', () => {
    const s: ProgressSnapshot = { ...zero, level: 40, totalQuestsCompleted: 999, bestStreak: 99, achievementsUnlocked: 99 };
    expect(highestUnlockedChapter(CHAPTERS, [1, 2, 3, 4], s)).toBe(5);
  });
});
