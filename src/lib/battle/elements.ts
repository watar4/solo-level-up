import type { StatKey } from '../../types';

// Five-element affinity cycle — docs/redesign/03-battle-system.md §4.
// Each element maps 1:1 onto an existing stat so the new system layers on top
// of the current STR/AGI/INT/VIT/PER combat maths without a rewrite.
//
//   剛 go   = STR   (physical might)
//   迅 jin  = AGI   (speed)
//   魔 ma   = INT   (arcane)
//   守 shu  = VIT   (defense)
//   心 shin = PER   (mind / perception)
export type Element = 'go' | 'jin' | 'ma' | 'shu' | 'shin';

export const ELEMENTS: Element[] = ['go', 'jin', 'ma', 'shu', 'shin'];

export const ELEMENT_LABELS: Record<Element, { jp: string; kanji: string }> = {
  go: { jp: 'ごう', kanji: '剛' },
  jin: { jp: 'じん', kanji: '迅' },
  ma: { jp: 'ま', kanji: '魔' },
  shu: { jp: 'しゅ', kanji: '守' },
  shin: { jp: 'しん', kanji: '心' },
};

// Attacker main color per element, used so a boss's affinity reads at a glance
// from its sprite palette (docs/redesign/06-boss-design.md §2).
export const ELEMENT_COLORS: Record<Element, string> = {
  go: '#e0524b',   // red
  jin: '#4bbf6b',  // green
  ma: '#9b6be0',   // purple
  shu: '#d9a441',  // ochre
  shin: '#4b9be0', // blue
};

export const ELEMENT_TO_STAT: Record<Element, StatKey> = {
  go: 'STR',
  jin: 'AGI',
  ma: 'INT',
  shu: 'VIT',
  shin: 'PER',
};

export const STAT_TO_ELEMENT: Record<StatKey, Element> = {
  STR: 'go',
  AGI: 'jin',
  INT: 'ma',
  VIT: 'shu',
  PER: 'shin',
};

// The "strong against" chain: go → jin → shin → ma → shu → go (loops).
// beats[X] = the element X deals bonus damage to.
const BEATS: Record<Element, Element> = {
  go: 'jin',
  jin: 'shin',
  shin: 'ma',
  ma: 'shu',
  shu: 'go',
};

// The element an attacker should use to exploit `defender`'s weakness — i.e.
// the element that beats it. Derived from the cycle, NOT hand-authored per
// enemy: the roster tables in 06 list an approximate weak column for flavour,
// but this function is the single source of truth.
export function weaknessOf(defender: Element): Element {
  const entry = (Object.entries(BEATS) as [Element, Element][]).find(
    ([, beaten]) => beaten === defender
  );
  // Every element is beaten by exactly one other, so this is always defined.
  return entry ? entry[0] : defender;
}

// The element `defender` resists (takes reduced damage from): the one it beats.
export function resistOf(defender: Element): Element {
  return BEATS[defender];
}

export type Affinity = 'weak' | 'resist' | 'neutral';

// How an attacking element fares against a defending element.
export function affinity(attacker: Element, defender: Element): Affinity {
  if (BEATS[attacker] === defender) return 'weak';   // attacker beats defender
  if (BEATS[defender] === attacker) return 'resist'; // defender beats attacker
  return 'neutral';
}

export const AFFINITY_MULTIPLIER: Record<Affinity, number> = {
  weak: 1.5,
  resist: 0.6,
  neutral: 1,
};

export function affinityMultiplier(attacker: Element, defender: Element): number {
  return AFFINITY_MULTIPLIER[affinity(attacker, defender)];
}
