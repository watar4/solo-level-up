import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { X, Dices } from 'lucide-react';
import { PixelArt } from './PixelArt';
import { PRIMARY_COLORS, ACCENT_COLORS } from '../lib/playerSprites';
import {
  renderAvatar, randomAppearance, normalizeAppearance,
  SKINS, HAIR_STYLES, HAIR_COLORS, EYE_STYLES, EYE_COLORS, ACCESSORIES,
  OUTFITS, isOutfitUnlocked, outfitUnlockLabel, type UnlockCtx,
} from '../lib/appearance';
import type { Character, HunterAppearance } from '../types';
import { usePanelDialog } from '../hooks/usePanelDialog';

interface Props {
  character: Character;
  onClose: () => void;
  onSave: (appearance: HunterAppearance) => Promise<void>;
}

// Closet (クローゼット) — post-creation appearance editor. All hair/eyes/colours
// are free; special outfits unlock via progress (docs 05 §3, §5).
export function ClosetPanel({ character, onClose, onSave }: Props) {
  const [app, setApp] = useState<HunterAppearance>(() => normalizeAppearance(character.appearance ?? { hunterClass: 'knight', primaryColor: '#3a6abc', accentColor: '#c8d0d8' }));
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(false);
  const dialog = usePanelDialog(onClose);
  const avatar = useMemo(() => renderAvatar(app), [app]);
  const patch = (p: Partial<HunterAppearance>) => setApp((a) => ({ ...a, ...p }));

  const ctx: UnlockCtx = {
    medals: character.campaign?.medals.length ?? 0,
    cleared: character.campaign?.clearedChapters ?? [],
    achievements: character.unlocked?.achievements.length ?? 0,
  };

  const save = async () => {
    if (saving) return;
    setSaving(true);
    setErr(false);
    try {
      await onSave(app);
      onClose();
    } catch (e) {
      console.error('[closet] save failed', e);
      setErr(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      {...dialog}
      aria-label="クローゼット"
      className="fixed inset-0 z-50 overflow-y-auto bg-[#04070f]/97 p-4 outline-none"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 5rem)' }}
    >
      <div className="mx-auto max-w-md">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="sys-title text-base">クローゼット</h2>
          <button type="button" onClick={onClose} aria-label="とじる" className="-m-2 p-2 text-sys-muted hover:text-sys-text"><X className="h-5 w-5" /></button>
        </div>
        {err && (
          <p role="status" className="mb-3 rounded-md border border-rose-500/50 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
            保存に しっぱいした。もういちど ためして。
          </p>
        )}

        <div className="mb-4 flex items-center justify-center rounded-md border border-sys-border/40 bg-[#0a0f1c] py-4">
          <motion.div animate={{ y: [0, -4, 0] }} transition={{ repeat: Infinity, duration: 2 }}>
            <PixelArt layers={[avatar]} pixelSize={7} ariaLabel="プレビュー" />
          </motion.div>
        </div>

        <div className="mb-3 flex justify-end">
          <button type="button" onClick={() => setApp(randomAppearance(app.hunterClass))} className="sys-button flex items-center gap-1 px-3 py-1.5 text-xs">
            <Dices className="h-4 w-4" /> ランダム
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <div className="mb-1 text-[10px] uppercase tracking-wide text-sys-muted">いしょう</div>
            <div className="grid grid-cols-2 gap-1.5">
              {OUTFITS.map((o) => {
                const unlocked = isOutfitUnlocked(o, ctx);
                const active = app.outfit === o.id;
                return (
                  <button
                    key={o.id}
                    type="button"
                    disabled={!unlocked}
                    aria-pressed={active}
                    onClick={() => patch({ outfit: o.id, primaryColor: o.primary, accentColor: o.accent })}
                    className={`rounded-sm border px-2 py-1.5 text-left text-xs transition ${
                      active ? 'border-sys-accent bg-sys-accent/10 text-sys-text'
                        : unlocked ? 'border-sys-border/40 text-sys-muted' : 'border-sys-border/20'
                    }`}
                  >
                    {/* Locked: dim only the name — the unlock hint is the one
                        thing the user must be able to read. */}
                    {unlocked ? o.label : <span className="text-sys-muted/50">🔒 {o.label}</span>}
                    {!unlocked && <span className="block text-[10px] text-sys-muted">{outfitUnlockLabel(o)}</span>}
                  </button>
                );
              })}
            </div>
          </div>
          <Swatches label="はだ" colors={SKINS.map((s) => s.hex)} value={app.skin} onPick={(v) => patch({ skin: v })} />
          <Chips label="かみがた" options={HAIR_STYLES} value={app.hair} onPick={(v) => patch({ hair: v })} />
          <Swatches label="かみいろ" colors={HAIR_COLORS} value={app.hairColor} onPick={(v) => patch({ hairColor: v })} />
          <Chips label="め" options={EYE_STYLES} value={app.eyes} onPick={(v) => patch({ eyes: v })} />
          <Swatches label="めのいろ" colors={EYE_COLORS} value={app.eyeColor} onPick={(v) => patch({ eyeColor: v })} />
          <Chips label="アクセ" options={ACCESSORIES} value={app.accessory} onPick={(v) => patch({ accessory: v })} />
          <Swatches label="ふくのいろ" colors={PRIMARY_COLORS} value={app.primaryColor} onPick={(v) => patch({ primaryColor: v })} />
          <Swatches label="さしいろ" colors={ACCENT_COLORS} value={app.accentColor} onPick={(v) => patch({ accentColor: v })} />
        </div>

        <button type="button" onClick={save} disabled={saving} className="sys-button-arise mt-5 w-full py-2.5 text-sm font-bold">
          {saving ? '保存中…' : '保存する'}
        </button>
      </div>
    </div>
  );
}

function Swatches({ label, colors, value, onPick }: { label: string; colors: string[]; value?: string; onPick: (v: string) => void }) {
  return (
    <div>
      <div className="mb-1 text-[10px] uppercase tracking-wide text-sys-muted">{label}</div>
      <div className="flex flex-wrap gap-1.5">
        {colors.map((c) => (
          <button key={c} type="button" onClick={() => onPick(c)}
            aria-label={`${label} ${c}`} aria-pressed={value === c}
            className={`h-9 w-9 rounded-sm border-2 transition ${value === c ? 'border-sys-accent scale-110' : 'border-transparent'}`}
            style={{ backgroundColor: c }} />
        ))}
      </div>
    </div>
  );
}

function Chips({ label, options, value, onPick }: { label: string; options: { id: string; label: string }[]; value?: string; onPick: (v: string) => void }) {
  return (
    <div>
      <div className="mb-1 text-[10px] uppercase tracking-wide text-sys-muted">{label}</div>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => (
          <button key={o.id} type="button" onClick={() => onPick(o.id)} aria-pressed={value === o.id}
            className={`rounded-sm border px-2.5 py-1.5 text-xs transition ${value === o.id ? 'border-sys-accent bg-sys-accent/10 text-sys-text' : 'border-sys-border/40 text-sys-muted'}`}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
