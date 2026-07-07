// Battle engine — docs/redesign/03-battle-system.md, 07 §3.
// A pure, UI-independent reducer: (state, input) → (state, events). The scene
// layer (BattleScene) ticks it on a timer and replays the emitted events as
// animations. All randomness is injected so the engine is deterministic under
// test.
//
// Cast: the player + up to 3 companion shadows vs one enemy. ATB initiative is
// carried over from the original DailyBossPanel design (speed = 6 + AGI·0.35,
// target 100). New mechanics layered on top: five-element affinity, break
// gauge, status ailments, guard, and a class ultimate.

import type { StatKey } from '../../types';
import {
  ATB_TARGET,
  CRIT_MULTIPLIER_EXPORT as CRIT_MULT,
  computePlayerAttack,
  computeBossAttack,
} from './formulas';
import type { Element } from './elements';
import {
  STAT_TO_ELEMENT,
  ELEMENT_TO_STAT,
  affinity,
  affinityMultiplier,
} from './elements';
import {
  tickStatuses,
  applyStatus,
  attackModifierFromStatuses,
  damageTakenModifier,
  wakeOnHit,
  cleanseResettable,
  type ActiveStatus,
  type StatusId,
} from './status';
import {
  initBreak,
  chipBreak,
  tickBreak,
  breakDamage,
  damageMultiplierWhileBroken,
  type BreakState,
} from './break';
import type { EnemyDef, EnemyMove } from '../enemies/types';

// ── Public config passed in at battle start ──────────────────────────────

export interface PlayerSkill {
  id: string;
  name: string;
  kind: 'attack' | 'heal';
  stat: StatKey;
  damageMultiplier: number;
  healPct: number;
  guaranteedCrit: boolean;
  critBonusFlat: number;
  cooldown: number;
}

export interface PlayerConfig {
  name: string;
  level: number;
  stats: Record<StatKey, number>; // effective (base + weapon + class growth)
  maxHp: number;
  primaryElement: Element;         // basic-attack element (from class)
  skills: PlayerSkill[];           // equipped, resolved
  hasRevive: boolean;              // phoenix feather held
  critBonus: number;               // flat crit add from medals
  burnResist: number;              // 0..1 dmg reduction on burn
  // ----- job/class combat passives (lib/jobs.ts jobCombatMods) -----
  damageTakenMult: number;         // ≤1: incoming-damage reduction (knight)
  atbBonus: number;                // fraction added to ATB speed (hunter)
  cooldownReduction: number;       // subtracted from skill cooldowns (mage)
  firstStrikeBreak: number;        // extra break on first weakness hit (scout)
  ultimatePower: number;           // ultimate damage multiplier (tier-scaled)
  ultimateName: string;
}

export interface ShadowConfig {
  id: string;
  name: string;
  element: Element;
  attack: number;   // per-hit base (from shadowCombatPower)
  speed: number;    // ATB fill speed (from shadowCombatPower.atbSpeed)
  role: 'attacker' | 'healer';
}

// ── Live combat state ────────────────────────────────────────────────────

export interface Actor {
  key: string;
  name: string;
  hp: number;
  maxHp: number;
  atb: number;
  speed: number;
  alive: boolean;
  statuses: ActiveStatus[];
}

export interface PlayerActor extends Actor {
  guarding: boolean;
  cooldowns: Record<string, number>; // skillId → turns left
  attackMod: number;                 // debuff/buff multiplier (from enemy)
  reviveAvailable: boolean;
  firstStrikeUsed: boolean;          // scout first-strike break bonus consumed
}

export interface ShadowActor extends Actor {
  element: Element;
  attack: number;
  role: 'attacker' | 'healer';
}

export interface EnemyActor extends Actor {
  element: Element;
  attack: number;
  critChance: number;
  playerLevel: number;
  break: BreakState;
  charged: EnemyMove | null;  // pending unleash next turn
  turnCount: number;
  phase: 1 | 2;
  phases: number;
  def: EnemyDef;
  attackMod: number;          // self-buff multiplier
}

export type BattlePhase = 'ticking' | 'awaiting-input' | 'won' | 'lost';

export interface BattleState {
  player: PlayerActor;
  shadows: ShadowActor[];
  enemy: EnemyActor;
  phase: BattlePhase;
  ultimate: number;   // 0..100
  turnNumber: number; // increments on each enemy turn (drives everyNTurns)
  itemAttackBoost: number; // power-crystal: multiplier for the next player attack
}

