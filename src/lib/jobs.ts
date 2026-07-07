import type { Character, HunterClass, StatKey } from '../types';
import type { Element } from './battle/elements';

// Jobs (キャラクリ v2) — docs/redesign/05-character.md §2. Classes finally carry
// mechanical weight: a per-level growth bonus, a combat passive that scales
// with job tier, an element (basic-attack affinity), and an ultimate that
// upgrades on advancement. Tier2 unlocks at Lv20, tier3 at Lv40.

export const TIER2_LEVEL = 20;
export const TIER3_LEVEL = 40;

export type ClassPassiveKind = 'damageTaken' | 'cooldown' | 'atb' | 'firstStrikeBreak';

export interface ClassInfo {
  jp: string;
  label: string;
  blurb: string;
  growth: [StatKey, StatKey]; // +1 to each per level (derived, see classStatBonus)
  element: Element;
  passive: ClassPassiveKind;
  passiveDesc: string;
}

export const CLASS_INFO: Record<HunterClass, ClassInfo> = {
  knight: {
    jp: '剣士', label: 'KNIGHT',
    blurb: '正面から受けて崩す。STR/VIT が伸び、被ダメージを軽減する。',
    growth: ['STR', 'VIT'], element: 'go', passive: 'damageTaken',
    passiveDesc: '被ダメージ -8%',
  },
  mage: {
    jp: '魔導師', label: 'MAGE',
    blurb: '魔力で押し切る。INT/PER が伸び、スキルの再使用が速い。',
    growth: ['INT', 'PER'], element: 'ma', passive: 'cooldown',
    passiveDesc: 'スキルCD -1',
  },
  hunter: {
    jp: '狩人', label: 'HUNTER',
    blurb: '先手必勝。AGI/PER が伸び、行動が速くなる。',
    growth: ['AGI', 'PER'], element: 'jin', passive: 'atb',
    passiveDesc: '行動速度 +8%',
  },
  scout: {
    jp: '斥候', label: 'SCOUT',
    blurb: '搦め手で崩す。AGI/INT が伸び、先制でブレイクを稼ぐ。',
    growth: ['AGI', 'INT'], element: 'jin', passive: 'firstStrikeBreak',
    passiveDesc: '初撃のブレイク +1',
  },
};

export interface JobNode {
  id: string;
  name: string;
  tier: 1 | 2 | 3;
  base: HunterClass;
  parent?: string; // id of the tier below
  blurb: string;
}

// Full job tree. Tier-1 nodes are the base classes themselves.
export const JOB_TREE: JobNode[] = [
  // knight
  { id: 'knight', name: '剣士', tier: 1, base: 'knight', blurb: '基本の剣士。' },
  { id: 'k-knight', name: 'ナイト', tier: 2, base: 'knight', parent: 'knight', blurb: '守りに厚い重騎士。' },
  { id: 'k-berserker', name: 'バーサーカー', tier: 2, base: 'knight', parent: 'knight', blurb: '攻めに全てを賭ける狂戦士。' },
  { id: 'k-paladin', name: 'パラディン', tier: 3, base: 'knight', parent: 'k-knight', blurb: '不動の聖騎士。' },
  { id: 'k-lord', name: '剣聖ロード', tier: 3, base: 'knight', parent: 'k-knight', blurb: '剣を極めた王。' },
  { id: 'k-kenki', name: '剣鬼', tier: 3, base: 'knight', parent: 'k-berserker', blurb: '鬼の一撃。' },
  { id: 'k-dragoon', name: '竜殺し', tier: 3, base: 'knight', parent: 'k-berserker', blurb: '大物喰らいの豪傑。' },
  // mage
  { id: 'mage', name: '魔導師', tier: 1, base: 'mage', blurb: '基本の魔導師。' },
  { id: 'm-wizard', name: 'ウィザード', tier: 2, base: 'mage', parent: 'mage', blurb: '火力特化の術士。' },
  { id: 'm-sage', name: 'セージ', tier: 2, base: 'mage', parent: 'mage', blurb: '支援に長けた賢者見習い。' },
  { id: 'm-archmage', name: '大魔導', tier: 3, base: 'mage', parent: 'm-wizard', blurb: '極大魔法の使い手。' },
  { id: 'm-sennin', name: '賢者', tier: 3, base: 'mage', parent: 'm-sage', blurb: '万物を見通す賢者。' },
  { id: 'm-warlock', name: '破魔導', tier: 3, base: 'mage', parent: 'm-wizard', blurb: '破壊に特化した術士。' },
  { id: 'm-oracle', name: '神託者', tier: 3, base: 'mage', parent: 'm-sage', blurb: '未来を読む導き手。' },
  // hunter
  { id: 'hunter', name: '狩人', tier: 1, base: 'hunter', blurb: '基本の狩人。' },
  { id: 'h-sniper', name: 'スナイパー', tier: 2, base: 'hunter', parent: 'hunter', blurb: '一撃必中の狙撃手。' },
  { id: 'h-ranger', name: 'レンジャー', tier: 2, base: 'hunter', parent: 'hunter', blurb: '手数で押す野伏。' },
  { id: 'h-hawkeye', name: '鷹の目', tier: 3, base: 'hunter', parent: 'h-sniper', blurb: '弱点を射抜く達人。' },
  { id: 'h-tempest', name: '疾風の射手', tier: 3, base: 'hunter', parent: 'h-ranger', blurb: '嵐のような連射。' },
  { id: 'h-phantom', name: '幻影狙撃', tier: 3, base: 'hunter', parent: 'h-sniper', blurb: '気配なき狙撃手。' },
  { id: 'h-gale', name: '烈風の狩人', tier: 3, base: 'hunter', parent: 'h-ranger', blurb: '風を纏う狩人。' },
  // scout
  { id: 'scout', name: '斥候', tier: 1, base: 'scout', blurb: '基本の斥候。' },
  { id: 's-assassin', name: 'アサシン', tier: 2, base: 'scout', parent: 'scout', blurb: '妨害と暗殺の刺客。' },
  { id: 's-trickster', name: 'トリックスター', tier: 2, base: 'scout', parent: 'scout', blurb: '搦め手の道化。' },
  { id: 's-shadow', name: '影番', tier: 3, base: 'scout', parent: 's-assassin', blurb: '影を操る番人。' },
  { id: 's-faces', name: '千の顔', tier: 3, base: 'scout', parent: 's-trickster', blurb: '無数の策を持つ者。' },
  { id: 's-reaper', name: '首狩り', tier: 3, base: 'scout', parent: 's-assassin', blurb: '確実に仕留める刺客。' },
  { id: 's-jester', name: '大道化', tier: 3, base: 'scout', parent: 's-trickster', blurb: '盤面を引っかき回す。' },
];

