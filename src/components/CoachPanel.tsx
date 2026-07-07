import { useEffect, useRef, useState } from 'react';
import { Cpu, Download, Loader2, Send, ShieldCheck, Trash2, X, Zap } from 'lucide-react';
import { SystemWindow } from './SystemWindow';
import type { CoachContext } from '../lib/coach/context';
import type { CoachMessage } from '../lib/coach/engine';
import type { CoachEngineApi } from '../hooks/useCoachEngine';
import type { CoachModelOption } from '../lib/coach/webllm';

interface Props {
  open: boolean;
  uid: string;
  ctx: CoachContext | null;
  engine: CoachEngineApi;
  onClose: () => void;
}

const historyKeyOf = (uid: string) => `slu:coachChat:${uid}`;
const MAX_TURNS = 20;

function loadHistory(uid: string): CoachMessage[] {
  try {
    const raw = sessionStorage.getItem(historyKeyOf(uid));
    return raw ? (JSON.parse(raw) as CoachMessage[]) : [];
  } catch {
    return [];
  }
}

export function CoachPanel({ open, uid, ctx, engine, onClose }: Props) {
  const [history, setHistory] = useState<CoachMessage[]>(() => loadHistory(uid));
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState('');
  const [busy, setBusy] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [models, setModels] = useState<CoachModelOption[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      sessionStorage.setItem(historyKeyOf(uid), JSON.stringify(history.slice(-MAX_TURNS * 2)));
    } catch {
      /* best effort */
    }
  }, [history, uid]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [history, streaming]);

  // Lazily fetch the available on-device models when the settings pane opens.
  useEffect(() => {
    if (!showSettings || models.length > 0 || !engine.webgpu) return;
    let cancelled = false;
    (async () => {
      const { listAvailableModels } = await import('../lib/coach/webllm');
      const list = await listAvailableModels();
      if (!cancelled) setModels(list);
    })();
    return () => {
      cancelled = true;
    };
  }, [showSettings, models.length, engine.webgpu]);

  if (!open) return null;

  const send = async () => {
    const text = input.trim();
    if (!text || busy || !ctx) return;
    const next: CoachMessage[] = [...history, { role: 'user', text }];
    setHistory(next);
    setInput('');
    setBusy(true);
    setStreaming('');
    let acc = '';
    try {
      const reply = await engine.chat(ctx, next, (t) => {
        acc += t;
        setStreaming(acc);
      });
      setHistory([...next, { role: 'assistant', text: reply || acc }]);
    } catch (err) {
      console.error('[coach] send failed', err);
      setHistory([...next, { role: 'assistant', text: '応答の生成に失敗しました。もう一度お試しください。' }]);
    } finally {
      setStreaming('');
      setBusy(false);
    }
  };

  const clearChat = () => {
    setHistory([]);
    try {
      sessionStorage.removeItem(historyKeyOf(uid));
    } catch {
      /* best effort */
    }
  };

  const engineLabel =
    engine.status === 'ready'
      ? '端末内AI'
      : engine.status === 'loading'
        ? '読み込み中'
        : 'ルールベース';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/70 px-4 py-6 backdrop-blur-sm"
      onClick={onClose}
    >
      <div className="my-auto w-full max-w-2xl" onClick={(e) => e.stopPropagation()}>
        <SystemWindow title="AI Coach" subtitle="アリア">
          <div className="mb-3 flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-widest text-sys-muted">
              {engine.status === 'ready' ? <Cpu className="h-3.5 w-3.5" /> : <Zap className="h-3.5 w-3.5" />}
              {engineLabel}
            </span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setShowSettings((s) => !s)}
                className="text-[11px] text-sys-muted hover:text-sys-accent transition"
              >
                {showSettings ? '会話へ戻る' : '端末内AI設定'}
              </button>
              <button type="button" onClick={onClose} className="text-sys-muted hover:text-sys-text" aria-label="閉じる">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {showSettings ? (
            <ModelSettings engine={engine} models={models} />
          ) : (
            <>
              <div
                ref={scrollRef}
                className="mb-3 h-[22rem] space-y-3 overflow-y-auto pr-1.5 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-sys-border/40"
              >
                {history.length === 0 && !streaming && (
                  <p className="mt-8 text-center text-xs text-sys-muted/80">
                    記録をもとに相談できます。<br />
                    「今日は何をやればいい?」「連続はどう?」など お気軽に。
                  </p>
                )}
                {history.map((m, i) => (
                  <Bubble key={i} role={m.role} text={m.text} />
                ))}
                {streaming && <Bubble role="assistant" text={streaming} />}
                {busy && !streaming && (
                  <div className="flex items-center gap-2 text-xs text-sys-muted">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> 考えています…
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 border-t border-sys-border/20 pt-3">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.nativeEvent.isComposing && send()}
                  placeholder="メッセージを入力…"
                  disabled={busy}
                  className="flex-1 bg-transparent border border-sys-border/40 px-3 py-2 text-sm text-sys-text placeholder:text-sys-muted/60 focus:border-sys-accent focus:outline-none disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={send}
                  disabled={busy || !input.trim()}
                  className="sys-button disabled:opacity-40"
                  aria-label="送信"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
              {history.length > 0 && (
                <button
                  type="button"
                  onClick={clearChat}
                  className="mt-2 text-[10px] text-sys-muted/70 hover:text-sys-muted"
                >
                  会話履歴をクリア
                </button>
              )}
            </>
          )}
        </SystemWindow>
      </div>
    </div>
  );
}

