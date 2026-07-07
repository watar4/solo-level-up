// Combat damage maths — element-based reimplementation of the coefficients from
// the original boss.ts, decoupled from BossDef so the engine works on the new
// EnemyDef/Element model. Same numbers, so balance carries over.

import type { StatKey } from '../../types';
import { affinityMultiplier, type Element } from './elements';

export const ATB_TARGET = 100;
export const CRIT_MULTIPLIER_EXPORT = 1.75;
const CRIT = CRIT_MULTIPLIER_EXPORT;

export function critChanceFromINT(INT: number): number {
  return Math.min(0.3, INT * 0.005);
}
export function dodgeChance(PER: number): number {
  return Math.min(0.18, PER * 0.003);
}
export function critAvoidChance(PER: number): number {
  return Math.min(0.12, PER * 0.002);
}

export interface PlayerAttackResult {
  damage: number;
  crit: boolean;
}

export function computePlayerAttack(args: {
  stat: StatKey;
  damageMultiplier: number;
  effective: Record<StatKey, number>;
  enemyElement: Element;
  attackElement: Element;
  guaranteedCrit?: boolean;
  critBonusFlat?: number;
  rng?: () => number;
}): PlayerAttackResult {
  const rng = args.rng ?? Math.random;
  const mult = affinityMultiplier(args.attackElement, args.enemyElement);
  const variance = 0.85 + rng() * 0.3;
  const statValue = args.effective[args.stat] ?? 0;
  const base = statValue + 4;

  let crit = false;
  if (args.guaranteedCrit) {
    crit = true;
  } else {
    const baseCrit = critChanceFromINT(args.effective.INT ?? 0);
    crit = rng() < Math.min(1, baseCrit + (args.critBonusFlat ?? 0));
  }
  const critMult = crit ? CRIT : 1;
  const strMult = 1 + (args.effective.STR ?? 0) * 0.01;
  const damage = Math.max(
    1,
    Math.round(base * strMult * mult * critMult * variance * args.damageMultiplier)
  );
  return { damage, crit };
}

export interface BossAttackResult {
  damage: number;
  dodged: boolean;
  crit: boolean;
}

export function computeBossAttack(args: {
  attack: number;        // already includes any move-power / self-buff multiplier
  playerLevel: number;
  effective: Record<StatKey, number>;
  critChance?: number;
  rng?: () => number;
}): BossAttackResult {
  const rng = args.rng ?? Math.random;
  const variance = 0.85 + rng() * 0.3;

  if (rng() < dodgeChance(args.effective.PER ?? 0)) {
    return { damage: 0, dodged: true, crit: false };
  }
  let critRoll = rng() < (args.critChance ?? 0);
  if (critRoll && rng() < critAvoidChance(args.effective.PER ?? 0)) critRoll = false;
  const critMult = critRoll ? CRIT : 1;
  const base = args.attack + args.playerLevel * 0.5;
  const damage = Math.max(1, Math.round(base * critMult * variance));
  return { damage, dodged: false, crit: critRoll };
}
