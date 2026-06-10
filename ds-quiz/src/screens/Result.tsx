import { useMemo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Check, Home, RefreshCcw, X } from 'lucide-react';
import type { SessionRecord } from '../types/question';
import { useStore } from '../store/useStore';
import { toQuestionMap } from '../lib/questions';
import { formatDuration, formatPercent, gradeSession } from '../lib/scoring';
import { CategoryBarChart } from '../components/charts';
import CategoryBadge from '../components/CategoryBadge';

const MODE_LABEL: Record<string, string> = {
  practice: '分野別練習',
  random: 'ランダム練習',
  mock: '模擬試験',
  review: '復習',
};

export default function Result() {
  const location = useLocation();
  const navigate = useNavigate();
  const questions = useStore((s) => s.allQuestions);
  const sessions = useStore((s) => s.sessions);
  const passThreshold = useStore((s) => s.settings.passThreshold);

  const state = location.state as { record?: SessionRecord } | null;
  const record = state?.record ?? sessions[0];

  const result = useMemo(() => {
    if (!record) return null;
    return gradeSession(record, toQuestionMap(questions), record.mode === 'mock' ? passThreshold : undefined);
  }, [record, questions, passThreshold]);

  if (!record || !result) {
    return (
      <div className="card text-center">
        <p className="mb-3">表示できる結果がありません。</p>
        <Link to="/" className="btn-primary">ホームへ</Link>
      </div>
    );
  }

  const qmap = toQuestionMap(questions);
  const isMock = record.mode === 'mock';

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold">結果サマリ</h1>

      <section className="card text-center">
        <div className="text-sm text-slate-500 dark:text-slate-400">
          {MODE_LABEL[record.mode]} ・ {formatDuration(record.durationSec)}
        </div>
        <div className="my-2 text-5xl font-bold tabular-nums">{formatPercent(result.rate)}</div>
        <div className="text-slate-600 dark:text-slate-300">
          {result.correct} / {result.total} 問正解
        </div>
        {isMock && result.passed != null && (
          <div
            className={`mx-auto mt-3 inline-flex items-center gap-2 rounded-xl px-4 py-2 font-bold ${
              result.passed
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200'
                : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-200'
            }`}
          >
            {result.passed ? <Check size={20} /> : <X size={20} />}
            {result.passed ? '合格ライン到達' : '合格ライン未達'}（基準 {Math.round(passThreshold * 100)}%）
          </div>
        )}
      </section>

      {result.byCategory.length > 0 && (
        <section className="card">
          <h2 className="mb-2 font-semibold">分野別正答率</h2>
          <CategoryBarChart data={result.byCategory} />
        </section>
      )}

      <section className="card">
        <h2 className="mb-3 font-semibold">解答一覧</h2>
        <ul className="space-y-2">
          {record.answers.map((a, i) => {
            const q = qmap.get(a.questionId);
            if (!q) return null;
            return (
              <li key={a.questionId} className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                <div className="flex items-start gap-2">
                  <span className={`mt-0.5 ${a.isCorrect ? 'text-emerald-600' : 'text-red-600'}`}>
                    {a.isCorrect ? <Check size={18} /> : <X size={18} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <span className="text-xs font-mono text-slate-400">Q{i + 1}</span>
                      <CategoryBadge category={q.category} />
                    </div>
                    <div className="text-sm">{q.question}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      あなた: {a.selected.join(', ') || '（未回答）'} / 正解: {q.answer.join(', ')}
                    </div>
                    {!a.isCorrect && (
                      <details className="mt-1 text-xs">
                        <summary className="cursor-pointer text-brand-600">解説を見る</summary>
                        <p className="mt-1 text-slate-600 dark:text-slate-300">{q.explanation}</p>
                      </details>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="flex flex-wrap gap-2">
        <button onClick={() => navigate('/')} className="btn-ghost"><Home size={16} /> ホーム</button>
        <Link to="/review" className="btn-ghost"><RefreshCcw size={16} /> 復習する</Link>
        <Link to="/setup" className="btn-primary ml-auto">もう一度</Link>
      </section>
    </div>
  );
}
