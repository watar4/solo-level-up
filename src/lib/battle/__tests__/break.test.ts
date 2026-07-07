import { describe, it, expect } from 'vitest';
import {
  initBreak,
  breakDamage,
  chipBreak,
  tickBreak,
  damageMultiplierWhileBroken,
  BREAK_STUN_TURNS,
  BREAK_REGEN_DELAY_TURNS,
} from '../break';

describe('break gauge', () => {
  it('only weakness hits chip the gauge', () => {
    expect(breakDamage(false)).toBe(0);
    expect(breakDamage(true)).toBe(1);
    expect(breakDamage(true, true)).toBe(2);
  });

  it('enemies with no gauge never break', () => {
    const s = initBreak(0);
    const r = chipBreak(s, 5);
    expect(r.justBroke).toBe(false);
    expect(r.state.broken).toBe(false);
  });

  it('breaks when the gauge empties and grants the bonus multiplier', () => {
    let s = initBreak(2);
    let r = chipBreak(s, 1);
    expect(r.justBroke).toBe(false);
    s = r.state;
    r = chipBreak(s, 1);
    expect(r.justBroke).toBe(true);
    expect(r.state.broken).toBe(true);
    expect(damageMultiplierWhileBroken(r.state)).toBeCloseTo(1.5);
  });

  it('a broken enemy is stunned, then regenerates its gauge', () => {
    let s = initBreak(2);
    s = chipBreak(s, 2).state; // broken, stun=1, regen=2
    expect(s.stunTurnsLeft).toBe(BREAK_STUN_TURNS);
    expect(s.regenCooldown).toBe(BREAK_REGEN_DELAY_TURNS);

    // turn 1: consume the stun
    let t = tickBreak(s);
    expect(t.stunned).toBe(true);
    expect(t.state.broken).toBe(true);
    s = t.state;

    // regen countdown turns: not stunned, still broken
    t = tickBreak(s); expect(t.stunned).toBe(false); expect(t.state.broken).toBe(true); s = t.state;
    t = tickBreak(s); expect(t.stunned).toBe(false); expect(t.state.broken).toBe(true); s = t.state;

    // final tick: gauge restored, no longer broken
    t = tickBreak(s);
    expect(t.state.broken).toBe(false);
    expect(t.state.current).toBe(t.state.max);
  });

  it('a chip cannot break an already-broken enemy again', () => {
    let s = initBreak(1);
    s = chipBreak(s, 1).state;
    const r = chipBreak(s, 5);
    expect(r.justBroke).toBe(false);
  });
});
