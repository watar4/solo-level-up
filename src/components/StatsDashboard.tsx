import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { SystemWindow } from './SystemWindow';
import { getAllCompletions, type CompletionLogRich } from '../lib/firestore';
import type { Character, Difficulty, Quest, QuestType, StatKey } from '../types';
import { ALL_STATS, STAT_LABELS } from '../types';
import { ACHIEVEMENTS } from '../lib/achievements';
import { SKILLS } from '../lib/skills';

interface Props {
  open: boolean;
  uid: string;
  character: Character;
  quests: Quest[];
  onClose: () => void;
}

const DIFFICULTIES: Difficulty[] = ['E', 'D', 'C', 'B', 'A', 'S'];
const DIFFICULTY_COLORS: Record<Difficulty, string> = {
  E: 'bg-sys-muted/70',
  D: 'bg-emerald-400/80',
  C: 'bg-cyan-400/80',
  B: 'bg-blue-400/80',
  A: 'bg-purple-400/80',
  S: 'bg-amber-400/85',
};

const TYPE_LABELS: Record<QuestType, string> = {
  daily: 'デイリー',
  weekly: 'ウィークリー',
  'one-time': '単発',
};

const WEEKLY_BUCKETS = 12;

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Monday-anchored ISO week key (YYYY-MM-DD of the Monday).
function weekKey(d: Date): string {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  const dow = copy.getDay() === 0 ? 7 : copy.getDay(); // 1..7 (Mon..Sun)
  copy.setDate(copy.getDate() - (dow - 1));
  return dateKey(copy);
}

function shortWeekLabel(key: string): string {
  // "YYYY-MM-DD" → "M/D"
  const [, m, d] = key.split('-');
  return `${parseInt(m, 10)}/${parseInt(d, 10)}`;
}

// Compute the longest run of consecutive days appearing in the date set.
function longestRun(dates: Set<string>): number {
  if (dates.size === 0) return 0;
  const sorted = Array.from(dates).sort();
  let best = 1;
  let run = 1;
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1]);
    const curr = new Date(sorted[i]);
    const diff = Math.round((curr.getTime() - prev.getTime()) / 86_400_000);
    if (diff === 1) {
      run += 1;
      if (run > best) best = run;
    } else {
      run = 1;
    }
  }
  return best;
}

