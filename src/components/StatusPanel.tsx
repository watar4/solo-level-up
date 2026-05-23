import type { Character } from '../types';
import { ALL_STATS, STAT_LABELS } from '../types';
import { expForLevel, rankForLevel } from '../lib/leveling';
import { SystemWindow } from './SystemWindow';
import { WeightPanel } from './WeightPanel';

interface Props {
  character: Character;
  email?: string | null;
  uid: string;
}

const RANK_COLORS: Record<string, string> = {
  E: 'text-sys-muted',
  D: 'text-emerald-300',
  C: 'text-cyan-300',
  B: 'text-blue-300',
  A: 'text-purple-300',
  S: 'text-amber-300',
  SS: 'text-rose-300',
};

export function StatusPanel({ character, email, uid }: Props) {
  const rank = rankForLevel(character.level);
  const need = expForLevel(character.level);
  const pct = Math.min(100, Math.round((character.exp / need) * 100));

  return (
    <SystemWindow title="Status" subtitle={email ?? ''}>
      <div className="space-y-5">
        <div>
          <div className="flex items-end justify-between">
            <h2 className="text-2xl font-black tracking-wider">{character.name}</h2>
            <div className={`text-right ${RANK_COLORS[rank] ?? ''}`}>
              <div className="text-[10px] uppercase tracking-widest text-sys-muted">Rank</div>
              <div className="text-3xl font-black leading-none drop-shadow-[0_0_8px_currentColor]">
                {rank}
              </div>
            </div>
          </div>
          <div className="mt-2 flex items-center gap-2 text-sm">
            <span className="text-sys-muted">Lv.</span>
            <span className="text-xl font-bold text-sys-accent drop-shadow-[0_0_6px_rgba(0,212,255,0.6)]">
              {character.level}
            </span>
            {character.statPoints > 0 && (
              <span className="ml-auto rounded border border-sys-gold/60 bg-sys-gold/10 px-2 py-0.5 text-[11px] font-bold tracking-wider text-sys-gold">
                +{character.statPoints} POINTS
              </span>
            )}
          </div>
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between text-[11px] uppercase tracking-widest text-sys-muted">
            <span>EXP</span>
            <span className="font-mono text-sys-text/80">
              {character.exp} / {need}
            </span>
          </div>
          <div className="h-2.5 w-full overflow-hidden border border-sys-border/40 bg-black/50">
            <div
              className="h-full bg-gradient-to-r from-sys-accent to-sys-gold transition-all duration-500"
              style={{
                width: `${pct}%`,
                boxShadow: '0 0 12px rgba(0, 212, 255, 0.7)',
              }}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {ALL_STATS.map((s) => (
            <div
              key={s}
              className="flex items-center justify-between border border-sys-border/30 bg-black/30 px-3 py-2"
            >
              <span className="flex flex-col leading-tight">
                <span className="text-[10px] uppercase tracking-widest text-sys-muted">
                  {STAT_LABELS[s].en}
                </span>
                <span className="text-xs text-sys-text/70">{STAT_LABELS[s].jp}</span>
              </span>
              <span className="font-mono text-xl font-bold text-sys-text">
                {character.stats[s]}
              </span>
            </div>
          ))}
        </div>

        <div className="border-t border-sys-border/20 pt-4">
          <WeightPanel uid={uid} />
        </div>

        <div className="border-t border-sys-border/20 pt-3 text-[11px] text-sys-muted">
          Total EXP earned: <span className="font-mono text-sys-text/80">{character.totalExp}</span>
        </div>
      </div>
    </SystemWindow>
  );
}
