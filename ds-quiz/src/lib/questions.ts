import builtinRaw from '../data/questions.json';
import type { Question } from '../types/question';

/** 同梱（builtin）の問題バンク。ビルドに含まれる静的JSON。 */
export const builtinQuestions: Question[] = (builtinRaw as Question[]).map((q) => ({
  ...q,
  origin: 'builtin',
  enabled: q.enabled !== false,
}));

/**
 * 同梱問題と、localStorage 由来（AI生成・インポート）の追加問題をマージする。
 * ID が衝突した場合は追加問題（後勝ち）で上書きする。
 */
export function mergeQuestions(extra: Question[]): Question[] {
  const map = new Map<string, Question>();
  for (const q of builtinQuestions) map.set(q.id, q);
  for (const q of extra) map.set(q.id, q);
  return Array.from(map.values());
}

export function toQuestionMap(questions: Question[]): Map<string, Question> {
  return new Map(questions.map((q) => [q.id, q]));
}
