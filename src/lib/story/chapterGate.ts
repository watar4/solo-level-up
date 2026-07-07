// Chapter-unlock evaluation — docs/redesign/02-story.md §6, 07 §4.
// All inputs are derived from persisted data (quest completedDates, streaks,
// achievements, feature-usage counters) rather than a cached "unlocked" flag,
// so progress is tamper-resistant and always self-consistent.

import type { ChapterDef, GateCond } from './chapters';

// Everything a gate can test. The caller assembles this once from game state.
export interface ProgressSnapshot {
  level: number;
  totalQuestsCompleted: number; // sum of all quests' completedDates lengths
  bestStreak: number;           // best current daily streak across quests
  weeklyQuestsCompleted: number;// lifetime weekly-quest completions
  focusGateDays: number;        // days the focus gate was cleared
  mealLogDays: number;          // distinct days with a meal logged
  savingsWeeks: number;         // distinct ISO weeks with a savings entry
  weightLogDays: number;        // distinct days with a weight entry
  achievementsUnlocked: number;
  medalsOwned: number;
}

export function condLabel(cond: GateCond): string {
  switch (cond.kind) {
    case 'totalQuests': return `クエスト累計 ${cond.count} 回`;
    case 'streak': return `ストリーク ${cond.days} 日`;
    case 'weeklyQuests': return `週次クエスト ${cond.count} 回`;
    case 'focusGate': return `フォーカスゲート ${cond.count} 回`;
    case 'mealDays': return `食事記録 ${cond.days} 日`;
    case 'savingsWeeks': return `貯金記録 ${cond.weeks} 週`;
    case 'weightDays': return `体重記録 ${cond.days} 日`;
    case 'achievements': return `実績 ${cond.count} 個`;
    case 'medals': return `メダル ${cond.count} 枚`;
  }
}

// Current progress value / required value for a single condition.
function condProgress(cond: GateCond, s: ProgressSnapshot): { have: number; need: number } {
  switch (cond.kind) {
    case 'totalQuests': return { have: s.totalQuestsCompleted, need: cond.count };
    case 'streak': return { have: s.bestStreak, need: cond.days };
    case 'weeklyQuests': return { have: s.weeklyQuestsCompleted, need: cond.count };
    case 'focusGate': return { have: s.focusGateDays, need: cond.count };
    case 'mealDays': return { have: s.mealLogDays, need: cond.days };
    case 'savingsWeeks': return { have: s.savingsWeeks, need: cond.weeks };
    case 'weightDays': return { have: s.weightLogDays, need: cond.days };
    case 'achievements': return { have: s.achievementsUnlocked, need: cond.count };
    case 'medals': return { have: s.medalsOwned, need: cond.count };
  }
}

function condMet(cond: GateCond, s: ProgressSnapshot): boolean {
  const { have, need } = condProgress(cond, s);
  return have >= need;
}

export interface GateEvaluation {
  unlocked: boolean;
  levelMet: boolean;
  continuityMet: boolean;
  // For the locked-chapter tooltip: the closest condition to completion and
  // how far off it is (docs 04 §2 "あと:ストリーク3日").
  remaining: { label: string; have: number; need: number } | null;
}

export function evaluateGate(chapter: ChapterDef, s: ProgressSnapshot): GateEvaluation {
  const levelMet = s.level >= chapter.gate.level;

  if (chapter.gate.either === null) {
    return { unlocked: levelMet, levelMet, continuityMet: true, remaining: null };
  }

  const [a, b] = chapter.gate.either;
  const aMet = condMet(a, s);
  const bMet = condMet(b, s);
  const continuityMet = aMet || bMet;

  // Surface the condition the player is closest to satisfying (highest ratio).
  let remaining: GateEvaluation['remaining'] = null;
  if (!continuityMet) {
    const options = [a, b].map((c) => ({ cond: c, ...condProgress(c, s) }));
    const closest = options.sort((x, y) => y.have / y.need - x.have / x.need)[0];
    remaining = { label: condLabel(closest.cond), have: closest.have, need: closest.need };
  }

  return {
    unlocked: levelMet && continuityMet,
    levelMet,
    continuityMet,
    remaining,
  };
}

// Highest chapter id the player may currently enter, given prior chapters are
// cleared. Chapters must be unlocked in order (a later chapter's gate is only
// checked once every earlier chapter is cleared).
export function highestUnlockedChapter(
  chapters: ChapterDef[],
  clearedChapterIds: number[],
  s: ProgressSnapshot
): number {
  const cleared = new Set(clearedChapterIds);
  const ordered = [...chapters].sort((a, b) => a.id - b.id);
  let highest = 0;
  for (const ch of ordered) {
    if (cleared.has(ch.id)) {
      highest = ch.id;
      continue;
    }
    if (evaluateGate(ch, s).unlocked) {
      highest = ch.id;
    }
    break; // stop at the first not-yet-cleared chapter
  }
  return highest;
}
