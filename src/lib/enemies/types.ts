// Enemy (Daramon) data model — docs/redesign/06-boss-design.md §5, 07 §2.
// Enemies are declarative: stats + a weighted move script + lore. The engine
// reads `moves` generically; it never branches on a specific enemy id. The few
// truly special behaviours use the `gimmick` hook instead.

import type { Element } from '../battle/elements';
import type { StatusId } from '../battle/status';

export type EnemyTier = 'mob' | 'elite' | 'lord' | 'king';

// Sprite grid sizes by tier (docs 06 §1). Actual art lives in enemies/sprites/
// and is produced during the content phase; the id links the two.
export const TIER_SPRITE_SIZE: Record<EnemyTier, 16 | 24 | 32> = {
  mob: 16,
  elite: 24,
  lord: 32,
  king: 32,
};

export type MoveKind =
  | 'attack'   // ordinary hit
  | 'charge'   // telegraph a big hit next turn ("!" over head)
  | 'unleash'  // release the charged hit
  | 'buff'     // self attack/defense/speed up
  | 'debuff'   // player attack/defense/speed down
  | 'status'   // inflict a StatusId
  | 'summon'   // call adds (lord only)
  | 'gimmick'; // fire the enemy's gimmick hook

// Condition under which a move becomes eligible for the weighted pick.
export type MoveCondition =
  | 'always'
  | 'opening'      // first turn only
  | 'hpBelow50'    // phase-2 territory
  | 'phase2'       // after the phase-2 transition
  | 'everyNTurns'; // fires on turns that are a multiple of n

export interface EnemyMove {
  id: string;
  kind: MoveKind;
  weight: number;              // relative pick weight among eligible moves
  power?: number;              // attack multiplier for attack/unleash
  status?: StatusId;
  statusChance?: number;       // 0..1
  condition?: MoveCondition;
  n?: number;                  // period for everyNTurns
  log: string;                 // kana battle-log line
}

// Special mechanics that need an engine hook (docs 06 §5). Kept to a small,
// explicit enum so the engine's special-case surface stays auditable.
export type GimmickId =
  | 'fakeNotification' // ch3: injects a fake notification into the UI
  | 'buffEater'        // ch4: steals the player's buffs/item effects
  | 'goldScatter'      // ch5: temporarily drains displayed gold
  | 'triTurnReset'     // ch8: resets resettable statuses every 3 turns
  | 'mirror'           // ch9: enemy stats copied from the player
  | 'selfBurn'         // ch10: spends own HP for extra power
  | 'darkening'        // ch7: accuracy falls as the fight drags on
  | 'nullify'          // ch11: disables one player option per turn
  | 'uiSleep';         // ch12: UI text decays to "zzz…"

export interface EnemyDef {
  id: string;
  name: string;
  tier: EnemyTier;
  chapter: number;
  element: Element;            // weakness/resist are DERIVED from this (elements.ts)
  // Target time-to-kill expressed as "turns of the era-appropriate player's
  // full damage output" (docs 03 §8-3). The engine converts this to concrete
  // HP at battle start from the player's actual power, so numbers stay honest
  // as builds diverge.
  hpTurns: number;
  breakGauge: number;         // 0 = no break gauge (typical for mobs)
  attack: number;             // base per-hit damage before player-level scaling
  agility: number;            // ATB fill speed (6..14)
  critChance: number;         // 0..0.3
  moves: EnemyMove[];
  phases?: number;            // 1 (default) or 2 for lords
  gimmick?: GimmickId;
  lore: string;               // dex entry
  loreAfter: string;          // dex entry unlocked after defeat (改心後の近況)
  quotes?: { open?: string; phase2?: string; defeat?: string };
}
