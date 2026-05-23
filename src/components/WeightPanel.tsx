import { useMemo, useState } from 'react';
import { WeightChart } from './WeightChart';
import { useWeights } from '../hooks/useWeights';
import { todayKey } from '../lib/leveling';
import { Scale, Plus, ArrowDown, ArrowUp, Minus } from 'lucide-react';

interface Props {
  uid: string;
}

const MIN_WEIGHT = 20;
const MAX_WEIGHT = 300;

// Section embedded inside StatusPanel — renders only its content (no
// SystemWindow wrapper) so the body-weight readout / chart / input form
// share the same surrounding frame as the rest of the Status block.
export function WeightPanel({ uid }: Props) {
  const { entries, recordWeight } = useWeights(uid);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

      <WeightChart entries={entries} />

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
