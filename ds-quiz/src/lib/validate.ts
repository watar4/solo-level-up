import { CATEGORIES, type Category, type Question, type QuestionType } from '../types/question';

export interface ValidationResult {
  ok: boolean;
  errors: string[];
  /** 正常化済みの問題（ok のときのみ） */
  value?: Question;
}

const TYPES: QuestionType[] = ['single', 'multiple'];

/**
 * 任意のオブジェクトが 5.1 スキーマに適合するか検証し、正常化した Question を返す。
 * AI生成・インポート問題の取り込み前チェックに使う（方式A/B・インポート共通）。
 */
export function validateQuestion(raw: unknown, index = 0): ValidationResult {
  const errors: string[] = [];
  const o = raw as Record<string, unknown>;
  const at = `[#${index}]`;

  if (!o || typeof o !== 'object') {
    return { ok: false, errors: [`${at} オブジェクトではありません`] };
  }

  const category = o.category as Category;
  if (!CATEGORIES.includes(category)) {
    errors.push(`${at} category が不正です: ${String(o.category)}`);
  }

  const type = (o.type as QuestionType) ?? 'single';
  if (!TYPES.includes(type)) {
    errors.push(`${at} type は "single" | "multiple" のいずれかです`);
  }

  const difficulty = Number(o.difficulty);
  if (![1, 2, 3].includes(difficulty)) {
    errors.push(`${at} difficulty は 1〜3 です`);
  }

  if (typeof o.question !== 'string' || !o.question.trim()) {
    errors.push(`${at} question が空です`);
  }

  const choices = Array.isArray(o.choices) ? o.choices : [];
  if (choices.length < 2) {
    errors.push(`${at} choices は2件以上必要です`);
  }
  const keys = new Set<string>();
  for (const c of choices) {
    const cc = c as Record<string, unknown>;
    if (typeof cc?.key !== 'string' || typeof cc?.text !== 'string') {
      errors.push(`${at} choices の各要素は { key, text } が必要です`);
      break;
    }
    if (keys.has(cc.key)) errors.push(`${at} choices の key が重複しています: ${cc.key}`);
    keys.add(cc.key);
  }

  const answer = Array.isArray(o.answer) ? (o.answer as unknown[]).map(String) : [];
  if (answer.length === 0) {
    errors.push(`${at} answer は1件以上必要です`);
  }
  for (const a of answer) {
    if (!keys.has(a)) errors.push(`${at} answer "${a}" が choices の key に存在しません`);
  }
  if (type === 'single' && answer.length !== 1) {
    errors.push(`${at} type=single の answer は1件です`);
  }

  if (typeof o.explanation !== 'string' || !o.explanation.trim()) {
    errors.push(`${at} explanation が空です`);
  }

  if (errors.length > 0) return { ok: false, errors };

  const value: Question = {
    id: typeof o.id === 'string' && o.id ? o.id : `tmp-${Date.now()}-${index}`,
    category,
    subCategory: typeof o.subCategory === 'string' ? o.subCategory : undefined,
    type,
    difficulty: difficulty as 1 | 2 | 3,
    question: o.question as string,
    choices: choices as Question['choices'],
    answer,
    explanation: o.explanation as string,
    tags: Array.isArray(o.tags) ? (o.tags as unknown[]).map(String) : undefined,
    imageUrl: typeof o.imageUrl === 'string' ? o.imageUrl : null,
    source: typeof o.source === 'string' ? o.source : undefined,
    origin:
      o.origin === 'ai-generated' || o.origin === 'imported' || o.origin === 'builtin'
        ? o.origin
        : 'imported',
    enabled: o.enabled === false ? false : true,
  };

  return { ok: true, errors: [], value };
}

/** 配列を一括検証。ok な問題と全エラーを返す。 */
export function validateQuestions(rawList: unknown[]): { questions: Question[]; errors: string[] } {
  const questions: Question[] = [];
  const errors: string[] = [];
  rawList.forEach((raw, i) => {
    const r = validateQuestion(raw, i);
    if (r.ok && r.value) questions.push(r.value);
    else errors.push(...r.errors);
  });
  return { questions, errors };
}
