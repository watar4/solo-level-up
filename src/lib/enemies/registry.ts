import type { EnemyDef } from './types';
import { CH01_ENEMIES } from './ch01';

// Flat registry of every enemy across chapters. Later chapters append here.
const ALL: EnemyDef[] = [...CH01_ENEMIES];

export const ENEMY_BY_ID: Record<string, EnemyDef> = Object.fromEntries(
  ALL.map((e) => [e.id, e])
);

export function getEnemy(id: string): EnemyDef | undefined {
  return ENEMY_BY_ID[id];
}
