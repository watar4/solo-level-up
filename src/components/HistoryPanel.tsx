import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { SystemWindow } from './SystemWindow';
import { getAllCompletions, type CompletionLogRich } from '../lib/firestore';
import type { Quest } from '../types';

interface Props {
  open: boolean;
  uid: string;
  quests: Quest[];
  onClose: () => void;
}

const WEEKS = 13;
const DAYS_PER_WEEK = 7;

function formatDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function intensityClass(count: number): string {
  if (count === 0) return 'bg-black/40 border-sys-border/15';
  if (count === 1) return 'bg-sys-accent/25 border-sys-accent/40';
  if (count === 2) return 'bg-sys-accent/50 border-sys-accent/60';
  if (count <= 4) return 'bg-sys-accent/75 border-sys-accent/80';
  return 'bg-sys-gold/80 border-sys-gold';
}

export function HistoryPanel({ open, uid, quests, onClose }: Props) {
  const [logs, setLogs] = useState<CompletionLogRich[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    getAllCompletions(uid)
      .then(setLogs)
      .catch((err) => console.error('[history] load failed', err))
      .finally(() => setLoading(false));
  }, [open, uid]);

  // Pre-build the day grid: 13 columns (weeks) × 7 rows (Mon..Sun), ending today.
  const grid = useMemo(() => {
    const counts = new Map<string, number>();
    for (const log of logs) {
      if (!log.date) continue;
      counts.set(log.date, (counts.get(log.date) ?? 0) + 1);
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayDow = today.getDay() === 0 ? 7 : today.getDay(); // ISO 1..7
    const start = new Date(today);
    start.setDate(start.getDate() - ((WEEKS - 1) * 7 + (todayDow - 1)));
    const columns: { key: string; count: number; isFuture: boolean; date: Date }[][] = [];
    const cursor = new Date(start);
    for (let w = 0; w < WEEKS; w++) {
      const col: typeof columns[number] = [];
      for (let d = 0; d < DAYS_PER_WEEK; d++) {
        const key = formatDateKey(cursor);
        col.push({
          key,
          count: counts.get(key) ?? 0,
          isFuture: cursor > today,
          date: new Date(cursor),
        });
        cursor.setDate(cursor.getDate() + 1);
      }
      columns.push(col);
    }
    return columns;
  }, [logs]);

  // Recent completion log (last 30, newest first).
  const recent = useMemo(() => {
    return [...logs]
      .sort((a, b) => (b.at ?? 0) - (a.at ?? 0))
      .slice(0, 30)
      .map((log) => {
        const q = quests.find((qq) => qq.id === log.questId);
        return {
          ...log,
          title: q?.title ?? '(削除されたクエスト)',
          difficulty: q?.difficulty,
        };
      });
  }, [logs, quests]);

  const total = logs.length;
  const last7 = useMemo(() => {
    const since = new Date();
    since.setDate(since.getDate() - 7);
    const cutoff = formatDateKey(since);
    return logs.filter((l) => (l.date ?? '') > cutoff).length;
  }, [logs]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-sm overflow-y-auto"
      onClick={onClose}
    >
      <div className="w-full max-w-3xl my-auto" onClick={(e) => e.stopPropagation()}>
        <SystemWindow title="Quest History" subtitle="record">
          <div className="flex justify-end mb-2">
            <button type="button" onClick={onClose} className="text-sys-muted hover:text-sys-text" aria-label="閉じる">
              <X className="h-4 w-4" />
            </button>
          </div>

          {loading ? (
            <p className="py-10 text-center text-sm text-sys-muted">履歴を読み込み中…</p>
          ) : (
            <>
              <div className="mb-5 grid grid-cols-3 gap-3 text-center">
                <div className="border border-sys-border/30 bg-black/30 py-2">
                  <div className="text-[10px] uppercase tracking-widest text-sys-muted">累計達成</div>
                  <div className="font-mono text-xl text-sys-accent">{total}</div>
                </div>
                <div className="border border-sys-border/30 bg-black/30 py-2">
                  <div className="text-[10px] uppercase tracking-widest text-sys-muted">直近 7 日</div>
                  <div className="font-mono text-xl text-sys-text">{last7}</div>
                </div>
                <div className="border border-sys-border/30 bg-black/30 py-2">
                  <div className="text-[10px] uppercase tracking-widest text-sys-muted">アクティブ</div>
                  <div className="font-mono text-xl text-sys-text">
                    {quests.filter((q) => !q.archived).length}
                  </div>
                </div>
              </div>

              <div className="mb-2 text-[10px] uppercase tracking-widest text-sys-muted">
                最近 13 週の達成ヒートマップ
              </div>
              <div className="mb-4 overflow-x-auto">
                <div className="inline-flex gap-1">
                  {grid.map((col, w) => (
                    <div key={w} className="flex flex-col gap-1">
                      {col.map((cell) => (
                        <div
                          key={cell.key}
                          title={`${cell.key} · ${cell.count} 件達成`}
                          className={`h-4 w-4 border ${
                            cell.isFuture
                              ? 'opacity-0'
                              : intensityClass(cell.count)
                          }`}
                        />
                      ))}
                    </div>
                  ))}
                </div>
                <div className="mt-2 flex items-center gap-1 text-[10px] uppercase tracking-widest text-sys-muted">
                  <span>少</span>
                  {[0, 1, 2, 4, 5].map((n) => (
                    <div key={n} className={`h-3 w-3 border ${intensityClass(n)}`} />
                  ))}
                  <span>多</span>
                </div>
              </div>

              <div className="border-t border-sys-border/20 pt-3">
                <div className="mb-2 text-[10px] uppercase tracking-widest text-sys-muted">
                  最近の完了 (最新 30 件)
                </div>
                {recent.length === 0 ? (
                  <p className="py-6 text-center text-sm text-sys-muted">まだ完了履歴がありません。</p>
                ) : (
                  <ul className="space-y-1 max-h-72 overflow-y-auto pr-2">
                    {recent.map((r) => (
                      <li
                        key={r.id}
                        className="flex items-center gap-3 border border-sys-border/20 bg-black/30 px-3 py-1.5 text-xs"
                      >
                        <span className="font-mono text-sys-muted whitespace-nowrap">{r.date ?? '-'}</span>
                        {r.difficulty && (
                          <span className="border border-sys-border/40 px-1 text-[10px] font-bold tracking-widest">
                            {r.difficulty}
                          </span>
                        )}
                        <span className="flex-1 truncate text-sys-text">{r.title}</span>
                        <span className="font-mono text-sys-gold whitespace-nowrap">+{r.expGained} EXP</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </SystemWindow>
      </div>
    </div>
  );
}
