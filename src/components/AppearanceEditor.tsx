import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { SystemWindow } from './SystemWindow';
import { PixelArt } from './PixelArt';
import {
  ACCENT_COLORS,
  CLASS_TEMPLATES,
  PRIMARY_COLORS,
  renderClassSprite,
  DEFAULT_APPEARANCE,
} from '../lib/playerSprites';
import type { HunterAppearance, HunterClass } from '../types';

interface Props {
  open: boolean;
  current: HunterAppearance | undefined;
  onClose: () => void;
  onSave: (appearance: HunterAppearance) => Promise<void>;
}

const CLASS_ORDER: HunterClass[] = ['knight', 'mage', 'hunter', 'scout'];

export function AppearanceEditor({ open, current, onClose, onSave }: Props) {
  const initial = current ?? DEFAULT_APPEARANCE;
  const [hunterClass, setHunterClass] = useState<HunterClass>(initial.hunterClass);
  const [primaryColor, setPrimaryColor] = useState<string>(initial.primaryColor);
  const [accentColor, setAccentColor] = useState<string>(initial.accentColor);
  const [busy, setBusy] = useState(false);

  // Re-sync local state when the modal opens so cancel + reopen shows the
  // saved values, not whatever the user left mid-edit last time.
  useEffect(() => {
    if (!open) return;
    setHunterClass(initial.hunterClass);
    setPrimaryColor(initial.primaryColor);
    setAccentColor(initial.accentColor);
  }, [open, initial.hunterClass, initial.primaryColor, initial.accentColor]);

  const sprite = useMemo(
    () => renderClassSprite(hunterClass, primaryColor, accentColor),
    [hunterClass, primaryColor, accentColor]
  );

  const pickClass = (next: HunterClass) => {
    setHunterClass(next);
    // Snap palette to the class's signature colors when switching, so
    // changing class doesn't leave a weirdly-coloured Mage etc.
    setPrimaryColor(CLASS_TEMPLATES[next].preview.primary);
    setAccentColor(CLASS_TEMPLATES[next].preview.accent);
  };

  const save = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await onSave({ hunterClass, primaryColor, accentColor });
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
      <div className="w-full max-w-lg my-auto" onClick={(e) => e.stopPropagation()}>
        <SystemWindow title="Appearance Edit" subtitle="reforge">
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

          <div className="space-y-4">
            <div className="flex justify-center border border-sys-border/40 bg-black/40 p-4">
              <PixelArt
                layers={[{ grid: sprite.grid, palette: sprite.palette }]}
                pixelSize={10}
                ariaLabel="プレビュー"
              />
            </div>

            <div>
              <span className="block text-xs uppercase tracking-widest text-sys-muted mb-2">
                Class
              </span>
              <div className="grid grid-cols-2 gap-2">
                {CLASS_ORDER.map((c) => {
                  const tpl = CLASS_TEMPLATES[c];
                  const selected = c === hunterClass;
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => pickClass(c)}
                      className={`flex items-center gap-2 border px-2 py-2 text-left transition ${
                        selected
                          ? 'border-sys-accent bg-sys-accent/10'
                          : 'border-sys-border/40 hover:border-sys-border'
                      }`}
                    >
                      <div className="shrink-0">
                        <PixelArt
                          layers={[
                            {
                              grid: tpl.grid,
                              palette: {
                                ...tpl.basePalette,
                                P: tpl.preview.primary,
                                A: tpl.preview.accent,
                              },
                            },
                          ]}
                          pixelSize={2}
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] uppercase tracking-widest text-sys-muted">
                          {tpl.label}
                        </p>
                        <p className="text-sm font-bold text-sys-text">{tpl.jp}</p>
                        <p className="text-[10px] text-sys-muted/80 truncate">
                          {tpl.blurb}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <ColorRow
                label="主色"
                value={primaryColor}
                options={PRIMARY_COLORS}
                onChange={setPrimaryColor}
              />
              <ColorRow
                label="差し色"
                value={accentColor}
                options={ACCENT_COLORS}
                onChange={setAccentColor}
              />
            </div>

            <div className="flex gap-2 pt-2">
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
                className="sys-button flex-1 justify-center"
                disabled={busy}
              >
                {busy ? '保存中…' : '保存'}
              </button>
            </div>
          </div>
        </SystemWindow>
      </div>
    </div>
  );
}

interface ColorRowProps {
  label: string;
  value: string;
  options: string[];
  onChange: (color: string) => void;
}

function ColorRow({ label, value, options, onChange }: ColorRowProps) {
  return (
    <div>
      <span className="block text-xs uppercase tracking-widest text-sys-muted mb-2">
        {label}
      </span>
      <div className="grid grid-cols-4 gap-1.5">
        {options.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onChange(c)}
            aria-label={`色 ${c}`}
            className={`h-7 w-full border transition ${
              value === c
                ? 'border-sys-accent ring-1 ring-sys-accent'
                : 'border-sys-border/40 hover:border-sys-border'
            }`}
            style={{ background: c }}
          />
        ))}
      </div>
    </div>
  );
}
