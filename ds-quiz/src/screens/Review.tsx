import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bookmark, Play, RefreshCcw } from 'lucide-react';
import { useStore } from '../store/useStore';
import { useQuiz } from '../store/useQuiz';
import { enabledOnly, selectReview } from '../lib/quiz';
import CategoryBadge from '../components/CategoryBadge';

type Filter = 'all' | 'wrong' | 'bookmark';

export default function Review() {
  const navigate = useNavigate();
  const questions = useStore((s) => s.allQuestions);
  const stats = useStore((s) => s.questionStats);
  const start = useQuiz((s) => s.start);
  const [filter, setFilter] = useState<Filter>('all');

  const items = useMemo(() => {
    const reviewable = selectReview(questions, stats, 'all');
    if (filter === 'wrong') return reviewable.filter((q) => (stats[q.id]?.wrongCount ?? 0) > 0);
    if (filter === 'bookmark') return enabledOnly(questions).filter((q) => stats[q.id]?.bookmarked);
    return reviewable;
  }, [questions, stats, filter]);

  const handleStart = () => {
    if (items.length === 0) return;
    start({ mode: 'review', questions: items, immediateFeedback: true });
    navigate('/quiz');
  };

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold">復習</h1>
      <p className="text-sm text-slate-500 dark:text-slate-400">
        誤答・ブックマークした問題を再演習します。誤答回数が多い問題を優先して出題します（間隔反復ライト）。
      </p>

      <div className="flex gap-2">
        {([
          ['all', '誤答+ブックマーク'],
          ['wrong', '誤答のみ'],
          ['bookmark', 'ブックマークのみ'],
        ] as [Filter, string][]).map(([f, label]) => (
          <button key={f} onClick={() => setFilter(f)} className={`btn ${filter === f ? 'bg-brand-600 text-white' : 'btn-ghost'}`}>
            {label}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <span className="text-sm text-slate-500">対象 <strong className="tabular-nums">{items.length}</strong> 問</span>
        <button onClick={handleStart} disabled={items.length === 0} className="btn-primary">
          <Play size={18} /> 復習を開始
        </button>
      </div>

      {items.length === 0 ? (
        <div className="card text-center text-slate-500">
          <RefreshCcw size={28} className="mx-auto mb-2 opacity-50" />
          対象の問題がありません。練習や模擬試験で誤答すると、ここに溜まっていきます。
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((q) => {
            const s = stats[q.id];
            return (
              <li key={q.id} className="card flex items-start gap-3 !p-3">
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <CategoryBadge category={q.category} />
                    {s?.bookmarked && <Bookmark size={14} className="text-amber-500" fill="currentColor" />}
                  </div>
                  <div className="text-sm">{q.question}</div>
                </div>
                <div className="shrink-0 text-right text-xs text-slate-400">
                  <div>誤答 {s?.wrongCount ?? 0}</div>
                  <div>正答 {s?.correctCount ?? 0}</div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
