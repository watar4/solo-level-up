import { useState } from 'react';
import { X } from 'lucide-react';
import type { Character } from '../types';
import {
  CLASS_INFO, baseClass, resolveJobNode, jobCombatMods, advancementOptions,
  TIER2_LEVEL, TIER3_LEVEL, type JobNode,
} from '../lib/jobs';
import { CREEDS } from '../lib/creeds';
import { usePanelDialog } from '../hooks/usePanelDialog';

interface Props {
  character: Character;
  onClose: () => void;
  onAdvance: (nodeId: string) => Promise<void>;
  onChangeCreed: (creed: string) => Promise<void>;
}

// Guild panel — job (転職) + creed. Job advancement unlocks at Lv20/40.
export function JobPanel({ character, onClose, onAdvance, onChangeCreed }: Props) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(false);
  // 転職 is irreversible — first tap arms, second tap on the confirm commits.
  const [pending, setPending] = useState<JobNode | null>(null);
  const dialog = usePanelDialog(onClose);
  const node = resolveJobNode(character);
  const info = CLASS_INFO[baseClass(character)];
  const mods = jobCombatMods(character);
  const options = advancementOptions(character);

  const nextGate = !character.job?.tier2
    ? (character.level < TIER2_LEVEL ? `二次職は Lv${TIER2_LEVEL} で解放` : null)
    : !character.job?.tier3
      ? (character.level < TIER3_LEVEL ? `三次職は Lv${TIER3_LEVEL} で解放` : null)
      : 'すべての 転職を 達成済み';

  const run = async (fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setErr(false);
    try {
      await fn();
    } catch (e) {
      console.error('[guild] save failed', e);
      setErr(true);
    } finally {
      setBusy(false);
    }
  };

  const confirmAdvance = (n: JobNode) =>
    run(async () => {
      await onAdvance(n.id);
      setPending(null);
    });

  return (
    <div
      {...dialog}
      aria-label="ギルド ― 職業"
      className="fixed inset-0 z-50 overflow-y-auto bg-[#04070f]/97 p-4 outline-none"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 5rem)' }}
    >
      <div className="mx-auto max-w-md space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="sys-title text-base">ギルド ― 職業</h2>
          <button type="button" onClick={onClose} aria-label="とじる" className="-m-2 p-2 text-sys-muted hover:text-sys-text"><X className="h-5 w-5" /></button>
        </div>

        {err && (
          <p role="status" className="rounded-md border border-rose-500/50 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
            保存に しっぱいした。もういちど ためして。
          </p>
        )}

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
              <p className="text-[11px] text-sys-text">
                ※ 転職の 選択は <span className="font-bold text-amber-300">もどせません</span>(ステータスは 振り直し可)。
              </p>
              {options.map((o) => {
                const armed = pending?.id === o.id;
                return (
                  <div key={o.id} className={`rounded-md border transition ${armed ? 'border-amber-400 bg-amber-400/5' : 'border-sys-border/40'}`}>
                    <button
                      type="button"
                      disabled={busy}
                      aria-pressed={armed}
                      onClick={() => setPending(armed ? null : o)}
                      className="flex w-full items-center justify-between p-3 text-left transition active:scale-[0.99]"
                    >
                      <span>
                        <span className="block text-sm font-bold text-sys-text">{o.name}</span>
                        <span className="block text-[11px] text-sys-muted">{o.blurb}</span>
                      </span>
                      <span className="text-[10px] text-sys-accent">{armed ? 'えらんだ' : 'えらぶ'}</span>
                    </button>
                    {armed && (
                      <div className="flex items-center justify-between gap-2 border-t border-amber-400/30 p-2.5">
                        <span className="text-[11px] text-sys-text">「{o.name}」に 転職しますか?</span>
                        <div className="flex gap-2">
                          <button type="button" disabled={busy} onClick={() => setPending(null)} className="sys-button px-3 py-1.5 text-xs">やめる</button>
                          <button type="button" disabled={busy} onClick={() => void confirmAdvance(o)} className="sys-button-gold sys-button px-3 py-1.5 text-xs font-bold">
                            {busy ? '転職中…' : '転職する'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
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
                <button key={cr.id} type="button" disabled={busy} aria-pressed={active}
                  onClick={() => void run(() => onChangeCreed(cr.id))}
                  className={`flex w-full items-center justify-between rounded-md border p-2.5 text-left transition ${active ? 'border-sys-accent bg-sys-accent/10' : 'border-sys-border/40'} ${busy ? 'opacity-60' : ''}`}>
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
