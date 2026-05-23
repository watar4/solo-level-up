import { useMemo, useState } from 'react';
import { X, Sword } from 'lucide-react';
import { SystemWindow } from './SystemWindow';
import {
  RARITY_COLOR,
  RARITY_LABEL,
  SHADOW_EQUIP_LIMIT,
  totalShadowBonus,
} from '../lib/shadows';
import { ALL_STATS, STAT_LABELS } from '../types';
import type { Shadow, ShadowRarity, StatKey } from '../types';

interface Props {
  open: boolean;
  shadows: Shadow[];
  onClose: () => void;
  onEquip: (id: string) => Promise<void>;
  onUnequip: (id: string) => Promise<void>;
  onDiscard: (id: string) => Promise<void>;
}

const RARITY_ORDER: ShadowRarity[] = ['legendary', 'epic', 'rare', 'normal'];

function formatBonus(s: Shadow): string {
  // Quick label like "STR +4" — works as a compact rarity-driven hint.
  const map: Record<ShadowRarity, number> = {
    normal: 1,
    rare: 2,
    epic: 4,
    legendary: 7,
  };
  return `${s.stat} +${map[s.rarity]}`;
}

export function ShadowArmyPanel({
  open,
  shadows,
  onClose,
  onEquip,
  onUnequip,
  onDiscard,
}: Props) {
  const [busyId, setBusyId] = useState<string | null>(null);

  const equippedCount = shadows.filter((s) => s.equipped).length;

  const grouped = useMemo(() => {
    const m = new Map<ShadowRarity, Shadow[]>();
    for (const r of RARITY_ORDER) m.set(r, []);
    for (const s of shadows) {
      m.get(s.rarity)?.push(s);
    }
    // Within a rarity tier, equipped first then newest.
    for (const arr of m.values()) {
      arr.sort((a, b) => {
        if (a.equipped !== b.equipped) return a.equipped ? -1 : 1;
        return b.createdAt - a.createdAt;
      });
    }
    return m;
  }, [shadows]);

  const bonus = useMemo(() => totalShadowBonus(shadows), [shadows]);

  const handleEquip = async (id: string) => {
    if (busyId) return;
    if (equippedCount >= SHADOW_EQUIP_LIMIT) return;
    setBusyId(id);
    try {
      await onEquip(id);
    } finally {
      setBusyId(null);
    }
  };
  const handleUnequip = async (id: string) => {
    if (busyId) return;
    setBusyId(id);
    try {
      await onUnequip(id);
    } finally {
      setBusyId(null);
    }
  };
  const handleDiscard = async (s: Shadow) => {
    if (busyId) return;
    if (!window.confirm(`「${s.name}」を抹消しますか? (戻せません)`)) return;
    setBusyId(s.id);
    try {
      await onDiscard(s.id);
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
        <SystemWindow title="Shadow Army" subtitle="influence">
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

          <div className="mb-4 border border-sys-border/30 bg-black/30 p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-sys-muted">
                  編成状況
                </p>
                <p className="mt-0.5 font-mono text-lg text-sys-accent">
                  {equippedCount} / {SHADOW_EQUIP_LIMIT}
                </p>
              </div>
              <div className="grid grid-cols-5 gap-1.5 text-center">
                {ALL_STATS.map((s) => (
                  <div key={s} className="px-1.5 py-1 border border-sys-border/30">
                    <div className="text-[9px] uppercase tracking-widest text-sys-muted">
                      {STAT_LABELS[s].en}
                    </div>
                    <div className={`font-mono text-sm ${bonus[s] > 0 ? 'text-sys-accent' : 'text-sys-text/40'}`}>
                      +{bonus[s]}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {shadows.length === 0 ? (
            <div className="border border-dashed border-sys-border/30 px-4 py-10 text-center text-sm text-sys-muted">
              影をまだ獲得していません。<br />
              クエスト達成・デイリーボス撃破で確率獲得できます。
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
                        ({list.length} 体)
                      </span>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {list.map((s) => (
                        <ShadowCard
                          key={s.id}
                          shadow={s}
                          busy={busyId === s.id}
                          canEquipMore={equippedCount < SHADOW_EQUIP_LIMIT}
                          stat={s.stat}
                          onEquip={() => handleEquip(s.id)}
                          onUnequip={() => handleUnequip(s.id)}
                          onDiscard={() => handleDiscard(s)}
                        />
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

interface ShadowCardProps {
  shadow: Shadow;
  busy: boolean;
  canEquipMore: boolean;
  stat: StatKey;
  onEquip: () => void;
  onUnequip: () => void;
  onDiscard: () => void;
}

function ShadowCard({
  shadow,
  busy,
  canEquipMore,
  stat,
  onEquip,
  onUnequip,
  onDiscard,
}: ShadowCardProps) {
  return (
    <div
      className={`group relative border px-3 py-2 ${
        shadow.equipped
          ? 'border-sys-accent/70 bg-sys-accent/5'
          : 'border-sys-border/40 bg-black/30'
      }`}
    >
      <div className="flex items-start gap-2">
        <span className="mt-0.5 text-lg">🌑</span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-sys-text">{shadow.name}</p>
          <div className="mt-0.5 flex items-baseline gap-2">
            <span className="text-[10px] uppercase tracking-widest text-sys-muted">
              {STAT_LABELS[stat].en}
            </span>
            <span className="font-mono text-xs text-sys-accent">
              {formatBonus(shadow)}
            </span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          {shadow.equipped ? (
            <button
              type="button"
              onClick={onUnequip}
              disabled={busy}
              className="border border-sys-border/50 px-2 py-0.5 text-[10px] uppercase tracking-widest text-sys-muted hover:border-sys-danger/70 hover:text-sys-danger transition"
            >
              外す
            </button>
          ) : (
            <button
              type="button"
              onClick={onEquip}
              disabled={busy || !canEquipMore}
              title={!canEquipMore ? '編成枠が一杯です' : undefined}
              className="inline-flex items-center gap-1 border border-sys-accent/60 bg-sys-accent/10 px-2 py-0.5 text-[10px] uppercase tracking-widest text-sys-accent hover:bg-sys-accent/25 disabled:opacity-40 transition"
            >
              <Sword className="h-3 w-3" />
              装備
            </button>
          )}
          <button
            type="button"
            onClick={onDiscard}
            disabled={busy}
            className="text-[10px] uppercase tracking-widest text-sys-muted/60 hover:text-sys-danger transition"
          >
            抹消
          </button>
        </div>
      </div>
    </div>
  );
}
