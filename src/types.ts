import type { CampaignState } from './lib/story/campaign';

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
  primaryColor: string; // hex — outfit main color
  accentColor: string;  // hex — accent (trim/pants/etc.)
  // ----- v2 parts (optional on legacy docs; migrateAppearance backfills) -----
  skin?: string;        // skin color hex
  hair?: string;        // hairstyle id
  hairColor?: string;   // hex
  eyes?: string;        // eye style id
  eyeColor?: string;    // hex
  outfit?: string;      // outfit id (shape + default colors)
  accessory?: string;   // accessory id ('none' | ...)
}

// Job/class progression. `base` is the starting class; tier2 unlocks at Lv20,
// tier3 at Lv40 (see lib/jobs.ts).
export interface HunterJob {
  base: HunterClass;
  tier2?: string;
  tier3?: string;
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
  // ----- job / creed / cosmetics (キャラクリ v2) -----
  job?: HunterJob;         // class progression (base + tier2/tier3)
  creed?: string;          // playstyle creed id (lib/creeds.ts); changeable
  cosmetics?: string[];    // owned cosmetic ids (outfits/accessories)
  // IDs of battle skills the player has equipped (max 5, used in combat).
  // Distinct from the achievement-style "unlocked.skills" tags above.
  equippedSkills?: string[];
  // Continuous-mode boss tower progress. Floor = bossesDefeated + 1.
  // Retained for the post-clear "infinite corridor"; the story campaign uses
  // `campaign` below.
  bossesDefeated?: number;
  // Story campaign save-state (『ダラリア大陸』). Optional so pre-campaign
  // characters load unchanged; seeded on first Adventure entry.
  campaign?: CampaignState;
  // ----- nutrition / meal goal -----
  weightTargetDate?: string;         // YYYY-MM-DD deadline that pairs with weightTarget
  activityLevel?: ActivityLevel;     // maintenance-calorie multiplier
  dietType?: DietType;               // PFC split preset
  nutritionTarget?: NutritionTarget; // manual override; when set, used as-is instead of the auto value
  lastNutritionRewardDate?: string;  // YYYY-MM-DD guard so the meal EXP is granted at most once/day
  // ----- focus gate (iOS Shortcut soft-block) -----
  // Random secret that is also the id of the public `gates/{secret}` doc an
  // iOS automation polls. Lets a Shortcut read "did I clear a quest today?"
  // without Firebase auth. Undefined until the user enables the focus gate.
  gateSecret?: string;
  // ----- economy -----
  gold?: number; // wallet. Earned via quests / boss wins / real-world savings
  // Consumable counts keyed by CONSUMABLES template id. Kept on the character
  // doc (not per-doc items) so buying/using is a single cheap patch.
  consumables?: Record<string, number>;
  // templateIds of every shadow ever obtained — powers the dex even after
  // the shadow itself is discarded.
  dexShadows?: string[];
  // ----- real-world savings link -----
  savingsGoal?: SavingsGoal;
  monthlyBudget?: number;          // yen — Rakuten-card spending cap goal
  lastBudgetRewardMonth?: string;  // YYYY-MM guard for the under-budget reward
}

