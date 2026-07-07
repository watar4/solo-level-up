import { useMemo, useState } from 'react';
import { X, Sword, Zap } from 'lucide-react';
import { SystemWindow } from './SystemWindow';
import {
  RARITY_COLOR,
  RARITY_LABEL,
  SHADOW_EQUIP_LIMIT,
  SHADOW_ROLE_LABEL,
  shadowRole,
} from '../lib/shadows';
import {
  nextEvolutionLevel,
  shadowCombatPower,
  shadowExp,
  shadowExpForLevel,
  shadowLevel,
  stageDisplayName,
  SHADOW_MAX_LEVEL,
} from '../lib/shadowGrowth';
import { STAT_LABELS } from '../types';
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

function combatLine(s: Shadow): string {
  const c = shadowCombatPower(s);
  return `${SHADOW_ROLE_LABEL[shadowRole(s.stat)]} · ATK ${c.attack} · 速 ${c.atbSpeed.toFixed(1)}`;
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

          <div className="mb-4 border border-sys-border/30 bg-black/30 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-[10px] uppercase tracking-widest text-sys-muted">
                編成 (ボス戦で自動戦闘)
              </p>
              <p className="font-mono text-lg text-sys-accent">
                {equippedCount} / {SHADOW_EQUIP_LIMIT}
              </p>
            </div>
            <p className="text-[10px] text-sys-muted/80">
              装備した影はボス戦で各自の ATB が満ちる度に自動攻撃する。ボス勝利で EXP を獲得してレベルアップし、Lv10 で「覚醒」・Lv20 で「真」へ進化して大幅に強化される
            </p>
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

// Compact EXP progress toward the next shadow level, with the next
// evolution gate called out when one is coming up.
function ShadowExpBar({ shadow }: { shadow: Shadow }) {
  const level = shadowLevel(shadow);
  if (level >= SHADOW_MAX_LEVEL) {
    return <p className="mt-1 font-mono text-[9px] text-sys-gold">MAX LEVEL</p>;
  }
  const exp = shadowExp(shadow);
  const need = shadowExpForLevel(level);
  const pct = Math.min(100, (exp / need) * 100);
  const nextEvo = nextEvolutionLevel(level);
  return (
    <div className="mt-1">
      <div className="h-1 w-full overflow-hidden border border-sys-border/30 bg-black/60">
        <div
          className="h-full bg-gradient-to-r from-purple-500 to-fuchsia-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-0.5 font-mono text-[9px] text-sys-muted">
        EXP {exp}/{need}
        {nextEvo !== null && ` · Lv${nextEvo} で進化`}
      </p>
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
          <p className="truncate text-sm font-bold text-sys-text">
            {stageDisplayName(shadow.name, shadowLevel(shadow))}
          </p>
          <div className="mt-0.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="font-mono text-[10px] text-sys-gold">
              Lv{shadowLevel(shadow)}
            </span>
            <span className="text-[10px] uppercase tracking-widest text-sys-muted">
              {STAT_LABELS[stat].en}
            </span>
            <span className="inline-flex items-center gap-1 font-mono text-xs text-sys-accent">
              <Zap className="h-3 w-3" />
              {combatLine(shadow)}
            </span>
          </div>
          <ShadowExpBar shadow={shadow} />
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
