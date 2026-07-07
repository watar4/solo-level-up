import { describe, it, expect } from 'vitest';
import {
  createBattle, advance, setTactic, type PlayerConfig, type ShadowConfig, type BattleState, type BattleEvent,
} from '../engine';
import { shadowRole } from '../../shadows';
import type { EnemyDef } from '../../enemies/types';

const player: PlayerConfig = {
  name: 'P', level: 10, stats: { STR: 15, AGI: 15, INT: 15, VIT: 15, PER: 15 },
  maxHp: 200, primaryElement: 'go',
  skills: [{ id: 'b', name: '斬', kind: 'attack', stat: 'STR', damageMultiplier: 1, healPct: 0, guaranteedCrit: false, critBonusFlat: 0, cooldown: 0 }],
  hasRevive: false, critBonus: 0, burnResist: 0,
  damageTakenMult: 1, atbBonus: 0, cooldownReduction: 0, firstStrikeBreak: 0, ultimatePower: 3.2, ultimateName: 'x',
};
function enemy(p: Partial<EnemyDef> = {}): EnemyDef {
  return { id: 'e', name: 'E', tier: 'lord', chapter: 1, element: 'ma', hpTurns: 40, breakGauge: 6, attack: 3, agility: 4, critChance: 0,
    moves: [{ id: 'a', kind: 'attack', weight: 1, power: 1, log: 'x' }], lore: '', loreAfter: '', ...p };
}
const shadow = (id: string, element: ShadowConfig['element'], role: ShadowConfig['role']): ShadowConfig => ({ id, name: id, element, attack: 20, speed: 12, role });
const HALF = () => 0.5;

// Run a few shadow turns and collect events (player never acts here).
function runShadows(state: BattleState): { state: BattleState; events: BattleEvent[] } {
  let s = state;
  const events: BattleEvent[] = [];
  for (let i = 0; i < 400; i++) {
    if (s.phase !== 'ticking') break;
    const r = advance(s, 5, player, HALF);
    // if it's the player's turn, nudge past it by faking a wait-like no-op:
    if (r.state.phase === 'awaiting-input') { s = { ...r.state, phase: 'ticking', player: { ...r.state.player, atb: 0 } }; continue; }
    s = r.state; events.push(...r.events);
    if (events.filter((e) => e.type === 'log').length > 6) break;
  }
  return { state: s, events };
}

describe('shadow roles & tactics', () => {
  it('role derives from primary stat', () => {
    expect(shadowRole('VIT')).toBe('healer');
    expect(shadowRole('INT')).toBe('support');
    expect(shadowRole('STR')).toBe('attacker');
  });

  it('heal tactic: a healer mends when the player is low', () => {
    let s = createBattle({ player, shadows: [shadow('h', 'go', 'healer')], enemy: enemy() });
    s = setTactic(s, 'heal');
    s = { ...s, player: { ...s.player, hp: 40 } }; // low
    const { events } = runShadows(s);
    expect(events.some((e) => e.type === 'heal' && e.target === 'player')).toBe(true);
  });

  it('support tactic: a support shadow weakens the enemy attack', () => {
    let s = createBattle({ player, shadows: [shadow('s', 'go', 'support')], enemy: enemy() });
    s = setTactic(s, 'support');
    const before = s.enemy.attackMod;
    const { state } = runShadows(s);
    expect(state.enemy.attackMod).toBeLessThan(before);
  });

  it('break tactic: only weakness-element shadows act; others wait', () => {
    // enemy element ma → weakness is shin (PER). A go-element shadow is NOT weak.
    let s = createBattle({ player, shadows: [shadow('g', 'go', 'attacker')], enemy: enemy({ element: 'ma' }) });
    s = setTactic(s, 'break');
    const { events } = runShadows(s);
    expect(events.some((e) => e.type === 'log' && e.text.includes('待機'))).toBe(true);
    // and it dealt no damage to the enemy
    expect(events.some((e) => e.type === 'damage' && e.target === 'enemy')).toBe(false);
  });

  it('attack tactic: shadows always strike', () => {
    let s = createBattle({ player, shadows: [shadow('a', 'jin', 'attacker')], enemy: enemy() });
    s = setTactic(s, 'attack');
    const { events } = runShadows(s);
    expect(events.some((e) => e.type === 'damage' && e.target === 'enemy')).toBe(true);
  });
});