// Long-term savings target. Progress = sum of all savingsEntries (kind:
// 'saving'). Framed in-game as an S-rank quest ("軍資金を貯めよ").
export interface SavingsGoal {
  targetAmount: number;   // yen
  monthlyAmount?: number; // yen — optional monthly pace goal
  label?: string;         // what the money is for ("旅行", "PC" …)
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

// ----- Meal / nutrition -----

export type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export const MEAL_SLOT_LABELS: Record<MealSlot, string> = {
  breakfast: '朝食',
  lunch: '昼食',
  dinner: '夕食',
  snack: '間食',
};

export const MEAL_SLOT_ORDER: MealSlot[] = ['breakfast', 'lunch', 'dinner', 'snack'];

// Diet style — drives the PFC split of the daily target. Calories come from
// the weight-delta back-calculation; the diet type only redistributes them
// across protein / fat / carbs.
export type DietType = 'balanced' | 'highprotein' | 'lowcarb' | 'keto' | 'leanbulk';

export const DIET_TYPE_LABELS: Record<DietType, { jp: string; desc: string }> = {
  balanced: { jp: 'バランス', desc: 'P 1.8g/kg・脂質 25%' },
  highprotein: { jp: '高タンパク減量', desc: 'P 2.2g/kg・脂質 25%' },
  lowcarb: { jp: 'ローカーボ', desc: 'P 2.0g/kg・糖質 20%以下' },
  keto: { jp: 'ケトジェニック', desc: 'P 2.0g/kg・糖質 50g固定' },
  leanbulk: { jp: '増量(リーンバルク)', desc: 'P 1.8g/kg・脂質 20%' },
};

export const DIET_TYPE_ORDER: DietType[] = [
  'balanced',
  'highprotein',
  'lowcarb',
  'keto',
  'leanbulk',
];

// Activity multiplier applied to a bodyweight-based maintenance estimate.
// Four coarse levels keep the input simple (no height/age required).
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active';

export const ACTIVITY_LABELS: Record<ActivityLevel, { jp: string; desc: string }> = {
  sedentary: { jp: '座りがち', desc: 'デスクワーク中心' },
  light: { jp: '軽い運動', desc: '週 1〜3 回の運動' },
  moderate: { jp: '中程度', desc: '週 3〜5 回の運動' },
  active: { jp: '活発', desc: '週 6〜7 回・肉体労働' },
};

export const ACTIVITY_ORDER: ActivityLevel[] = ['sedentary', 'light', 'moderate', 'active'];

// Daily nutrition target in grams + kcal. Either auto-computed from the weight
// goal (current/target weight + deadline + activity + diet) or manually set.
export interface NutritionTarget {
  kcal: number;
  protein: number; // g
  fat: number;     // g
  carbs: number;   // g
}

// One logged meal. PFC in grams, calories in kcal. `date` groups a day's
// meals together for the daily evaluation.
export interface MealEntry {
  id: string;
  uid: string;
  date: string;    // YYYY-MM-DD
  slot: MealSlot;
  name: string;
  kcal: number;
  protein: number; // g
  fat: number;     // g
  carbs: number;   // g
  createdAt: number;
}

// A reusable meal template. Slot-less and date-less on purpose: a preset is
// just "a dish + its macros" that the user can apply to the log form, then
// pick the slot at logging time. Names are treated as the upsert key so
// re-saving the same dish overwrites it instead of piling up duplicates.
export interface MealPreset {
  id: string;
  uid: string;
  name: string;
  kcal: number;
  protein: number; // g
  fat: number;     // g
  carbs: number;   // g
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
  // ----- growth (Pokémon-style). Absent on legacy docs → level 1, exp 0.
  level?: number;
  exp?: number;         // EXP within the current level
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

// ----- real-world savings / spending ledger -----

export type SavingsSource = 'manual' | 'yucho-csv' | 'rakuten-csv';

// One money movement. kind 'saving' = money set aside (counts toward the
// goal, converts to gold). kind 'spending' = card usage (counts against the
// monthly budget). `hash` fingerprints CSV rows so re-importing the same
// file is idempotent.
export interface SavingsEntry {
  id: string;
  uid: string;
  date: string;        // YYYY-MM-DD
  amount: number;      // yen, positive. kind decides the direction.
  kind: 'saving' | 'spending';
  memo: string;
  source: SavingsSource;
  hash?: string;
  createdAt: number;
}

export type SystemEventKind =
  | 'level-up' | 'achievement' | 'skill' | 'shadow' | 'boss' | 'inbox' | 'nutrition'
  | 'gold' | 'item' | 'evolution' | 'savings';

export interface SystemEvent {
  id: string;
  kind: SystemEventKind;
  title: string;       // system header, e.g. "Level Up!" / "称号獲得" / "スキル解放"
  primary: string;     // main display line
  secondary?: string;  // small print under the primary
  icon?: string;       // emoji
  accent?: 'gold' | 'cyan' | 'purple' | 'rose';
}
