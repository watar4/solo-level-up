import { useEffect, useMemo, useRef, useState } from 'react';
import { WeightChart } from './WeightChart';
import { useWeights } from '../hooks/useWeights';
import { todayKey } from '../lib/leveling';
import { Scale, Plus, ArrowDown, ArrowUp, Minus, Target, Pencil, X } from 'lucide-react';

interface Props {
  uid: string;
  target?: number;
  onSetTarget?: (target: number | null) => Promise<void>;
}

const MIN_WEIGHT = 20;
const MAX_WEIGHT = 300;

// Section embedded inside StatusPanel — renders only its content (no
// SystemWindow wrapper) so the body-weight readout / chart / input form
// share the same surrounding frame as the rest of the Status block.
export function WeightPanel({ uid, target, onSetTarget }: Props) {
  const { entries, recordWeight } = useWeights(uid);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Target-weight inline editor — mirrors the rename UX in StatusPanel.
  const [targetEditing, setTargetEditing] = useState(false);
  const [targetDraft, setTargetDraft] = useState(
    target !== undefined ? target.toFixed(1) : ''
  );
  const targetInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (targetEditing) {
      setTargetDraft(target !== undefined ? target.toFixed(1) : '');
      requestAnimationFrame(() => {
        targetInputRef.current?.focus();
        targetInputRef.current?.select();
      });
    }
  }, [targetEditing, target]);

  const commitTarget = async () => {
    if (!onSetTarget) {
      setTargetEditing(false);
      return;
    }
    const raw = targetDraft.trim();
    if (raw === '') {
      // Clear target only if it was previously set.
      if (target !== undefined) await onSetTarget(null);
      setTargetEditing(false);
      return;
    }
    const num = parseFloat(raw);
    if (isNaN(num) || num < MIN_WEIGHT || num > MAX_WEIGHT) {
      setTargetEditing(false);
      return;
    }
    if (num !== target) {
      await onSetTarget(num);
    }
    setTargetEditing(false);
  };

  const clearTarget = async () => {
    if (!onSetTarget) return;
    await onSetTarget(null);
  };

  const { latest, prior } = useMemo(() => {
    if (entries.length === 0) return { latest: null, prior: null };
    const byDate = new Map<string, (typeof entries)[number]>();
    for (const e of entries) {
      const prev = byDate.get(e.date);
      if (!prev || e.createdAt > prev.createdAt) byDate.set(e.date, e);
    }
    const dailySorted = Array.from(byDate.values()).sort((a, b) =>
      a.date.localeCompare(b.date)
    );
    const latest = dailySorted[dailySorted.length - 1] ?? null;
    const prior = dailySorted.length >= 2 ? dailySorted[dailySorted.length - 2] : null;
    return { latest, prior };
  }, [entries]);

  const delta = latest && prior ? latest.weight - prior.weight : null;
  const recordedToday = latest?.date === todayKey();
  const toGoal = latest && target !== undefined ? latest.weight - target : null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(input);
    if (isNaN(num) || num < MIN_WEIGHT || num > MAX_WEIGHT) {
      setError(`${MIN_WEIGHT}〜${MAX_WEIGHT} kg の範囲で入力してください`);
      return;
    }
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await recordWeight(num, todayKey());
      setInput('');
    } catch (err) {
      console.error('[weight:record] failed', err);
      const msg = err instanceof Error ? err.message : String(err);
      setError(`保存に失敗しました: ${msg}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-widest text-sys-muted flex items-center gap-1.5">
          <Scale className="h-3 w-3" />
          Body Weight
        </p>
        {latest && (
          <p className="text-[10px] text-sys-muted">
            {recordedToday ? '本日' : latest.date}
          </p>
        )}
      </div>

      <div className="flex items-end justify-between gap-3">
        <p className="font-mono font-black leading-none text-sys-accent drop-shadow-[0_0_8px_rgba(0,212,255,0.4)]">
          <span className="text-3xl">
            {latest ? latest.weight.toFixed(1) : '--.-'}
          </span>
          <span className="ml-1 text-xs font-normal text-sys-muted">kg</span>
        </p>
        {delta !== null && (
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-widest text-sys-muted">前回比</p>
            <p
              className={`mt-0.5 inline-flex items-center gap-0.5 font-mono text-xs ${
                delta > 0
                  ? 'text-sys-danger'
                  : delta < 0
                  ? 'text-sys-ok'
                  : 'text-sys-muted'
              }`}
            >
              {delta > 0 ? (
                <ArrowUp className="h-3 w-3" />
              ) : delta < 0 ? (
                <ArrowDown className="h-3 w-3" />
              ) : (
                <Minus className="h-3 w-3" />
              )}
              {delta > 0 ? '+' : ''}
              {delta.toFixed(1)} kg
            </p>
          </div>
        )}
      </div>

      {onSetTarget && (
        <div className="flex items-center justify-between gap-2 border border-sys-border/20 bg-black/20 px-2.5 py-1.5">
          <span className="text-[10px] uppercase tracking-widest text-sys-muted flex items-center gap-1.5">
            <Target className="h-3 w-3" />
            目標
          </span>
          {targetEditing ? (
            <input
              ref={targetInputRef}
              type="number"
              step="0.1"
              min={MIN_WEIGHT}
              max={MAX_WEIGHT}
              inputMode="decimal"
              value={targetDraft}
              onChange={(e) => setTargetDraft(e.target.value)}
              onBlur={commitTarget}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void commitTarget();
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  setTargetEditing(false);
                }
              }}
              placeholder="例 68.0"
              className="sys-input w-24 text-right py-1"
            />
          ) : (
            <div className="flex items-center gap-2">
              {toGoal !== null && (
                <span
                  className={`text-[10px] font-mono ${
                    Math.abs(toGoal) < 0.05
                      ? 'text-sys-ok'
                      : 'text-sys-muted'
                  }`}
                >
                  {Math.abs(toGoal) < 0.05
                    ? '達成!'
                    : `あと ${toGoal > 0 ? '-' : '+'}${Math.abs(toGoal).toFixed(1)} kg`}
                </span>
              )}
              <button
                type="button"
                onClick={() => setTargetEditing(true)}
                className="inline-flex items-center gap-1 font-mono text-sm text-sys-text hover:text-sys-accent transition"
                title="目標体重を編集"
              >
                {target !== undefined ? `${target.toFixed(1)} kg` : '未設定'}
                <Pencil className="h-3 w-3 opacity-50" />
              </button>
              {target !== undefined && (
                <button
                  type="button"
                  onClick={() => void clearTarget()}
                  className="text-sys-muted/60 hover:text-sys-danger transition"
                  title="目標を解除"
                  aria-label="目標を解除"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          )}
        </div>
      )}

      <WeightChart entries={entries} target={target} />

      <form onSubmit={submit} className="space-y-2">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              type="number"
              step="0.1"
              min={MIN_WEIGHT}
              max={MAX_WEIGHT}
              inputMode="decimal"
              placeholder="例 72.4"
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                if (error) setError(null);
              }}
              className="sys-input pr-10"
              disabled={busy}
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-sys-muted">
              kg
            </span>
          </div>
          <button
            type="submit"
            className="sys-button"
            disabled={!input.trim() || busy}
          >
            <Plus className="h-4 w-4" />
            {busy ? '保存中…' : '記録'}
          </button>
        </div>
        {error && (
          <p className="text-[11px] text-sys-danger">{error}</p>
        )}
      </form>
    </div>
  );
}
