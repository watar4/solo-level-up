import { CATEGORIES, type Category, type Question, type SessionRecord } from '../types/question';

export interface CategoryScore {
  category: Category;
  total: number;
  correct: number;
  rate: number; // 0..1
}

export interface SessionResult {
  total: number;
  correct: number;
  rate: number; // 0..1
  byCategory: CategoryScore[];
  passed?: boolean;
}

/** セッションの採点結果（全体・カテゴリ別正答率）を算出 */
export function gradeSession(
  session: SessionRecord,
  questionMap: Map<string, Question>,
  passThreshold?: number,
): SessionResult {
  const total = session.total;
  const correct = session.correct;
  const rate = total > 0 ? correct / total : 0;

  const agg = new Map<Category, { total: number; correct: number }>();
  for (const c of CATEGORIES) agg.set(c, { total: 0, correct: 0 });

  for (const ans of session.answers) {
    const q = questionMap.get(ans.questionId);
    if (!q) continue;
    const a = agg.get(q.category)!;
    a.total += 1;
    if (ans.isCorrect) a.correct += 1;
  }

  const byCategory: CategoryScore[] = CATEGORIES.map((category) => {
    const a = agg.get(category)!;
    return {
      category,
      total: a.total,
      correct: a.correct,
      rate: a.total > 0 ? a.correct / a.total : 0,
    };
  }).filter((c) => c.total > 0);

  const passed = passThreshold != null ? rate >= passThreshold : undefined;
  return { total, correct, rate, byCategory, passed };
}

/** 全セッションを通算したカテゴリ別正答率 */
export function aggregateByCategory(
  sessions: SessionRecord[],
  questionMap: Map<string, Question>,
): CategoryScore[] {
  const agg = new Map<Category, { total: number; correct: number }>();
  for (const c of CATEGORIES) agg.set(c, { total: 0, correct: 0 });
  for (const s of sessions) {
    for (const ans of s.answers) {
      const q = questionMap.get(ans.questionId);
      if (!q) continue;
      const a = agg.get(q.category)!;
      a.total += 1;
      if (ans.isCorrect) a.correct += 1;
    }
  }
  return CATEGORIES.map((category) => {
    const a = agg.get(category)!;
    return { category, total: a.total, correct: a.correct, rate: a.total > 0 ? a.correct / a.total : 0 };
  });
}

export function formatPercent(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

export function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m === 0) return `${s}秒`;
  return `${m}分${String(s).padStart(2, '0')}秒`;
}
