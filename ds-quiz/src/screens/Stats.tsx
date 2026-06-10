import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { BarChart3, LineChart as LineIcon } from 'lucide-react';
import { useStore } from '../store/useStore';
import { toQuestionMap } from '../lib/questions';
import { aggregateByCategory, formatDuration, formatPercent } from '../lib/scoring';
import { CategoryBarChart, TrendLineChart, type TrendPoint } from '../components/charts';

const MODE_LABEL: Record<string, string> = {
  practice: '分野別',
  random: 'ランダム',
  mock: '模擬試験',
  review: '復習',
};

export default function Stats() {
  const questions = useStore((s) => s.allQuestions);
  const sessions = useStore((s) => s.sessions);

  const { byCategory, trend, totalAnswered, totalCorrect } = useMemo(() => {
    const qmap = toQuestionMap(questions);
    const cats = aggregateByCategory(sessions, qmap).filter((c) => c.total > 0);
    // 古い順に並べて推移を作る
    const chrono = [...sessions].reverse();
    const t: TrendPoint[] = chrono.map((s, i) => ({
      label: `${i + 1}`,
      rate: Math.round((s.correct / Math.max(1, s.total)) * 100),
    }));
    let answered = 0;
    let correct = 0;
    for (const s of sessions) {
      answered += s.total;
      correct += s.correct;
    }
    return { byCategory: cats, trend: t, totalAnswered: answered, totalCorrect: correct };
  }, [questions, sessions]);

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold">成績・履歴</h1>

      <section className="grid grid-cols-3 gap-3">
        <div className="card"><div className="text-xs text-slate-500">セッション数</div><div className="text-2xl font-bold tabular-nums">{sessions.length}</div></div>
        <div className="card"><div className="text-xs text-slate-500">通算正答率</div><div className="text-2xl font-bold tabular-nums">{totalAnswered > 0 ? formatPercent(totalCorrect / totalAnswered) : '—'}</div></div>
        <div className="card"><div className="text-xs text-slate-500">のべ解答</div><div className="text-2xl font-bold tabular-nums">{totalAnswered}</div></div>
      </section>

      {sessions.length === 0 ? (
        <div className="card text-center text-slate-500">
          まだ履歴がありません。<Link to="/setup" className="text-brand-600">演習を始める</Link>と記録されます。
        </div>
      ) : (
        <>
          {trend.length >= 2 && (
            <section className="card">
              <div className="mb-2 flex items-center gap-2"><LineIcon size={18} className="text-slate-500" /><h2 className="font-semibold">正答率の推移</h2></div>
              <TrendLineChart data={trend} />
            </section>
          )}

          {byCategory.length > 0 && (
            <section className="card">
              <div className="mb-2 flex items-center gap-2"><BarChart3 size={18} className="text-slate-500" /><h2 className="font-semibold">分野別正答率（通算）</h2></div>
              <CategoryBarChart data={byCategory} />
            </section>
          )}

          <section className="card">
            <h2 className="mb-3 font-semibold">セッション履歴</h2>
            <ul className="divide-y divide-slate-200 dark:divide-slate-800">
              {sessions.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <div>
                    <div className="font-medium">
                      {MODE_LABEL[s.mode]}
                      {s.mode === 'mock' && s.passed != null && (
                        <span className={`ml-2 chip ${s.passed ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>{s.passed ? '合格' : '未達'}</span>
                      )}
                    </div>
                    <div className="text-xs text-slate-400">
                      {new Date(s.startedAt).toLocaleString('ja-JP', { dateStyle: 'short', timeStyle: 'short' })} ・ {formatDuration(s.durationSec)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold tabular-nums">{formatPercent(s.correct / Math.max(1, s.total))}</div>
                    <div className="text-xs text-slate-400 tabular-nums">{s.correct}/{s.total}</div>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
