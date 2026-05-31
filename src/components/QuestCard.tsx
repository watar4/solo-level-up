import type { Quest } from '../types';
import { DIFFICULTY_EXP, STAT_LABELS } from '../types';
import {
  daysUntilWeekReset,
  effectiveStreak,
  todayKey,
  weeklyCompletionCount,
  yesterdayKey,
} from '../lib/leveling';
import { Check, Clock, Flame, GripVertical, MoreVertical, Layers } from 'lucide-react';

// Pass-through type for dnd-kit's useSortable listeners. We treat it
// opaquely — it's just a record of handlers to spread onto the drag handle.
export type DragListeners = Record<string, (event: React.SyntheticEvent) => void>;

interface Props {
  quest: Quest;
  doneToday: boolean;
  busy?: boolean;
  onToggle: () => void;
  // When provided, a single "⋮" trigger opens the action menu. Designed for
  // touch — the previously inline edit/up/down/delete icons were too close
  // together to tap reliably on a phone.
  onOpenMenu?: () => void;
  // When provided, renders a dedicated grip handle that receives drag
  // listeners. The rest of the card stays scroll-friendly (touch-action:auto),
  // so the user's normal swipe-to-scroll never gets misread as a drag attempt.
  dragListeners?: DragListeners;
}

const DIFFICULTY_COLOR: Record<string, string> = {
  E: 'text-sys-muted border-sys-muted/50',
  D: 'text-emerald-300 border-emerald-400/60',
  C: 'text-cyan-300 border-cyan-400/60',
  B: 'text-blue-300 border-blue-400/60',
  A: 'text-purple-300 border-purple-400/60',
  S: 'text-amber-300 border-amber-400/60',
};

const TYPE_LABEL: Record<Quest['type'], string> = {
  daily: 'デイリー',
  weekly: 'ウィークリー',
  'one-time': '単発',
};

export function QuestCard({
  quest,
  doneToday,
  busy,
  onToggle,
  onOpenMenu,
  dragListeners,
}: Props) {
  const expReward = DIFFICULTY_EXP[quest.difficulty];
  // Re-derive streak from completedDates so it expires automatically when the
  // user skips a day, instead of showing the stale value stored in Firestore.
  const liveStreak = effectiveStreak(quest.completedDates, quest.type);
  const streakBroken =
    quest.type === 'daily' &&
    quest.streak > 0 &&
    liveStreak === 0;
  const streakAtRisk =
    quest.type === 'daily' &&
    liveStreak > 0 &&
    !quest.completedDates.includes(todayKey()) &&
    quest.completedDates.includes(yesterdayKey());
  const weekResetDays = quest.type === 'weekly' ? daysUntilWeekReset() : null;
  const weeklyCount =
    quest.type === 'weekly' ? weeklyCompletionCount(quest.completedDates) : 0;

  return (
    <div
      className={`group relative border bg-black/40 px-4 py-3 transition ${
        doneToday
          ? 'border-sys-ok/40 bg-sys-ok/5'
          : 'border-sys-border/40 hover:border-sys-border'
      }`}
    >
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={onToggle}
          disabled={busy}
          aria-label={doneToday ? 'チェックを外す' : 'クエストを完了'}
          title={doneToday ? 'もう一度押すと未達成に戻ります' : 'クエストを完了する'}
          className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center border transition ${
            doneToday
              ? 'border-sys-ok bg-sys-ok/30 text-sys-ok hover:bg-sys-ok/10 hover:text-sys-ok/70'
              : 'border-sys-border/60 hover:border-sys-accent hover:bg-sys-accent/15'
          } ${busy ? 'opacity-50 cursor-wait' : ''}`}
        >
          {doneToday && <Check className="h-4 w-4" />}
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span
              className={`inline-block border px-1.5 text-[10px] font-bold tracking-widest ${
                DIFFICULTY_COLOR[quest.difficulty]
              }`}
            >
              {quest.difficulty}
            </span>
            <span className="text-[10px] uppercase tracking-widest text-sys-muted">
              {TYPE_LABEL[quest.type]}
            </span>
            <span className="text-[10px] uppercase tracking-widest text-sys-muted">
              · +{expReward} EXP · {STAT_LABELS[quest.targetStat].en}
            </span>
          </div>
          <h3
            className={`mt-0.5 font-bold leading-tight ${
              doneToday ? 'text-sys-text/60 line-through' : 'text-sys-text'
            }`}
          >
            {quest.title}
          </h3>
          {quest.description && (
            <p className="mt-1 text-xs text-sys-muted">{quest.description}</p>
          )}
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
            {quest.type === 'daily' && liveStreak > 0 && (
              <span
                className={`inline-flex items-center gap-1 ${
                  streakAtRisk ? 'text-sys-danger' : 'text-sys-gold'
                }`}
                title={streakAtRisk ? '今日達成しないと連続記録が途切れます' : undefined}
              >
                <Flame className="h-3 w-3" />
                {liveStreak}日連続{streakAtRisk && ' (残り今日中!)'}
              </span>
            )}
            {streakBroken && (
              <span
                className="inline-flex items-center gap-1 text-sys-muted"
                title={`記録上は ${quest.streak} 日連続でしたが途切れました`}
              >
                <Flame className="h-3 w-3 opacity-40" />
                連続記録 途切れ
              </span>
            )}
            {quest.type === 'weekly' && (
              <span
                className={`inline-flex items-center gap-1 ${
                  weeklyCount > 0 ? 'text-sys-gold' : 'text-sys-muted'
                }`}
                title="今週チェックした回数"
              >
                <Layers className="h-3 w-3" />
                今週 {weeklyCount} 回
              </span>
            )}
            {weekResetDays !== null && (
              <span className="inline-flex items-center gap-1 text-sys-muted">
                <Clock className="h-3 w-3" />
                {doneToday
                  ? `今日達成済 · リセットまで ${weekResetDays} 日`
                  : `リセットまで ${weekResetDays} 日`}
              </span>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-start gap-0.5">
          {dragListeners && (
            <button
              type="button"
              aria-label="ドラッグして並び替え"
              title="ドラッグして並び替え"
              {...dragListeners}
              style={{ touchAction: 'none' }}
              className="-mt-1 flex h-9 w-7 cursor-grab items-center justify-center text-sys-muted/60 hover:text-sys-accent active:cursor-grabbing active:bg-sys-accent/10 transition"
            >
              <GripVertical className="h-5 w-5" />
            </button>
          )}
          {onOpenMenu && (
            <button
              type="button"
              onClick={onOpenMenu}
              aria-label="操作メニューを開く"
              title="操作メニュー"
              className="-mr-2 -mt-1 flex h-9 w-9 items-center justify-center text-sys-muted hover:text-sys-accent active:bg-sys-accent/10 transition"
            >
              <MoreVertical className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
