import type { ShadowRarity, StatKey } from '../types';
import { ALL_STATS } from '../types';

export type BossActionId = 'strike' | 'sprint' | 'arcane' | 'guard' | 'insight';

export interface BossAction {
  id: BossActionId;
  label: string;
  jp: string;
  stat: StatKey;
  flavor: string;
}

export const BOSS_ACTIONS: BossAction[] = [
  { id: 'strike', label: 'STRIKE', jp: '強打', stat: 'STR', flavor: '渾身の一撃' },
  { id: 'sprint', label: 'SPRINT', jp: '速攻', stat: 'AGI', flavor: '隙を突く連撃' },
  { id: 'arcane', label: 'ARCANE', jp: '魔法', stat: 'INT', flavor: '魔力を解放' },
  { id: 'guard', label: 'GUARD',  jp: '守備', stat: 'VIT', flavor: '盾と踏み込みで圧す' },
  { id: 'insight', label: 'INSIGHT', jp: '看破', stat: 'PER', flavor: '弱点を見極めて貫く' },
];

export interface BossDef {
  id: string;
  name: string;
  hp: number;          // base HP at player Lv 1; scaled at runtime
  weak: StatKey;       // 1.5× damage with this stat
  resist: StatKey;     // 0.6× damage with this stat
  flavor: string;
  agility: number;     // 6..14, drives the boss ATB fill rate
  attack: number;      // 4..14, base attack damage before player level scaling
  critChance: number;  // 0..0.3
}

export const BOSSES: BossDef[] = [
  {
    id: 'shadow-wolf',
    name: '影の獣・牙狼',
    hp: 220,
    weak: 'STR',
    resist: 'INT',
    flavor: '機敏な動きで距離を詰めてくる獣型ボス',
    agility: 12,
    attack: 8,
    critChance: 0.15,
  },
  {
    id: 'lich-king',
    name: '黒霊王・モルガ',
    hp: 240,
    weak: 'INT',
    resist: 'STR',
    flavor: '魔法障壁に守られた術士。物理は通りにくい',
    agility: 7,
    attack: 10,
    critChance: 0.18,
  },
  {
    id: 'iron-golem',
    name: '鋼塊・アイアンゴーレム',
    hp: 320,
    weak: 'PER',
    resist: 'VIT',
    flavor: '装甲の継ぎ目を見抜けば一気に崩せる',
    agility: 5,
    attack: 13,
    critChance: 0.05,
  },
  {
    id: 'shadow-assassin',
    name: '影刺し・カゲヌキ',
    hp: 180,
    weak: 'AGI',
    resist: 'PER',
    flavor: '高速で消える。速攻でしか追いつかない',
    agility: 14,
    attack: 7,
    critChance: 0.22,
  },
  {
    id: 'wraith-knight',
    name: '冷霊騎士・グラデス',
    hp: 260,
    weak: 'VIT',
    resist: 'AGI',
    flavor: '冷気を纏う重騎士。守りを固めて押し返せ',
    agility: 8,
    attack: 10,
    critChance: 0.12,
  },
  {
    id: 'demonlord',
    name: '魔王の眷属・バルザ',
    hp: 300,
    weak: 'STR',
    resist: 'PER',
    flavor: '魔王配下の幹部。真っ向勝負を挑んでくる',
    agility: 9,
    attack: 12,
    critChance: 0.15,
  },
  {
    id: 'phantom-stalker',
    name: '深淵の追跡者',
    hp: 200,
    weak: 'PER',
    resist: 'STR',
    flavor: '気配を消す影。直感が頼り',
    agility: 11,
    attack: 9,
    critChance: 0.20,
  },
];

// ── Boss selection ────────────────────────────────────────────────────

// Boss tower picks by floor (1-indexed). Cycles through the BOSSES pool
// so the player sees a varied rotation as they climb. Combined with the
// floor-based HP/attack scaling below, fights get progressively harder
// even after the pool loops back to the first boss.
export function pickBossByFloor(floor: number): BossDef {
  const safeFloor = Math.max(1, Math.floor(floor));
  return BOSSES[(safeFloor - 1) % BOSSES.length];
}

