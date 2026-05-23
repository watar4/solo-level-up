import type {
  Difficulty,
  Shadow,
  ShadowRarity,
  StatKey,
} from '../types';
import { ALL_STATS } from '../types';

// Each rarity gives a flat bonus to the shadow's primary stat. Higher tiers
// also splash into secondary stats so a legendary shadow is meaningfully
// stronger than just "+N to one number".
const RARITY_BONUS: Record<
  ShadowRarity,
  { primary: number; splash: number }
> = {
  normal: { primary: 1, splash: 0 },
  rare: { primary: 2, splash: 1 },
  epic: { primary: 4, splash: 1 },
  legendary: { primary: 7, splash: 2 },
};

export const RARITY_LABEL: Record<ShadowRarity, string> = {
  normal: '下級',
  rare: '中級',
  epic: '上級',
  legendary: '君主級',
};

export const RARITY_COLOR: Record<ShadowRarity, string> = {
  normal: 'text-sys-muted border-sys-muted/40',
  rare: 'text-cyan-300 border-cyan-400/50',
  epic: 'text-purple-300 border-purple-400/60',
  legendary: 'text-amber-300 border-amber-400/70 drop-shadow-[0_0_4px_rgba(252,211,77,0.5)]',
};

// Sequenced bonus stats by primary stat for the "splash" — adjacent-ish
// affinity so a STR shadow also pumps VIT and AGI at higher rarities, etc.
const SPLASH_ORDER: Record<StatKey, StatKey[]> = {
  STR: ['VIT', 'AGI', 'PER', 'INT'],
  AGI: ['STR', 'PER', 'INT', 'VIT'],
  INT: ['PER', 'AGI', 'VIT', 'STR'],
  VIT: ['STR', 'PER', 'INT', 'AGI'],
  PER: ['AGI', 'INT', 'VIT', 'STR'],
};

export interface ShadowTemplate {
  id: string;
  name: string;
  stat: StatKey;
  rarity: ShadowRarity;
  flavor?: string;
}

// 5 stats × 4 rarities = 20 base templates. Flavor names lean Solo-Leveling-ish
// without lifting any direct trademarked terms outside the loose homage.
export const SHADOW_TEMPLATES: ShadowTemplate[] = [
  // STR
  { id: 'str-n', name: '下級・影の戦士', stat: 'STR', rarity: 'normal' },
  { id: 'str-r', name: '中級・影の剣士', stat: 'STR', rarity: 'rare' },
  { id: 'str-e', name: '上級・影の鬼神', stat: 'STR', rarity: 'epic' },
  { id: 'str-l', name: '君主級・影の覇王', stat: 'STR', rarity: 'legendary' },
  // AGI
  { id: 'agi-n', name: '下級・影の追跡者', stat: 'AGI', rarity: 'normal' },
  { id: 'agi-r', name: '中級・影の暗殺者', stat: 'AGI', rarity: 'rare' },
  { id: 'agi-e', name: '上級・影の風狼', stat: 'AGI', rarity: 'epic' },
  { id: 'agi-l', name: '君主級・影の疾風王', stat: 'AGI', rarity: 'legendary' },
  // INT
  { id: 'int-n', name: '下級・影の術士', stat: 'INT', rarity: 'normal' },
  { id: 'int-r', name: '中級・影の魔導士', stat: 'INT', rarity: 'rare' },
  { id: 'int-e', name: '上級・影の賢者', stat: 'INT', rarity: 'epic' },
  { id: 'int-l', name: '君主級・影の大魔導', stat: 'INT', rarity: 'legendary' },
  // VIT
  { id: 'vit-n', name: '下級・影の鉄壁', stat: 'VIT', rarity: 'normal' },
  { id: 'vit-r', name: '中級・影の重騎兵', stat: 'VIT', rarity: 'rare' },
  { id: 'vit-e', name: '上級・影の守護神', stat: 'VIT', rarity: 'epic' },
  { id: 'vit-l', name: '君主級・影の不滅', stat: 'VIT', rarity: 'legendary' },
  // PER
  { id: 'per-n', name: '下級・影の斥候', stat: 'PER', rarity: 'normal' },
  { id: 'per-r', name: '中級・影の鷹眼', stat: 'PER', rarity: 'rare' },
  { id: 'per-e', name: '上級・影の探者', stat: 'PER', rarity: 'epic' },
  { id: 'per-l', name: '君主級・影の千里眼', stat: 'PER', rarity: 'legendary' },
];

