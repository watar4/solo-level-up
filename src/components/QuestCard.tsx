import type { Quest } from '../types';
import { DIFFICULTY_EXP, STAT_LABELS } from '../types';
import { daysUntilWeekReset, effectiveStreak, todayKey, yesterdayKey } from '../lib/leveling';
import { Check, ChevronDown, ChevronUp, Clock, Flame, Pencil, Trash2 } from 'lucide-react';

interface Props {
  quest: Quest;
  doneToday: boolean;
  busy?: boolean;
  onToggle: () => void;
  onDelete: () => void;
  onEdit?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
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
  onDelete,
  onEdit,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
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

  const showMove = !!(onMoveUp || onMoveDown);

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
            {weekResetDays !== null && (
              <span
                className={`inline-flex items-center gap-1 ${
                  doneToday ? 'text-sys-muted' : 'text-sys-text/70'
                }`}
              >
                <Clock className="h-3 w-3" />
                {doneToday ? `次回まで残り ${weekResetDays} 日` : `今週中: あと ${weekResetDays} 日`}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-start gap-1.5">
          {showMove && (
            <div className="flex flex-col">
              <button
                type="button"
                onClick={onMoveUp}
                disabled={!canMoveUp}
                aria-label="上に移動"
                title="上に移動"
                className="text-sys-muted/70 hover:text-sys-accent disabled:opacity-20 disabled:hover:text-sys-muted/70 transition"
              >
                <ChevronUp className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={onMoveDown}
                disabled={!canMoveDown}
                aria-label="下に移動"
                title="下に移動"
                className="text-sys-muted/70 hover:text-sys-accent disabled:opacity-20 disabled:hover:text-sys-muted/70 transition"
              >
                <ChevronDown className="h-4 w-4" />
              </button>
            </div>
          )}
          <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition">
            {onEdit && (
              <button
                type="button"
                onClick={onEdit}
                aria-label="クエストを編集"
                title="クエストを編集"
                className="text-sys-muted hover:text-sys-accent transition"
              >
                <Pencil className="h-4 w-4" />
              </button>
            )}
            <button
              type="button"
              onClick={onDelete}
              aria-label="クエストを削除"
              title="クエストを削除"
              className="text-sys-muted hover:text-sys-danger transition"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
