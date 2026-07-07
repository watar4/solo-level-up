// Status ailments — docs/redesign/03-battle-system.md §5.
// Kept deliberately small (6 kinds) and defined as pure data + pure reducers so
// the battle engine (built in a later increment) can apply them without any
// UI coupling.

export type StatusId =
  | 'poison'   // どく:  % max-HP damage each turn
  | 'burn'     // やけど: % HP damage + attack down
  | 'sleep'    // ねむり: skip turns until hit
  | 'paralyze' // まひ:  chance to skip turn
  | 'mark'     // しるし: +damage taken, immune to "reset" gimmicks
  | 'shield';  // シールド: absorb one hit (buff-side, usable by both sides)

export interface StatusDef {
  id: StatusId;
  jp: string;
  kind: 'ailment' | 'buff';
  // Whether a "reset / cleanse" gimmick (e.g. Mikkaboze's 3-turn reset,
  // docs 06 ch08) may remove it. `mark` intentionally survives resets — it is
  // the counter to that boss.
  resettable: boolean;
  defaultDuration: number; // turns; 0 = consumed on trigger (shield)
  log: string;             // kana battle-log line shown on apply
}

export const STATUS_DEFS: Record<StatusId, StatusDef> = {
  poison: {
    id: 'poison', jp: 'どく', kind: 'ailment', resettable: true,
    defaultDuration: 3, log: 'どくに おかされた!',
  },
  burn: {
    id: 'burn', jp: 'やけど', kind: 'ailment', resettable: true,
    defaultDuration: 3, log: 'からだが やけどした!',
  },
  sleep: {
    id: 'sleep', jp: 'ねむり', kind: 'ailment', resettable: true,
    defaultDuration: 99, log: 'ねむって しまった!',
  },
  paralyze: {
    id: 'paralyze', jp: 'まひ', kind: 'ailment', resettable: true,
    defaultDuration: 3, log: 'からだが しびれた!',
  },
  mark: {
    id: 'mark', jp: 'しるし', kind: 'ailment', resettable: false,
    defaultDuration: 8, log: 'しるしが きざまれた!',
  },
  shield: {
    id: 'shield', jp: 'シールド', kind: 'buff', resettable: true,
    defaultDuration: 0, log: 'シールドを はった!',
  },
};

// Tuning constants for per-turn effects.
export const POISON_MAXHP_FRACTION = 0.05; // 5% of max HP / turn
export const BURN_MAXHP_FRACTION = 0.03;   // 3% of max HP / turn
export const BURN_ATK_DOWN = 0.15;         // -15% attack while burning
export const PARALYZE_SKIP_CHANCE = 0.25;  // 25% chance to lose the turn
export const MARK_DAMAGE_BONUS = 0.20;     // +20% damage taken while marked

// A live status instance carried by a combatant.
export interface ActiveStatus {
  id: StatusId;
  turnsLeft: number;
}

// Combined start-of-turn tick for one combatant. Pure: returns the damage to
// apply, the surviving statuses, log lines, and whether the turn is skipped.
export interface StatusTickResult {
  damage: number;        // HP loss from poison + burn this turn
  statuses: ActiveStatus[];
  logs: string[];
  skipTurn: boolean;     // asleep, or a paralyze roll landed
}

export function tickStatuses(
  statuses: ActiveStatus[],
  maxHp: number,
  rng: () => number = Math.random
): StatusTickResult {
  let damage = 0;
  let skipTurn = false;
  const logs: string[] = [];
  const next: ActiveStatus[] = [];

  for (const s of statuses) {
    switch (s.id) {
      case 'poison':
        damage += Math.max(1, Math.round(maxHp * POISON_MAXHP_FRACTION));
        break;
      case 'burn':
        damage += Math.max(1, Math.round(maxHp * BURN_MAXHP_FRACTION));
        break;
      case 'sleep':
        skipTurn = true;
        break;
      case 'paralyze':
        if (rng() < PARALYZE_SKIP_CHANCE) {
          skipTurn = true;
          logs.push('からだが しびれて うごけない!');
        }
        break;
      default:
        break;
    }
    const turnsLeft = s.turnsLeft - 1;
    if (turnsLeft > 0) next.push({ ...s, turnsLeft });
  }

  return { damage, statuses: next, logs, skipTurn };
}

// Attack-output multiplier from ailments the *attacker* is suffering (burn).
export function attackModifierFromStatuses(statuses: ActiveStatus[]): number {
  return statuses.some((s) => s.id === 'burn') ? 1 - BURN_ATK_DOWN : 1;
}

// Incoming-damage multiplier from ailments the *defender* is suffering (mark).
export function damageTakenModifier(statuses: ActiveStatus[]): number {
  return statuses.some((s) => s.id === 'mark') ? 1 + MARK_DAMAGE_BONUS : 1;
}

// Apply a new status, refreshing duration if it already exists. Waking a
// sleeper on hit is handled separately by the engine (removeOnHit).
export function applyStatus(
  statuses: ActiveStatus[],
  id: StatusId,
  duration = STATUS_DEFS[id].defaultDuration
): ActiveStatus[] {
  const existing = statuses.find((s) => s.id === id);
  if (existing) {
    return statuses.map((s) =>
      s.id === id ? { ...s, turnsLeft: Math.max(s.turnsLeft, duration) } : s
    );
  }
  return [...statuses, { id, turnsLeft: duration }];
}

// Remove all resettable statuses — the "reset" gimmick (docs 06 ch08). `mark`
// and any other resettable:false ailment survive.
export function cleanseResettable(statuses: ActiveStatus[]): ActiveStatus[] {
  return statuses.filter((s) => !STATUS_DEFS[s.id].resettable);
}

// Sleep is broken by taking a hit.
export function wakeOnHit(statuses: ActiveStatus[]): ActiveStatus[] {
  return statuses.filter((s) => s.id !== 'sleep');
}