const TEMPLATE_BY_ID = new Map(SHADOW_TEMPLATES.map((t) => [t.id, t] as const));

export function templateForShadow(s: Shadow): ShadowTemplate | undefined {
  return TEMPLATE_BY_ID.get(s.templateId);
}

// Drop probability matrix: P(rarity | quest difficulty). Anything above the
// summed probability rolls "no drop". Tuned so:
//   - Easy quests rarely drop; S-rank quests almost always do something.
//   - Legendaries are *very* rare — meaningful when they appear.
const DROP_TABLE: Record<Difficulty, Record<ShadowRarity, number>> = {
  E: { normal: 0.08, rare: 0.0, epic: 0.0, legendary: 0.0 },
  D: { normal: 0.14, rare: 0.03, epic: 0.0, legendary: 0.0 },
  C: { normal: 0.18, rare: 0.07, epic: 0.01, legendary: 0.0 },
  B: { normal: 0.20, rare: 0.12, epic: 0.03, legendary: 0.0 },
  A: { normal: 0.22, rare: 0.18, epic: 0.07, legendary: 0.01 },
  S: { normal: 0.25, rare: 0.25, epic: 0.15, legendary: 0.04 },
};

// Roll for a shadow drop. Returns null if no drop happens. The returned
// template's stat matches the quest's targetStat so completing a "strength"
// quest produces a strength-aligned shadow — gives the player narrative
// control over what they're building toward.
export function rollShadowDrop(
  difficulty: Difficulty,
  targetStat: StatKey,
  rng: () => number = Math.random
): ShadowTemplate | null {
  const probs = DROP_TABLE[difficulty];
  const r = rng();
  let acc = 0;
  // Iterate from rarest to commonest so a single random value cleanly
  // partitions the probability space.
  const order: ShadowRarity[] = ['legendary', 'epic', 'rare', 'normal'];
  for (const rarity of order) {
    acc += probs[rarity];
    if (r < acc) {
      const template = SHADOW_TEMPLATES.find(
        (t) => t.stat === targetStat && t.rarity === rarity
      );
      return template ?? null;
    }
  }
  return null;
}

// Boss reward roll — biased toward rarer drops as a baseline since every win
// should feel rewarding.
export function rollBossReward(
  rng: () => number = Math.random
): { stat: StatKey; rarity: ShadowRarity } {
  const r = rng();
  let rarity: ShadowRarity = 'normal';
  if (r < 0.05) rarity = 'legendary';
  else if (r < 0.25) rarity = 'epic';
  else if (r < 0.65) rarity = 'rare';
  // Random stat — boss drops are not stat-aligned (you get what you get).
  const stat = ALL_STATS[Math.floor(rng() * ALL_STATS.length)];
  return { stat, rarity };
}

// Sum of equipped shadow bonuses per stat. Driven off both template stat
// (primary) and SPLASH_ORDER (secondary tail) so a legendary shadow lights
// up two stats noticeably.
export function totalShadowBonus(
  shadows: Shadow[]
): Record<StatKey, number> {
  const bonus: Record<StatKey, number> = { STR: 0, AGI: 0, INT: 0, VIT: 0, PER: 0 };
  for (const s of shadows) {
    if (!s.equipped) continue;
    const { primary, splash } = RARITY_BONUS[s.rarity];
    bonus[s.stat] += primary;
    if (splash > 0) {
      const splashStats = SPLASH_ORDER[s.stat];
      // Higher rarity → splashes into more secondary stats (1 for rare/epic,
      // 2 for legendary based on the bonus.splash value).
      for (let i = 0; i < splash; i++) {
        const target = splashStats[i];
        if (target) bonus[target] += 1;
      }
    }
  }
  return bonus;
}

// How many shadows the user can equip at once. Centralised here so the limit
// is consistent across UI gates and persistence checks.
export const SHADOW_EQUIP_LIMIT = 5;
