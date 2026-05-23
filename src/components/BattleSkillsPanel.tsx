import { useEffect, useMemo, useState } from 'react';
import { X, Sparkles, Lock, Heart, Sword } from 'lucide-react';
import { SystemWindow } from './SystemWindow';
import {
  BATTLE_SKILLS,
  MAX_EQUIPPED_SKILLS,
  describeUnlock,
  effectiveEquippedSkills,
  isSkillUnlocked,
} from '../lib/battleSkills';
import type { BattleSkill } from '../lib/battleSkills';
import type { Character } from '../types';
import { STAT_LABELS } from '../types';

interface Props {
  open: boolean;
  character: Character;
  onClose: () => void;
  onSave: (skillIds: string[]) => Promise<void>;
}

function effectSummary(s: BattleSkill): string {
  if (s.effect.kind === 'heal') {
    return `回復 ${Math.round(s.effect.healPct * 100)}%`;
  }
  const parts = [`${s.effect.stat} ×${s.effect.damageMultiplier.toFixed(1)}`];
  if (s.effect.guaranteedCrit) parts.push('必中クリ');
  else if (s.effect.critBonusFlat) parts.push(`クリ+${Math.round(s.effect.critBonusFlat * 100)}%`);
  return parts.join(' · ');
}

export function BattleSkillsPanel({ open, character, onClose, onSave }: Props) {
  const initialEquipped = effectiveEquippedSkills(character);
  const [equipped, setEquipped] = useState<string[]>(initialEquipped);
  const [busy, setBusy] = useState(false);

  // Re-seed local equipped state when the modal opens, so canceling and
  // reopening shows the saved loadout rather than stale draft.
  useEffect(() => {
    if (open) setEquipped(effectiveEquippedSkills(character));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, character.equippedSkills]);

  const grouped = useMemo(() => {
    const unlocked: BattleSkill[] = [];
    const locked: BattleSkill[] = [];
    for (const s of BATTLE_SKILLS) {
      if (isSkillUnlocked(s, character)) unlocked.push(s);
      else locked.push(s);
    }
    return { unlocked, locked };
  }, [character]);

  const toggle = (id: string) => {
    setEquipped((prev) => {
      if (prev.includes(id)) {
        return prev.filter((x) => x !== id);
      }
      if (prev.length >= MAX_EQUIPPED_SKILLS) return prev;
      return [...prev, id];
    });
  };

  const save = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await onSave(equipped);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-sm overflow-y-auto"
      onClick={onClose}
    >
      <div className="w-full max-w-2xl my-auto" onClick={(e) => e.stopPropagation()}>
        <SystemWindow title="Battle Skills" subtitle="loadout">
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

          <div className="mb-4 flex items-center justify-between border border-sys-border/30 bg-black/30 px-3 py-2">
            <p className="text-[10px] uppercase tracking-widest text-sys-muted flex items-center gap-1.5">
              <Sparkles className="h-3 w-3" />
              編成枠
            </p>
            <p className="font-mono text-sm text-sys-accent">
              {equipped.length} / {MAX_EQUIPPED_SKILLS}
            </p>
          </div>

          <section className="space-y-2">
            <p className="text-[10px] uppercase tracking-widest text-sys-muted">
              解放済み ({grouped.unlocked.length})
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {grouped.unlocked.map((s) => {
                const checked = equipped.includes(s.id);
                const atCap = !checked && equipped.length >= MAX_EQUIPPED_SKILLS;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => toggle(s.id)}
                    disabled={atCap}
                    className={`border px-3 py-2 text-left transition ${
                      checked
                        ? 'border-sys-accent bg-sys-accent/10'
                        : 'border-sys-border/40 bg-black/30 hover:border-sys-border'
                    } disabled:opacity-40 disabled:cursor-not-allowed`}
                  >
                    <div className="flex items-start gap-2">
                      <span className="mt-0.5 text-sys-accent">
                        {s.effect.kind === 'heal' ? (
                          <Heart className="h-4 w-4" />
                        ) : (
                          <Sword className="h-4 w-4" />
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <p className="text-sm font-bold text-sys-text truncate">
                            {s.name}
                          </p>
                          <span className="text-[10px] font-mono text-sys-muted shrink-0">
                            {effectSummary(s)}
                          </span>
                        </div>
                        <p className="mt-0.5 text-[11px] text-sys-muted/80 leading-snug">
                          {s.description}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {grouped.locked.length > 0 && (
            <section className="mt-5 space-y-2">
              <p className="text-[10px] uppercase tracking-widest text-sys-muted">
                未解放 ({grouped.locked.length})
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {grouped.locked.map((s) => (
                  <div
                    key={s.id}
                    className="border border-sys-border/20 bg-black/20 px-3 py-2 opacity-60"
                  >
                    <div className="flex items-start gap-2">
                      <Lock className="mt-0.5 h-4 w-4 text-sys-muted/60" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <p className="text-sm font-bold text-sys-muted truncate">
                            {s.name}
                          </p>
                          <span className="text-[10px] font-mono text-sys-muted/70 shrink-0">
                            {effectSummary(s)}
                          </span>
                        </div>
                        <p className="mt-0.5 text-[11px] text-sys-muted/70 leading-snug">
                          {s.description}
                        </p>
                        <p className="mt-0.5 text-[10px] text-sys-gold/80">
                          {describeUnlock(s)}{previewProgress(s, character)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          <div className="mt-5 flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="sys-button flex-1 justify-center"
            >
              キャンセル
            </button>
            <button
              type="button"
              onClick={save}
              disabled={busy}
              className="sys-button flex-1 justify-center"
            >
              {busy ? '保存中…' : '編成を保存'}
            </button>
          </div>
        </SystemWindow>
      </div>
    </div>
  );
}

// Append a tiny "現在 X / Y" hint so the user can see how close they are to
// unlocking a locked skill from their current level/stat.
function previewProgress(s: BattleSkill, c: Character): string {
  if (s.unlock.level !== undefined) {
    return `（現在 Lv ${c.level}）`;
  }
  if (s.unlock.statThreshold) {
    const t = s.unlock.statThreshold;
    const v = c.stats[t.stat] ?? 0;
    return `（現在 ${STAT_LABELS[t.stat].en} ${v}）`;
  }
  return '';
}