export function StatsDashboard({ open, uid, character, quests, onClose }: Props) {
  const [logs, setLogs] = useState<CompletionLogRich[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    getAllCompletions(uid)
      .then(setLogs)
      .catch((err) => console.error('[stats] load failed', err))
      .finally(() => setLoading(false));
  }, [open, uid]);

  const stats = useMemo(() => {
    const questById = new Map(quests.map((q) => [q.id, q] as const));
    const byDifficulty: Record<Difficulty, number> = { E: 0, D: 0, C: 0, B: 0, A: 0, S: 0 };
    const byType: Record<QuestType, number> = { daily: 0, weekly: 0, 'one-time': 0 };
    const expByStat: Record<StatKey, number> = { STR: 0, AGI: 0, INT: 0, VIT: 0, PER: 0 };
    let totalExp = 0;
    const allDates = new Set<string>();

    for (const log of logs) {
      totalExp += log.expGained;
      if (log.date) allDates.add(log.date);
      const q = questById.get(log.questId);
      if (q) {
        byDifficulty[q.difficulty] += 1;
        byType[q.type] += 1;
        expByStat[q.targetStat] += log.expGained;
      }
    }

    // Weekly volume — last N weeks ending this week.
    const now = new Date();
    const buckets: { key: string; count: number }[] = [];
    const cursor = new Date(now);
    cursor.setHours(0, 0, 0, 0);
    const dow = cursor.getDay() === 0 ? 7 : cursor.getDay();
    cursor.setDate(cursor.getDate() - (dow - 1)); // start of current week (Monday)
    const startKey = (() => {
      const c = new Date(cursor);
      c.setDate(c.getDate() - (WEEKLY_BUCKETS - 1) * 7);
      return dateKey(c);
    })();
    for (let i = 0; i < WEEKLY_BUCKETS; i++) {
      const c = new Date(cursor);
      c.setDate(c.getDate() - (WEEKLY_BUCKETS - 1 - i) * 7);
      buckets.push({ key: dateKey(c), count: 0 });
    }
    for (const log of logs) {
      if (!log.date) continue;
      const wk = weekKey(new Date(log.date));
      if (wk < startKey) continue;
      const idx = buckets.findIndex((b) => b.key === wk);
      if (idx >= 0) buckets[idx].count += 1;
    }
    const maxWeekly = buckets.reduce((m, b) => Math.max(m, b.count), 0);

    // Current best streak across active dailies (live), and historical longest
    // run derived from completion dates.
    const dailyStreaks = quests
      .filter((q) => q.type === 'daily' && !q.archived)
      .map((q) => q.streak ?? 0);
    const liveBestStreak = dailyStreaks.length ? Math.max(...dailyStreaks) : 0;
    const historicalLongestRun = longestRun(allDates);

    // Achievement / Skill unlocks vs library size.
    const achUnlocked = (character.unlocked?.achievements ?? []).length;
    const skillUnlocked = (character.unlocked?.skills ?? []).length;

    // Most-leveled stat (favorite focus).
    const topStat = ALL_STATS.reduce<{ stat: StatKey; value: number } | null>(
      (acc, s) => {
        const v = character.stats[s];
        if (!acc || v > acc.value) return { stat: s, value: v };
        return acc;
      },
      null
    );

    return {
      totalCompletions: logs.length,
      totalExpFromLog: totalExp,
      byDifficulty,
      byType,
      expByStat,
      weekly: buckets,
      maxWeekly,
      liveBestStreak,
      historicalLongestRun,
      achUnlocked,
      achTotal: ACHIEVEMENTS.length,
      skillUnlocked,
      skillTotal: SKILLS.length,
      topStat,
      activeDays: allDates.size,
    };
  }, [logs, quests, character]);

  if (!open) return null;

  const totalDifficulty = DIFFICULTIES.reduce(
    (sum, d) => sum + stats.byDifficulty[d],
    0
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-sm overflow-y-auto"
      onClick={onClose}
    >
      <div className="w-full max-w-3xl my-auto" onClick={(e) => e.stopPropagation()}>
        <SystemWindow title="Stats Report" subtitle="performance review">
          <div className="flex justify-end mb-2">
            <button
              type="button"
              onClick={onClose}
              className="text-sys-muted hover:text-sys-text"
              aria-label="閉じる"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {loading ? (
            <p className="py-10 text-center text-sm text-sys-muted">集計中…</p>
          ) : logs.length === 0 ? (
            <p className="py-10 text-center text-sm text-sys-muted">
              まだ達成記録がありません。
            </p>
          ) : (
            <div className="space-y-6">
              {/* Top-level KPI grid */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <KpiCell label="累計達成" value={stats.totalCompletions.toString()} />
                <KpiCell
                  label="獲得 EXP"
                  value={stats.totalExpFromLog.toLocaleString()}
                />
                <KpiCell label="活動日数" value={stats.activeDays.toString()} />
                <KpiCell
                  label="現在の最高連続"
                  value={`${stats.liveBestStreak} 日`}
                />
                <KpiCell
                  label="過去最長連続"
                  value={`${stats.historicalLongestRun} 日`}
                />
                <KpiCell
                  label="得意ステータス"
                  value={stats.topStat ? `${stats.topStat.stat}` : '--'}
                  sub={stats.topStat ? `${stats.topStat.value}` : undefined}
                />
                <KpiCell
                  label="称号"
                  value={`${stats.achUnlocked} / ${stats.achTotal}`}
                />
                <KpiCell
                  label="スキル"
                  value={`${stats.skillUnlocked} / ${stats.skillTotal}`}
                />
              </div>

              {/* Weekly volume chart */}
              <section>
                <div className="mb-2 text-[10px] uppercase tracking-widest text-sys-muted">
                  週次達成数 (直近 {WEEKLY_BUCKETS} 週)
                </div>
                <div className="flex h-32 items-end gap-1.5 border-b border-sys-border/30 pb-1">
                  {stats.weekly.map((b) => {
                    const pct =
                      stats.maxWeekly > 0 ? (b.count / stats.maxWeekly) * 100 : 0;
                    return (
                      <div
                        key={b.key}
                        className="flex flex-1 flex-col items-center justify-end gap-1"
                        title={`${shortWeekLabel(b.key)} の週 · ${b.count} 件`}
                      >
                        <span className="font-mono text-[9px] text-sys-muted">
                          {b.count > 0 ? b.count : ''}
                        </span>
                        <div
                          className="w-full bg-gradient-to-t from-sys-accent/40 to-sys-accent border-t border-sys-accent/80"
                          style={{ height: `${Math.max(pct, b.count > 0 ? 6 : 0)}%` }}
                        />
                      </div>
                    );
                  })}
                </div>
                <div className="mt-1 flex justify-between font-mono text-[9px] text-sys-muted">
                  <span>{shortWeekLabel(stats.weekly[0]?.key ?? '')}</span>
                  <span>
                    {shortWeekLabel(
                      stats.weekly[stats.weekly.length - 1]?.key ?? ''
                    )}
                  </span>
                </div>
              </section>

              {/* Difficulty + Type breakdown side by side */}
              <section className="grid gap-5 sm:grid-cols-2">
                <div>
                  <div className="mb-2 text-[10px] uppercase tracking-widest text-sys-muted">
                    難易度別達成
                  </div>
                  <div className="space-y-1.5">
                    {DIFFICULTIES.map((d) => {
                      const n = stats.byDifficulty[d];
                      const pct =
                        totalDifficulty > 0 ? (n / totalDifficulty) * 100 : 0;
                      return (
                        <div key={d} className="flex items-center gap-2">
                          <span className="w-5 font-mono text-xs text-sys-text/80">
                            {d}
                          </span>
                          <div className="flex-1 h-3 border border-sys-border/30 bg-black/40">
                            <div
                              className={`h-full ${DIFFICULTY_COLORS[d]}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="w-8 text-right font-mono text-xs text-sys-text/70">
                            {n}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <div className="mb-2 text-[10px] uppercase tracking-widest text-sys-muted">
                    タイプ別達成
                  </div>
                  <div className="space-y-1.5">
                    {(Object.keys(TYPE_LABELS) as QuestType[]).map((t) => {
                      const n = stats.byType[t];
                      const total =
                        stats.byType.daily +
                        stats.byType.weekly +
                        stats.byType['one-time'];
                      const pct = total > 0 ? (n / total) * 100 : 0;
                      return (
                        <div key={t} className="flex items-center gap-2">
                          <span className="w-20 text-xs text-sys-text/80">
                            {TYPE_LABELS[t]}
                          </span>
                          <div className="flex-1 h-3 border border-sys-border/30 bg-black/40">
                            <div
                              className="h-full bg-sys-accent/70"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="w-8 text-right font-mono text-xs text-sys-text/70">
                            {n}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </section>

              {/* EXP earned per stat */}
              <section>
                <div className="mb-2 text-[10px] uppercase tracking-widest text-sys-muted">
                  ステータス別 獲得EXP
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                  {ALL_STATS.map((s) => {
                    const v = stats.expByStat[s];
                    const max = Math.max(
                      ...ALL_STATS.map((k) => stats.expByStat[k]),
                      1
                    );
                    const pct = (v / max) * 100;
                    return (
                      <div
                        key={s}
                        className="border border-sys-border/30 bg-black/30 p-2"
                      >
                        <div className="flex items-baseline justify-between">
                          <span className="text-[10px] uppercase tracking-widest text-sys-muted">
                            {STAT_LABELS[s].en}
                          </span>
                          <span className="font-mono text-xs text-sys-text">
                            {v}
                          </span>
                        </div>
                        <div className="mt-1 h-1.5 w-full border border-sys-border/30 bg-black/40">
                          <div
                            className="h-full bg-sys-accent/70"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            </div>
          )}
        </SystemWindow>
      </div>
    </div>
  );
}

interface KpiCellProps {
  label: string;
  value: string;
  sub?: string;
}

function KpiCell({ label, value, sub }: KpiCellProps) {
  return (
    <div className="border border-sys-border/30 bg-black/30 px-3 py-2">
      <div className="text-[10px] uppercase tracking-widest text-sys-muted">
        {label}
      </div>
      <div className="mt-0.5 flex items-baseline gap-1">
        <span className="font-mono text-lg font-bold text-sys-accent">
          {value}
        </span>
        {sub && <span className="text-[10px] text-sys-muted">({sub})</span>}
      </div>
    </div>
  );
}
