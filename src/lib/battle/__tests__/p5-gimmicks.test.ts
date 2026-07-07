import { describe, it, expect } from 'vitest';
import {
  createBattle, advance, playerAction, type PlayerConfig, type BattleState, type BattleEvent,
} from '../engine';
import type { EnemyDef } from '../../enemies/types';

const player: PlayerConfig = {
  name: 'P', level: 10, stats: { STR: 20, AGI: 15, INT: 10, VIT: 20, PER: 12 },
  maxHp: 200, primaryElement: 'go',
  skills: [{ id: 'basic', name: '斬', kind: 'attack', stat: 'STR', damageMultiplier: 1, healPct: 0, guaranteedCrit: false, critBonusFlat: 0, cooldown: 0 }],
  hasRevive: false, critBonus: 0, burnResist: 0,
  damageTakenMult: 1, atbBonus: 0, cooldownReduction: 0, firstStrikeBreak: 0, ultimatePower: 3.2, ultimateName: '奥義',
  nullifyResist: 0,
};

function enemy(p: Partial<EnemyDef>): EnemyDef {
  return {
    id: 'e', name: 'E', tier: 'lord', chapter: 1, element: 'ma', hpTurns: 30,
    breakGauge: 0, attack: 5, agility: 6, critChance: 0,
    moves: [{ id: 'a', kind: 'attack', weight: 1, power: 1, log: 'x' }],
    lore: '', loreAfter: '', ...p,
  };
}

const HALF = () => 0.5;

function collectUntilFx(state: BattleState, cfg: PlayerConfig): BattleEvent[] {
  let s = state;
  const all: BattleEvent[] = [];
  for (let i = 0; i < 4000; i++) {
    if (s.phase === 'ticking') {
      const r = advance(s, 5, cfg, HALF); s = r.state; all.push(...r.events);
    } else if (s.phase === 'awaiting-input') {
      const r = playerAction(s, { kind: 'attack' }, cfg, HALF); s = r.state; all.push(...r.events);
    } else break;
    if (all.some((e) => e.type === 'fx')) break;
  }
  return all;
}

describe('P5 gimmicks & actions', () => {
  it('mirror enemy copies the player element', () => {
    const s = createBattle({ player, shadows: [], enemy: enemy({ gimmick: 'mirror', element: 'shu' }) });
    expect(s.enemy.element).toBe(player.primaryElement); // 'go', not 'shu'
  });

  it('fakeNotification gimmick emits a fx event', () => {
    const e = enemy({ gimmick: 'fakeNotification', moves: [{ id: 'g', kind: 'gimmick', weight: 1, log: 'にせ通知!' }] });
    const events = collectUntilFx(createBattle({ player, shadows: [], enemy: e }), player);
    expect(events.some((ev) => ev.type === 'fx' && ev.fx === 'fakeNotification')).toBe(true);
  });

  it('uiSleep gimmick emits a fx event', () => {
    const e = enemy({ gimmick: 'uiSleep', moves: [{ id: 'g', kind: 'gimmick', weight: 1, log: 'zzz' }] });
    const events = collectUntilFx(createBattle({ player, shadows: [], enemy: e }), player);
    expect(events.some((ev) => ev.type === 'fx' && ev.fx === 'uiSleep')).toBe(true);
  });

  it('phoenix feather fires on a poison-tick death and emits a revive event', () => {
    const withFeather: PlayerConfig = { ...player, hasRevive: true };
    let s = createBattle({ player: withFeather, shadows: [], enemy: enemy({ attack: 1 }) });
    // poison the player and drop them to lethal-tick range
    s = {
      ...s,
      player: { ...s.player, hp: 3, statuses: [{ id: 'poison', turnsLeft: 3 }] },
    };
    let revived = false;
    for (let i = 0; i < 4000 && !revived; i++) {
      if (s.phase !== 'ticking') break;
      const r = advance(s, 5, withFeather, HALF);
      s = r.state;
      if (r.events.some((e) => e.type === 'revive')) revived = true;
    }
    expect(revived).toBe(true);
    expect(s.phase).not.toBe('lost');
    expect(s.player.hp).toBe(Math.round(withFeather.maxHp * 0.5));
    expect(s.player.reviveAvailable).toBe(false);
  });

  it('nullify drain is floored higher by medal resist', () => {
    const drained = (resist: number) => {
      const cfg: PlayerConfig = { ...player, nullifyResist: resist };
      const e = enemy({ gimmick: 'nullify', moves: [{ id: 'g', kind: 'gimmick', weight: 1, log: 'いみない' }] });
      let s = createBattle({ player: cfg, shadows: [], enemy: e });
      for (let i = 0; i < 6000; i++) {
        if (s.phase === 'awaiting-input') s = { ...s, phase: 'ticking', player: { ...s.player, atb: 0 } };
        else if (s.phase === 'ticking') s = advance(s, 5, cfg, HALF).state;
        else break;
        if (s.turnNumber >= 8) break; // enough gimmick turns to hit the floor
      }
      return s.player.attackMod;
    };
    expect(drained(0)).toBeCloseTo(0.4);       // no medals: full drain
    expect(drained(0.44)).toBeCloseTo(0.84);   // 11 medals: barely bites
  });

  it('wait action consumes the turn without acting', () => {
    // advance to the player's turn, then wait
    let s = createBattle({ player, shadows: [], enemy: enemy({ attack: 1 }) });
    for (let i = 0; i < 2000 && s.phase !== 'awaiting-input'; i++) s = advance(s, 5, player, HALF).state;
    expect(s.phase).toBe('awaiting-input');
    const hpBefore = s.enemy.hp;
    const r = playerAction(s, { kind: 'wait' }, player, HALF);
    expect(r.state.enemy.hp).toBe(hpBefore); // did no damage
    expect(r.state.phase).toBe('ticking');   // turn ended
    expect(r.events.some((e) => e.type === 'log')).toBe(true);
  });
});
