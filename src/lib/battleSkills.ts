import type { Character, StatKey } from '../types';

export type BattleSkillEffect =
  | {
      kind: 'attack';
      stat: StatKey;
      damageMultiplier: number;
      // Optional per-skill crit override. `guaranteedCrit` forces a crit
      // regardless of INT-based chance; `critBonusFlat` adds to the rolled
      // chance (cap still 100%).
      guaranteedCrit?: boolean;
      critBonusFlat?: number;
    }
  | {
      kind: 'heal';
      // Percentage of player's max HP to restore, 0..1
      healPct: number;
    };

export interface BattleSkillUnlock {
  level?: number;
  statThreshold?: { stat: StatKey; value: number };
}

export interface BattleSkill {
  id: string;
  name: string;            // Japanese display name
  label: string;           // short uppercase tag for the action button
  description: string;
  effect: BattleSkillEffect;
  unlock: BattleSkillUnlock;
  // Base skill = auto-equipped on a fresh character (5 of these) so the
  // existing UX (one action per stat) still works on day one.
  isBaseSkill?: boolean;
  // Turns the skill is unavailable after use. 0 = always usable. Tuned so
  // stronger/wide-effect skills can't be spammed every turn.
  cooldown: number;
}

export const BATTLE_SKILLS: BattleSkill[] = [
  // Base set — always unlocked, default-equipped. CD 1 keeps the user from
  // mashing the same button forever; they must rotate at least two skills.
  {
    id: 'basic-strike',
    name: '斬撃',
    label: 'STRIKE',
    description: '渾身の一撃。基礎攻撃 (STR)',
    effect: { kind: 'attack', stat: 'STR', damageMultiplier: 1.0 },
    unlock: {},
    isBaseSkill: true,
    cooldown: 1,
  },
  {
    id: 'quick-shot',
    name: '早撃ち',
    label: 'SPRINT',
    description: '隙を突く素早い一撃 (AGI)',
    effect: { kind: 'attack', stat: 'AGI', damageMultiplier: 1.0 },
    unlock: {},
    isBaseSkill: true,
    cooldown: 1,
  },
  {
    id: 'mind-bolt',
    name: '魔力弾',
    label: 'ARCANE',
    description: '魔力を込めて放つ (INT)',
    effect: { kind: 'attack', stat: 'INT', damageMultiplier: 1.0 },
    unlock: {},
    isBaseSkill: true,
    cooldown: 1,
  },
  {
    id: 'guard-strike',
    name: '盾撃',
    label: 'GUARD',
    description: '盾で押し込む一撃 (VIT)',
    effect: { kind: 'attack', stat: 'VIT', damageMultiplier: 1.0 },
    unlock: {},
    isBaseSkill: true,
    cooldown: 1,
  },
  {
    id: 'pinpoint',
    name: '弱点突き',
    label: 'INSIGHT',
    description: '見極めた一点を貫く (PER)',
    effect: { kind: 'attack', stat: 'PER', damageMultiplier: 1.0 },
    unlock: {},
    isBaseSkill: true,
    cooldown: 1,
  },

  // Level-gated skills
  {
    id: 'power-smash',
    name: '強打',
    label: 'SMASH',
    description: 'Lv 5: STR攻撃 ×1.4 / CD 2',
    effect: { kind: 'attack', stat: 'STR', damageMultiplier: 1.4 },
    unlock: { level: 5 },
    cooldown: 2,
  },
  {
    id: 'flame-burst',
    name: '烈火',
    label: 'BLAZE',
    description: 'Lv 10: INT攻撃 ×1.5 / CD 2',
    effect: { kind: 'attack', stat: 'INT', damageMultiplier: 1.5 },
    unlock: { level: 10 },
    cooldown: 2,
  },
  {
    id: 'restore',
    name: '治癒',
    label: 'HEAL',
    description: 'Lv 15: 最大HPの25%回復 / CD 3',
    effect: { kind: 'heal', healPct: 0.25 },
    unlock: { level: 15 },
    cooldown: 3,
  },
  {
    id: 'finishing-blow',
    name: '必殺一閃',
    label: 'FINISH',
    description: 'Lv 20: STR×1.8 + クリ率+10% / CD 3',
    effect: {
      kind: 'attack',
      stat: 'STR',
      damageMultiplier: 1.8,
      critBonusFlat: 0.1,
    },
    unlock: { level: 20 },
    cooldown: 3,
  },
  {
    id: 'hawk-eye',
    name: '鷹眼',
    label: 'HAWK',
    description: 'Lv 25: PER×1.5 + クリ率+20% / CD 3',
    effect: {
      kind: 'attack',
      stat: 'PER',
      damageMultiplier: 1.5,
      critBonusFlat: 0.2,
    },
    unlock: { level: 25 },
    cooldown: 3,
  },

  // Stat-threshold-gated skills
  {
    id: 'mountain-cleave',
    name: '山砕き',
    label: 'CLEAVE',
    description: 'STR ≥ 25: STR攻撃 ×2.0 / CD 4',
    effect: { kind: 'attack', stat: 'STR', damageMultiplier: 2.0 },
    unlock: { statThreshold: { stat: 'STR', value: 25 } },
    cooldown: 4,
  },
  {
    id: 'flash-step',
    name: '神速連撃',
    label: 'FLASH',
    description: 'AGI ≥ 25: AGI攻撃 ×1.9 / CD 3',
    effect: { kind: 'attack', stat: 'AGI', damageMultiplier: 1.9 },
    unlock: { statThreshold: { stat: 'AGI', value: 25 } },
    cooldown: 3,
  },
  {
    id: 'inferno',
    name: '業炎',
    label: 'INFERNO',
    description: 'INT ≥ 25: INT攻撃 ×2.0 / CD 4',
    effect: { kind: 'attack', stat: 'INT', damageMultiplier: 2.0 },
    unlock: { statThreshold: { stat: 'INT', value: 25 } },
    cooldown: 4,
  },
  {
    id: 'full-heal',
    name: '完全治癒',
    label: 'MEND',
    description: 'VIT ≥ 25: 最大HPの50%回復 / CD 4',
    effect: { kind: 'heal', healPct: 0.5 },
    unlock: { statThreshold: { stat: 'VIT', value: 25 } },
    cooldown: 4,
  },
  {
    id: 'see-through',
    name: '看破',
    label: 'PIERCE',
    description: 'PER ≥ 25: PER×1.7 + 必中クリ / CD 4',
    effect: {
      kind: 'attack',
      stat: 'PER',
      damageMultiplier: 1.7,
      guaranteedCrit: true,
    },
    unlock: { statThreshold: { stat: 'PER', value: 25 } },
    cooldown: 4,
  },
];

