import { describe, it, expect } from 'vitest';
import type { Character, StatKey } from '../../../types';
import { buildPlayerConfig, buildShadowConfigs } from '../loadout';
import { getEnemy } from '../../enemies/registry';
import { createBattle, advance, playerAction, type BattleState } from '../engine';

// End-to-end pipeline check using the REAL chapter-1 lord data + the real
// loadout builder (which pulls in playerMaxHp, battle skills, medals). Verifies
// the whole chain a player actually walks: character → config → live battle.

function makeCharacter(level: number, stat: number): Character {
  const stats: Record<StatKey, number> = { STR: stat, AGI: stat, INT: stat, VIT: stat, PER: stat };
  return {
    uid: 't', name: '勇者', level, exp: 0, totalExp: 0,
    stats, statPoints: 0, createdAt: 0, lastSeenAt: 0,
    appearance: { hunterClass: 'knight', primaryColor: '#fff', accentColor: '#000' },
  };
}

function play(initial: BattleState, cfg: ReturnType<typeof buildPlayerConfig>): BattleState {
  let s = initial;
  for (let i = 0; i < 5000; i++) {
    if (s.phase === 'won' || s.phase === 'lost') break;
    if (s.phase === 'ticking') {
      s = advance(s, 5, cfg).state;
    } else if (s.phase === 'awaiting-input') {
      // Prefer the PER weakness skill vs Suyarin (ma → weak shin), else attack.
      const per = cfg.skills.find((sk) => sk.kind === 'attack' && sk.stat === 'PER');
      const cd = per ? s.player.cooldowns[per.id] ?? 0 : 1;
      s = per && cd === 0
        ? playerAction(s, { kind: 'skill', skillId: per.id }, cfg).state
        : playerAction(s, { kind: 'attack' }, cfg).state;
    }
  }
  return s;
}

describe('chapter 1 lord — real data pipeline', () => {
  it('a well-built hunter defeats まくら大公スヤリン', () => {
    const character = makeCharacter(20, 30);
    const cfg = buildPlayerConfig(character, character.stats, []);
    const suyarin = getEnemy('suyarin');
    expect(suyarin).toBeDefined();

    const battle = createBattle({ player: cfg, shadows: buildShadowConfigs([]), enemy: suyarin! });
    const end = play(battle, cfg);
    expect(end.phase).toBe('won');
  });

  it('an underpowered hunter can lose to the lord', () => {
    const character = makeCharacter(1, 1);
    const cfg = buildPlayerConfig(character, character.stats, []);
    const suyarin = getEnemy('suyarin')!;
    const end = play(createBattle({ player: cfg, shadows: [], enemy: suyarin }), cfg);
    // Not asserting a guaranteed loss (RNG), but the battle must resolve.
    expect(['won', 'lost']).toContain(end.phase);
  });

  it('the lord config carries 2 phases and a break gauge', () => {
    const suyarin = getEnemy('suyarin')!;
    expect(suyarin.phases).toBe(2);
    expect(suyarin.breakGauge).toBeGreaterThan(0);
  });
});
