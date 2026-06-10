import { useMemo, useState } from 'react';
import { Eye, EyeOff, Search, Trash2 } from 'lucide-react';
import { CATEGORIES, type Category, type QuestionOrigin } from '../types/question';
import { useStore } from '../store/useStore';
import CategoryBadge from '../components/CategoryBadge';

const ORIGIN_LABEL: Record<QuestionOrigin, string> = {
  builtin: '同梱',
  'ai-generated': 'AI生成',
  imported: 'インポート',
};

export default function QuestionManager() {
  const questions = useStore((s) => s.allQuestions);
  const setEnabled = useStore((s) => s.setQuestionEnabled);
  const removeQuestion = useStore((s) => s.removeQuestion);

  const [keyword, setKeyword] = useState('');
  const [cat, setCat] = useState<Category | ''>('');
  const [origin, setOrigin] = useState<QuestionOrigin | ''>('');

  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    return questions.filter((q) => {
      if (cat && q.category !== cat) return false;
      if (origin && q.origin !== origin) return false;
      if (kw) {
        const hay = `${q.question} ${q.subCategory ?? ''} ${(q.tags ?? []).join(' ')} ${q.id}`.toLowerCase();
        if (!hay.includes(kw)) return false;
      }
      return true;
    });
  }, [questions, keyword, cat, origin]);

  const enabledCount = questions.filter((q) => q.enabled !== false).length;

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between">
        <h1 className="text-xl font-bold">問題管理</h1>
        <span className="text-sm text-slate-500">全 {questions.length} 問 / 有効 {enabledCount} 問</span>
      </div>

      <section className="card space-y-3">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="input pl-9"
            placeholder="設問・タグ・IDで検索"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <select className="input max-w-[12rem]" value={cat} onChange={(e) => setCat(e.target.value as Category | '')}>
            <option value="">全カテゴリ</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select className="input max-w-[10rem]" value={origin} onChange={(e) => setOrigin(e.target.value as QuestionOrigin | '')}>
            <option value="">全種別</option>
            <option value="builtin">同梱</option>
            <option value="ai-generated">AI生成</option>
            <option value="imported">インポート</option>
          </select>
        </div>
      </section>

      <ul className="space-y-2">
        {filtered.map((q) => {
          const disabled = q.enabled === false;
          return (
            <li key={q.id} className={`card !p-3 ${disabled ? 'opacity-50' : ''}`}>
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs text-slate-400">{q.id}</span>
                <CategoryBadge category={q.category} />
                <span className="chip bg-slate-100 text-slate-500 dark:bg-slate-800">{'★'.repeat(q.difficulty)}</span>
                <span className="chip bg-slate-100 text-slate-500 dark:bg-slate-800">{ORIGIN_LABEL[q.origin]}</span>
                {q.type === 'multiple' && <span className="chip bg-violet-100 text-violet-700">複数</span>}
              </div>
              <div className="text-sm">{q.question}</div>
              <div className="mt-2 flex items-center gap-2">
                <button onClick={() => setEnabled(q.id, disabled)} className="btn-ghost !px-2 !py-1 text-xs">
                  {disabled ? <><Eye size={14} /> 有効化</> : <><EyeOff size={14} /> 無効化</>}
                </button>
                {q.origin !== 'builtin' && (
                  <button
                    onClick={() => { if (confirm('この問題を削除しますか？')) removeQuestion(q.id); }}
                    className="btn-ghost !px-2 !py-1 text-xs !text-red-600"
                  >
                    <Trash2 size={14} /> 削除
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {filtered.length === 0 && <div className="card text-center text-slate-500">該当する問題がありません。</div>}
    </div>
  );
}
