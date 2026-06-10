// DS検定 問題演習アプリ 共通型定義（要件定義書 5.1 / 付録 準拠）

export type Category =
  | 'データサイエンス力'
  | 'データエンジニアリング力'
  | 'ビジネス力'
  | '数理・データサイエンス・AIリテラシー';

export const CATEGORIES: Category[] = [
  'データサイエンス力',
  'データエンジニアリング力',
  'ビジネス力',
  '数理・データサイエンス・AIリテラシー',
];

/** ダッシュボード等の表示で使う短縮ラベル */
export const CATEGORY_SHORT: Record<Category, string> = {
  データサイエンス力: 'DS力',
  データエンジニアリング力: 'DE力',
  ビジネス力: 'ビジネス力',
  '数理・データサイエンス・AIリテラシー': '数理・AI',
};

export type QuestionType = 'single' | 'multiple';
export type QuestionOrigin = 'builtin' | 'ai-generated' | 'imported';
export type Difficulty = 1 | 2 | 3;

export interface Choice {
  key: string;
  text: string;
}

export interface Question {
  id: string;
  category: Category;
  subCategory?: string;
  type: QuestionType;
  difficulty: Difficulty;
  question: string;
  choices: Choice[];
  answer: string[];
  explanation: string;
  tags?: string[];
  imageUrl?: string | null;
  source?: string;
  origin: QuestionOrigin;
  /** 問題管理での有効/無効。未定義は有効扱い */
  enabled?: boolean;
}

export interface QuestionStat {
  questionId: string;
  correctCount: number;
  wrongCount: number;
  lastAnsweredAt?: string;
  bookmarked: boolean;
}

export type QuizMode = 'practice' | 'random' | 'mock' | 'review';

export interface SessionAnswer {
  questionId: string;
  selected: string[];
  isCorrect: boolean;
}

export interface SessionRecord {
  id: string;
  startedAt: string;
  mode: QuizMode;
  total: number;
  correct: number;
  durationSec: number;
  /** 模擬試験の合否（mock 以外は undefined） */
  passed?: boolean;
  answers: SessionAnswer[];
}

export interface AISettings {
  apiKey: string; // localStorage のみ。コミット禁止
  model: string; // 例: "claude-sonnet-4-6"
}

/** 模擬試験のカテゴリ配分（合計100問に対する重み）。比率として正規化して使う */
export type MockDistribution = Record<Category, number>;
