import { useEffect, useMemo, useState } from 'react';
import { Brain, Eye, EyeOff, KeyRound, Loader2, Sparkles, Trash2 } from 'lucide-react';
import { SystemWindow } from './SystemWindow';
import { useAiSettings } from '../hooks/useAiSettings';
import { buildMealReviewMessage, requestMealReview, type AiRange } from '../lib/mealAi';
import type { MealEntry, NutritionTarget } from '../types';

interface Props {
  uid: string;
  meals: MealEntry[];
  today: string;
  target: NutritionTarget | null;
}

interface StoredResult {
  range: AiRange;
  text: string;
  at: number;
}

const resultKey = (uid: string) => `slu:mealAiResult:${uid}`;

function fmtTime(t: number): string {
  const d = new Date(t);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const RANGE_LABEL: Record<AiRange, string> = { day: '今日', week: '今週' };

export function MealAiPanel({ uid, meals, today, target }: Props) {
  const { apiKey, model, hasKey, setApiKey, setModel, clearKey } = useAiSettings(uid);

  const [range, setRange] = useState<AiRange>('day');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<StoredResult | null>(null);

  const [showSettings, setShowSettings] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [keyDraft, setKeyDraft] = useState('');

  // Restore the last review so it survives tab switches / reloads (the meal
  // tab unmounts when you navigate away).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(resultKey(uid));
      const parsed = raw ? (JSON.parse(raw) as StoredResult) : null;
      setResult(parsed && typeof parsed.text === 'string' ? parsed : null);
    } catch {
      setResult(null);
    }
  }, [uid]);

  // Keep the editable key draft in sync with the stored value.
  useEffect(() => {
    setKeyDraft(apiKey);
  }, [apiKey]);

  // Nudge the user to enter a key the first time.
  useEffect(() => {
    if (!hasKey) setShowSettings(true);
  }, [hasKey]);

  const hasDataForRange = useMemo(() => {
    if (range === 'day') return meals.some((m) => m.date === today);
    return meals.length > 0;
  }, [meals, range, today]);

  const run = async () => {
    if (busy || !target || !hasKey || !hasDataForRange) return;
    setBusy(true);
    setError(null);
    try {
      const message = buildMealReviewMessage(meals, target, range, today);
      const text = await requestMealReview({ apiKey, model, message });
      const stored: StoredResult = { range, text, at: Date.now() };
      setResult(stored);
      try {
        localStorage.setItem(resultKey(uid), JSON.stringify(stored));
      } catch {
        /* ignore — best effort */
      }
    } catch (err) {
      console.error('[meal:ai] review failed', err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const saveKey = () => {
    setApiKey(keyDraft);
    if (keyDraft.trim()) setShowSettings(false);
  };

  const removeKey = () => {
    clearKey();
    setKeyDraft('');
    setShowKey(false);
  };

  return (
    <SystemWindow title="AI Coach" subtitle="meal review">
      <div className="space-y-3">
        <p className="flex items-center gap-1.5 text-[11px] text-sys-muted">
          <Brain className="h-3.5 w-3.5" />
          記録した食事を AI が評価し、改善のヒントを返します。
        </p>

        {/* Range toggle */}
        <div className="flex gap-1.5">
          {(['day', 'week'] as AiRange[]).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              className={`border px-3 py-1 text-xs transition ${
                range === r
                  ? 'border-sys-accent bg-sys-accent/10 text-sys-accent'
                  : 'border-sys-border/30 text-sys-muted hover:text-sys-text'
              }`}
            >
              {RANGE_LABEL[r]}
            </button>
          ))}
        </div>

        {/* Run button */}
        <button
          type="button"
          onClick={() => void run()}
          disabled={busy || !target || !hasKey || !hasDataForRange}
          className="sys-button w-full justify-center"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {busy ? '評価中…' : `${RANGE_LABEL[range]}の食事を AI 評価`}
        </button>

        {/* Guard messages */}
        {!target && (
          <p className="text-[11px] text-sys-muted">
            ※ 先に「Goal」で1日の栄養目標を設定してください。
          </p>
        )}
        {target && !hasKey && (
          <p className="text-[11px] text-sys-muted">
            ※ 下の「API 設定」で Gemini の API キーを登録すると評価できます。
          </p>
        )}
        {target && hasKey && !hasDataForRange && (
          <p className="text-[11px] text-sys-muted">
            ※ {RANGE_LABEL[range]}の食事記録がありません。
          </p>
        )}

        {error && (
          <div className="border border-sys-danger/60 bg-sys-danger/10 p-2 text-xs text-sys-danger">
            {error}
          </div>
        )}

        {/* Result */}
        {result && (
          <div className="border border-sys-border/30 bg-black/30 p-3">
            <div className="mb-1.5 flex items-center justify-between text-[10px] uppercase tracking-widest text-sys-muted">
              <span className="text-sys-accent">{RANGE_LABEL[result.range]}の評価</span>
              <span className="font-mono">{fmtTime(result.at)}</span>
            </div>
            <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-sys-text/90">
              {result.text}
            </p>
          </div>
        )}

        {/* API settings */}
        <details
          className="border-t border-sys-border/20 pt-3"
          open={showSettings}
          onToggle={(e) => setShowSettings((e.target as HTMLDetailsElement).open)}
        >
          <summary className="flex cursor-pointer items-center gap-1.5 text-xs uppercase tracking-widest text-sys-muted hover:text-sys-text">
            <KeyRound className="h-3.5 w-3.5" />
            API 設定 {hasKey ? <span className="text-sys-ok">(設定済み)</span> : <span className="text-sys-danger/80">(未設定)</span>}
          </summary>

          <div className="mt-3 space-y-3">
            <label className="block">
              <span className="mb-1 block text-[10px] uppercase tracking-widest text-sys-muted">
                Gemini API キー
              </span>
              <div className="flex gap-2">
                <input
                  type={showKey ? 'text' : 'password'}
                  className="sys-input flex-1 font-mono text-xs"
                  value={keyDraft}
                  onChange={(e) => setKeyDraft(e.target.value)}
                  placeholder="AIza..."
                  autoComplete="off"
                  spellCheck={false}
                />
                <button
                  type="button"
                  onClick={() => setShowKey((s) => !s)}
                  className="border border-sys-border/40 px-2 text-sys-muted hover:text-sys-text"
                  aria-label={showKey ? 'キーを隠す' : 'キーを表示'}
                  title={showKey ? 'キーを隠す' : 'キーを表示'}
                >
                  {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </label>

            <label className="block">
              <span className="mb-1 block text-[10px] uppercase tracking-widest text-sys-muted">
                モデル名
              </span>
              <input
                type="text"
                className="sys-input font-mono text-xs"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="gemini-2.5-flash"
                autoComplete="off"
                spellCheck={false}
              />
            </label>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={saveKey}
                disabled={keyDraft.trim() === apiKey}
                className="sys-button flex-1 justify-center"
              >
                保存
              </button>
              {hasKey && (
                <button
                  type="button"
                  onClick={removeKey}
                  className="inline-flex items-center gap-1 border border-sys-border/40 px-3 text-xs text-sys-muted hover:text-sys-danger"
                >
                  <Trash2 className="h-3.5 w-3.5" /> 削除
                </button>
              )}
            </div>

            <p className="text-[10px] leading-relaxed text-sys-muted/80">
              キーはこの端末のブラウザ内にのみ保存され、評価リクエスト時に Gemini API
              へ送信される以外に外部送信はされません。無料枠で利用できます。
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
                className="ml-1 underline hover:text-sys-accent"
              >
                キーの取得 (Google AI Studio)
              </a>
            </p>
          </div>
        </details>
      </div>
    </SystemWindow>
  );
}
