import type { Character, Difficulty, Quest, StatKey } from '../types';
import { effectiveStreak } from './leveling';

// =====================================================================
// Achievement engine
// ---------------------------------------------------------------------
// Achievements are pure-function predicates over the player's snapshot.
// Add or remove entries in `ACHIEVEMENTS` below — `evaluateAchievements`
// will retroactively grant any that newly match, so editing the list at
// any point is safe.
// =====================================================================

export interface AchievementContext {
  character: Character;
  quests: Quest[];
  totalCompletions: number;
  longestEffectiveStreak: number;
  completionsByDifficulty: Record<Difficulty, number>;
  hour: number; // hour of day right now, 0-23
}

export interface AchievementDef {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: 'streak' | 'level' | 'quest' | 'stat' | 'special';
  check: (ctx: AchievementContext) => boolean;
  reward?: { statPoints?: number; title?: string };
}

export const ACHIEVEMENTS: AchievementDef[] = [
  // --- Quest count ---
  { id: 'first-quest',    name: '初日',           description: '初めてクエストを達成した',         icon: '🌅', category: 'quest', check: (c) => c.totalCompletions >= 1 },
  { id: 'ten-quests',     name: '駆け出し',       description: '累計 10 回クエストを達成',          icon: '⚔️', category: 'quest', check: (c) => c.totalCompletions >= 10,   reward: { statPoints: 2 } },
  { id: 'fifty-quests',   name: '熟練ハンター',   description: '累計 50 回クエストを達成',          icon: '🗡️', category: 'quest', check: (c) => c.totalCompletions >= 50,   reward: { statPoints: 5 } },
  { id: 'hundred-quests', name: 'ベテラン',       description: '累計 100 回クエストを達成',         icon: '🏆', category: 'quest', check: (c) => c.totalCompletions >= 100,  reward: { statPoints: 10 } },
  { id: 'thousand-quests',name: '千の試練',       description: '累計 1000 回クエストを達成',        icon: '👑', category: 'quest', check: (c) => c.totalCompletions >= 1000, reward: { statPoints: 50, title: '千の試練の踏破者' } },

  // --- Streak ---
  { id: 'streak-3',   name: '三日坊主突破',     description: '3 日連続でクエストを達成',   icon: '🔥', category: 'streak', check: (c) => c.longestEffectiveStreak >= 3,   reward: { statPoints: 2 } },
  { id: 'streak-7',   name: '一週間継続',       description: '7 日連続でクエストを達成',   icon: '🌟', category: 'streak', check: (c) => c.longestEffectiveStreak >= 7,   reward: { statPoints: 5 } },
  { id: 'streak-30',  name: '月の門番',         description: '30 日連続でクエストを達成',  icon: '🌙', category: 'streak', check: (c) => c.longestEffectiveStreak >= 30,  reward: { statPoints: 15 } },
  { id: 'streak-100', name: '不屈の探索者',     description: '100 日連続でクエストを達成', icon: '💎', category: 'streak', check: (c) => c.longestEffectiveStreak >= 100, reward: { statPoints: 50, title: '不屈の探索者' } },

  // --- Level / Rank ---
  { id: 'level-10', name: 'D ランク覚醒',     description: 'レベル 10 に到達', icon: '🛡️', category: 'level', check: (c) => c.character.level >= 10, reward: { statPoints: 3 } },
  { id: 'level-20', name: 'C ランク到達',     description: 'レベル 20 に到達', icon: '⚜️', category: 'level', check: (c) => c.character.level >= 20, reward: { statPoints: 5 } },
  { id: 'level-30', name: 'B ランク覚醒',     description: 'レベル 30 に到達', icon: '🔮', category: 'level', check: (c) => c.character.level >= 30, reward: { statPoints: 8 } },
  { id: 'level-40', name: 'A ランク到達',     description: 'レベル 40 に到達', icon: '⚡', category: 'level', check: (c) => c.character.level >= 40, reward: { statPoints: 12 } },
  { id: 'level-50', name: 'S ランク覚醒',     description: 'レベル 50 に到達', icon: '👁️', category: 'level', check: (c) => c.character.level >= 50, reward: { statPoints: 20, title: 'S 級ハンター' } },
  { id: 'level-60', name: '国家級ハンター',   description: 'レベル 60 に到達', icon: '☠️', category: 'level', check: (c) => c.character.level >= 60, reward: { statPoints: 30, title: '影の君主' } },

  // --- Difficulty ---
  { id: 'first-s-rank', name: '初の S 級討伐',   description: 'S 難易度クエストを初めて達成',     icon: '💥', category: 'quest', check: (c) => (c.completionsByDifficulty.S ?? 0) >= 1, reward: { statPoints: 5 } },
  { id: 'ten-a-plus',   name: '高難度の常連',     description: 'A 以上のクエストを通算 10 回達成', icon: '🗡️', category: 'quest', check: (c) => (c.completionsByDifficulty.A ?? 0) + (c.completionsByDifficulty.S ?? 0) >= 10, reward: { statPoints: 8 } },

  // --- Stats ---
  { id: 'str-50',    name: '鍛えられた肉体',   description: 'STR が 50 に到達', icon: '💪', category: 'stat', check: (c) => c.character.stats.STR >= 50 },
  { id: 'agi-50',    name: '影の如き敏捷',     description: 'AGI が 50 に到達', icon: '🌪️', category: 'stat', check: (c) => c.character.stats.AGI >= 50 },
  { id: 'int-50',    name: '賢者の知性',       description: 'INT が 50 に到達', icon: '📜', category: 'stat', check: (c) => c.character.stats.INT >= 50 },
  { id: 'vit-50',    name: '鋼の肉体',         description: 'VIT が 50 に到達', icon: '🛡️', category: 'stat', check: (c) => c.character.stats.VIT >= 50 },
  { id: 'per-50',    name: '千里眼',           description: 'PER が 50 に到達', icon: '👁️', category: 'stat', check: (c) => c.character.stats.PER >= 50 },
  { id: 'balanced',  name: '全方位の修練',     description: '全ステータスが 30 以上',
    icon: '⚖️', category: 'stat',
    check: (c) => (Object.values(c.character.stats) as number[]).every((v) => v >= 30),
    reward: { statPoints: 10 } },

  // --- Special (time-of-day) ---
  { id: 'early-bird', name: '朝の蹂躙者',       description: '朝 6 時前にクエストを達成', icon: '🌄', category: 'special', check: (c) => c.totalCompletions >= 1 && c.hour < 6 },
  { id: 'night-owl',  name: '深夜の探究者',     description: '深夜 0〜4 時の間にクエストを達成', icon: '🦉', category: 'special', check: (c) => c.totalCompletions >= 1 && c.hour < 4 },
];