export function currentFloor(character: { bossesDefeated?: number }): number {
  return (character.bossesDefeated ?? 0) + 1;
}

// ── Combat formulas ────────────────────────────────────────────────────

// Hit-points pool the player carries into combat. VIT is the floor on
// survivability — every point adds 3 HP on top of the 50-point baseline so
// even a Lv-1 hunter survives ~3 normal hits.
export function playerMaxHp(stats: Record<StatKey, number>, level: number): number {
  return 50 + (stats.VIT ?? 0) * 3 + level * 4;
}

// Boss HP scales with both player level (gentle) and current floor
// (heavier) so the difficulty curve keeps rising as you climb the tower.
export function scaledBossHp(
  boss: BossDef,
  playerLevel: number,
  floor: number = 1
): number {
  const levelMod = 1 + (playerLevel - 1) * 0.05;
  const floorMod = 1 + (floor - 1) * 0.10;
  return Math.round(boss.hp * levelMod * floorMod);
}

// Same idea for boss attack — each floor bumps the per-hit damage so the
// player can't AFK the tower indefinitely with a Lv-1 build.
export function scaledBossAttack(boss: BossDef, floor: number = 1): number {
  return boss.attack + Math.floor((floor - 1) * 0.7);
}

// ── ATB initiative ────────────────────────────────────────────────────

// Speed = base + AGI * coefficient. Both sides use the same formula so
// AGI is the only differentiator in turn frequency. ATB target = 100.
export const ATB_TARGET = 100;
const ATB_BASE = 6;
const ATB_PER_AGI = 0.35;

export function playerAtbSpeed(stats: Record<StatKey, number>): number {
  return ATB_BASE + (stats.AGI ?? 0) * ATB_PER_AGI;
}
export function bossAtbSpeed(boss: BossDef): number {
  return ATB_BASE + boss.agility * ATB_PER_AGI;
}

// ── Player-side damage ────────────────────────────────────────────────

// STR globally boosts attack output (regardless of which action is used).
// Multiplier is +1% per STR point — STR 30 → +30%. Tuned so it isn't
// dominant but is meaningfully visible.
function strMultiplier(STR: number): number {
  return 1 + STR * 0.01;
}

// Critical hit chance: INT × 0.5%, capped at 30%. Higher cap would make
// combat too RNG-swingy.
export function critChance(INT: number): number {
  return Math.min(0.30, INT * 0.005);
}

const CRIT_MULTIPLIER = 1.75;

export interface PlayerAttackResult {
  damage: number;
  crit: boolean;
  isWeak: boolean;
  isResist: boolean;
}

// Skill-driven attack — accepts the active skill's stat + multiplier + crit
// overrides so each skill keeps its identity (大魔法は固定ダメージ高、必中クリは
// crit絶対、等)。BOSS_ACTIONS は装備スキルの初期 5 種に対応。
export function computePlayerAttack(args: {
  stat: StatKey;
  damageMultiplier: number;
  effective: Record<StatKey, number>;
  boss: BossDef;
  guaranteedCrit?: boolean;
  critBonusFlat?: number;
  rng?: () => number;
}): PlayerAttackResult {
  const rng = args.rng ?? Math.random;
  const isWeak = args.boss.weak === args.stat;
  const isResist = args.boss.resist === args.stat;
  const matchMultiplier = isWeak ? 1.5 : isResist ? 0.6 : 1;
  const variance = 0.85 + rng() * 0.3; // 0.85..1.15

  const statValue = args.effective[args.stat] ?? 0;
  const base = statValue + 4;

  // Crit chance can be flat-boosted by skills (鷹眼など) or forced (看破).
  let crit = false;
  if (args.guaranteedCrit) {
    crit = true;
  } else {
    const baseCrit = critChance(args.effective.INT ?? 0);
    const total = Math.min(1, baseCrit + (args.critBonusFlat ?? 0));
    crit = rng() < total;
  }
  const critMult = crit ? CRIT_MULTIPLIER : 1;
  const damage = Math.max(
    1,
    Math.round(
      base *
        strMultiplier(args.effective.STR ?? 0) *
        matchMultiplier *
        critMult *
        variance *
        args.damageMultiplier
    )
  );
  return { damage, crit, isWeak, isResist };
}