// ── Events emitted for the UI ─────────────────────────────────────────────

export type GimmickFx = 'fakeNotification' | 'uiSleep';

export type BattleEvent =
  | { type: 'log'; text: string }
  | { type: 'damage'; target: string; amount: number; crit: boolean; weak: boolean; resist: boolean }
  | { type: 'heal'; target: string; amount: number }
  | { type: 'status'; target: string; status: StatusId }
  | { type: 'break' }
  | { type: 'phase2' }
  | { type: 'charge' }
  | { type: 'ultimate' }
  | { type: 'fx'; fx: GimmickFx }
  | { type: 'miss'; target: string }
  | { type: 'defeat'; target: string }
  | { type: 'win' }
  | { type: 'lose' };

export interface StepResult {
  state: BattleState;
  events: BattleEvent[];
}

// ── Element → class basic-attack mapping helper ────────────────────────────

export const CLASS_ELEMENT: Record<string, Element> = {
  knight: 'go',
  mage: 'ma',
  hunter: 'jin',
  scout: 'jin',
};

// Neutral, variance-free estimate of the player's per-hit output. Used to size
// enemy HP from `hpTurns` so numbers stay honest as builds diverge (docs 03
// §8-3). Assumes the strongest attacking skill at neutral affinity, no crit.
export function estimatePlayerDamage(cfg: PlayerConfig): number {
  const best = cfg.skills
    .filter((s) => s.kind === 'attack')
    .reduce((m, s) => Math.max(m, s.damageMultiplier), 1);
  const strMult = 1 + (cfg.stats.STR ?? 0) * 0.01;
  const topStat = Math.max(...(Object.values(cfg.stats) as number[]));
  return Math.max(1, Math.round((topStat + 4) * strMult * best));
}

export function enemyMaxHp(def: EnemyDef, cfg: PlayerConfig, companionCount: number): number {
  const perHit = estimatePlayerDamage(cfg);
  // hpTurns is "turns of the player's own output"; companions shorten real TTK
  // so scale HP up modestly per companion to keep pacing (mirrors the old
  // per-shadow HP bump in boss.ts).
  const companionMod = 1 + companionCount * 0.3;
  return Math.max(10, Math.round(def.hpTurns * perHit * companionMod));
}

// ── Battle construction ────────────────────────────────────────────────────

function atbSpeed(agilityLike: number): number {
  return 6 + agilityLike * 0.35;
}

export function createBattle(params: {
  player: PlayerConfig;
  shadows: ShadowConfig[];
  enemy: EnemyDef;
}): BattleState {
  const { player, shadows, enemy } = params;
  const companionCount = shadows.length;

  const playerActor: PlayerActor = {
    key: 'player',
    name: player.name,
    hp: player.maxHp,
    maxHp: player.maxHp,
    atb: 0,
    speed: atbSpeed(player.stats.AGI ?? 0) * (1 + player.atbBonus),
    alive: true,
    statuses: [],
    guarding: false,
    cooldowns: {},
    attackMod: 1,
    reviveAvailable: player.hasRevive,
    firstStrikeUsed: false,
  };

  const shadowActors: ShadowActor[] = shadows.map((s) => ({
    key: `shadow:${s.id}`,
    name: s.name,
    hp: 1, // shadows don't take damage in this slice; kept alive as attackers
    maxHp: 1,
    atb: 0,
    speed: s.speed,
    alive: true,
    statuses: [],
    element: s.element,
    attack: s.attack,
    role: s.role,
  }));

  const maxHp = enemyMaxHp(enemy, player, companionCount);
  // Mirror gimmick (ch9 ネガミラー): the enemy is a copy of YOU — it takes the
  // player's element (so your own affinity gives no easy weakness) and hits
  // scaled from the player's own power.
  const mirror = enemy.gimmick === 'mirror';
  const topStat = Math.max(...(Object.values(player.stats) as number[]));
  const enemyActor: EnemyActor = {
    key: 'enemy',
    name: enemy.name,
    hp: maxHp,
    maxHp,
    atb: 0,
    speed: atbSpeed(enemy.agility),
    alive: true,
    statuses: [],
    element: mirror ? player.primaryElement : enemy.element,
    attack: mirror ? Math.max(enemy.attack, Math.round(topStat * 0.35)) : enemy.attack,
    critChance: enemy.critChance,
    playerLevel: player.level,
    break: initBreak(enemy.breakGauge),
    charged: null,
    turnCount: 0,
    phase: 1,
    phases: enemy.phases ?? 1,
    def: enemy,
    attackMod: 1,
  };

  return {
    player: playerActor,
    shadows: shadowActors,
    enemy: enemyActor,
    phase: 'ticking',
    ultimate: 0,
    turnNumber: 0,
    itemAttackBoost: 1,
  };
}

