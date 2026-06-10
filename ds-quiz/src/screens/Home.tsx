import { Link } from 'react-router-dom';
import { BarChart3, BookOpen, Database, RefreshCcw, Shuffle, Sparkles, Timer } from 'lucide-react';
import { useStore } from '../store/useStore';
import { toQuestionMap } from '../lib/questions';
import { aggregateByCategory, formatPercent } from '../lib/scoring';
import { CategoryBarChart } from '../components/charts';
import { CATEGORY_SHORT } from '../types/question';
import { useMemo } from 'react';

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card flex flex-col gap-0.5">
      <span className="text-xs text-slate-500 dark:text-slate-400">{label}</span>
      <span className="text-2xl font-bold tabular-nums">{value}</span>
      {sub && <span className="text-xs text-slate-500 dark:text-slate-400">{sub}</span>}
    </div>
  );
}

export default function Home() {
  const questions = useStore((s) => s.allQuestions);
  const stats = useStore((s) => s.questionStats);
  const sessions = useStore((s) => s.sessions);

  const { totalAnswered, totalCorrect, byCategory, weakest } = useMemo(() => {
    const qmap = toQuestionMap(questions);
    let answered = 0;
    let correct = 0;
    for (const s of Object.values(stats)) {
      answered += s.correctCount + s.wrongCount;
      correct += s.correctCount;
    }
    const cats = aggregateByCategory(sessions, qmap).filter((c) => c.total > 0);
    const weak = cats.length > 0 ? [...cats].sort((a, b) => a.rate - b.rate)[0] : null;
    return { totalAnswered: answered, totalCorrect: correct, byCategory: cats, weakest: weak };
  }, [questions, stats, sessions]);

  const enabledCount = questions.filter((q) => q.enabled !== false).length;
  const overall = totalAnswered > 0 ? totalCorrect / totalAnswered : 0;
  const lastMock = sessions.find((s) => s.mode === 'mock');

  const modes = [
    { to: '/setup?mode=practice', label: '分野別練習', desc: 'カテゴリを選んで演習', icon: BookOpen },
    { to: '/setup?mode=random', label: 'ランダム練習', desc: '全分野からランダム出題', icon: Shuffle },
    { to: '/setup?mode=mock', label: '模擬試験', desc: '本番想定 100問・100分', icon: Timer },
    { to: '/review', label: '復習', desc: '誤答・ブックマークを再演習', icon: RefreshCcw },
  ];

  return (
    <div className="space-y-5">
      <section>
        <h1 className="mb-1 text-xl font-bold">学習ダッシュボード</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          データサイエンティスト検定 リテラシーレベル（DS検定★）対策
        </p>
      </section>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="通算正答率" value={totalAnswered > 0 ? formatPercent(overall) : '—'} sub={`${totalCorrect}/${totalAnswered}問`} />
        <StatCard label="総解答数" value={`${totalAnswered}`} sub="のべ解答" />
        <StatCard label="出題可能" value={`${enabledCount}`} sub="問（有効）" />
        <StatCard
          label="苦手分野"
          value={weakest ? (CATEGORY_SHORT[weakest.category] ?? '—') : '—'}
          sub={weakest ? formatPercent(weakest.rate) : '記録なし'}
        />
      </section>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {modes.map(({ to, label, desc, icon: Icon }) => (
          <Link key={to} to={to} className="card flex items-center gap-3 transition hover:border-brand-400 hover:shadow-md">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200">
              <Icon size={22} />
            </span>
            <span>
              <span className="block font-semibold">{label}</span>
              <span className="block text-xs text-slate-500 dark:text-slate-400">{desc}</span>
            </span>
          </Link>
        ))}
      </section>

      {byCategory.length > 0 && (
        <section className="card">
          <div className="mb-2 flex items-center gap-2">
            <BarChart3 size={18} className="text-slate-500" />
            <h2 className="font-semibold">分野別正答率</h2>
          </div>
          <CategoryBarChart data={byCategory} />
        </section>
      )}

      {lastMock && (
        <section className="card flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400">直近の模擬試験</div>
            <div className="font-semibold">
              {formatPercent(lastMock.correct / lastMock.total)}（{lastMock.correct}/{lastMock.total}）
              {lastMock.passed != null && (
                <span className={`ml-2 chip ${lastMock.passed ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                  {lastMock.passed ? '合格ライン到達' : '未達'}
                </span>
              )}
            </div>
          </div>
          <Link to="/stats" className="btn-ghost">履歴を見る</Link>
        </section>
      )}

      <section className="flex flex-wrap gap-2">
        <Link to="/generate" className="btn-ghost"><Sparkles size={16} /> AIで問題を増やす</Link>
        <Link to="/questions" className="btn-ghost"><Database size={16} /> 問題管理</Link>
      </section>
    </div>
  );
}
