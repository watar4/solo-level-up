import { useMemo } from 'react';
import { X, BookOpen } from 'lucide-react';
import { SystemWindow } from './SystemWindow';
import { PixelArt } from './PixelArt';
import { BOSSES } from '../lib/boss';
import { BOSS_SPRITES, FALLBACK_BOSS_SPRITE } from '../lib/bossSprites';
import { RARITY_COLOR, RARITY_LABEL, SHADOW_TEMPLATES } from '../lib/shadows';
import { SHADOW_RARITY_ORDER, STAT_LABELS } from '../types';
import type { Character, Shadow } from '../types';

interface Props {
  open: boolean;
  character: Character;
  shadows: Shadow[];
  onClose: () => void;
}

// How many times boss template #i (0-indexed in the BOSSES rotation) has
// been defeated, given the tower cycles through the pool floor by floor.
function defeatCount(bossIndex: number, bossesDefeated: number): number {
  if (bossesDefeated <= bossIndex) return 0;
  return Math.floor((bossesDefeated - 1 - bossIndex) / BOSSES.length) + 1;
}

// Silhouette palette: every opaque pixel renders as the same dark navy so
// undiscovered entries read as a mystery silhouette, Pokédex-style.
function silhouette(palette: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.keys(palette).map((k) => [k, '#101b30']));
}

export function DexPanel({ open, character, shadows, onClose }: Props) {
  const bossesDefeated = character.bossesDefeated ?? 0;

  // Shadows ever obtained: the persisted dex list, plus currently-owned ones
  // (covers shadows acquired before the dex field existed).
  const seenShadowTemplates = useMemo(() => {
    const seen = new Set(character.dexShadows ?? []);
    for (const s of shadows) seen.add(s.templateId);
    return seen;
  }, [character.dexShadows, shadows]);

  const bossFound = BOSSES.filter((_, i) => defeatCount(i, bossesDefeated) > 0).length;
  const shadowFound = SHADOW_TEMPLATES.filter((t) => seenShadowTemplates.has(t.id)).length;

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-sm overflow-y-auto"
      onClick={onClose}
    >
      <div className="w-full max-w-2xl my-auto" onClick={(e) => e.stopPropagation()}>
        <SystemWindow title="Dex" subtitle="encyclopedia">
          <div className="mb-2 flex items-center justify-between">
            <p className="flex items-center gap-1.5 text-[11px] text-sys-muted">
              <BookOpen className="h-3.5 w-3.5" />
              討伐図鑑 — 出会った魔物と影の記録
            </p>
            <button
              type="button"
              onClick={onClose}
              className="text-sys-muted hover:text-sys-text"
              aria-label="閉じる"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Boss dex */}
          <section className="space-y-2">
            <div className="flex items-baseline justify-between">
              <p className="text-[10px] uppercase tracking-widest text-sys-muted">
                魔物図鑑
              </p>
              <p className="font-mono text-xs text-sys-accent">
                {bossFound} / {BOSSES.length}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {BOSSES.map((b, i) => {
                const kills = defeatCount(i, bossesDefeated);
                const found = kills > 0;
                const sprite = BOSS_SPRITES[b.id] ?? FALLBACK_BOSS_SPRITE;
                return (
                  <div
                    key={b.id}
                    className={`border px-2.5 py-2 ${
                      found
                        ? 'border-sys-border/40 bg-black/30'
                        : 'border-sys-border/20 bg-black/20'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className="shrink-0 border border-sys-border/30 bg-black/60 p-0.5">
                        <PixelArt
                          layers={[
                            {
                              grid: sprite.grid,
                              palette: found ? sprite.palette : silhouette(sprite.palette),
                            },
                          ]}
                          pixelSize={3}
                          ariaLabel={found ? b.name : '未討伐の魔物'}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className={`truncate text-[11px] font-bold ${found ? 'text-sys-text' : 'text-sys-muted'}`}>
                          {found ? b.name : '？？？'}
                        </p>
                        {found ? (
                          <>
                            <p className="mt-0.5 font-mono text-[9px] text-sys-muted">
                              討伐 ×{kills}
                            </p>
                            <p className="font-mono text-[9px]">
                              <span className="text-sys-gold">弱 {b.weak}</span>
                              <span className="text-sys-muted"> / </span>
                              <span className="text-sys-danger">耐 {b.resist}</span>
                            </p>
                          </>
                        ) : (
                          <p className="mt-0.5 text-[9px] text-sys-muted">
                            タワーを進んで遭遇
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Shadow dex */}
          <section className="mt-5 space-y-2">
            <div className="flex items-baseline justify-between">
              <p className="text-[10px] uppercase tracking-widest text-sys-muted">
                影図鑑
              </p>
              <p className="font-mono text-xs text-sys-arise">
                {shadowFound} / {SHADOW_TEMPLATES.length}
              </p>
            </div>
            {SHADOW_RARITY_ORDER.map((rarity) => {
              const list = SHADOW_TEMPLATES.filter((t) => t.rarity === rarity);
              return (
                <div key={rarity} className="space-y-1.5">
                  <span
                    className={`inline-block border px-2 py-0.5 text-[10px] font-bold tracking-widest ${RARITY_COLOR[rarity]}`}
                  >
                    {RARITY_LABEL[rarity]}
                  </span>
                  <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                    {list.map((t) => {
                      const found = seenShadowTemplates.has(t.id);
                      return (
                        <div
                          key={t.id}
                          className={`border px-2 py-1.5 ${
                            found
                              ? `${RARITY_COLOR[t.rarity]} bg-black/30`
                              : 'border-sys-border/20 bg-black/20'
                          }`}
                        >
                          <p className={`truncate text-[11px] font-bold ${found ? 'text-sys-text' : 'text-sys-muted'}`}>
                            {found ? t.name : '？？？'}
                          </p>
                          <p className="font-mono text-[9px] text-sys-muted">
                            {found ? STAT_LABELS[t.stat].en : '未収集'}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </section>
        </SystemWindow>
      </div>
    </div>
  );
}