// ── Helpers ────────────────────────────────────────────────────────────────

function pctHp(a: Actor): number {
  return a.maxHp > 0 ? a.hp / a.maxHp : 0;
}

// Gauge display for the player's effective attack stats after debuff.
function playerEffectiveStats(
  cfg: Record<StatKey, number>,
  attackMod: number,
  statuses: ActiveStatus[]
): Record<StatKey, number> {
  const mod = attackMod * attackModifierFromStatuses(statuses);
  const out = {} as Record<StatKey, number>;
  (Object.keys(cfg) as StatKey[]).forEach((k) => {
    out[k] = cfg[k] * mod;
  });
  return out;
}

// ── The main tick ────────────────────────────────────────────────────────

// Advance the ATB clocks by dt (ms-equivalent units). Resolves at most ONE
// non-player actor's turn per call so the UI can animate each beat. When the
// player's gauge fills, hands control back (phase → awaiting-input).
export function advance(
  state: BattleState,
  dt: number,
  cfg: PlayerConfig,
  rng: () => number = Math.random
): StepResult {
  if (state.phase !== 'ticking') return { state, events: [] };

  // Fill gauges.
  const player = { ...state.player, atb: state.player.atb + state.player.speed * dt };
  const shadows = state.shadows.map((s) => ({ ...s, atb: s.atb + s.speed * dt }));
  const enemy = { ...state.enemy, atb: state.enemy.atb + state.enemy.speed * dt };
  let next: BattleState = { ...state, player, shadows, enemy };

  // Find the readiest actor (highest overflow past target).
  const ready: { key: string; over: number }[] = [];
  if (player.alive && player.atb >= ATB_TARGET) ready.push({ key: 'player', over: player.atb - ATB_TARGET });
  shadows.forEach((s) => { if (s.alive && s.atb >= ATB_TARGET) ready.push({ key: s.key, over: s.atb - ATB_TARGET }); });
  if (enemy.alive && enemy.atb >= ATB_TARGET) ready.push({ key: 'enemy', over: enemy.atb - ATB_TARGET });

  if (ready.length === 0) return { state: next, events: [] };
  ready.sort((a, b) => b.over - a.over);
  const actor = ready[0].key;

  if (actor === 'player') {
    return beginPlayerTurn(next, cfg, rng);
  }
  if (actor === 'enemy') {
    return resolveEnemyTurn(next, cfg, rng);
  }
  return resolveShadowTurn(next, actor, rng);
}

// Player gauge filled: run start-of-turn status tick, then either skip (asleep
// /paralysed) or hand control to the UI.
function beginPlayerTurn(state: BattleState, cfg: PlayerConfig, rng: () => number): StepResult {
  const events: BattleEvent[] = [];
  const p = { ...state.player, atb: state.player.atb - ATB_TARGET, guarding: false };

  const tick = tickStatuses(p.statuses, p.maxHp, rng);
  p.statuses = tick.statuses;
  tick.logs.forEach((t) => events.push({ type: 'log', text: t }));
  if (tick.damage > 0) {
    const dmg = Math.round(tick.damage * (1 - (hasBurn(p.statuses) ? cfg.burnResist : 0)));
    p.hp = Math.max(0, p.hp - dmg);
    events.push({ type: 'damage', target: 'player', amount: dmg, crit: false, weak: false, resist: false });
  }
  // decrement cooldowns at the start of the player's turn
  p.cooldowns = decrementCooldowns(p.cooldowns);

  if (p.hp <= 0) {
    return finishIfDead({ ...state, player: p }, events);
  }
  if (tick.skipTurn) {
    // lose the turn; keep ticking
    return { state: { ...state, player: p, phase: 'ticking' }, events };
  }
  return { state: { ...state, player: p, phase: 'awaiting-input' }, events };
}

