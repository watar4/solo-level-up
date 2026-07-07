// Break gauge — docs/redesign/03-battle-system.md §5.
// Enemies carry a shield gauge that only drops on weakness hits. At zero the
// enemy is BROKEN: it loses its next turn and takes bonus damage, then the
// gauge regenerates. Pure helpers here; the engine owns the live state.

export const BROKEN_DAMAGE_MULTIPLIER = 1.5; // damage taken while broken
export const BREAK_STUN_TURNS = 1;           // enemy turns skipped on break
export const BREAK_REGEN_DELAY_TURNS = 2;    // turns before the gauge refills

// Gauge damage per hit by affinity. Only weakness hits chip the gauge; a
// weakness-specialised skill chips harder.
export function breakDamage(isWeak: boolean, specialised = false): number {
  if (!isWeak) return 0;
  return specialised ? 2 : 1;
}

export interface BreakState {
  max: number;      // full gauge size (0 = enemy has no gauge, e.g. mobs)
  current: number;  // remaining shield
  broken: boolean;
  stunTurnsLeft: number;   // turns still skipped while broken
  regenCooldown: number;   // turns until the gauge starts refilling
}

export function initBreak(max: number): BreakState {
  return { max, current: max, broken: false, stunTurnsLeft: 0, regenCooldown: 0 };
}

export interface ApplyBreakResult {
  state: BreakState;
  justBroke: boolean;
}

// Chip the gauge. When it empties, the enemy breaks.
export function chipBreak(state: BreakState, amount: number): ApplyBreakResult {
  if (state.max <= 0 || state.broken || amount <= 0) {
    return { state, justBroke: false };
  }
  const current = state.current - amount;
  if (current <= 0) {
    return {
      state: {
        ...state,
        current: 0,
        broken: true,
        stunTurnsLeft: BREAK_STUN_TURNS,
        regenCooldown: BREAK_REGEN_DELAY_TURNS,
      },
      justBroke: true,
    };
  }
  return { state: { ...state, current }, justBroke: false };
}

// Advance the break state at the start of the enemy's turn. Returns whether the
// enemy's turn is stunned (skipped) this turn.
export interface BreakTickResult {
  state: BreakState;
  stunned: boolean;
}

export function tickBreak(state: BreakState): BreakTickResult {
  if (!state.broken) return { state, stunned: false };

  if (state.stunTurnsLeft > 0) {
    return {
      state: { ...state, stunTurnsLeft: state.stunTurnsLeft - 1 },
      stunned: true,
    };
  }

  // Stun elapsed — refill after the regen delay, then un-break.
  if (state.regenCooldown > 0) {
    return {
      state: { ...state, regenCooldown: state.regenCooldown - 1 },
      stunned: false,
    };
  }
  return { state: { ...state, broken: false, current: state.max }, stunned: false };
}

export function damageMultiplierWhileBroken(state: BreakState): number {
  return state.broken ? BROKEN_DAMAGE_MULTIPLIER : 1;
}
