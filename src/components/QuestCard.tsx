import type { Quest } from '../types';
import { DIFFICULTY_EXP, STAT_LABELS } from '../types';
import { Check, Flame, Trash2 } from 'lucide-react';

interface Props {
  quest: Quest;
  doneToday: boolean;
  busy?: boolean;
  onToggle: () => void;
  onDelete: () => void;
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

export function QuestCard({ quest, doneToday, busy, onToggle, onDelete }: Props) {
  const expReward = DIFFICULTY_EXP[quest.difficulty];

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
          {quest.type === 'daily' && quest.streak > 0 && (
            <div className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-sys-gold">
              <Flame className="h-3 w-3" />
              {quest.streak}日連続
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={onDelete}
          aria-label="クエストを削除"
          className="opacity-0 group-hover:opacity-100 text-sys-muted hover:text-sys-danger transition"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