function hasBurn(statuses: ActiveStatus[]): boolean {
  return statuses.some((s) => s.id === 'burn');
}

function decrementCooldowns(cd: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(cd)) if (v - 1 > 0) out[k] = v - 1;
  return out;
}

// ── Player actions ─────────────────────────────────────────────────────────

export type PlayerAction =
  | { kind: 'attack' }
  | { kind: 'skill'; skillId: string }
  | { kind: 'guard' }
  | { kind: 'item'; effect: { type: 'heal'; percent: number } | { type: 'attack-boost'; multiplier: number } | { type: 'revive'; percent: number } }
  | { kind: 'ultimate' }
  | { kind: 'wait' }; // turn wasted (e.g. tapping a fake notification, ch3)

export const ULTIMATE_READY = 100;

export function playerAction(
  state: BattleState,
  action: PlayerAction,
  cfg: PlayerConfig,
  rng: () => number = Math.random
): StepResult {
  if (state.phase !== 'awaiting-input') return { state, events: [] };
  const events: BattleEvent[] = [];
  let player = { ...state.player };
  let enemy = { ...state.enemy };
  let ultimate = state.ultimate;
  let itemAttackBoost = state.itemAttackBoost;

  const dealToEnemy = (stat: StatKey, mult: number, opts?: { guaranteedCrit?: boolean; critBonusFlat?: number }) => {
    const element = STAT_TO_ELEMENT[stat];
    const aff = affinity(element, enemy.element);
    const eff = playerEffectiveStats(cfg.stats, player.attackMod, player.statuses);
    const res = computePlayerAttack({
      stat,
      damageMultiplier: mult * itemAttackBoost,
      effective: eff,
      enemyElement: enemy.element,
      attackElement: element,
      guaranteedCrit: opts?.guaranteedCrit,
      critBonusFlat: (opts?.critBonusFlat ?? 0) + cfg.critBonus,
      rng,
    });
    itemAttackBoost = 1;
    // break: weakness chips the gauge; broken enemies take bonus damage
    let dmg = res.damage;
    const brokenMult = damageMultiplierWhileBroken(enemy.break);
    dmg = Math.round(dmg * brokenMult * damageTakenModifier(enemy.statuses));
    enemy.hp = Math.max(0, enemy.hp - dmg);
    events.push({ type: 'damage', target: 'enemy', amount: dmg, crit: res.crit, weak: aff === 'weak', resist: aff === 'resist' });
    if (aff === 'weak') {
      // scout first-strike passive: extra break chips on the opening weakness hit
      let chipAmt = breakDamage(true, mult >= 1.7);
      if (!player.firstStrikeUsed && cfg.firstStrikeBreak > 0) {
        chipAmt += cfg.firstStrikeBreak;
        player.firstStrikeUsed = true;
      }
      const chip = chipBreak(enemy.break, chipAmt);
      enemy.break = chip.state;
      if (chip.justBroke) events.push({ type: 'break' });
    }
    ultimate = Math.min(ULTIMATE_READY, ultimate + 10);
  };

  switch (action.kind) {
    case 'attack': {
      const stat = ELEMENT_TO_STAT[cfg.primaryElement];
      events.push({ type: 'log', text: `${player.name}の こうげき!` });
      dealToEnemy(stat, 1);
      break;
    }
    case 'skill': {
      const skill = cfg.skills.find((s) => s.id === action.skillId);
      if (!skill) return { state, events };
      if ((player.cooldowns[skill.id] ?? 0) > 0) return { state, events };
      events.push({ type: 'log', text: `${skill.name}!` });
      if (skill.kind === 'heal') {
        const amount = Math.round(player.maxHp * skill.healPct);
        player.hp = Math.min(player.maxHp, player.hp + amount);
        events.push({ type: 'heal', target: 'player', amount });
        ultimate = Math.min(ULTIMATE_READY, ultimate + 10);
      } else {
        dealToEnemy(skill.stat, skill.damageMultiplier, {
          guaranteedCrit: skill.guaranteedCrit,
          critBonusFlat: skill.critBonusFlat,
        });
      }
      const cd = Math.max(0, skill.cooldown - cfg.cooldownReduction);
      if (cd > 0) player.cooldowns = { ...player.cooldowns, [skill.id]: cd };
      break;
    }
    case 'guard': {
      player.guarding = true;
      events.push({ type: 'log', text: `${player.name}は みをまもっている` });
      ultimate = Math.min(ULTIMATE_READY, ultimate + 5);
      break;
    }
    case 'wait': {
      events.push({ type: 'log', text: 'つい 通知を みてしまった… 1ターン むだにした!' });
      break;
    }
    case 'item': {
      const e = action.effect;
      if (e.type === 'heal') {
        const amount = Math.round(player.maxHp * e.percent);
        player.hp = Math.min(player.maxHp, player.hp + amount);
        events.push({ type: 'heal', target: 'player', amount });
      } else if (e.type === 'attack-boost') {
        itemAttackBoost = e.multiplier;
        events.push({ type: 'log', text: 'ちからが みなぎった!' });
      }
      // 'revive' is passive (reviveAvailable), no active effect here.
      break;
    }
    case 'ultimate': {
      if (ultimate < ULTIMATE_READY) return { state, events };
      events.push({ type: 'ultimate' });
      events.push({ type: 'log', text: `おくぎ ${cfg.ultimateName}!` });
      const stat = ELEMENT_TO_STAT[cfg.primaryElement];
      dealToEnemy(stat, cfg.ultimatePower, { critBonusFlat: 0.2 });
      // ultimate also chips break hard on a weakness
      if (affinity(cfg.primaryElement, enemy.element) === 'weak') {
        const chip = chipBreak(enemy.break, 2);
        enemy.break = chip.state;
        if (chip.justBroke) events.push({ type: 'break' });
      }
      ultimate = 0;
      break;
    }
  }

  // reset player atb (already subtracted at beginPlayerTurn), back to ticking
  const finished = finishIfDead(
    { ...state, player, enemy, ultimate, itemAttackBoost, phase: 'ticking' },
    events
  );
  return finished;
}

