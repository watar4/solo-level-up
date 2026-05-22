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
}

export interface LevelUpEvent {
  fromLevel: number;
  toLevel: number;
  statPointsGained: number;
  newRank?: Rank;
}

export type SystemEventKind = 'level-up' | 'achievement' | 'skill';

export interface SystemEvent {
  id: string;
  kind: SystemEventKind;
  title: string;       // system header, e.g. "Level Up!" / "称号獲得" / "スキル解放"
  primary: string;     // main display line
  secondary?: string;  // small print under the primary
  icon?: string;       // emoji
  accent?: 'gold' | 'cyan' | 'purple' | 'rose';
}
