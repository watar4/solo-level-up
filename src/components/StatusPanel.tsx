import { useEffect, useRef, useState } from 'react';
import type { Character } from '../types';
import { ALL_STATS, STAT_LABELS } from '../types';
import { expForLevel, rankForLevel } from '../lib/leveling';
import { SystemWindow } from './SystemWindow';
import { WeightPanel } from './WeightPanel';
import { Pencil } from 'lucide-react';

interface Props {
  character: Character;
  email?: string | null;
  uid: string;
  onRename: (name: string) => Promise<void>;
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

export function StatusPanel({ character, email, uid, onRename }: Props) {
  const rank = rankForLevel(character.level);
  const need = expForLevel(character.level);
  const pct = Math.min(100, Math.round((character.exp / need) * 100));

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(character.name);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      setDraft(character.name);
      // Autofocus + select on entering edit mode.
      requestAnimationFrame(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      });
    }
  }, [editing, character.name]);

  const commit = async () => {
    const trimmed = draft.trim();
    if (!trimmed || saving) {
      setEditing(false);
      return;
    }
    if (trimmed === character.name) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onRename(trimmed);
    } catch (err) {
      console.error('[character:rename] failed', err);
    } finally {
      setSaving(false);
      setEditing(false);
    }
  };

  return (
    <SystemWindow title="Status" subtitle={email ?? ''}>
      <div className="space-y-5">
        <div>
          <div className="flex items-end justify-between gap-3">
            {editing ? (
              <input
                ref={inputRef}
                type="text"
                value={draft}
                maxLength={24}
                disabled={saving}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={commit}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void commit();
                  } else if (e.key === 'Escape') {
                    e.preventDefault();
                    setEditing(false);
                  }
                }}
                className="sys-input min-w-0 flex-1 text-2xl font-black tracking-wider"
                aria-label="ハンター名を編集"
              />
            ) : (
              <button
                type="button"
                onClick={() => setEditing(true)}
                title="ハンター名を編集"
                className="group inline-flex items-center gap-2 text-2xl font-black tracking-wider text-left hover:text-sys-accent transition"
              >
                <span className="truncate">{character.name}</span>
                <Pencil className="h-3.5 w-3.5 opacity-40 group-hover:opacity-100 transition" />
              </button>
            )}
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