// ── Shadow turn ────────────────────────────────────────────────────────────

function resolveShadowTurn(state: BattleState, key: string, rng: () => number): StepResult {
  const events: BattleEvent[] = [];
  const idx = state.shadows.findIndex((s) => s.key === key);
  if (idx < 0) return { state, events };
  const shadows = [...state.shadows];
  const s = { ...shadows[idx], atb: shadows[idx].atb - ATB_TARGET };
  shadows[idx] = s;
  let enemy = { ...state.enemy };
  let player = { ...state.player };

  if (s.role === 'healer' && pctHp(player) < 0.5) {
    const amount = Math.round(player.maxHp * 0.12);
    player = { ...player, hp: Math.min(player.maxHp, player.hp + amount) };
    events.push({ type: 'log', text: `${s.name}が かばった!` });
    events.push({ type: 'heal', target: 'player', amount });
    return { state: { ...state, shadows, player }, events };
  }

  // attacker: simple hit scaled by shadow attack + affinity
  const aff = affinity(s.element, enemy.element);
  const variance = 0.85 + rng() * 0.3;
  let dmg = Math.max(1, Math.round(s.attack * affinityMultiplier(s.element, enemy.element) * variance));
  dmg = Math.round(dmg * damageMultiplierWhileBroken(enemy.break) * damageTakenModifier(enemy.statuses));
  enemy = { ...enemy, hp: Math.max(0, enemy.hp - dmg) };
  events.push({ type: 'log', text: `${s.name}の えんご!` });
  events.push({ type: 'damage', target: 'enemy', amount: dmg, crit: false, weak: aff === 'weak', resist: aff === 'resist' });
  if (aff === 'weak') {
    const chip = chipBreak(enemy.break, breakDamage(true));
    enemy = { ...enemy, break: chip.state };
    if (chip.justBroke) events.push({ type: 'break' });
  }
  return finishIfDead({ ...state, shadows, enemy, player }, events);
}

// ── Enemy turn ────────────────────────────────────────────────────────────

