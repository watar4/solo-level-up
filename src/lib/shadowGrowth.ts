import type { Shadow } from '../types';
import { SHADOW_COMBAT } from './shadows';

// ── Shadow growth (Pokémon-style) ──────────────────────────────────────
//
// Equipped shadows earn EXP from boss victories, level up, and evolve at
// fixed level gates. Levels/EXP are optional on the doc (legacy shadows
// read as Lv1) so no migration is needed.

export const SHADOW_MAX_LEVEL = 30;

export function shadowLevel(s: Pick<Shadow, 'level'>): number {
  return Math.min(SHADOW_MAX_LEVEL, Math.max(1, s.level ?? 1));
}

export function shadowExp(s: Pick<Shadow, 'exp'>): number {
  return Math.max(0, s.exp ?? 0);
}

// EXP needed to advance FROM level L to L+1. Linear-ish so a casual pace
// (1 boss/day) still evolves a shadow in about a week.
export function shadowExpForLevel(level: number): number {
  return 20 + level * 10;
}

// EXP each equipped shadow earns per boss victory.
export function shadowExpForBossWin(floor: number): number {
  return 12 + Math.max(0, floor - 1) * 3;
}

export interface ShadowGrowthResult {
  level: number;
  exp: number;
  levelsGained: number;
  evolved: boolean;       // crossed an evolution gate this gain
  newStageName?: string;  // set when evolved
}

// ── Evolution gates ────────────────────────────────────────────────────
// Stage 0 = base, stage 1 (Lv10) = 覚醒, stage 2 (Lv20) = 真・覚醒.
// The stage prefixes the display name: 「覚醒・下級・影の戦士」.
const EVOLUTION_LEVELS = [10, 20];
const STAGE_PREFIX = ['', '覚醒・', '真・'];

export function evolutionStage(level: number): number {
  let stage = 0;
  for (const gate of EVOLUTION_LEVELS) {
    if (level >= gate) stage++;
  }
  return stage;
}

export function stageDisplayName(baseName: string, level: number): string {
  return `${STAGE_PREFIX[evolutionStage(level)]}${baseName}`;
}

export function nextEvolutionLevel(level: number): number | null {
  for (const gate of EVOLUTION_LEVELS) {
    if (level < gate) return gate;
  }
  return null;
}

export function applyShadowExp(shadow: Shadow, gain: number): ShadowGrowthResult {
  let level = shadowLevel(shadow);
  let exp = shadowExp(shadow) + gain;
  let levelsGained = 0;
  const stageBefore = evolutionStage(level);

  while (level < SHADOW_MAX_LEVEL && exp >= shadowExpForLevel(level)) {
    exp -= shadowExpForLevel(level);
    level += 1;
    levelsGained += 1;
  }
  if (level >= SHADOW_MAX_LEVEL) {
    exp = 0; // cap: park the bar empty instead of overflowing
  }

  const evolved = evolutionStage(level) > stageBefore;
  return {
    level,
    exp,
    levelsGained,
    evolved,
    newStageName: evolved ? stageDisplayName(shadow.name, level) : undefined,
  };
}

// ── Combat scaling ─────────────────────────────────────────────────────
// Levels raise both ATB speed and attack; each evolution stage multiplies
// attack again so evolving feels like a real power spike.
const ATTACK_PER_LEVEL = 0.06;   // +6%/Lv
const SPEED_PER_LEVEL = 0.15;    // flat ATB speed per level
const STAGE_ATTACK_MULT = 1.25;  // ×1.25 per evolution stage

export function shadowCombatPower(s: Shadow): { atbSpeed: number; attack: number } {
  const base = SHADOW_COMBAT[s.rarity];
  const level = shadowLevel(s);
  const stage = evolutionStage(level);
  return {
    atbSpeed: base.atbSpeed + (level - 1) * SPEED_PER_LEVEL,
    attack: Math.round(
      base.attack * (1 + (level - 1) * ATTACK_PER_LEVEL) * Math.pow(STAGE_ATTACK_MULT, stage)
    ),
  };
}
