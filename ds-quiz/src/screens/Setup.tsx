import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Play } from 'lucide-react';
import { CATEGORIES, type Category, type Difficulty, type QuizMode } from '../types/question';
import { useStore } from '../store/useStore';
import { useQuiz } from '../store/useQuiz';
import { listSubCategories, selectMock, selectPractice } from '../lib/quiz';
import CategoryBadge from '../components/CategoryBadge';

const COUNT_OPTIONS: (number | 'all')[] = [10, 20, 50, 'all'];

export default function Setup() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const questions = useStore((s) => s.allQuestions);
  const settings = useStore((s) => s.settings);
  const start = useQuiz((s) => s.start);

  const initialMode = (params.get('mode') as QuizMode) || 'practice';
  const [mode, setMode] = useState<QuizMode>(
    ['practice', 'random', 'mock'].includes(initialMode) ? initialMode : 'practice',
  );
  const [selectedCats, setSelectedCats] = useState<Category[]>([]);
  const [subCategory, setSubCategory] = useState<string>('');
  const [difficulties, setDifficulties] = useState<Difficulty[]>([]);
  const [count, setCount] = useState<number | 'all'>(10);

  const subOptions = useMemo(
    () => listSubCategories(questions, selectedCats.length === 1 ? selectedCats[0] : undefined),
    [questions, selectedCats],
  );

  // 現在の条件で出題可能な問題数
  const availableCount = useMemo(() => {
    if (mode === 'mock') return selectMock(questions, settings.mockDistribution, settings.mockTotal).length;
    if (mode === 'random') return selectPractice(questions, {}, 'all').length;
    return selectPractice(
      questions,
      { categories: selectedCats, subCategory: subCategory || undefined, difficulties },
      'all',
    ).length;
  }, [mode, questions, settings, selectedCats, subCategory, difficulties]);

  const toggleCat = (c: Category) => {
    setSubCategory('');
    setSelectedCats((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));
  };
  const toggleDiff = (d: Difficulty) =>
    setDifficulties((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));

  const handleStart = () => {
    let qs;
    if (mode === 'mock') {
      qs = selectMock(questions, settings.mockDistribution, settings.mockTotal);
    } else if (mode === 'random') {
      qs = selectPractice(questions, {}, count);
    } else {
      qs = selectPractice(
        questions,
        { categories: selectedCats, subCategory: subCategory || undefined, difficulties },
        count,
      );
    }
    if (qs.length === 0) return;
    start({
      mode,
      questions: qs,
      immediateFeedback: mode !== 'mock',
      timeLimitSec: mode === 'mock' ? settings.mockMinutes * 60 : undefined,
    });
    navigate('/quiz');
  };

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold">出題設定</h1>

      <section className="card space-y-3">
        <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400">モード</h2>
        <div className="grid grid-cols-3 gap-2">
          {([
            ['practice', '分野別練習'],
            ['random', 'ランダム'],
            ['mock', '模擬試験'],
          ] as [QuizMode, string][]).map(([m, label]) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`btn ${mode === m ? 'bg-brand-600 text-white' : 'btn-ghost'}`}
            >
              {label}
            </button>
          ))}
        </div>
        {mode === 'mock' && (
          <p className="rounded-lg bg-brand-50 p-3 text-sm text-brand-800 dark:bg-brand-900/30 dark:text-brand-200">
            本番想定：<strong>{settings.mockTotal}問 / {settings.mockMinutes}分</strong>。
            試験中は正誤・解説を非表示にし、最後にまとめて採点します（合格ライン {Math.round(settings.passThreshold * 100)}%）。
            配分は設定画面で調整できます。
          </p>
        )}
      </section>

      {mode === 'practice' && (
        <>
          <section className="card space-y-3">
            <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400">カテゴリ（未選択=全カテゴリ）</h2>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((c) => (
                <button key={c} onClick={() => toggleCat(c)} className={selectedCats.includes(c) ? 'ring-2 ring-brand-500 rounded-full' : ''}>
                  <CategoryBadge category={c} />
                </button>
              ))}
            </div>
            {subOptions.length > 0 && (
              <div>
                <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">サブカテゴリ（任意）</label>
                <select className="input" value={subCategory} onChange={(e) => setSubCategory(e.target.value)}>
                  <option value="">すべて</option>
                  {subOptions.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            )}
          </section>

          <section className="card space-y-3">
            <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400">難易度（未選択=すべて）</h2>
            <div className="flex gap-2">
              {([1, 2, 3] as Difficulty[]).map((d) => (
                <button
                  key={d}
                  onClick={() => toggleDiff(d)}
                  className={`btn ${difficulties.includes(d) ? 'bg-brand-600 text-white' : 'btn-ghost'}`}
                >
                  {'★'.repeat(d)}
                </button>
              ))}
            </div>
          </section>
        </>
      )}

      {mode !== 'mock' && (
        <section className="card space-y-3">
          <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400">問題数</h2>
          <div className="flex flex-wrap gap-2">
            {COUNT_OPTIONS.map((c) => (
              <button
                key={String(c)}
                onClick={() => setCount(c)}
                className={`btn ${count === c ? 'bg-brand-600 text-white' : 'btn-ghost'}`}
              >
                {c === 'all' ? '全問' : `${c}問`}
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="flex items-center justify-between gap-3">
        <span className="text-sm text-slate-500 dark:text-slate-400">
          出題可能: <strong className="tabular-nums">{availableCount}</strong> 問
        </span>
        <button onClick={handleStart} disabled={availableCount === 0} className="btn-primary">
          <Play size={18} /> 開始する
        </button>
      </section>
      {availableCount === 0 && (
        <p className="text-sm text-red-600 dark:text-red-400">
          条件に合う問題がありません。条件を変えるか、AI生成・インポートで問題を追加してください。
        </p>
      )}
    </div>
  );
}