function resolveEnemyTurn(state: BattleState, cfg: PlayerConfig, rng: () => number): StepResult {
  const events: BattleEvent[] = [];
  let enemy: EnemyActor = { ...state.enemy, atb: state.enemy.atb - ATB_TARGET };
  let player = { ...state.player };
  const turnNumber = state.turnNumber + 1;
  enemy.turnCount += 1;

  // Phase-2 transition on first drop below 50% HP.
  if (enemy.phases >= 2 && enemy.phase === 1 && pctHp(enemy) < 0.5) {
    enemy.phase = 2;
    if (enemy.def.quotes?.phase2) events.push({ type: 'log', text: enemy.def.quotes.phase2 });
    events.push({ type: 'phase2' });
  }

  // Break tick (stun).
  const bt = tickBreak(enemy.break);
  enemy.break = bt.state;
  if (bt.stunned) {
    events.push({ type: 'log', text: `${enemy.name}は くずれていて うごけない!` });
    return { state: { ...state, enemy, player, turnNumber }, events };
  }

  // Status tick (poison/burn/sleep/paralyze on the enemy).
  const tick = tickStatuses(enemy.statuses, enemy.maxHp, rng);
  enemy.statuses = tick.statuses;
  tick.logs.forEach((t) => events.push({ type: 'log', text: t }));
  if (tick.damage > 0) {
    enemy.hp = Math.max(0, enemy.hp - tick.damage);
    events.push({ type: 'damage', target: 'enemy', amount: tick.damage, crit: false, weak: false, resist: false });
    if (enemy.hp <= 0) return finishIfDead({ ...state, enemy, player, turnNumber }, events);
  }
  if (tick.skipTurn) {
    return { state: { ...state, enemy, player, turnNumber }, events };
  }

  // Choose + resolve a move.
  let move: EnemyMove;
  if (enemy.charged) {
    move = enemy.charged;
    enemy.charged = null;
  } else {
    move = pickMove(enemy, rng);
  }

  const result = applyEnemyMove(move, enemy, player, cfg, rng, events);
  enemy = result.enemy;
  player = result.player;

  if (player.hp <= 0 && player.reviveAvailable) {
    player.hp = Math.round(player.maxHp * 0.5);
    player.reviveAvailable = false;
    events.push({ type: 'log', text: '不死鳥の羽根が きらめいた! 復活!' });
    events.push({ type: 'heal', target: 'player', amount: player.hp });
  }

  return finishIfDead({ ...state, enemy, player, turnNumber }, events);
}

function pickMove(enemy: EnemyActor, rng: () => number): EnemyMove {
  const eligible = enemy.def.moves.filter((m) => {
    if (m.kind === 'unleash') return false; // triggered by charge only
    switch (m.condition) {
      case 'opening': return enemy.turnCount === 1;
      case 'hpBelow50': return pctHp(enemy) < 0.5;
      case 'phase2': return enemy.phase === 2;
      case 'everyNTurns': return m.n ? enemy.turnCount % m.n === 0 : false;
      default: return true;
    }
  });
  const pool = eligible.length ? eligible : enemy.def.moves.filter((m) => m.kind === 'attack');
  const total = pool.reduce((s, m) => s + Math.max(0, m.weight), 0);
  if (total <= 0) return pool[0] ?? enemy.def.moves[0];
  let r = rng() * total;
  for (const m of pool) {
    r -= Math.max(0, m.weight);
    if (r <= 0) return m;
  }
  return pool[pool.length - 1];
}

function applyEnemyMove(
  move: EnemyMove,
  enemyIn: EnemyActor,
  playerIn: PlayerActor,
  cfg: PlayerConfig,
  rng: () => number,
  events: BattleEvent[]
): { enemy: EnemyActor; player: PlayerActor } {
  let enemy = { ...enemyIn };
  let player = { ...playerIn };
  events.push({ type: 'log', text: move.log });

  const enemyAttack = (power: number) => {
    const res = computeBossAttack({
      attack: enemy.attack * enemy.attackMod * power,
      playerLevel: enemy.playerLevel,
      effective: cfg.stats,
      critChance: enemy.critChance,
      rng,
    });
    if (res.dodged) {
      events.push({ type: 'miss', target: 'player' });
      return;
    }
    let dmg = res.damage;
    if (player.guarding) dmg = Math.round(dmg * 0.55);
    dmg = Math.max(1, Math.round(dmg * cfg.damageTakenMult)); // knight passive
    // wake the player if asleep and hit
    player.statuses = wakeOnHit(player.statuses);
    player.hp = Math.max(0, player.hp - dmg);
    events.push({ type: 'damage', target: 'player', amount: dmg, crit: res.crit, weak: false, resist: false });
  };

  switch (move.kind) {
    case 'attack':
      enemyAttack(move.power ?? 1);
      break;
    case 'charge':
      // schedule the matching unleash (first unleash move) for next turn
      enemy.charged = enemy.def.moves.find((m) => m.kind === 'unleash') ?? {
        id: 'unleash', kind: 'unleash', weight: 0, power: (move.power ?? 1) * 2, log: 'こうげき!',
      };
      events.push({ type: 'charge' });
      break;
    case 'unleash':
      enemyAttack(move.power ?? 2);
      break;
    case 'buff':
      enemy.attackMod = Math.min(2, enemy.attackMod + 0.25);
      break;
    case 'debuff':
      player.attackMod = Math.max(0.5, player.attackMod - 0.2);
      break;
    case 'status':
      if (move.status && rng() < (move.statusChance ?? 1)) {
        const resisted = player.guarding && rng() < 0.3;
        if (!resisted) {
          player.statuses = applyStatus(player.statuses, move.status);
          events.push({ type: 'status', target: 'player', status: move.status });
        }
      }
      break;
    case 'gimmick':
      applyGimmick(enemy, player, events);
      break;
    case 'summon':
      // Summons are a later-chapter feature; degrade to a basic hit for now.
      enemyAttack(1);
      break;
  }
  return { enemy, player };
}