// Build the engine input from the player's current state. Pure — no I/O.
export function buildAchievementContext(character: Character, quests: Quest[]): AchievementContext {
  const completionsByDifficulty: Record<Difficulty, number> = { E: 0, D: 0, C: 0, B: 0, A: 0, S: 0 };
  let totalCompletions = 0;
  let longestEffectiveStreak = 0;
  for (const q of quests) {
    const n = q.completedDates.length;
    totalCompletions += n;
    completionsByDifficulty[q.difficulty] = (completionsByDifficulty[q.difficulty] ?? 0) + n;
    if (q.type === 'daily') {
      longestEffectiveStreak = Math.max(longestEffectiveStreak, effectiveStreak(q.completedDates, q.type));
    }
  }
  return {
    character,
    quests,
    totalCompletions,
    longestEffectiveStreak,
    completionsByDifficulty,
    hour: new Date().getHours(),
  };
}

// Returns the achievement IDs that should now be unlocked but aren't yet.
export function newlyUnlockedAchievements(ctx: AchievementContext): AchievementDef[] {
  const already = new Set(ctx.character.unlocked?.achievements ?? []);
  return ACHIEVEMENTS.filter((a) => !already.has(a.id) && a.check(ctx));
}

// Apply rewards from a list of achievements to a character (statPoints, title).
export function applyAchievementRewards(
  character: Character,
  achievements: AchievementDef[]
): { statPointsAdded: number; titleAdded?: string } {
  let pts = 0;
  let title: string | undefined;
  for (const a of achievements) {
    if (a.reward?.statPoints) pts += a.reward.statPoints;
    if (a.reward?.title) title = a.reward.title;
  }
  return { statPointsAdded: pts, titleAdded: title ?? character.title };
}

export const STAT_LABELS_FOR_ACHIEVE: Record<StatKey, string> = {
  STR: '筋力',
  AGI: '敏捷',
  INT: '知力',
  VIT: '体力',
  PER: '感知',
};
