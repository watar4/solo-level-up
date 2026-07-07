import type { Element } from '../battle/elements';
import type { StatusId } from '../battle/status';
import type { EnemyDef, EnemyMove, EnemyShape, EnemyTier, GimmickId } from './types';

// Compact move constructors. ids need not be unique (the engine keys behaviour
// on `kind`, not `id`), so these stay terse.
export const mv = {
  atk: (weight: number, power = 1, log = 'こうげき!'): EnemyMove => ({ id: 'a', kind: 'attack', weight, power, log }),
  charge: (weight: number, log = 'ちからを ためている…'): EnemyMove => ({ id: 'c', kind: 'charge', weight, log }),
  unleash: (power: number, log = 'はなった!'): EnemyMove => ({ id: 'u', kind: 'unleash', weight: 0, power, log }),
  buff: (weight: number, log = 'みがまえた!'): EnemyMove => ({ id: 'b', kind: 'buff', weight, log }),
  debuff: (weight: number, log = 'よわらせてきた!'): EnemyMove => ({ id: 'd', kind: 'debuff', weight, log }),
  status: (weight: number, status: StatusId, chance: number, log: string): EnemyMove => ({ id: 's', kind: 'status', weight, status, statusChance: chance, log }),
  gimmick: (weight: number, log: string): EnemyMove => ({ id: 'g', kind: 'gimmick', weight, log }),
  // phase2-gated — only meaningful on lords (the factory gives phases:2 to
  // lords only). For non-lords use `enrage` (HP<50%) instead.
  p2: (weight: number, power: number, log: string): EnemyMove => ({ id: 'p2', kind: 'attack', weight, power, condition: 'phase2', log }),
  enrage: (weight: number, power: number, log: string): EnemyMove => ({ id: 'e', kind: 'attack', weight, power, condition: 'hpBelow50', log }),
  opening: (weight: number, power: number, log: string): EnemyMove => ({ id: 'o', kind: 'attack', weight, power, condition: 'opening', log }),
};

interface EnemyOpts {
  moves: EnemyMove[];
  lore: string;
  loreAfter: string;
  shape: EnemyShape;
  gimmick?: GimmickId;
  quotes?: EnemyDef['quotes'];
  hpTurns?: number;
  breakGauge?: number;
  attack?: number;
  agility?: number;
  critChance?: number;
}

// Per-chapter builder: fills tier-appropriate defaults, scaling per-hit attack
// with the chapter so fights stay threatening as the player levels (HP is
// derived from player power via hpTurns, so it needs no chapter scaling).
export function makeChapter(chapter: number) {
  const atk = (t: EnemyTier) =>
    t === 'mob' ? 4 + Math.round(chapter * 1.3)
      : t === 'elite' ? 6 + Math.round(chapter * 2.1)
        : 8 + Math.round(chapter * 2.6);
  // hpTurns = "turns of the player's full output". Tuned against the HP/damage
  // curve so an attack-spam floor wins with margin at recommended+3, while real
  // play (guard/heal/items/shadows) makes it comfortable earlier.
  const hp = (t: EnemyTier) => (t === 'mob' ? 3 : t === 'elite' ? 6 : 10);
  const brk = (t: EnemyTier) => (t === 'mob' ? 0 : t === 'elite' ? 4 : 6);
  const ag = (t: EnemyTier) => (t === 'mob' ? 8 : t === 'elite' ? 6 : 9);

  const build = (tier: EnemyTier, id: string, name: string, element: Element, o: EnemyOpts): EnemyDef => ({
    id, name, tier, chapter, element,
    hpTurns: o.hpTurns ?? hp(tier),
    breakGauge: o.breakGauge ?? brk(tier),
    attack: o.attack ?? atk(tier),
    agility: o.agility ?? ag(tier),
    critChance: o.critChance ?? (tier === 'lord' ? 0.1 : 0.05),
    moves: o.moves,
    phases: tier === 'lord' ? 2 : undefined,
    gimmick: o.gimmick,
    shape: o.shape,
    lore: o.lore,
    loreAfter: o.loreAfter,
    quotes: o.quotes,
  });

  return {
    mob: (id: string, name: string, el: Element, o: EnemyOpts) => build('mob', id, name, el, o),
    elite: (id: string, name: string, el: Element, o: EnemyOpts) => build('elite', id, name, el, o),
    lord: (id: string, name: string, el: Element, o: EnemyOpts) => build('lord', id, name, el, o),
  };
}
