import { useRef, useState } from 'react';
import { AlertTriangle, Download, Eye, EyeOff, KeyRound, Trash2, Upload } from 'lucide-react';
import { CATEGORIES, type MockDistribution } from '../types/question';
import { useStore } from '../store/useStore';
import { validateQuestions } from '../lib/validate';

const MODELS = [
  { id: 'claude-sonnet-4-6', label: 'claude-sonnet-4-6（既定・バランス）' },
  { id: 'claude-haiku-4-5', label: 'claude-haiku-4-5（低コスト）' },
];

export default function Settings() {
  const settings = useStore((s) => s.settings);
  const ai = useStore((s) => s.ai);
  const updateSettings = useStore((s) => s.updateSettings);
  const updateDistribution = useStore((s) => s.updateDistribution);
  const setAISettings = useStore((s) => s.setAISettings);
  const resetProgress = useStore((s) => s.resetProgress);
  const resetAll = useStore((s) => s.resetAll);
  const addQuestions = useStore((s) => s.addQuestions);
  const store = useStore;

  const [showKey, setShowKey] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const qFileRef = useRef<HTMLInputElement>(null);

  const distTotal = CATEGORIES.reduce((s, c) => s + (settings.mockDistribution[c] ?? 0), 0);

  const setDist = (cat: keyof MockDistribution, value: number) => {
    updateDistribution({ ...settings.mockDistribution, [cat]: Math.max(0, value) });
  };

  const exportAll = () => {
    const s = store.getState();
    const data = {
      _type: 'ds-quiz-backup',
      exportedAt: new Date().toISOString(),
      extraQuestions: s.extraQuestions,
      disabledIds: s.disabledIds,
      questionStats: s.questionStats,
      sessions: s.sessions,
      settings: s.settings,
    };
    download(data, `ds-quiz-backup-${Date.now()}.json`);
  };

  const exportQuestions = () => {
    // 方式A の問題バンク取り込み用：問題配列のみ
    const s = store.getState();
    download(s.extraQuestions, `ds-quiz-questions-${Date.now()}.json`);
  };

  const download = (data: unknown, filename: string) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportBackup = async (file: File) => {
    try {
      const data = JSON.parse(await file.text());
      store.getState().importData(data);
      setMsg('バックアップを取り込みました。');
    } catch {
      setMsg('インポートに失敗しました（JSONを確認してください）。');
    }
  };

  const handleImportQuestions = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text());
      const list = Array.isArray(parsed) ? parsed : parsed.extraQuestions ?? [];
      const { questions, errors } = validateQuestions(list);
      if (questions.length === 0) {
        setMsg(`取り込める問題がありませんでした。${errors.slice(0, 2).join(' / ')}`);
        return;
      }
      const { added } = addQuestions(questions.map((q) => ({ ...q, origin: 'imported' as const })));
      setMsg(`${added} 問をインポートしました${errors.length ? `（${errors.length}件はスキップ）` : ''}。`);
    } catch {
      setMsg('インポートに失敗しました（JSONを確認してください）。');
    }
  };

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold">設定</h1>
      {msg && <div className="rounded-xl bg-brand-50 p-3 text-sm text-brand-800 dark:bg-brand-900/30 dark:text-brand-200">{msg}</div>}

      {/* 模擬試験設定 */}
      <section className="card space-y-3">
        <h2 className="font-semibold">模擬試験</h2>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm">問題数
            <input type="number" min={1} className="input mt-1" value={settings.mockTotal}
              onChange={(e) => updateSettings({ mockTotal: Math.max(1, Number(e.target.value)) })} />
          </label>
          <label className="text-sm">制限時間（分）
            <input type="number" min={1} className="input mt-1" value={settings.mockMinutes}
              onChange={(e) => updateSettings({ mockMinutes: Math.max(1, Number(e.target.value)) })} />
          </label>
        </div>
        <label className="block text-sm">合格ライン: <strong>{Math.round(settings.passThreshold * 100)}%</strong>
          <input type="range" min={50} max={100} step={1} className="mt-1 w-full"
            value={Math.round(settings.passThreshold * 100)}
            onChange={(e) => updateSettings({ passThreshold: Number(e.target.value) / 100 })} />
        </label>

        <div>
          <div className="mb-1 flex items-center justify-between text-sm font-medium">
            <span>カテゴリ配分（重み）</span>
            <span className="text-xs text-slate-500">合計重み {distTotal}</span>
          </div>
          <div className="space-y-2">
            {CATEGORIES.map((c) => {
              const w = settings.mockDistribution[c] ?? 0;
              const pct = distTotal > 0 ? Math.round((w / distTotal) * 100) : 0;
              return (
                <div key={c} className="flex items-center gap-2 text-sm">
                  <span className="w-44 shrink-0 truncate">{c}</span>
                  <input type="number" min={0} className="input w-20" value={w}
                    onChange={(e) => setDist(c, Number(e.target.value))} />
                  <span className="w-24 text-right text-xs text-slate-500">≒ {pct}%（{Math.round((w / (distTotal || 1)) * settings.mockTotal)}問）</span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* AI設定（BYOK） */}
      <section className="card space-y-3">
        <h2 className="flex items-center gap-2 font-semibold"><KeyRound size={18} /> AIプロバイダ設定（BYOK）</h2>
        <p className="rounded-lg bg-amber-50 p-2 text-xs text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
          APIキーは<strong>このブラウザの localStorage にのみ保存</strong>され、サーバーやリポジトリには一切送信・保存されません（持ち込み方式＝BYOK）。共用端末では使用後に「キーを消去」してください。
        </p>
        <label className="block text-sm">Anthropic APIキー
          <div className="mt-1 flex gap-2">
            <input type={showKey ? 'text' : 'password'} className="input font-mono" placeholder="sk-ant-..."
              value={ai.apiKey} onChange={(e) => setAISettings({ apiKey: e.target.value })} autoComplete="off" />
            <button className="btn-ghost !px-3" onClick={() => setShowKey((v) => !v)} aria-label={showKey ? 'キーを隠す' : 'キーを表示'}>
              {showKey ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </label>
        <label className="block text-sm">使用モデル
          <select className="input mt-1" value={ai.model} onChange={(e) => setAISettings({ model: e.target.value })}>
            {MODELS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
        </label>
        {ai.apiKey && (
          <button className="btn-ghost !text-red-600" onClick={() => setAISettings({ apiKey: '' })}>
            <Trash2 size={16} /> キーを消去
          </button>
        )}
      </section>

      {/* データ管理 */}
      <section className="card space-y-3">
        <h2 className="font-semibold">学習データの管理</h2>
        <div className="flex flex-wrap gap-2">
          <button className="btn-ghost" onClick={exportAll}><Download size={16} /> 全データを書き出し</button>
          <button className="btn-ghost" onClick={() => fileRef.current?.click()}><Upload size={16} /> バックアップ取込</button>
          <input ref={fileRef} type="file" accept="application/json" className="hidden"
            onChange={(e) => e.target.files?.[0] && handleImportBackup(e.target.files[0])} />
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-ghost" onClick={exportQuestions}><Download size={16} /> 生成/取込問題のみ書き出し</button>
          <button className="btn-ghost" onClick={() => qFileRef.current?.click()}><Upload size={16} /> 問題JSONを取込</button>
          <input ref={qFileRef} type="file" accept="application/json" className="hidden"
            onChange={(e) => e.target.files?.[0] && handleImportQuestions(e.target.files[0])} />
        </div>
      </section>

      {/* 危険な操作 */}
      <section className="card space-y-3 border-red-200 dark:border-red-900/50">
        <h2 className="flex items-center gap-2 font-semibold text-red-600"><AlertTriangle size={18} /> リセット</h2>
        <div className="flex flex-wrap gap-2">
          <button className="btn-ghost !text-red-600" onClick={() => { if (confirm('成績・履歴・統計をリセットします。よろしいですか？')) { resetProgress(); setMsg('成績データをリセットしました。'); } }}>
            成績・履歴をリセット
          </button>
          <button className="btn-ghost !text-red-600" onClick={() => { if (confirm('すべての学習データ（成績・生成問題・無効設定）を削除します。元に戻せません。よろしいですか？')) { resetAll(); setMsg('全データをリセットしました。'); } }}>
            全データを削除
          </button>
        </div>
      </section>
    </div>
  );
}
