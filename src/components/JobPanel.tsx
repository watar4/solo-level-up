import { useState } from 'react';
import { X } from 'lucide-react';
import type { Character } from '../types';
import {
  CLASS_INFO, baseClass, resolveJobNode, jobCombatMods, advancementOptions,
  TIER2_LEVEL, TIER3_LEVEL, type JobNode,
} from '../lib/jobs';
import { CREEDS } from '../lib/creeds';

interface Props {
  character: Character;
  onClose: () => void;
  onAdvance: (nodeId: string) => Promise<void>;
  onChangeCreed: (creed: string) => Promise<void>;
}

// Guild panel — job (転職) + creed. Job advancement unlocks at Lv20/40.
export function JobPanel({ character, onClose, onAdvance, onChangeCreed }: Props) {
  const [busy, setBusy] = useState(false);
  const node = resolveJobNode(character);
  const info = CLASS_INFO[baseClass(character)];
  const mods = jobCombatMods(character);
  const options = advancementOptions(character);

  const nextGate = !character.job?.tier2
    ? (character.level < TIER2_LEVEL ? `二次職は Lv${TIER2_LEVEL} で解放` : null)
    : !character.job?.tier3
      ? (character.level < TIER3_LEVEL ? `三次職は Lv${TIER3_LEVEL} で解放` : null)
      : 'すべての 転職を 達成済み';

  const advance = async (n: JobNode) => {
    if (busy) return;
    setBusy(true);
    try { await onAdvance(n.id); } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#04070f]/97 p-4" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 5rem)' }}>
      <div className="mx-auto max-w-md space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="sys-title text-base">ギルド ― 職業</h2>
          <button type="button" onClick={onClose} aria-label="とじる" className="text-sys-muted hover:text-sys-text"><X className="h-5 w-5" /></button>
        </div>

        {/* Current job */}
        <div className="rounded-md border border-sys-accent/40 bg-sys-accent/5 p-3">
          <div className="text-sm font-bold text-sys-text">{node.name} <span className="text-[10px] text-sys-muted">Tier {node.tier}</span></div>
          <div className="mt-1 text-[11px] text-sys-muted">{node.blurb}</div>
          <div className="mt-2 flex flex-wrap gap-1 text-[10px]">
            <Tag>成長 {info.growth.join('/')}</Tag>
            <Tag>{passiveText(info.passive, mods)}</Tag>
            <Tag>奥義 {mods.ultimateName}</Tag>
          </div>
        </div>

        {/* Advancement */}
        <div>
          <div className="mb-2 text-xs font-bold text-sys-text">転職</div>
          {options.length > 0 ? (
            <div className="space-y-2">
              {options.map((o) => (
                <button key={o.id} type="button" disabled={busy} onClick={() => advance(o)}
                  className="flex w-full items-center justify-between rounded-md border border-sys-border/40 p-3 text-left transition active:scale-[0.99] hover:border-sys-accent">
                  <span>
                    <span className="block text-sm font-bold text-sys-text">{o.name}</span>
                    <span className="block text-[11px] text-sys-muted">{o.blurb}</span>
                  </span>
                  <span className="text-[10px] text-sys-accent">転職 →</span>
                </button>
              ))}
              <p className="text-[10px] text-sys-muted">※ 転職の 選択は もどせません(ステータスは 振り直し可)。</p>
            </div>
          ) : (
            <p className="text-[11px] text-sys-muted">{nextGate}</p>
          )}
        </div>

        {/* Creed */}
        <div>
          <div className="mb-2 text-xs font-bold text-sys-text">信条(いつでも変更可)</div>
          <div className="space-y-1.5">
            {CREEDS.map((cr) => {
              const active = character.creed === cr.id;
              return (
                <button key={cr.id} type="button" disabled={busy} onClick={() => onChangeCreed(cr.id)}
                  className={`flex w-full items-center justify-between rounded-md border p-2.5 text-left transition ${active ? 'border-sys-accent bg-sys-accent/10' : 'border-sys-border/40'}`}>
                  <span className="text-sm font-bold text-sys-text">{cr.jp}</span>
                  <span className="text-[11px] text-sys-muted">{cr.desc}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function passiveText(kind: string, mods: ReturnType<typeof jobCombatMods>): string {
  if (kind === 'damageTaken') return `被ダメージ -${Math.round((1 - mods.damageTakenMult) * 100)}%`;
  if (kind === 'atb') return `行動速度 +${Math.round(mods.atbBonus * 100)}%`;
  if (kind === 'cooldown') return `スキルCD -${mods.cooldownReduction}`;
  if (kind === 'firstStrikeBreak') return `初撃のブレイク +${mods.firstStrikeBreak}`;
  return '';
}

function Tag({ children }: { children: React.ReactNode }) {
  return <span className="rounded-sm border border-sys-border/50 px-1.5 py-0.5 text-sys-muted">{children}</span>;
}