function Bubble({ role, text }: { role: 'user' | 'assistant'; text: string }) {
  const mine = role === 'user';
  return (
    <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] whitespace-pre-wrap px-3 py-2 text-sm leading-relaxed ${
          mine
            ? 'bg-sys-accent/15 text-sys-text border border-sys-accent/30'
            : 'bg-sys-border/10 text-sys-text border border-sys-border/30'
        }`}
      >
        {text}
      </div>
    </div>
  );
}

function ModelSettings({ engine, models }: { engine: CoachEngineApi; models: CoachModelOption[] }) {
  if (!engine.webgpu) {
    return (
      <div className="space-y-3 py-4 text-sm text-sys-muted">
        <p className="flex items-center gap-2 text-sys-text">
          <Cpu className="h-4 w-4" /> 端末内AIは この端末では使えません
        </p>
        <p className="text-xs leading-relaxed">
          お使いのブラウザが WebGPU に対応していないため、ローカルモデルを実行できません。
          Chrome / Edge のデスクトップ版、または対応 Android 端末でお試しください。
          コーチのダイジェストと基本的な相談は、この端末でもそのまま使えます。
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3 py-1">
      <p className="text-xs leading-relaxed text-sys-muted">
        端末内でAIを動かすと、完全無料・回数無制限・オフラインで相談できます。記録は端末の外に出ません。
        モデルは初回のみダウンロードします(Wi-Fi 推奨)。
      </p>

      {engine.status === 'loading' && engine.progress && (
        <div className="border border-sys-accent/30 px-3 py-2">
          <p className="flex items-center gap-2 text-xs text-sys-accent">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            {engine.progress.text || '読み込み中…'}
          </p>
          <div className="mt-2 h-1 w-full bg-sys-border/20">
            <div
              className="h-full bg-sys-accent transition-all"
              style={{ width: `${Math.round((engine.progress.progress || 0) * 100)}%` }}
            />
          </div>
        </div>
      )}

      {engine.status === 'ready' && (
        <div className="flex items-center justify-between border border-emerald-500/30 px-3 py-2">
          <span className="flex items-center gap-2 text-xs text-emerald-300">
            <ShieldCheck className="h-3.5 w-3.5" /> 有効: {engine.modelId}
          </span>
          <button
            type="button"
            onClick={() => engine.removeModel()}
            className="flex items-center gap-1 text-[11px] text-sys-muted hover:text-rose-300"
          >
            <Trash2 className="h-3.5 w-3.5" /> 削除
          </button>
        </div>
      )}

      {engine.error && <p className="text-xs text-rose-300">{engine.error}</p>}

      {engine.status !== 'loading' && (
        <div className="space-y-2">
          {models.length === 0 ? (
            <p className="flex items-center gap-2 text-xs text-sys-muted">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> モデル一覧を取得中…
            </p>
          ) : (
            models.map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between border border-sys-border/30 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="text-sm text-sys-text">
                    {m.label} <span className="text-[10px] text-sys-muted">{m.sizeLabel}</span>
                  </p>
                  {m.note && <p className="text-[10px] text-sys-muted/80">{m.note}</p>}
                </div>
                <button
                  type="button"
                  onClick={() => engine.downloadModel(m.id)}
                  disabled={engine.status === 'ready' && engine.modelId === m.id}
                  className="sys-button shrink-0 disabled:opacity-40"
                >
                  <Download className="h-3.5 w-3.5" />
                  {engine.status === 'ready' && engine.modelId === m.id ? '使用中' : '取得'}
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
