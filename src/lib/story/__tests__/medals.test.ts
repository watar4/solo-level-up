import { describe, it, expect } from 'vitest';
import { MEDALS, MEDAL_BY_CHAPTER, sumMedalPassive } from '../medals';

describe('medals', () => {
  it('has exactly one medal per chapter 1..12', () => {
    expect(MEDALS).toHaveLength(12);
    for (let c = 1; c <= 12; c++) {
      expect(MEDAL_BY_CHAPTER[c]).toBeDefined();
    }
  });

  it('sums a passive across owned medals and ignores unrelated ones', () => {
    // hayaoki (+5% morning) is the only morningQuestExp source.
    expect(sumMedalPassive(['hayaoki', 'undou'], 'morningQuestExp')).toBeCloseTo(0.05);
    expect(sumMedalPassive(['undou'], 'morningQuestExp')).toBe(0);
  });

  it('ignores unknown ids without throwing', () => {
    // @ts-expect-error intentionally passing a bad id to test robustness
    expect(sumMedalPassive(['nope'], 'allExp')).toBe(0);
  });

  it('handles add-style passives (crit chance)', () => {
    expect(sumMedalPassive(['homeru'], 'critChance')).toBeCloseTo(0.03);
  });
});
