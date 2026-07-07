import { describe, it, expect } from 'vitest';
import type { Character, StatKey } from '../../../types';
import { CHAPTERS } from '../../story/chapters';
import { getEnemy, ALL_ENEMIES } from '../../enemies/registry';
import { classStatBonus } from '../../jobs';
import { buildPlayerConfig } from '../loadout';
import { createBattle, advance, playerAction, ULTIMATE_READY, type BattleState } from '../engine';
import { weaknessOf, ELEMENT_TO_STAT } from '../elements';
import type { EnemyDef } from '../../enemies/types';

// Deterministic RNG so win-rates are reproducible across CI runs.
function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A plausible mid-progression hunter at a given level: even stat allocation
// (~+1/level/stat) plus derived class growth, default skills.
function hunterAt(level: number): { character: Character; eff: Record<StatKey, number> } {
  const per = level - 1;
  const stats: Record<StatKey, number> = { STR: 10 + per, AGI: 10 + per, INT: 10 + per, VIT: 10 + per, PER: 10 + per };
  const character: Character = {
    uid: 't', name: '勇者', level, exp: 0, totalExp: 0, stats,
    statPoints: 0, createdAt: 0, lastSeenAt: 0,
    appearance: { hunterClass: 'knight', primaryColor: '#fff', accentColor: '#000' },
    job: { base: 'knight' },
  };
  const growth = classStatBonus(character);
  const eff: Record<StatKey, number> = { ...stats };
  (Object.keys(eff) as StatKey[]).forEach((k) => { eff[k] += growth[k] ?? 0; });
  return { character, eff };
}

function simulate(enemy: EnemyDef, level: number, seed: number, naive = false, maxTurnsCap = 200): { won: boolean; turns: number } {
  const { character, eff } = hunterAt(Math.max(1, level));
  const cfg = buildPlayerConfig(character, eff, []);
  const rng = mulberry32(seed);
  // Competent policy: heal when low, exploit the weakness element, spend the
  // ultimate when charged, otherwise the strongest ready attack. Naive policy:
  // basic attack only (models an unprepared player).
  const weakStat = ELEMENT_TO_STAT[weaknessOf(enemy.element)];
  let s: BattleState = createBattle({ player: cfg, shadows: [], enemy });
  let acts = 0;
  const ready = (id: string) => (s.player.cooldowns[id] ?? 0) === 0;
  for (let i = 0; i < 20000 && s.phase !== 'won' && s.phase !== 'lost'; i++) {
    if (s.phase === 'ticking') { s = advance(s, 5, cfg, rng).state; continue; }
    acts++;
    if (naive) {
      s = playerAction(s, { kind: 'attack' }, cfg, rng).state;
    } else {
      const low = s.player.hp / s.player.maxHp < 0.35;
      const heal = cfg.skills.find((sk) => sk.kind === 'heal' && ready(sk.id));
      const weak = cfg.skills.find((sk) => sk.kind === 'attack' && sk.stat === weakStat && ready(sk.id));
      const best = cfg.skills
        .filter((sk) => sk.kind === 'attack' && ready(sk.id))
        .sort((a, b) => b.damageMultiplier - a.damageMultiplier)[0];
      if (low && heal) s = playerAction(s, { kind: 'skill', skillId: heal.id }, cfg, rng).state;
      else if (s.ultimate >= ULTIMATE_READY) s = playerAction(s, { kind: 'ultimate' }, cfg, rng).state;
      else if (weak) s = playerAction(s, { kind: 'skill', skillId: weak.id }, cfg, rng).state;
      else if (best) s = playerAction(s, { kind: 'skill', skillId: best.id }, cfg, rng).state;
      else s = playerAction(s, { kind: 'attack' }, cfg, rng).state;
    }
    if (acts > maxTurnsCap) break;
  }
  return { won: s.phase === 'won', turns: s.turnNumber };
}

const SEEDS = [1, 7, 13, 42, 99, 123, 777, 2024];

describe('balance — chapter lords', () => {
  it('a prepared hunter (recommended Lv +3) reliably clears every lord', () => {
    for (const ch of CHAPTERS) {
      const lord = getEnemy(ch.lordId)!;
      const wins = SEEDS.filter((seed) => simulate(lord, ch.recommendedLevel + 3, seed).won).length;
      const rate = wins / SEEDS.length;
      expect(rate, `lord ${ch.lordId} (ch${ch.id}) win-rate ${rate}`).toBeGreaterThanOrEqual(0.6);
    }
  });

  it('under-prepared play is punished (challenge exists)', () => {
    // Naive attack-spam, under-levelled: aggregate win-rate must leave real
    // risk — under-preparation should frequently lose (design: lords are a
    // multi-day, come-back-stronger fight).
    let wins = 0, total = 0;
    for (const ch of CHAPTERS) {
      const lord = getEnemy(ch.lordId)!;
      for (const seed of SEEDS) { total++; if (simulate(lord, ch.recommendedLevel - 6, seed, true).won) wins++; }
    }
    const rate = wins / total;
    expect(rate).toBeLessThanOrEqual(0.85); // under-levelled button-mashing frequently loses
  });
});

describe('balance — mob tempo', () => {
  it('mobs fall quickly for a recommended-level hunter (≤ 8 player turns avg)', () => {
    const byChapter = new Map<number, number>();
    CHAPTERS.forEach((c) => byChapter.set(c.id, c.recommendedLevel));
    const mobs = ALL_ENEMIES.filter((e) => e.tier === 'mob');
    let totalTurns = 0, count = 0;
    for (const mob of mobs) {
      const lvl = byChapter.get(mob.chapter) ?? 5;
      const r = simulate(mob, lvl, 42);
      expect(r.won, `mob ${mob.id} should be winnable`).toBe(true);
      totalTurns += r.turns; count++;
    }
    expect(totalTurns / count).toBeLessThanOrEqual(8);
  });
});
