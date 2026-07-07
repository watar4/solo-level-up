import { describe, it, expect } from 'vitest';
import {
  createBattle,
  advance,
  playerAction,
  enemyMaxHp,
  type PlayerConfig,
  type BattleState,
  type BattleEvent,
} from '../engine';
import type { EnemyDef } from '../../enemies/types';

const basePlayer: PlayerConfig = {
  name: 'テスト',
  level: 5,
  stats: { STR: 12, AGI: 10, INT: 6, VIT: 10, PER: 8 },
  maxHp: 120,
  primaryElement: 'go', // STR
  skills: [
    { id: 'basic-strike', name: '斬撃', kind: 'attack', stat: 'STR', damageMultiplier: 1, healPct: 0, guaranteedCrit: false, critBonusFlat: 0, cooldown: 1 },
    { id: 'restore', name: '治癒', kind: 'heal', stat: 'VIT', damageMultiplier: 0, healPct: 0.25, guaranteedCrit: false, critBonusFlat: 0, cooldown: 3 },
  ],
  hasRevive: false,
  critBonus: 0,
  burnResist: 0,
};

function enemy(partial: Partial<EnemyDef>): EnemyDef {
  return {
    id: 'dummy', name: 'ダミー', tier: 'mob', chapter: 1,
    element: 'jin', hpTurns: 3, breakGauge: 0, attack: 6, agility: 6, critChance: 0,
    moves: [{ id: 'hit', kind: 'attack', weight: 1, power: 1, log: 'こうげき!' }],
    lore: '', loreAfter: '',
    ...partial,
  };
}

const HALF = () => 0.5;

// Run advance() until the player must act or the battle ends.
function runToPlayer(state: BattleState, cfg: PlayerConfig, rng = HALF): { state: BattleState; events: BattleEvent[] } {
  let s = state;
  const events: BattleEvent[] = [];
  for (let i = 0; i < 10000 && s.phase === 'ticking'; i++) {
    const r = advance(s, 5, cfg, rng);
    s = r.state;
    events.push(...r.events);
  }
  return { state: s, events };
}

describe('battle engine', () => {
  it('sizes enemy HP from hpTurns and player power', () => {
    const weak = enemyMaxHp(enemy({ hpTurns: 3 }), basePlayer, 0);
    const tanky = enemyMaxHp(enemy({ hpTurns: 9 }), basePlayer, 0);
    expect(weak).toBeGreaterThan(0);
    expect(tanky).toBeGreaterThan(weak * 2.5);
  });

  it('a weakness hit deals more than a resisted hit', () => {
    // player element 'go' beats 'jin' (weak) and is resisted by 'shu'.
    const vsWeak = createBattle({ player: basePlayer, shadows: [], enemy: enemy({ element: 'jin', hpTurns: 50 }) });
    const vsResist = createBattle({ player: basePlayer, shadows: [], enemy: enemy({ element: 'shu', hpTurns: 50 }) });

    const w = runToPlayer(vsWeak, basePlayer);
    const r = runToPlayer(vsResist, basePlayer);
    expect(w.state.phase).toBe('awaiting-input');

    const afterW = playerAction(w.state, { kind: 'attack' }, basePlayer, HALF);
    const afterR = playerAction(r.state, { kind: 'attack' }, basePlayer, HALF);
    const dmgW = afterW.events.find((e) => e.type === 'damage' && e.target === 'enemy') as Extract<BattleEvent, { type: 'damage' }>;
    const dmgR = afterR.events.find((e) => e.type === 'damage' && e.target === 'enemy') as Extract<BattleEvent, { type: 'damage' }>;
    expect(dmgW.weak).toBe(true);
    expect(dmgR.resist).toBe(true);
    expect(dmgW.amount).toBeGreaterThan(dmgR.amount);
  });

  it('player can win by attacking a weak, harmless enemy', () => {
    // enemy that never meaningfully hurts a 120 HP player over the fight.
    let s = createBattle({ player: basePlayer, shadows: [], enemy: enemy({ element: 'jin', hpTurns: 3, attack: 1 }) });
    for (let turn = 0; turn < 40 && s.phase !== 'won' && s.phase !== 'lost'; turn++) {
      const r = runToPlayer(s, basePlayer);
      s = r.state;
      if (s.phase === 'awaiting-input') {
        s = playerAction(s, { kind: 'attack' }, basePlayer, HALF).state;
      }
    }
    expect(s.phase).toBe('won');
  });

  it('breaks a weakness-vulnerable enemy that has a gauge', () => {
    let s = createBattle({ player: basePlayer, shadows: [], enemy: enemy({ element: 'jin', hpTurns: 50, breakGauge: 2, attack: 1 }) });
    let broke = false;
    for (let turn = 0; turn < 6 && !broke; turn++) {
      const r = runToPlayer(s, basePlayer);
      s = r.state;
      if (s.phase === 'awaiting-input') {
        const act = playerAction(s, { kind: 'attack' }, basePlayer, HALF);
        s = act.state;
        if (act.events.some((e) => e.type === 'break')) broke = true;
      }
    }
    expect(broke).toBe(true);
  });

  it('a strong enemy can defeat the player (lose state)', () => {
    const glass: PlayerConfig = { ...basePlayer, maxHp: 8, stats: { ...basePlayer.stats, PER: 0 } };
    let s = createBattle({ player: glass, shadows: [], enemy: enemy({ element: 'shu', hpTurns: 99, attack: 40, agility: 14 }) });
    for (let turn = 0; turn < 60 && s.phase !== 'won' && s.phase !== 'lost'; turn++) {
      const r = runToPlayer(s, glass);
      s = r.state;
      if (s.phase === 'awaiting-input') s = playerAction(s, { kind: 'guard' }, glass, HALF).state;
    }
    expect(s.phase).toBe('lost');
  });

  it('heal skill restores HP and respects the ultimate gauge gain', () => {
    let s = createBattle({ player: basePlayer, shadows: [], enemy: enemy({ hpTurns: 99, attack: 1 }) });
    s = runToPlayer(s, basePlayer).state;
    // damage the player first via a direct state tweak
    s = { ...s, player: { ...s.player, hp: 40 } };
    const healed = playerAction(s, { kind: 'skill', skillId: 'restore' }, basePlayer, HALF);
    const heal = healed.events.find((e) => e.type === 'heal') as Extract<BattleEvent, { type: 'heal' }>;
    expect(heal.amount).toBe(Math.round(basePlayer.maxHp * 0.25));
    expect(healed.state.player.hp).toBe(40 + heal.amount);
    expect(healed.state.ultimate).toBeGreaterThan(0);
  });
});
