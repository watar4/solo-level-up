import type { Character, Quest } from '../types';
import { buildAchievementContext, type AchievementContext } from './achievements';

// =====================================================================
// Skill engine
// ---------------------------------------------------------------------
// Skills are passive abilities the Hunter "awakens" as they grow. Same
// shape as achievements but conceptually different (flavour text, not
// reward stat-points). User will provide the canonical list later — the
// entries below are placeholders that demonstrate the system.
// =====================================================================

export interface SkillDef {
  id: string;
  name: string;
  description: string;     // what the skill does (flavour — not enforced)
  unlockText: string;      // requirement description shown when locked
  icon: string;
  category: 'attack' | 'defense' | 'support' | 'mind' | 'special';
  check: (ctx: AchievementContext) => boolean;
}

export const SKILLS: SkillDef[] = [
  {
    id: 'weapon-mastery',
    name: '武器の支配',
    description: '近接攻撃のクリティカル率上昇',
    unlockText: 'STR を 30 まで鍛える',
    icon: '⚔️',
    category: 'attack',
    check: (c) => c.character.stats.STR >= 30,
  },
  {
    id: 'iron-body',
    name: '鋼の肉体',
    description: '被ダメージ軽減',
    unlockText: 'VIT を 40 まで鍛える',
    icon: '🛡️',
    category: 'defense',
    check: (c) => c.character.stats.VIT >= 40,
  },
  {
    id: 'mind-eye',
    name: '心眼',
    description: '相手の弱点を見抜く',
    unlockText: 'PER を 40 まで鍛える',
    icon: '👁️',
    category: 'mind',
    check: (c) => c.character.stats.PER >= 40,
  },
  {
    id: 'healing-touch',
    name: '癒しの一撫',
    description: '休息時の HP 回復量増加',
    unlockText: 'INT を 30 まで鍛え、累計 20 回達成する',
    icon: '✨',
    category: 'support',
    check: (c) => c.character.stats.INT >= 30 && c.totalCompletions >= 20,
  },
  {
    id: 'shadow-summon',
    name: '影の召喚',
    description: '倒した相手を影として呼び出せる',
    unlockText: '累計 50 回クエスト達成',
    icon: '👤',
    category: 'special',
    check: (c) => c.totalCompletions >= 50,
  },
  {
    id: 'critical-strike',
    name: '一撃必殺',
    description: 'A 級以上の難敵を一撃で討つ',
    unlockText: 'A 以上のクエストを 5 回以上達成',
    icon: '💥',
    category: 'attack',
    check: (c) => (c.completionsByDifficulty.A ?? 0) + (c.completionsByDifficulty.S ?? 0) >= 5,
  },
  {
    id: 'shadow-army',
    name: '影の軍勢',
    description: '複数の影を同時に従える',
    unlockText: 'Lv 30 + 累計 100 達成',
    icon: '👥',
    category: 'special',
    check: (c) => c.character.level >= 30 && c.totalCompletions >= 100,
  },
  {
    id: 'monarch',
    name: '王の威光',
    description: '周囲の格下を畏怖させる',
    unlockText: 'S ランク (Lv 50) に到達',
    icon: '👑',
    category: 'special',
    check: (c) => c.character.level >= 50,
  },
];

export function newlyUnlockedSkills(character: Character, quests: Quest[]): SkillDef[] {
  const ctx = buildAchievementContext(character, quests);
  const already = new Set(character.unlocked?.skills ?? []);
  return SKILLS.filter((s) => !already.has(s.id) && s.check(ctx));
}
