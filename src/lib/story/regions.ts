// Region node maps — docs/redesign/03-battle-system.md §2, 04 §3.
// Chapter 1 is hand-authored; chapters 2-12 are generated from the enemy roster
// (3 mobs → elite → lord) so content scales with the data files.

import { ALL_ENEMIES } from '../enemies/registry';

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

function buildRegion(chapter: number): Region {
  const es = ALL_ENEMIES.filter((e) => e.chapter === chapter);
  const mobs = es.filter((e) => e.tier === 'mob');
  const elite = es.find((e) => e.tier === 'elite');
  const lord = es.find((e) => e.tier === 'lord' || e.tier === 'king');

  const nodes: RegionNode[] = [
    { kind: 'event', id: `ch${chapter}-intro`, label: 'たどりつく', dialogueId: `ch${chapter}-intro` },
    ...mobs.map((m, i): RegionNode => ({ kind: 'battle', id: `ch${chapter}-b${i + 1}`, label: m.name, enemyId: m.id })),
  ];
  if (elite) nodes.push({ kind: 'elite', id: `ch${chapter}-elite`, label: elite.name, enemyId: elite.id });
  nodes.push({ kind: 'event', id: `ch${chapter}-prelord`, label: 'ボスの間の前', dialogueId: `ch${chapter}-prelord` });
  if (lord) nodes.push({ kind: 'lord', id: `ch${chapter}-lord`, label: lord.name, enemyId: lord.id });

  return { chapter, nodes };
}

export const REGIONS: Record<number, Region> = {
  1: CH01,
  ...Object.fromEntries(
    Array.from({ length: 11 }, (_, i) => i + 2).map((ch) => [ch, buildRegion(ch)])
  ),
};

export function regionFor(chapter: number): Region | undefined {
  return REGIONS[chapter];
}

export function nextNode(region: Region, clearedIds: string[]): RegionNode | null {
  const cleared = new Set(clearedIds);
  return region.nodes.find((n) => !cleared.has(n.id)) ?? null;
}

export function isRegionComplete(region: Region, clearedIds: string[]): boolean {
  return nextNode(region, clearedIds) === null;
}