// ── Boss-side damage ──────────────────────────────────────────────────

// PER provides two distinct defensive rolls so it's a meaningful pick but
// can never fully neuter combat:
//   - Dodge: PER × 0.3% chance to make boss attack miss entirely (cap 18%)
//   - Crit avoidance: PER × 0.2% chance to downgrade boss crits to normal (cap 12%)
export function dodgeChance(PER: number): number {
  return Math.min(0.18, PER * 0.003);
}
export function critAvoidChance(PER: number): number {
  return Math.min(0.12, PER * 0.002);
}

export interface BossAttackResult {
  damage: number;
  dodged: boolean;
  crit: boolean;
}

// Bosses scale their per-hit damage with player level — so a 200HP Lv 20
// hunter still takes meaningful chunks.
export function computeBossAttack(args: {
  boss: BossDef;
  playerLevel: number;
  effective: Record<StatKey, number>;
  rng?: () => number;
}): BossAttackResult {
  const rng = args.rng ?? Math.random;
  const variance = 0.85 + rng() * 0.3;

  if (rng() < dodgeChance(args.effective.PER ?? 0)) {
    return { damage: 0, dodged: true, crit: false };
  }

  let critRoll = rng() < args.boss.critChance;
  if (critRoll && rng() < critAvoidChance(args.effective.PER ?? 0)) {
    critRoll = false;
  }
  const critMult = critRoll ? CRIT_MULTIPLIER : 1;
  const base = args.boss.attack + args.playerLevel * 0.5;
  const damage = Math.max(1, Math.round(base * critMult * variance));
  return { damage, dodged: false, crit: critRoll };
}

// ── Reward on win ──────────────────────────────────────────────────────

// ── Shadow extraction (post-victory reward) ────────────────────────────

// Victory no longer grants EXP — that's reserved for daily quest progress.
// Instead the player gets 3 chances to "extract" a shadow. Difficulty
// scales by player rank (level, PER, INT) vs boss difficulty (floor,
// scaled HP). Higher player power → both higher success rate AND better
// rarity distribution on successful extracts.
export interface ExtractionInput {
  playerLevel: number;
  perception: number;
  intelligence: number;
  floor: number;
  bossHpScaled: number;
}

export interface ExtractionResult {
  success: boolean;
  successChance: number;  // 0..1, for UI display
  rarity: ShadowRarity;   // only meaningful when success === true
  stat: StatKey;
}

export function extractionChance(input: ExtractionInput): number {
  const baseChance = 0.55;
  const levelBonus = input.playerLevel * 0.005;
  const perBonus = input.perception * 0.0035;
  const intBonus = input.intelligence * 0.0015;
  const floorPenalty = input.floor * 0.035;
  const hpPenalty = input.bossHpScaled * 0.00025;
  const raw = baseChance + levelBonus + perBonus + intBonus - floorPenalty - hpPenalty;
  return Math.max(0.08, Math.min(0.95, raw));
}

export function rollExtraction(
  input: ExtractionInput,
  rng: () => number = Math.random
): ExtractionResult {
  const successChance = extractionChance(input);
  const success = rng() < successChance;

  // Rarity quality scales with the same successChance — high-rank players
  // tackling sane-floor bosses get markedly better rarity rolls when they
  // do succeed.
  const quality = (successChance - 0.08) / 0.87; // normalised 0..1
  const r = rng();
  // Cumulative cutoffs swing from "mostly normal" to "even chance of epic+"
  const legendaryCut = 0.04 + quality * 0.12;
  const epicCut = legendaryCut + 0.10 + quality * 0.20;
  const rareCut = epicCut + 0.25 + quality * 0.18;
  let rarity: ShadowRarity;
  if (r < legendaryCut) rarity = 'legendary';
  else if (r < epicCut) rarity = 'epic';
  else if (r < rareCut) rarity = 'rare';
  else rarity = 'normal';

  const stat = ALL_STATS[Math.floor(rng() * ALL_STATS.length)];
  return { success, successChance, rarity, stat };
}

export const EXTRACTION_ATTEMPTS_PER_WIN = 3;
