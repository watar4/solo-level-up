import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, Check, Loader2, Sparkles, Trash2 } from 'lucide-react';
import { CATEGORIES, type Category, type Difficulty, type Question } from '../types/question';
import { useStore } from '../store/useStore';
import { AIError, generateQuestions } from '../lib/ai';
import { enabledOnly } from '../lib/quiz';
import CategoryBadge from '../components/CategoryBadge';
import Markdown from '../components/Markdown';

export default function AIGenerate() {
  const ai = useStore((s) => s.ai);
  const allQuestions = useStore((s) => s.allQuestions);
  const addQuestions = useStore((s) => s.addQuestions);

  const [category, setCategory] = useState<Category>(CATEGORIES[0]);
  const [subCategory, setSubCategory] = useState('');
  const [difficulty, setDifficulty] = useState<Difficulty>(2);
  const [count, setCount] = useState(3);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<Question[]>([]);
  const [adopted, setAdopted] = useState(false);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    setPreview([]);
    setAdopted(false);
    try {
      const avoid = enabledOnly(allQuestions)
        .filter((q) => q.category === category)
        .map((q) => q.question);
      const qs = await generateQuestions(ai, { category, subCategory: subCategory || undefined, difficulty, count, avoidQuestions: avoid });
      setPreview(qs);
    } catch (e) {
      if (e instanceof AIError) {
        setError(
          e.kind === 'no-key'
            ? 'APIキーが未設定です。設定画面で入力してください。'
            : e.message,
        );
      } else {
        setError((e as Error).message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAdopt = () => {
    const { added } = addQuestions(preview);
    setAdopted(true);
    setPreview([]);
    setError(null);
    alert(`${added} 問を問題バンクに追加しました。`);
  };

  return (
    <div className="space-y-5">
      <h1 className="flex items-center gap-2 text-xl font-bold"><Sparkles size={22} className="text-brand-600" /> AI問題生成</h1>
      <p className="text-sm text-slate-500 dark:text-slate-400">
        あなたのAnthropic APIキー（BYOK）でブラウザから直接生成します。生成結果はプレビューで確認してから採用してください。
        オフライン環境やキー未設定では利用できません。
      </p>

      {!ai.apiKey && (
        <div className="flex items-center gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
          <AlertCircle size={18} />
          APIキーが未設定です。<Link to="/settings" className="font-semibold underline">設定画面</Link>で入力してください。
        </div>
      )}

      <section className="card space-y-3">
        <label className="block text-sm">カテゴリ
          <select className="input mt-1" value={category} onChange={(e) => setCategory(e.target.value as Category)}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <label className="block text-sm">サブカテゴリ（任意）
          <input className="input mt-1" placeholder="例: 統計数理基礎、SQL など" value={subCategory} onChange={(e) => setSubCategory(e.target.value)} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm">難易度
            <select className="input mt-1" value={difficulty} onChange={(e) => setDifficulty(Number(e.target.value) as Difficulty)}>
              <option value={1}>★（易）</option>
              <option value={2}>★★（中）</option>
              <option value={3}>★★★（難）</option>
            </select>
          </label>
          <label className="block text-sm">問題数
            <input type="number" min={1} max={10} className="input mt-1" value={count}
              onChange={(e) => setCount(Math.min(10, Math.max(1, Number(e.target.value))))} />
          </label>
        </div>
        <button onClick={handleGenerate} disabled={loading || !ai.apiKey} className="btn-primary w-full">
          {loading ? <><Loader2 size={18} className="animate-spin" /> 生成中…</> : <><Sparkles size={18} /> 生成する</>}
        </button>
        <p className="text-xs text-slate-400">モデル: {ai.model}</p>
      </section>

      {error && (
        <div className="flex items-start gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-200">
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          <div>{error}</div>
        </div>
      )}

      {adopted && (
        <div className="flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200">
          <Check size={18} /> 採用しました。問題管理・演習で利用できます。
        </div>
      )}

      {preview.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">プレビュー（{preview.length}問）</h2>
            <div className="flex gap-2">
              <button onClick={() => setPreview([])} className="btn-ghost !text-red-600"><Trash2 size={16} /> 破棄</button>
              <button onClick={handleAdopt} className="btn-primary"><Check size={16} /> 採用する</button>
            </div>
          </div>
          {preview.map((q, i) => (
            <div key={i} className="card space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <CategoryBadge category={q.category} />
                {q.subCategory && <span className="text-xs text-slate-500">{q.subCategory}</span>}
                <span className="chip bg-slate-100 text-slate-500 dark:bg-slate-800">{'★'.repeat(q.difficulty)}</span>
                {q.type === 'multiple' && <span className="chip bg-violet-100 text-violet-700">複数選択</span>}
              </div>
              <div className="font-medium"><Markdown>{q.question}</Markdown></div>
              <ul className="space-y-1 text-sm">
                {q.choices.map((c) => (
                  <li key={c.key} className={`rounded-lg border p-2 ${q.answer.includes(c.key) ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20' : 'border-slate-200 dark:border-slate-700'}`}>
                    <span className="font-mono text-xs text-slate-400">{c.key}.</span> {c.text}
                    {q.answer.includes(c.key) && <Check size={14} className="ml-1 inline text-emerald-600" />}
                  </li>
                ))}
              </ul>
              <div className="rounded-lg bg-slate-50 p-2 text-sm dark:bg-slate-800/50">
                <span className="font-semibold">解説: </span>
                <Markdown>{q.explanation}</Markdown>
              </div>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