export const JOB_BY_ID: Record<string, JobNode> = Object.fromEntries(JOB_TREE.map((j) => [j.id, j]));

export function baseClass(character: Character): HunterClass {
  return character.job?.base ?? character.appearance?.hunterClass ?? 'knight';
}

// The player's currently-effective job node (respecting level gates).
export function resolveJobNode(character: Character): JobNode {
  const base = baseClass(character);
  const job = character.job;
  if (job?.tier3 && character.level >= TIER3_LEVEL && JOB_BY_ID[job.tier3]) return JOB_BY_ID[job.tier3];
  if (job?.tier2 && character.level >= TIER2_LEVEL && JOB_BY_ID[job.tier2]) return JOB_BY_ID[job.tier2];
  return JOB_BY_ID[base];
}

export function effectiveTier(character: Character): 1 | 2 | 3 {
  return resolveJobNode(character).tier;
}

// Advancement options available right now (empty if none / not eligible yet).
export function advancementOptions(character: Character): JobNode[] {
  const base = baseClass(character);
  const job = character.job;
  if (character.level >= TIER3_LEVEL && job?.tier2 && !job.tier3) {
    return JOB_TREE.filter((j) => j.tier === 3 && j.parent === job.tier2);
  }
  if (character.level >= TIER2_LEVEL && !job?.tier2) {
    return JOB_TREE.filter((j) => j.tier === 2 && j.parent === base);
  }
  return [];
}

// Derived per-level stat growth (not stored): +1 to each growth stat per level
// gained. Layered into effective stats like the weapon bonus, so it needs no
// migration and never desyncs on EXP refunds.
export function classStatBonus(character: Character): Partial<Record<StatKey, number>> {
  const info = CLASS_INFO[baseClass(character)];
  const amount = Math.max(0, character.level - 1);
  const out: Partial<Record<StatKey, number>> = {};
  for (const stat of info.growth) out[stat] = (out[stat] ?? 0) + amount;
  return out;
}

export interface JobCombatMods {
  damageTakenMult: number;   // multiplier on incoming damage (≤1)
  atbBonus: number;          // fraction added to player ATB speed
  cooldownReduction: number; // integer subtracted from skill cooldowns
  firstStrikeBreak: number;  // extra break chips on the first weakness hit
  ultimatePower: number;     // ultimate damage multiplier
  ultimateName: string;
}

const DMG_TAKEN = [0.08, 0.12, 0.16];
const ATB = [0.08, 0.12, 0.16];
const CD = [1, 1, 2];
const FSB = [1, 1, 2];
const ULT_POWER = [3.2, 3.6, 4.2];

function ultimateName(base: HunterClass, tier: number, nodeName: string): string {
  const suffix = tier >= 3 ? '・極' : tier >= 2 ? '・改' : '';
  const core: Record<HunterClass, string> = {
    knight: '剛剣一文字', mage: '星霜の詠唱', hunter: '追い風の連矢', scout: '影縫い',
  };
  return `${core[base]}${suffix}（${nodeName}）`;
}

export function jobCombatMods(character: Character): JobCombatMods {
  const node = resolveJobNode(character);
  const info = CLASS_INFO[node.base];
  const t = node.tier - 1;
  return {
    damageTakenMult: info.passive === 'damageTaken' ? 1 - DMG_TAKEN[t] : 1,
    atbBonus: info.passive === 'atb' ? ATB[t] : 0,
    cooldownReduction: info.passive === 'cooldown' ? CD[t] : 0,
    firstStrikeBreak: info.passive === 'firstStrikeBreak' ? FSB[t] : 0,
    ultimatePower: ULT_POWER[t],
    ultimateName: ultimateName(node.base, node.tier, node.name),
  };
}
