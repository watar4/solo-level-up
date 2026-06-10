import { create } from 'zustand';
import type { Question, QuizMode, SessionRecord } from '../types/question';
import { isAnswerCorrect } from '../lib/quiz';

export interface QuizConfig {
  mode: QuizMode;
  questions: Question[];
  /** 即時フィードバック（練習/復習=true, 模擬試験=false） */
  immediateFeedback: boolean;
  /** 制限時間（秒）。模擬試験のみ設定。0/未設定で無制限 */
  timeLimitSec?: number;
}

interface QuizState {
  active: boolean;
  mode: QuizMode;
  questions: Question[];
  index: number;
  immediateFeedback: boolean;
  startedAt: number; // ms
  deadline: number | null; // ms。模擬試験のカウントダウン用
  selections: Record<string, string[]>;
  committed: Record<string, boolean>;
  flagged: Record<string, true>;

  start: (config: QuizConfig) => void;
  select: (questionId: string, key: string, type: Question['type']) => void;
  commit: (questionId: string) => boolean | null;
  toggleFlag: (questionId: string) => void;
  goto: (index: number) => void;
  next: () => void;
  prev: () => void;
  /** 全問を確定して SessionRecord を生成（未確定の選択も採点対象に含める） */
  buildRecord: () => SessionRecord;
  reset: () => void;
}

export const useQuiz = create<QuizState>((set, get) => ({
  active: false,
  mode: 'practice',
  questions: [],
  index: 0,
  immediateFeedback: true,
  startedAt: 0,
  deadline: null,
  selections: {},
  committed: {},
  flagged: {},

  start: (config) =>
    set({
      active: true,
      mode: config.mode,
      questions: config.questions,
      index: 0,
      immediateFeedback: config.immediateFeedback,
      startedAt: Date.now(),
      deadline: config.timeLimitSec ? Date.now() + config.timeLimitSec * 1000 : null,
      selections: {},
      committed: {},
      flagged: {},
    }),

  select: (questionId, key, type) =>
    set((s) => {
      if (s.committed[questionId]) return s; // 確定後は変更不可
      const cur = s.selections[questionId] ?? [];
      let nextSel: string[];
      if (type === 'single') {
        nextSel = [key];
      } else {
        nextSel = cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key];
      }
      return { selections: { ...s.selections, [questionId]: nextSel } };
    }),

  commit: (questionId) => {
    const s = get();
    const q = s.questions.find((x) => x.id === questionId);
    if (!q) return null;
    const sel = s.selections[questionId] ?? [];
    if (sel.length === 0) return null;
    set({ committed: { ...s.committed, [questionId]: true } });
    return isAnswerCorrect(q, sel);
  },

  toggleFlag: (questionId) =>
    set((s) => {
      const flagged = { ...s.flagged };
      if (flagged[questionId]) delete flagged[questionId];
      else flagged[questionId] = true;
      return { flagged };
    }),

  goto: (index) =>
    set((s) => ({ index: Math.max(0, Math.min(index, s.questions.length - 1)) })),
  next: () => set((s) => ({ index: Math.min(s.index + 1, s.questions.length - 1) })),
  prev: () => set((s) => ({ index: Math.max(s.index - 1, 0) })),

  buildRecord: () => {
    const s = get();
    const answers = s.questions.map((q) => {
      const selected = s.selections[q.id] ?? [];
      return { questionId: q.id, selected, isCorrect: isAnswerCorrect(q, selected) };
    });
    const correct = answers.filter((a) => a.isCorrect).length;
    const durationSec = Math.round((Date.now() - s.startedAt) / 1000);
    return {
      id: `sess-${s.startedAt}`,
      startedAt: new Date(s.startedAt).toISOString(),
      mode: s.mode,
      total: s.questions.length,
      correct,
      durationSec,
      answers,
    } satisfies SessionRecord;
  },

  reset: () =>
    set({
      active: false,
      questions: [],
      index: 0,
      selections: {},
      committed: {},
      flagged: {},
      deadline: null,
    }),
}));
