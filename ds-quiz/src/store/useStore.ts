import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  CATEGORIES,
  type AISettings,
  type MockDistribution,
  type Question,
  type QuestionStat,
  type SessionRecord,
} from '../types/question';
import { builtinQuestions, mergeQuestions } from '../lib/questions';

const STORAGE_KEY = 'ds-quiz-store-v1';

export interface AppSettings {
  passThreshold: number; // 0..1
  mockTotal: number; // 既定100
  mockMinutes: number; // 既定100
  mockDistribution: MockDistribution; // カテゴリ配分（重み）
}

function defaultDistribution(): MockDistribution {
  return CATEGORIES.reduce((acc, c) => {
    acc[c] = 25;
    return acc;
  }, {} as MockDistribution);
}

const defaultSettings: AppSettings = {
  passThreshold: 0.8,
  mockTotal: 100,
  mockMinutes: 100,
  mockDistribution: defaultDistribution(),
};

const defaultAI: AISettings = {
  apiKey: '',
  model: 'claude-sonnet-4-6',
};

interface PersistedState {
  /** AI生成 + インポート問題（builtin は含まない） */
  extraQuestions: Question[];
  /** 無効化された問題ID（builtin/extra 共通） */
  disabledIds: Record<string, true>;
  questionStats: Record<string, QuestionStat>;
  sessions: SessionRecord[];
  settings: AppSettings;
  ai: AISettings;
  theme: 'light' | 'dark';
}

interface StoreState extends PersistedState {
  /** builtin + extra をマージし、disabledIds を反映した出題対象（派生・非永続） */
  allQuestions: Question[];

  recomputeQuestions: () => void;
  addQuestions: (qs: Question[]) => { added: number };
  removeQuestion: (id: string) => void;
  setQuestionEnabled: (id: string, enabled: boolean) => void;

  recordAnswer: (questionId: string, isCorrect: boolean) => void;
  toggleBookmark: (questionId: string) => void;
  addSession: (record: SessionRecord) => void;

  updateSettings: (partial: Partial<AppSettings>) => void;
  updateDistribution: (dist: MockDistribution) => void;
  setAISettings: (partial: Partial<AISettings>) => void;
  setTheme: (theme: 'light' | 'dark') => void;

  resetProgress: () => void;
  resetAll: () => void;
  importData: (data: Partial<PersistedState>) => void;
}

function computeAll(extra: Question[], disabled: Record<string, true>): Question[] {
  return mergeQuestions(extra).map((q) => ({
    ...q,
    enabled: disabled[q.id] ? false : q.enabled !== false,
  }));
}

function ensureStat(stats: Record<string, QuestionStat>, id: string): QuestionStat {
  return (
    stats[id] ?? { questionId: id, correctCount: 0, wrongCount: 0, bookmarked: false }
  );
}

export const useStore = create<StoreState>()(
  persist(
    (set) => ({
      extraQuestions: [],
      disabledIds: {},
      questionStats: {},
      sessions: [],
      settings: defaultSettings,
      ai: defaultAI,
      theme: 'light',
      allQuestions: computeAll([], {}),

      recomputeQuestions: () =>
        set((s) => ({ allQuestions: computeAll(s.extraQuestions, s.disabledIds) })),

      addQuestions: (qs) => {
        let added = 0;
        set((s) => {
          const existing = new Map(s.extraQuestions.map((q) => [q.id, q]));
          const builtinIds = new Set(builtinQuestions.map((q) => q.id));
          for (const q of qs) {
            // ID 衝突を避ける（builtin / 既存 extra と重複したら採番し直す）
            let id = q.id;
            while (builtinIds.has(id) || existing.has(id)) {
              id = `${q.origin === 'imported' ? 'imp' : 'ai'}-${Date.now()}-${Math.floor(
                Math.random() * 1e6,
              )}`;
            }
            existing.set(id, { ...q, id });
            added += 1;
          }
          const extraQuestions = Array.from(existing.values());
          return { extraQuestions, allQuestions: computeAll(extraQuestions, s.disabledIds) };
        });
        return { added };
      },

      removeQuestion: (id) =>
        set((s) => {
          const extraQuestions = s.extraQuestions.filter((q) => q.id !== id);
          return { extraQuestions, allQuestions: computeAll(extraQuestions, s.disabledIds) };
        }),

      setQuestionEnabled: (id, enabled) =>
        set((s) => {
          const disabledIds = { ...s.disabledIds };
          if (enabled) delete disabledIds[id];
          else disabledIds[id] = true;
          return { disabledIds, allQuestions: computeAll(s.extraQuestions, disabledIds) };
        }),

      recordAnswer: (questionId, isCorrect) =>
        set((s) => {
          const prev = ensureStat(s.questionStats, questionId);
          const next: QuestionStat = {
            ...prev,
            correctCount: prev.correctCount + (isCorrect ? 1 : 0),
            wrongCount: prev.wrongCount + (isCorrect ? 0 : 1),
            lastAnsweredAt: new Date().toISOString(),
          };
          return { questionStats: { ...s.questionStats, [questionId]: next } };
        }),

      toggleBookmark: (questionId) =>
        set((s) => {
          const prev = ensureStat(s.questionStats, questionId);
          return {
            questionStats: {
              ...s.questionStats,
              [questionId]: { ...prev, bookmarked: !prev.bookmarked },
            },
          };
        }),

      addSession: (record) => set((s) => ({ sessions: [record, ...s.sessions].slice(0, 500) })),

      updateSettings: (partial) => set((s) => ({ settings: { ...s.settings, ...partial } })),
      updateDistribution: (dist) =>
        set((s) => ({ settings: { ...s.settings, mockDistribution: dist } })),
      setAISettings: (partial) => set((s) => ({ ai: { ...s.ai, ...partial } })),
      setTheme: (theme) => set({ theme }),

      resetProgress: () => set({ questionStats: {}, sessions: [] }),
      resetAll: () =>
        set((s) => ({
          questionStats: {},
          sessions: [],
          extraQuestions: [],
          disabledIds: {},
          allQuestions: computeAll([], {}),
          settings: s.settings,
          ai: s.ai,
        })),

      importData: (data) =>
        set((s) => {
          const extraQuestions = data.extraQuestions ?? s.extraQuestions;
          const disabledIds = data.disabledIds ?? s.disabledIds;
          return {
            extraQuestions,
            disabledIds,
            questionStats: data.questionStats ?? s.questionStats,
            sessions: data.sessions ?? s.sessions,
            settings: data.settings ? { ...s.settings, ...data.settings } : s.settings,
            allQuestions: computeAll(extraQuestions, disabledIds),
          };
        }),
    }),
    {
      name: STORAGE_KEY,
      partialize: (s): PersistedState => ({
        extraQuestions: s.extraQuestions,
        disabledIds: s.disabledIds,
        questionStats: s.questionStats,
        sessions: s.sessions,
        settings: s.settings,
        ai: s.ai,
        theme: s.theme,
      }),
      onRehydrateStorage: () => (state) => {
        // 復元後に派生 allQuestions を再計算
        state?.recomputeQuestions();
      },
    },
  ),
);
