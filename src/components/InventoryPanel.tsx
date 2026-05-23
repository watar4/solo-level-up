import { useMemo, useState } from 'react';
import { X, Sword } from 'lucide-react';
import { SystemWindow } from './SystemWindow';
import { RARITY_COLOR, RARITY_LABEL } from '../lib/shadows';
import { weaponBonusFor } from '../lib/items';
import type { Item, ShadowRarity } from '../types';
import { STAT_LABELS } from '../types';

interface Props {
  open: boolean;
  items: Item[];
  onClose: () => void;
  onEquip: (id: string) => Promise<void>;
  onUnequip: (id: string) => Promise<void>;
  onDiscard: (id: string) => Promise<void>;
}

const RARITY_ORDER: ShadowRarity[] = ['legendary', 'epic', 'rare', 'normal'];

export function InventoryPanel({
  open,
  items,
  onClose,
  onEquip,
  onUnequip,
  onDiscard,
}: Props) {
  const [busyId, setBusyId] = useState<string | null>(null);

  const weapons = useMemo(
    () => items.filter((i) => i.kind === 'weapon'),
    [items]
  );

  const grouped = useMemo(() => {
    const m = new Map<ShadowRarity, Item[]>();
    for (const r of RARITY_ORDER) m.set(r, []);
    for (const w of weapons) m.get(w.rarity)?.push(w);
    for (const arr of m.values()) {
      arr.sort((a, b) => {
        if (a.equipped !== b.equipped) return a.equipped ? -1 : 1;
        return b.createdAt - a.createdAt;
      });
    }
    return m;
  }, [weapons]);

  const equipped = weapons.find((w) => w.equipped) ?? null;

  const handle = async (fn: (id: string) => Promise<void>, id: string) => {
    if (busyId) return;
    setBusyId(id);
    try {
      await fn(id);
    } finally {
      setBusyId(null);
    }
  };

  const handleDiscard = async (w: Item) => {
    if (busyId) return;
    if (!window.confirm(`「${w.name}」を破棄しますか? (戻せません)`)) return;
    setBusyId(w.id);
    try {
      await onDiscard(w.id);
    } finally {
      setBusyId(null);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-sm overflow-y-auto"
      onClick={onClose}
    >
      <div className="w-full max-w-2xl my-auto" onClick={(e) => e.stopPropagation()}>
        <SystemWindow title="Inventory" subtitle="weapons & gear">
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

          <div className="mb-4 border border-sys-border/30 bg-black/30 p-3 space-y-1.5">
            <p className="text-[10px] uppercase tracking-widest text-sys-muted">
              装備中の武器
            </p>
            {equipped ? (
              <p className="font-mono text-sm">
                <span className="text-sys-accent">{equipped.name}</span>
                <span className="ml-2 text-sys-muted">
                  {equipped.stat} +{weaponBonusFor(equipped.rarity)}
                </span>
              </p>
            ) : (
              <p className="text-sm text-sys-muted">未装備</p>
            )}
          </div>

          {weapons.length === 0 ? (
            <div className="border border-dashed border-sys-border/30 px-4 py-10 text-center text-sm text-sys-muted">
              武器をまだ入手していません。<br />
              ボス撃破時の宝箱で確率ドロップします。
            </div>
          ) : (
            <div className="space-y-4">
              {RARITY_ORDER.map((r) => {
                const list = grouped.get(r) ?? [];
                if (list.length === 0) return null;
                return (
                  <section key={r}>
                    <div className="mb-2 flex items-center gap-2">
                      <span
                        className={`inline-block border px-2 py-0.5 text-[10px] font-bold tracking-widest ${RARITY_COLOR[r]}`}
                      >
                        {RARITY_LABEL[r]}
                      </span>
                      <span className="text-[10px] text-sys-muted">
                        ({list.length} 本)
                      </span>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {list.map((w) => (
                        <div
                          key={w.id}
                          className={`relative border px-3 py-2 ${
                            w.equipped
                              ? 'border-sys-accent/70 bg-sys-accent/5'
                              : 'border-sys-border/40 bg-black/30'
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            <span className="mt-0.5 text-lg">⚔️</span>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-bold text-sys-text">
                                {w.name}
                              </p>
                              <div className="mt-0.5 flex items-baseline gap-2">
                                <span className="text-[10px] uppercase tracking-widest text-sys-muted">
                                  {STAT_LABELS[w.stat].en}
                                </span>
                                <span className="font-mono text-xs text-sys-accent">
                                  +{weaponBonusFor(w.rarity)}
                                </span>
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              {w.equipped ? (
                                <button
                                  type="button"
                                  onClick={() => handle(onUnequip, w.id)}
                                  disabled={busyId === w.id}
                                  className="border border-sys-border/50 px-2 py-0.5 text-[10px] uppercase tracking-widest text-sys-muted hover:border-sys-danger/70 hover:text-sys-danger transition"
                                >
                                  外す
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handle(onEquip, w.id)}
                                  disabled={busyId === w.id}
                                  className="inline-flex items-center gap-1 border border-sys-accent/60 bg-sys-accent/10 px-2 py-0.5 text-[10px] uppercase tracking-widest text-sys-accent hover:bg-sys-accent/25 transition"
                                >
                                  <Sword className="h-3 w-3" />
                                  装備
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleDiscard(w)}
                                disabled={busyId === w.id}
                                className="text-[10px] uppercase tracking-widest text-sys-muted/60 hover:text-sys-danger transition"
                              >
                                破棄
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </SystemWindow>
      </div>
    </div>
  );
}
