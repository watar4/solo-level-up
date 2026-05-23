import type { Character, HunterAppearance, StatKey } from '../types';
import { SHADOW_TEMPLATES } from './shadows';
import { ALL_STATS } from '../types';

// Emails that get the maxed-out "master" character auto-provisioned on
// first sign-in. Stored as a Set with lowercased comparisons for
// case-insensitive matching.
const MASTER_EMAIL_LIST = ['watar.pc4@gmail.com'];

const MASTER_EMAILS = new Set(MASTER_EMAIL_LIST.map((e) => e.toLowerCase()));

export function isMasterEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return MASTER_EMAILS.has(email.toLowerCase());
}

// Master loadout numbers — picked so every system is exercised:
//  - Lv 60 = SS rank (highest tier)
//  - All stats at 99 → every stat-threshold skill is unlocked
//  - statPoints leftover so the user can play with the +1 allocator UI
//  - High totalExp + 0 bossesDefeated so the tower still starts at Floor 1
//    (so they can experience the climb, not skip it)
const MASTER_DEFAULT_APPEARANCE: HunterAppearance = {
  hunterClass: 'knight',
  primaryColor: '#3a6abc',
  accentColor: '#c8d0d8',
};

const MASTER_EQUIPPED_SKILLS = [
  'mountain-cleave', // STR ≥ 25
  'flash-step',      // AGI ≥ 25
  'inferno',         // INT ≥ 25
  'full-heal',       // VIT ≥ 25
  'see-through',     // PER ≥ 25
];

export function buildMasterCharacter(uid: string): Character {
  const now = Date.now();
  const stats: Record<StatKey, number> = {
    STR: 99,
    AGI: 99,
    INT: 99,
    VIT: 99,
    PER: 99,
  };
  return {
    uid,
    name: 'Master',
    level: 60,
    exp: 0,
    totalExp: 200000,
    stats,
    statPoints: 30,
    createdAt: now,
    lastSeenAt: now,
    appearance: MASTER_DEFAULT_APPEARANCE,
    equippedSkills: MASTER_EQUIPPED_SKILLS,
    bossesDefeated: 0,
  };
}

// Five legendary shadows — one per stat, all equipped. Combined with the
// 99/99 base stats this gives the master a brutal effective stat block to
// stress-test damage / dodge / crit caps with.
export interface MasterShadowSeed {
  uid: string;
  templateId: string;
  name: string;
  stat: StatKey;
  rarity: 'legendary';
  equipped: boolean;
  createdAt: number;
}

export function buildMasterShadows(uid: string): MasterShadowSeed[] {
  const now = Date.now();
  const out: MasterShadowSeed[] = [];
  for (const stat of ALL_STATS) {
    const template = SHADOW_TEMPLATES.find(
      (t) => t.stat === stat && t.rarity === 'legendary'
    );
    if (!template) continue;
    out.push({
      uid,
      templateId: template.id,
      name: template.name,
      stat,
      rarity: 'legendary',
      equipped: true,
      createdAt: now + ALL_STATS.indexOf(stat), // unique createdAt per row
    });
  }
  return out;
}
