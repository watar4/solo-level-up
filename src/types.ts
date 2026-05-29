export type StatKey = 'STR' | 'AGI' | 'INT' | 'VIT' | 'PER';

export const STAT_LABELS: Record<StatKey, { jp: string; en: string }> = {
  STR: { jp: '筋力', en: 'STR' },
  AGI: { jp: '敏捷', en: 'AGI' },
  INT: { jp: '知力', en: 'INT' },
  VIT: { jp: '体力', en: 'VIT' },
  PER: { jp: '感知', en: 'PER' },
};

export const ALL_STATS: StatKey[] = ['STR', 'AGI', 'INT', 'VIT', 'PER'];

export type Rank = 'E' | 'D' | 'C' | 'B' | 'A' | 'S' | 'SS';

export type Difficulty = 'E' | 'D' | 'C' | 'B' | 'A' | 'S';

export const DIFFICULTY_EXP: Record<Difficulty, number> = {
  E: 10,
  D: 25,
  C: 50,
  B: 100,
  A: 200,
  S: 500,
};

export interface UnlockState {
  achievements: string[];
  achievementDates: Record<string, number>;
  skills: string[];
  skillDates: Record<string, number>;
}

export const EMPTY_UNLOCK: UnlockState = {
  achievements: [],
  achievementDates: {},
  skills: [],
  skillDates: {},
};

export type HunterClass = 'knight' | 'mage' | 'hunter' | 'scout';

export interface HunterAppearance {
  hunterClass: HunterClass;
  primaryColor: string; // hex — outfit/weapon main color
  accentColor: string;  // hex — accent (cape/hood/etc.)
}

export interface Character {
  uid: string;
  name: string;
  level: number;
  exp: number;        // EXP within the current level
  totalExp: number;   // lifetime EXP, used to derive rank progress
  stats: Record<StatKey, number>;
  statPoints: number; // unspent points awarded per level-up
  createdAt: number;
  lastSeenAt: number;
  unlocked?: UnlockState;
  title?: string;     // currently-equipped title from an achievement
  weightTarget?: number; // kg, one decimal — drives target line on the chart
  appearance?: HunterAppearance;
  // IDs of battle skills the player has equipped (max 5, used in combat).
  // Distinct from the achievement-style "unlocked.skills" tags above.
  equippedSkills?: string[];
  // Continuous-mode boss tower progress. Floor = bossesDefeated + 1.
  bossesDefeated?: number;
}

export type QuestType = 'daily' | 'weekly' | 'one-time';

export interface Quest {
  id: string;
  uid: string;
  title: string;
  description?: string;
  type: QuestType;
  targetStat: StatKey;
  difficulty: Difficulty;
  completedDates: string[]; // YYYY-MM-DD entries
  streak: number;           // consecutive-day streak (for daily)
  lastCompletedAt?: number;
  createdAt: number;
  archived?: boolean;
  order?: number;           // manual ordering; undefined = fall back to createdAt desc
}

export interface LevelUpEvent {
  fromLevel: number;
  toLevel: number;
  statPointsGained: number;
  newRank?: Rank;
}

export interface WeightEntry {
  id: string;
  uid: string;
  date: string;     // YYYY-MM-DD
  weight: number;   // kg, rounded to 1 decimal place
  createdAt: number;
}

export type ShadowRarity = 'normal' | 'rare' | 'epic' | 'legendary';

export const SHADOW_RARITY_ORDER: ShadowRarity[] = ['legendary', 'epic', 'rare', 'normal'];

export interface Shadow {
  id: string;
  uid: string;
  templateId: string;   // points into the SHADOW_TEMPLATES table
  name: string;         // resolved display name (denormalised for offline read)
  stat: StatKey;        // primary stat this shadow aligns to
  rarity: ShadowRarity;
  equipped: boolean;
  createdAt: number;
}

export interface BossAttempt {
  id: string;
  uid: string;
  date: string;         // YYYY-MM-DD — the boss's seed key
  bossId: string;       // template id
  won: boolean;
  turnsUsed: number;
  damageDealt: number;
  createdAt: number;
}

export type ItemKind = 'weapon';

export interface Item {
  id: string;
  uid: string;
  kind: ItemKind;
  templateId: string;
  name: string;
  stat: StatKey;        // primary stat the weapon boosts
  rarity: ShadowRarity; // reusing shadow rarity tiers
  equipped: boolean;
  createdAt: number;
}

// API keys issued by the player for non-browser clients (iOS Shortcut, etc.)
// to write to specific inbox collections. Document ID *is* the secret value
// so Firestore rules can `get(/apiKeys/$(payload.secret))` to look it up.
export interface ApiKey {
  id: string;          // = the secret. Treat as sensitive.
  uid: string;         // owning user
  label: string;       // human-readable description ("iPhone Shortcut", etc.)
  scopes: ApiKeyScope[]; // what the key is allowed to do
  createdAt: number;
  lastUsedAt?: number; // set by the inbox-drain side as a best-effort hint
}

export type ApiKeyScope = 'weight';

// Raw entry written by an external client (iOS Shortcut). The web app drains
// these on the next app-open and converts each one into a `weightEntries` doc.
export interface WeightInboxEntry {
  id: string;
  uid: string;
  secret: string;       // matches an apiKeys doc id; rules enforce uid match
  weight: number;       // kg
  recordedAt?: string;  // ISO 8601 from the Shortcut, optional
  source?: string;      // free-text, e.g. "ios-shortcut"
}

export type SystemEventKind = 'level-up' | 'achievement' | 'skill' | 'shadow' | 'boss' | 'inbox';

export interface SystemEvent {
  id: string;
  kind: SystemEventKind;
  title: string;       // system header, e.g. "Level Up!" / "称号獲得" / "スキル解放"
  primary: string;     // main display line
  secondary?: string;  // small print under the primary
  icon?: string;       // emoji
  accent?: 'gold' | 'cyan' | 'purple' | 'rose';
}
