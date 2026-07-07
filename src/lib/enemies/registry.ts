import type { EnemyDef } from './types';
import { CH01_ENEMIES } from './ch01';
import { CH02_ENEMIES } from './ch02';
import { CH03_ENEMIES } from './ch03';
import { CH04_ENEMIES } from './ch04';
import { CH05_ENEMIES } from './ch05';
import { CH06_ENEMIES } from './ch06';
import { CH07_ENEMIES } from './ch07';
import { CH08_ENEMIES } from './ch08';
import { CH09_ENEMIES } from './ch09';
import { CH10_ENEMIES } from './ch10';
import { CH11_ENEMIES } from './ch11';
import { CH12_ENEMIES } from './ch12';

// Flat registry of every enemy across all chapters.
const ALL: EnemyDef[] = [
  ...CH01_ENEMIES, ...CH02_ENEMIES, ...CH03_ENEMIES, ...CH04_ENEMIES,
  ...CH05_ENEMIES, ...CH06_ENEMIES, ...CH07_ENEMIES, ...CH08_ENEMIES,
  ...CH09_ENEMIES, ...CH10_ENEMIES, ...CH11_ENEMIES, ...CH12_ENEMIES,
];

export const ALL_ENEMIES = ALL;

export const ENEMY_BY_ID: Record<string, EnemyDef> = Object.fromEntries(
  ALL.map((e) => [e.id, e])
);

export function getEnemy(id: string): EnemyDef | undefined {
  return ENEMY_BY_ID[id];
}
