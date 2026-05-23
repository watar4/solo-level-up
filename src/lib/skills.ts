import type { Character, Quest } from '../types';

// Legacy "skills" achievement-style unlocks. Replaced by the BATTLE_SKILLS
// system in src/lib/battleSkills.ts which actually drives combat. This file
// is kept as a no-op shim so old `unlocked.skills` data on existing
// character docs (and the imports inside useGameData / StatsDashboard) keep
// compiling without runtime side effects.

export interface SkillDef {
  id: string;
  name: string;
  description: string;
  unlockText: string;
  icon: string;
  category: 'attack' | 'defense' | 'support' | 'mind' | 'special';
}

export const SKILLS: SkillDef[] = [];

// Always returns an empty list — there are no new flavour skills to unlock.
// Battle abilities are now handled by the BattleSkills loadout panel.
export function newlyUnlockedSkills(_character: Character, _quests: Quest[]): SkillDef[] {
  void _character;
  void _quests;
  return [];
}
