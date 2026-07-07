import { describe, it, expect } from 'vitest';
import {
  ELEMENTS,
  affinity,
  affinityMultiplier,
  weaknessOf,
  resistOf,
  ELEMENT_TO_STAT,
  STAT_TO_ELEMENT,
} from '../elements';

describe('five-element cycle', () => {
  it('every element beats exactly one and is beaten by exactly one', () => {
    for (const e of ELEMENTS) {
      const beatsCount = ELEMENTS.filter((d) => affinity(e, d) === 'weak').length;
      const beatenCount = ELEMENTS.filter((a) => affinity(a, e) === 'weak').length;
      expect(beatsCount).toBe(1);
      expect(beatenCount).toBe(1);
    }
  });

  it('an element is neutral against itself', () => {
    for (const e of ELEMENTS) {
      expect(affinity(e, e)).toBe('neutral');
    }
  });

  it('weaknessOf / resistOf are inverse views of the cycle', () => {
    for (const e of ELEMENTS) {
      // The element that beats `e` is `e`'s weakness.
      expect(affinity(weaknessOf(e), e)).toBe('weak');
      // The element `e` beats is what `e` resists (attacks it back weakly).
      expect(affinity(e, resistOf(e))).toBe('weak');
      expect(affinity(resistOf(e), e)).toBe('resist');
    }
  });

  it('multipliers follow the design (1.5 / 0.6 / 1.0)', () => {
    expect(affinityMultiplier('go', 'jin')).toBeCloseTo(1.5); // go beats jin
    expect(affinityMultiplier('jin', 'go')).toBeCloseTo(0.6); // jin resisted by go
    expect(affinityMultiplier('go', 'ma')).toBeCloseTo(1.0);  // neutral
  });

  it('stat <-> element mapping is a bijection', () => {
    for (const e of ELEMENTS) {
      expect(STAT_TO_ELEMENT[ELEMENT_TO_STAT[e]]).toBe(e);
    }
  });
});