const SKILL_BY_ID = new Map(BATTLE_SKILLS.map((s) => [s.id, s] as const));

export function getSkill(id: string): BattleSkill | undefined {
  return SKILL_BY_ID.get(id);
}

// Default loadout for a character that has never opened the skills panel.
// Mirrors the original 5-action layout so existing accounts behave the same
// the first time they walk into the boss room.
export function defaultEquippedSkills(): string[] {
  return BATTLE_SKILLS.filter((s) => s.isBaseSkill).map((s) => s.id);
}

export function effectiveEquippedSkills(character: Character | null): string[] {
  if (!character) return defaultEquippedSkills();
  const ids = character.equippedSkills;
  if (ids && ids.length > 0) return ids.slice(0, 5);
  return defaultEquippedSkills();
}

// Returns true when the character currently meets the skill's unlock req.
export function isSkillUnlocked(skill: BattleSkill, character: Character): boolean {
  const { unlock } = skill;
  if (unlock.level !== undefined && character.level < unlock.level) return false;
  if (unlock.statThreshold) {
    const v = character.stats[unlock.statThreshold.stat] ?? 0;
    if (v < unlock.statThreshold.value) return false;
  }
  return true;
}

export function unlockedSkillIds(character: Character): string[] {
  return BATTLE_SKILLS.filter((s) => isSkillUnlocked(s, character)).map((s) => s.id);
}

// Helper to describe an unlock condition for the UI ("Lv 10 で解放" etc).
export function describeUnlock(skill: BattleSkill): string {
  if (skill.unlock.level !== undefined) return `Lv ${skill.unlock.level} で解放`;
  if (skill.unlock.statThreshold) {
    const t = skill.unlock.statThreshold;
    return `${t.stat} ≥ ${t.value} で解放`;
  }
  return '初期解放';
}

export const MAX_EQUIPPED_SKILLS = 5;
