// Region node maps — docs/redesign/03-battle-system.md §2, 04 §3.
// A chapter's region is an ordered list of nodes the player walks through.
// Node ids are stable so cleared-state survives data edits.

export type RegionNode =
  | { kind: 'event'; id: string; label: string; dialogueId: string }
  | { kind: 'battle'; id: string; label: string; enemyId: string }
  | { kind: 'elite'; id: string; label: string; enemyId: string }
  | { kind: 'lord'; id: string; label: string; enemyId: string };

export interface Region {
  chapter: number;
  nodes: RegionNode[];
}

const CH01: Region = {
  chapter: 1,
  nodes: [
    { kind: 'event', id: 'ch1-intro', label: 'めざめ', dialogueId: 'ch1-intro' },
    { kind: 'battle', id: 'ch1-b1', label: 'そうげん', enemyId: 'nemukedama' },
    { kind: 'battle', id: 'ch1-b2', label: 'くさむら', enemyId: 'yumeusagi' },
    { kind: 'event', id: 'ch1-mid', label: 'いどばた', dialogueId: 'ch1-mid' },
    { kind: 'battle', id: 'ch1-b3', label: 'いわば', enemyId: 'makuragani' },
    { kind: 'elite', id: 'ch1-elite', label: 'まんねんどこ', enemyId: 'futon-golem' },
    { kind: 'event', id: 'ch1-prelord', label: 'ていたくまえ', dialogueId: 'ch1-prelord' },
    { kind: 'lord', id: 'ch1-lord', label: 'スヤリンの間', enemyId: 'suyarin' },
  ],
};

export const REGIONS: Record<number, Region> = {
  1: CH01,
};

export function regionFor(chapter: number): Region | undefined {
  return REGIONS[chapter];
}

// The next uncleared node in a region, or null if the whole region is done.
export function nextNode(region: Region, clearedIds: string[]): RegionNode | null {
  const cleared = new Set(clearedIds);
  return region.nodes.find((n) => !cleared.has(n.id)) ?? null;
}

export function isRegionComplete(region: Region, clearedIds: string[]): boolean {
  return nextNode(region, clearedIds) === null;
}