// Gimmick hook (docs 06 §5). Pure-state gimmicks are implemented here; the
// UI-heavy ones (fakeNotification / mirror / uiSleep) degrade to a small self
// buff so those fights stay playable until a later increment wires their
// presentation. Mutates the passed enemy/player copies in place.
function applyGimmick(enemy: EnemyActor, player: PlayerActor, events: BattleEvent[]): void {
  switch (enemy.def.gimmick) {
    case 'triTurnReset': // ch8: undo all resettable buffs/debuffs/statuses
      enemy.statuses = cleanseResettable(enemy.statuses);
      enemy.attackMod = 1;
      player.attackMod = 1;
      events.push({ type: 'log', text: 'すべてが なかったことに なった!' });
      break;
    case 'buffEater': // ch4: steal the player's edge
      enemy.attackMod = Math.min(2, enemy.attackMod + 0.25);
      player.attackMod = Math.max(0.5, player.attackMod - 0.15);
      break;
    case 'goldScatter': // ch5: rattle the player (cosmetic gold drain in the fiction)
      player.attackMod = Math.max(0.5, player.attackMod - 0.1);
      break;
    case 'darkening': // ch7: the fight gets darker, accuracy slips (stacks)
      player.attackMod = Math.max(0.4, player.attackMod - 0.1);
      break;
    case 'nullify': // ch11: "it's meaningless" — strips the player's power
      player.attackMod = Math.max(0.4, player.attackMod - 0.2);
      break;
    case 'selfBurn': // ch10: spend own HP to power up hard
      enemy.hp = Math.max(1, enemy.hp - Math.round(enemy.maxHp * 0.08));
      enemy.attackMod = Math.min(2.2, enemy.attackMod + 0.4);
      break;
    case 'fakeNotification': // ch3: pop a fake notification the player must ignore
      events.push({ type: 'fx', fx: 'fakeNotification' });
      break;
    case 'uiSleep': // ch12: the UI drifts to sleep (zzz)
      events.push({ type: 'fx', fx: 'uiSleep' });
      enemy.attackMod = Math.min(2, enemy.attackMod + 0.1);
      break;
    case 'mirror': // ch9: handled at battle setup (enemy copies the player)
    default:
      enemy.attackMod = Math.min(2, enemy.attackMod + 0.15);
      break;
  }
}

// ── Win / lose resolution ────────────────────────────────────────────────

function finishIfDead(state: BattleState, events: BattleEvent[]): StepResult {
  if (state.enemy.hp <= 0 && state.enemy.alive) {
    const enemy = { ...state.enemy, alive: false };
    if (enemy.def.quotes?.defeat) events.push({ type: 'log', text: enemy.def.quotes.defeat });
    events.push({ type: 'defeat', target: 'enemy' });
    events.push({ type: 'win' });
    return { state: { ...state, enemy, phase: 'won' }, events };
  }
  if (state.player.hp <= 0 && state.player.alive) {
    const player = { ...state.player, alive: false };
    events.push({ type: 'defeat', target: 'player' });
    events.push({ type: 'lose' });
    return { state: { ...state, player, phase: 'lost' }, events };
  }
  return { state, events };
}

// Re-export so tests/consumers don't reach into formulas.
export { CRIT_MULT };
