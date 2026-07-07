import { describe, it, expect } from 'vitest';
import {
  tickStatuses,
  applyStatus,
  cleanseResettable,
  wakeOnHit,
  attackModifierFromStatuses,
  damageTakenModifier,
  type ActiveStatus,
} from '../status';

describe('status ailments', () => {
  it('poison and burn deal proportional damage and count down', () => {
    const statuses: ActiveStatus[] = [
      { id: 'poison', turnsLeft: 3 },
      { id: 'burn', turnsLeft: 2 },
    ];
    const r = tickStatuses(statuses, 100, () => 0.99);
    // poison 5% + burn 3% of 100
    expect(r.damage).toBe(8);
    expect(r.skipTurn).toBe(false);
    const ids = r.statuses.map((s) => s.id).sort();
    expect(ids).toEqual(['burn', 'poison']);
    expect(r.statuses.find((s) => s.id === 'poison')!.turnsLeft).toBe(2);
  });

  it('sleep skips the turn', () => {
    const r = tickStatuses([{ id: 'sleep', turnsLeft: 5 }], 100);
    expect(r.skipTurn).toBe(true);
  });

  it('paralyze skips only when the roll lands', () => {
    const hit = tickStatuses([{ id: 'paralyze', turnsLeft: 3 }], 100, () => 0.1);
    const miss = tickStatuses([{ id: 'paralyze', turnsLeft: 3 }], 100, () => 0.9);
    expect(hit.skipTurn).toBe(true);
    expect(miss.skipTurn).toBe(false);
  });

  it('a status expires when its last turn ticks off', () => {
    const r = tickStatuses([{ id: 'poison', turnsLeft: 1 }], 100, () => 0.99);
    expect(r.statuses).toHaveLength(0);
  });

  it('burn lowers attack; mark raises damage taken', () => {
    expect(attackModifierFromStatuses([{ id: 'burn', turnsLeft: 2 }])).toBeCloseTo(0.85);
    expect(attackModifierFromStatuses([])).toBe(1);
    expect(damageTakenModifier([{ id: 'mark', turnsLeft: 8 }])).toBeCloseTo(1.2);
  });

  it('applyStatus refreshes duration instead of stacking', () => {
    let s: ActiveStatus[] = [{ id: 'poison', turnsLeft: 1 }];
    s = applyStatus(s, 'poison', 3);
    expect(s).toHaveLength(1);
    expect(s[0].turnsLeft).toBe(3);
  });

  it('cleanseResettable removes ailments but keeps mark (ch8 counter)', () => {
    const s: ActiveStatus[] = [
      { id: 'poison', turnsLeft: 2 },
      { id: 'mark', turnsLeft: 8 },
      { id: 'burn', turnsLeft: 2 },
    ];
    const after = cleanseResettable(s);
    expect(after.map((x) => x.id)).toEqual(['mark']);
  });

  it('wakeOnHit clears sleep only', () => {
    const s: ActiveStatus[] = [
      { id: 'sleep', turnsLeft: 5 },
      { id: 'poison', turnsLeft: 2 },
    ];
    expect(wakeOnHit(s).map((x) => x.id)).toEqual(['poison']);
  });
});
