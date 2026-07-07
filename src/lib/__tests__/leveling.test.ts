import { describe, it, expect } from 'vitest';
import { expForLevel, applyExp, levelFromTotalExp } from '../leveling';

function cumulativeExpTo(level: number): number {
  let total = 0;
  for (let l = 1; l < level; l++) total += expForLevel(l);
  return total;
}

describe('leveling curve reslope', () => {
  it('is strictly increasing per level', () => {
    for (let l = 1; l < 80; l++) {
      expect(expForLevel(l + 1)).toBeGreaterThan(expForLevel(l));
    }
  });

  it('lands Lv60 near the ~340k design target (docs 03 §8-2)', () => {
    const total = cumulativeExpTo(60);
    // ~1 year at ~750 EXP/day. Guard a generous band around the design value.
    expect(total).toBeGreaterThan(280_000);
    expect(total).toBeLessThan(400_000);
  });

  it('applyExp and levelFromTotalExp agree (single source of truth)', () => {
    // Simulate a chunky lifetime and check the reverse derivation matches.
    let level = 1, exp = 0, totalExp = 0;
    const grants = [10, 250, 1000, 5000, 25_000, 100_000, 40_000];
    for (const g of grants) {
      const r = applyExp(level, exp, totalExp, g);
      level = r.level; exp = r.exp; totalExp = r.totalExp;
    }
    const derived = levelFromTotalExp(totalExp);
    expect(derived.level).toBe(level);
    expect(derived.exp).toBe(exp);
  });

  it('is data-safe: an existing lifetime EXP re-derives without loss', () => {
    // A pre-reslope player with, say, 120k lifetime EXP just recomputes to a
    // consistent (level, exp) pair — the invariant we rely on for migration.
    const totalExp = 123_456;
    const { level, exp } = levelFromTotalExp(totalExp);
    expect(cumulativeExpTo(level) + exp).toBe(totalExp);
    expect(exp).toBeLessThan(expForLevel(level));
  });
});
