import {
  CATEGORIES,
  type Category,
  type Difficulty,
  type MockDistribution,
  type Question,
  type QuestionStat,
} from '../types/question';

/** Fisher–Yates シャッフル（非破壊） */
export function shuffle<T>(arr: readonly T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** 有効な問題だけを対象にする（enabled !== false） */
export function enabledOnly(questions: Question[]): Question[] {
  return questions.filter((q) => q.enabled !== false);
}

export interface PracticeFilter {
  categories?: Category[];
  subCategory?: string;
  difficulties?: Difficulty[];
}

/** 分野別/ランダム練習用に条件で絞り込み、シャッフルして count 件取り出す */
export function selectPractice(
  questions: Question[],
  filter: PracticeFilter,
  count: number | 'all',
): Question[] {
  let pool = enabledOnly(questions);
  if (filter.categories && filter.categories.length > 0) {
    pool = pool.filter((q) => filter.categories!.includes(q.category));
  }
  if (filter.subCategory) {
    pool = pool.filter((q) => q.subCategory === filter.subCategory);
  }
  if (filter.difficulties && filter.difficulties.length > 0) {
    pool = pool.filter((q) => filter.difficulties!.includes(q.difficulty));
  }
  const shuffled = shuffle(pool);
  if (count === 'all') return shuffled;
  return shuffled.slice(0, count);
}

/**
 * 模擬試験用の出題。カテゴリ配分（重み）を比率に正規化し、total 問を各カテゴリに割り当てる。
 * 各カテゴリの在庫が不足した場合は他カテゴリから補充し、最終的にできるだけ total に近づける。
 */
export function selectMock(
  questions: Question[],
  distribution: MockDistribution,
  total: number,
): Question[] {
  const pool = enabledOnly(questions);
  const byCategory = new Map<Category, Question[]>();
  for (const c of CATEGORIES) byCategory.set(c, shuffle(pool.filter((q) => q.category === c)));

  const weights = CATEGORIES.map((c) => Math.max(0, distribution[c] ?? 0));
  const weightSum = weights.reduce((s, w) => s + w, 0) || 1;

  // 各カテゴリの目標数（比率で按分し四捨五入）
  const targets = new Map<Category, number>();
  CATEGORIES.forEach((c, i) => {
    targets.set(c, Math.round((weights[i] / weightSum) * total));
  });

  const picked: Question[] = [];
  for (const c of CATEGORIES) {
    const want = targets.get(c) ?? 0;
    const avail = byCategory.get(c)!;
    const take = avail.splice(0, Math.min(want, avail.length));
    picked.push(...take);
  }

  // 不足分を残り全カテゴリのプールから補充
  if (picked.length < total) {
    const rest = shuffle(CATEGORIES.flatMap((c) => byCategory.get(c)!));
    picked.push(...rest.slice(0, total - picked.length));
  }

  return shuffle(picked).slice(0, total);
}

/**
 * 復習用の出題。誤答 or ブックマークされた問題を抽出し、
 * 誤答回数が多い・直近で間違えた順（間隔反復ライト）に優先度を付けて並べる。
 */
export function selectReview(
  questions: Question[],
  stats: Record<string, QuestionStat>,
  count: number | 'all',
): Question[] {
  const pool = enabledOnly(questions).filter((q) => {
    const s = stats[q.id];
    return s && (s.bookmarked || s.wrongCount > 0);
  });

  const score = (q: Question): number => {
    const s = stats[q.id];
    if (!s) return 0;
    // 誤答が正答より多いほど、ブックマークがあるほど優先
    const wrongBias = s.wrongCount - s.correctCount;
    const bookmarkBias = s.bookmarked ? 2 : 0;
    return wrongBias * 3 + bookmarkBias;
  };

  const sorted = pool.sort((a, b) => score(b) - score(a));
  if (count === 'all') return sorted;
  return sorted.slice(0, count);
}

/** 単一/複数選択の正誤判定（順不同・集合一致） */
export function isAnswerCorrect(question: Question, selected: string[]): boolean {
  const a = new Set(question.answer);
  const b = new Set(selected);
  if (a.size !== b.size) return false;
  for (const k of a) if (!b.has(k)) return false;
  return true;
}

/** カテゴリ別のサブカテゴリ一覧を抽出（出題設定の選択肢に使用） */
export function listSubCategories(questions: Question[], category?: Category): string[] {
  const set = new Set<string>();
  for (const q of enabledOnly(questions)) {
    if (category && q.category !== category) continue;
    if (q.subCategory) set.add(q.subCategory);
  }
  return Array.from(set).sort();
}
