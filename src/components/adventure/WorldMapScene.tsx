import { CHAPTERS } from '../../lib/story/chapters';
import { evaluateGate, type ProgressSnapshot } from '../../lib/story/chapterGate';
import { regionFor } from '../../lib/story/regions';
import type { CampaignState } from '../../lib/story/campaign';

interface Props {
  campaign: CampaignState;
  snapshot: ProgressSnapshot;
  onSelectChapter: (chapter: number) => void;
}

export function WorldMapScene({ campaign, snapshot, onSelectChapter }: Props) {
  const cleared = new Set(campaign.clearedChapters);

  return (
    <div className="mx-auto max-w-xl space-y-2">
      <p className="px-1 text-[11px] text-sys-muted">
        ダラリア大陸。12の地方の ダラモンを しずめ、しゅうかんメダルを 集めよう。
      </p>
      {CHAPTERS.map((ch) => {
        const isCleared = cleared.has(ch.id);
        const gate = evaluateGate(ch, snapshot);
        const hasRegion = !!regionFor(ch.id);
        const playable = (isCleared || gate.unlocked) && hasRegion;
        const status: 'cleared' | 'current' | 'locked' | 'soon' = isCleared
          ? 'cleared'
          : gate.unlocked
            ? hasRegion ? 'current' : 'soon'
            : 'locked';

        return (
          <button
            key={ch.id}
            type="button"
            disabled={!playable}
            onClick={() => playable && onSelectChapter(ch.id)}
            className={`flex w-full items-center gap-3 rounded-md border p-3 text-left transition ${
              status === 'current'
                ? 'border-sys-accent bg-sys-accent/10 active:scale-[0.99]'
                : status === 'cleared'
                  ? 'border-amber-500/40 bg-amber-500/5 active:scale-[0.99]'
                  : 'border-sys-border/40 opacity-60'
            }`}
          >
            <span className="text-lg">
              {status === 'cleared' ? '🏅' : status === 'current' ? '⚔️' : status === 'soon' ? '🚧' : '🔒'}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-baseline justify-between gap-2">
                <span className="truncate text-sm font-bold text-sys-text">
                  {ch.id}. {ch.title}
                </span>
                <span className="shrink-0 text-[10px] text-sys-muted">推奨Lv{ch.recommendedLevel}</span>
              </span>
              <span className="mt-0.5 block text-[11px] text-sys-muted">
                {status === 'cleared' && 'クリア済み'}
                {status === 'current' && `テーマ:${ch.theme}`}
                {status === 'soon' && '近日 実装(第2章以降)'}
                {status === 'locked' && (
                  gate.levelMet
                    ? gate.remaining
                      ? `解放まで:${gate.remaining.label}(${gate.remaining.have}/${gate.remaining.need})`
                      : '継続条件を みたそう'
                    : `Lv${ch.gate.level} で解放`
                )}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
