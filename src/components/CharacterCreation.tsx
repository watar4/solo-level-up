import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Dices, ChevronLeft, ChevronRight } from 'lucide-react';
import { SystemWindow } from './SystemWindow';
import { PixelArt } from './PixelArt';
import { PRIMARY_COLORS, ACCENT_COLORS } from '../lib/playerSprites';
import {
  renderAvatar,
  randomAppearance,
  SKINS, HAIR_STYLES, HAIR_COLORS, EYE_STYLES, EYE_COLORS, ACCESSORIES,
  CLASS_DEFAULT_OUTFIT, OUTFIT_BY_ID, DEFAULT_APPEARANCE_V2,
} from '../lib/appearance';
import { CLASS_INFO } from '../lib/jobs';
import { CREEDS, DEFAULT_CREED, type CreedId } from '../lib/creeds';
import { StatRadar } from './StatRadar';
import type { HunterAppearance, HunterClass } from '../types';

interface Props {
  onCreate: (name: string, appearance: HunterAppearance, creed?: string) => Promise<void>;
}

const CLASS_ORDER: HunterClass[] = ['knight', 'mage', 'hunter', 'scout'];
const STEPS = ['みため', 'しょくぎょう', 'しんじょう', 'なまえ'] as const;

export function CharacterCreation({ onCreate }: Props) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [creed, setCreed] = useState<CreedId>(DEFAULT_CREED);
  const [app, setApp] = useState<HunterAppearance>({ ...DEFAULT_APPEARANCE_V2 });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(false);

  const avatar = useMemo(() => renderAvatar(app), [app]);
  const patch = (p: Partial<HunterAppearance>) => setApp((a) => ({ ...a, ...p }));

  const pickClass = (c: HunterClass) => {
    const outfit = OUTFIT_BY_ID[CLASS_DEFAULT_OUTFIT[c]];
    patch({ hunterClass: c, outfit: outfit.id, primaryColor: outfit.primary, accentColor: outfit.accent });
  };

  const submit = async () => {
    if (submitting) return;
    setSubmitting(true);
    setSubmitError(false);
    try {
      await onCreate(name, app, creed);
    } catch (e) {
      console.error('[create] failed', e);
      setSubmitError(true);
    } finally {
      setSubmitting(false);
    }
  };

  const canNext = step < STEPS.length - 1;
  const canBack = step > 0;

  return (
    <div className="min-h-dvh overflow-y-auto p-4">
      <div className="mx-auto max-w-md">
        <SystemWindow title="Character Creation" subtitle={`${step + 1} / ${STEPS.length}`}>
          {/* Step tabs — completed steps are tappable to jump back;
              whitespace-nowrap keeps 「しょくぎょう」 from wrapping mid-word
              on 320px screens. */}
          <div className="mb-3 flex gap-1">
            {STEPS.map((s, i) => (
              <button
                key={s}
                type="button"
                disabled={i >= step}
                onClick={() => i < step && setStep(i)}
                aria-current={i === step ? 'step' : undefined}
                className={`flex-1 whitespace-nowrap rounded-sm py-1.5 text-center text-[9px] font-bold tracking-wide ${
                  i === step ? 'bg-sys-accent/20 text-sys-accent' : i < step ? 'text-sys-muted underline-offset-2 hover:underline' : 'text-sys-muted/50'
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          {/* Live preview */}
          <div className="mb-4 flex items-center justify-center rounded-md border border-sys-border/40 bg-[#0a0f1c] py-4">
            <motion.div animate={{ y: [0, -4, 0] }} transition={{ repeat: Infinity, duration: 2 }}>
              <PixelArt layers={[avatar]} pixelSize={7} ariaLabel="プレビュー" />
            </motion.div>
          </div>

          {/* Step body */}
          {step === 0 && (
            <div className="space-y-3">
              <div className="flex justify-end">
                <button type="button" onClick={() => setApp(randomAppearance(app.hunterClass))} className="sys-button flex items-center gap-1 px-3 py-1.5 text-xs">
                  <Dices className="h-4 w-4" /> ランダム
                </button>
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
          )}

          {step === 1 && (
            <div className="space-y-2">
              {CLASS_ORDER.map((c) => {
                const info = CLASS_INFO[c];
                const active = app.hunterClass === c;
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => pickClass(c)}
                    aria-pressed={active}
                    className={`flex w-full items-center gap-3 rounded-md border p-3 text-left transition ${
                      active ? 'border-sys-accent bg-sys-accent/10' : 'border-sys-border/40'
                    }`}
                  >
                    <StatRadar growth={info.growth} size={54} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-bold text-sys-text">{info.jp} <span className="text-[10px] text-sys-muted">{info.label}</span></span>
                      <span className="mt-0.5 block text-[11px] text-sys-muted">{info.blurb}</span>
                      <span className="mt-1 flex flex-wrap gap-1 text-[10px]">
                        <Tag>成長 {info.growth.join('/')}</Tag>
                        <Tag>{info.passiveDesc}</Tag>
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-2">
              <p className="text-[11px] text-sys-muted">生活リズムを えらぼう(あとで 変更できます)。</p>
              {CREEDS.map((cr) => {
                const active = creed === cr.id;
                return (
                  <button
                    key={cr.id}
                    type="button"
                    onClick={() => setCreed(cr.id)}
                    aria-pressed={active}
                    className={`flex w-full items-center justify-between rounded-md border p-2.5 text-left transition ${
                      active ? 'border-sys-accent bg-sys-accent/10' : 'border-sys-border/40'
                    }`}
                  >
                    <span className="text-sm font-bold text-sys-text">{cr.jp}</span>
                    <span className="text-[11px] text-sys-muted">{cr.desc}</span>
                  </button>
                );
              })}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3">
              <label className="block text-xs text-sys-muted">ハンターの なまえ</label>
              <input
                className="sys-input w-full"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="名もなき ハンター"
                maxLength={16}
              />
              <div className="rounded-md border border-sys-border/40 p-3 text-[11px] text-sys-muted">
                <p>職業:<span className="text-sys-text">{CLASS_INFO[app.hunterClass].jp}</span></p>
                <p>信条:<span className="text-sys-text">{CREEDS.find((c) => c.id === creed)?.jp}</span></p>
                <p className="mt-1 text-[10px]">評価:E ―― 伸びしろは、あります。たぶん。</p>
              </div>
            </div>
          )}

          {submitError && (
            <p role="status" className="mt-3 rounded-md border border-rose-500/50 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
              登録に しっぱいした。通信を たしかめて、もういちど。
            </p>
          )}

          {/* Nav */}
          <div className="mt-5 flex gap-2">
            {canBack && (
              <button type="button" onClick={() => setStep((s) => s - 1)} className="sys-button flex items-center gap-1 px-4 py-2 text-sm">
                <ChevronLeft className="h-4 w-4" /> もどる
              </button>
            )}
            {canNext ? (
              <button type="button" onClick={() => setStep((s) => s + 1)} className="sys-button ml-auto flex items-center gap-1 px-4 py-2 text-sm">
                つぎへ <ChevronRight className="h-4 w-4" />
              </button>
            ) : (
              <button type="button" onClick={submit} disabled={submitting} className="sys-button-arise ml-auto px-5 py-2 text-sm font-bold">
                {submitting ? '生成中…' : 'ハンター登録'}
              </button>
            )}
          </div>
        </SystemWindow>
      </div>
    </div>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return <span className="rounded-sm border border-sys-border/50 px-1.5 py-0.5 text-sys-muted">{children}</span>;
}

function Swatches({ label, colors, value, onPick }: { label: string; colors: string[]; value?: string; onPick: (v: string) => void }) {
  return (
    <div>
      <div className="mb-1 text-[10px] uppercase tracking-wide text-sys-muted">{label}</div>
      <div className="flex flex-wrap gap-1.5">
        {colors.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onPick(c)}
            aria-label={`${label} ${c}`}
            aria-pressed={value === c}
            className={`h-9 w-9 rounded-sm border-2 transition ${value === c ? 'border-sys-accent scale-110' : 'border-transparent'}`}
            style={{ backgroundColor: c }}
          />
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
          <button
            key={o.id}
            type="button"
            onClick={() => onPick(o.id)}
            aria-pressed={value === o.id}
            className={`rounded-sm border px-2.5 py-1.5 text-xs transition ${
              value === o.id ? 'border-sys-accent bg-sys-accent/10 text-sys-text' : 'border-sys-border/40 text-sys-muted'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
