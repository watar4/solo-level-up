import { useEffect, useMemo, useRef, useState } from 'react';
import { SystemWindow } from './SystemWindow';
import { MealAiPanel } from './MealAiPanel';
import { useMeals } from '../hooks/useMeals';
import { useMealPresets } from '../hooks/useMealPresets';
import { useWeights } from '../hooks/useWeights';
import { todayKey } from '../lib/leveling';
import {
  computeNutritionTarget,
  daysUntil,
  dayMeetsGoal,
  evaluateDay,
  maintenanceCalories,
  sumMeals,
  type NutritionGrade,
} from '../lib/nutrition';
import {
  ACTIVITY_LABELS,
  ACTIVITY_ORDER,
  DIET_TYPE_LABELS,
  DIET_TYPE_ORDER,
  MEAL_SLOT_LABELS,
  MEAL_SLOT_ORDER,
} from '../types';
import type {
  ActivityLevel,
  Character,
  DietType,
  MealEntry,
  MealPreset,
  MealSlot,
  NutritionTarget,
} from '../types';
import {
  Bookmark,
  BookmarkPlus,
  Check,
  Flame,
  Pencil,
  Plus,
  SlidersHorizontal,
  Target,
  Trash2,
  UtensilsCrossed,
  X,
} from 'lucide-react';

interface Props {
  uid: string;
  character: Character;
  onSetWeightTarget: (target: number | null) => Promise<void>;
  onSetNutritionConfig: (patch: {
    dietType?: DietType;
    activityLevel?: ActivityLevel;
    weightTargetDate?: string | null;
  }) => Promise<void>;
  onSetNutritionTarget: (target: NutritionTarget | null) => Promise<void>;
  onAwardNutritionExp: (amount: number, dateKey: string) => Promise<boolean>;
}

const MIN_WEIGHT = 20;
const MAX_WEIGHT = 300;

// EXP granted once per day for meeting the nutrition goal, scaled by grade.
function rewardForGrade(grade: NutritionGrade): number {
  if (grade === 'S') return 60;
  if (grade === 'A') return 45;
  return 30; // B (lowest grade that "meets the goal")
}

const GRADE_BADGE: Record<NutritionGrade, string> = {
  S: 'text-sys-gold border-sys-gold shadow-[0_0_12px_rgba(255,215,0,0.5)]',
  A: 'text-sys-accent border-sys-accent shadow-[0_0_12px_rgba(0,212,255,0.4)]',
  B: 'text-sys-ok border-sys-ok',
  C: 'text-sys-text border-sys-border/60',
  D: 'text-sys-muted border-sys-border/40',
  E: 'text-sys-danger border-sys-danger/60',
};

const GRADE_TEXT: Record<NutritionGrade, string> = {
  S: 'text-sys-gold',
  A: 'text-sys-accent',
  B: 'text-sys-ok',
  C: 'text-sys-text',
  D: 'text-sys-muted',
  E: 'text-sys-danger',
};

// Parse a numeric input string; non-positive / NaN collapses to 0.
function num(s: string): number {
  const n = parseFloat(s);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function GradeBadge({ grade }: { grade: NutritionGrade }) {
  return (
    <div
      className={`flex h-16 w-16 shrink-0 items-center justify-center border-2 bg-black/40 ${GRADE_BADGE[grade]}`}
    >
      <span className="font-mono text-3xl font-black">{grade}</span>
    </div>
  );
}

// One adherence bar (actual vs target). `tone` decides the over-target color:
// protein overshoot is fine (ok/green), calories/fat/carbs overshoot is bad.
function MacroBar({
  label,
  actual,
  target,
  unit,
  tone,
}: {
  label: string;
  actual: number;
  target: number;
  unit: string;
  tone: 'ok' | 'bad';
}) {
  const ratio = target > 0 ? actual / target : 0;
  const pct = Math.min(100, Math.round(ratio * 100));
  const over = ratio > 1.05;
  const fill = over ? (tone === 'ok' ? 'bg-sys-ok' : 'bg-sys-danger') : 'bg-sys-accent';
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-[11px]">
        <span className="text-sys-muted">{label}</span>
        <span className="font-mono">
          <span className={over && tone === 'bad' ? 'text-sys-danger' : 'text-sys-text'}>
            {Math.round(actual)}
          </span>
          <span className="text-sys-muted">
            {' / '}
            {Math.round(target)}
            {unit}
          </span>
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden border border-sys-border/30 bg-black/40">
        <div
          className={`h-full ${fill} transition-all duration-500`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// Small single-select chip group used for the slot / diet / activity pickers.
function ChipGroup<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T | undefined;
  options: { id: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          className={`border px-2.5 py-1 text-xs transition ${
            value === o.id
              ? 'border-sys-accent bg-sys-accent/10 text-sys-accent'
              : 'border-sys-border/30 text-sys-muted hover:text-sys-text'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function dayLabel(date: string, today: string): string {
  if (date === today) return '本日';
  return date.slice(5).replace('-', '/'); // MM/DD
}

export function MealPanel({
  uid,
  character,
  onSetWeightTarget,
  onSetNutritionConfig,
  onSetNutritionTarget,
  onAwardNutritionExp,
}: Props) {
  const today = todayKey();
  const { meals, addMeal, editMeal, removeMeal } = useMeals(uid);
  const { presets, savePreset, removePreset } = useMealPresets(uid);
  const { entries } = useWeights(uid);

  // ----- input form state -----
  const [slot, setSlot] = useState<MealSlot>('breakfast');
  const [name, setName] = useState('');
  const [kcal, setKcal] = useState('');
  const [protein, setProtein] = useState('');
  const [fat, setFat] = useState('');
  const [carbs, setCarbs] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // When set, the form edits an existing entry instead of logging a new one.
  // editingDate preserves the original day (the form has no date picker).
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingDate, setEditingDate] = useState(today);
  const formRef = useRef<HTMLDivElement>(null);

  // Preset management UI state. `managePresets` flips chips into delete mode;
  // `presetMsg` is a short confirmation shown after saving.
  const [managePresets, setManagePresets] = useState(false);
  const [presetMsg, setPresetMsg] = useState<string | null>(null);

  // ----- goal-setting state -----
  const [twDraft, setTwDraft] = useState(
    character.weightTarget != null ? String(character.weightTarget) : ''
  );
  useEffect(() => {
    setTwDraft(character.weightTarget != null ? String(character.weightTarget) : '');
  }, [character.weightTarget]);

  const [editingTarget, setEditingTarget] = useState(false);
  const [mDraft, setMDraft] = useState({ kcal: '', protein: '', fat: '', carbs: '' });

  // Latest body weight (most recent entry of the most recent date).
  const currentWeight = useMemo(() => {
    if (entries.length === 0) return null;
    const byDate = new Map<string, (typeof entries)[number]>();
    for (const e of entries) {
      const prev = byDate.get(e.date);
      if (!prev || e.createdAt > prev.createdAt) byDate.set(e.date, e);
    }
    const sorted = Array.from(byDate.values()).sort((a, b) =>
      a.date.localeCompare(b.date)
    );
    return sorted.length ? sorted[sorted.length - 1].weight : null;
  }, [entries]);

  const daysLeft = character.weightTargetDate ? daysUntil(character.weightTargetDate) : null;

  // Auto-computed target from the weight goal (when every input is present).
  const autoTarget = useMemo(() => {
    if (
      currentWeight == null ||
      character.weightTarget == null ||
      !character.weightTargetDate ||
      !character.activityLevel ||
      !character.dietType
    ) {
      return null;
    }
    return computeNutritionTarget({
      currentWeight,
      targetWeight: character.weightTarget,
      daysRemaining: daysUntil(character.weightTargetDate),
      activity: character.activityLevel,
      diet: character.dietType,
    });
  }, [
    currentWeight,
    character.weightTarget,
    character.weightTargetDate,
    character.activityLevel,
    character.dietType,
  ]);

  // Effective target = manual override if set, else the auto value.
  const effectiveTarget = character.nutritionTarget ?? autoTarget;

  // ----- daily grouping + today's totals -----
  const days = useMemo(() => {
    const map = new Map<string, typeof meals>();
    for (const m of meals) {
      const arr = map.get(m.date) ?? [];
      arr.push(m);
      map.set(m.date, arr);
    }
    const out = Array.from(map.entries()).map(([date, items]) => ({
      date,
      items: items.slice().sort((a, b) => {
        const so = MEAL_SLOT_ORDER.indexOf(a.slot) - MEAL_SLOT_ORDER.indexOf(b.slot);
        return so !== 0 ? so : a.createdAt - b.createdAt;
      }),
      totals: sumMeals(items),
    }));
    out.sort((a, b) => b.date.localeCompare(a.date));
    return out;
  }, [meals]);

  const todayTotals = useMemo(
    () => sumMeals(meals.filter((m) => m.date === today)),
    [meals, today]
  );

  const todayEval = effectiveTarget ? evaluateDay(todayTotals, effectiveTarget) : null;
  const rewardedToday = character.lastNutritionRewardDate === today;

  // Auto-grant the once-daily EXP the moment today crosses into a passing grade.
  // The hook + this guard both prevent a double award; the hook is the source
  // of truth (it no-ops if lastNutritionRewardDate already equals today).
  useEffect(() => {
    if (!todayEval || !dayMeetsGoal(todayEval)) return;
    if (rewardedToday) return;
    void onAwardNutritionExp(rewardForGrade(todayEval.grade), today);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todayEval?.grade, todayEval?.score, rewardedToday, today]);

  const resetForm = () => {
    setName('');
    setKcal('');
    setProtein('');
    setFat('');
    setCarbs('');
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    let kcalV = num(kcal);
    const pV = num(protein);
    const fV = num(fat);
    const cV = num(carbs);
    // Derive calories from macros if the user only filled PFC.
    if (kcalV === 0 && (pV || fV || cV)) {
      kcalV = Math.round(pV * 4 + fV * 9 + cV * 4);
    }
    if (kcalV === 0 && pV === 0 && fV === 0 && cV === 0) {
      setError('カロリーまたは PFC を入力してください');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const payload = {
        // Editing keeps the entry on its original day; new logs go to today.
        date: editingId ? editingDate : today,
        slot,
        name: name.trim(),
        kcal: kcalV,
        protein: pV,
        fat: fV,
        carbs: cV,
      };
      if (editingId) {
        await editMeal(editingId, payload);
        setEditingId(null);
      } else {
        await addMeal(payload);
      }
      resetForm();
    } catch (err) {
      console.error('[meal:save] failed', err);
      const msg = err instanceof Error ? err.message : String(err);
      setError(`保存に失敗しました: ${msg}`);
    } finally {
      setBusy(false);
    }
  };

  // Load an existing entry into the form for editing and scroll it into view.
  const startEdit = (m: MealEntry) => {
    setEditingId(m.id);
    setEditingDate(m.date);
    setSlot(m.slot);
    setName(m.name);
    setKcal(String(m.kcal));
    setProtein(String(m.protein));
    setFat(String(m.fat));
    setCarbs(String(m.carbs));
    setError(null);
    requestAnimationFrame(() =>
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    );
  };

  const cancelEdit = () => {
    setEditingId(null);
    setError(null);
    resetForm();
  };

  // Fill the form from a saved preset. The slot is left as-is so the user
  // picks when they ate it; this does not enter edit mode.
  const applyPreset = (p: MealPreset) => {
    setName(p.name);
    setKcal(String(p.kcal));
    setProtein(String(p.protein));
    setFat(String(p.fat));
    setCarbs(String(p.carbs));
    setError(null);
  };

  // Save the current form contents as a reusable preset (upsert by name).
  const saveAsPreset = async () => {
    const pV = num(protein);
    const fV = num(fat);
    const cV = num(carbs);
    let kcalV = num(kcal);
    if (kcalV === 0 && (pV || fV || cV)) {
      kcalV = Math.round(pV * 4 + fV * 9 + cV * 4);
    }
    if (!name.trim()) {
      setError('プリセット名(メニュー名)を入力してください');
      return;
    }
    if (kcalV === 0 && pV === 0 && fV === 0 && cV === 0) {
      setError('カロリーまたは PFC を入力してください');
      return;
    }
    try {
      await savePreset({ name: name.trim(), kcal: kcalV, protein: pV, fat: fV, carbs: cV });
      setError(null);
      setPresetMsg(`「${name.trim()}」を保存しました`);
      window.setTimeout(() => setPresetMsg(null), 2500);
    } catch (err) {
      console.error('[meal:preset:save] failed', err);
      setError('プリセット保存に失敗しました(ルール未反映の可能性)');
    }
  };

  const commitTargetWeight = async () => {
    const raw = twDraft.trim();
    if (raw === '') {
      if (character.weightTarget != null) await onSetWeightTarget(null);
      return;
    }
    const n = parseFloat(raw);
    if (!Number.isFinite(n) || n < MIN_WEIGHT || n > MAX_WEIGHT) {
      setTwDraft(character.weightTarget != null ? String(character.weightTarget) : '');
      return;
    }
    if (n !== character.weightTarget) await onSetWeightTarget(n);
  };

  const openTargetEditor = () => {
    const base = effectiveTarget ?? autoTarget;
    setMDraft({
      kcal: base ? String(base.kcal) : '',
      protein: base ? String(base.protein) : '',
      fat: base ? String(base.fat) : '',
      carbs: base ? String(base.carbs) : '',
    });
    setEditingTarget(true);
  };

  const saveTargetOverride = async () => {
    await onSetNutritionTarget({
      kcal: Math.round(num(mDraft.kcal)),
      protein: Math.round(num(mDraft.protein)),
      fat: Math.round(num(mDraft.fat)),
      carbs: Math.round(num(mDraft.carbs)),
    });
    setEditingTarget(false);
  };

  return (
    <div className="mx-auto max-w-xl space-y-5">
      {/* ----- Today's evaluation ----- */}
      <SystemWindow title="Meal" subtitle="today">
        {todayEval && effectiveTarget ? (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <GradeBadge grade={todayEval.grade} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-1.5">
                  <span className="font-mono text-2xl font-black text-sys-text">
                    {todayTotals.kcal}
                  </span>
                  <span className="text-xs text-sys-muted">
                    / {effectiveTarget.kcal} kcal
                  </span>
                </div>
                <p className="text-[11px] text-sys-muted">本日の摂取カロリー</p>
                {rewardedToday && (
                  <p className="mt-1 text-[11px] text-sys-ok">✓ 目標達成 — EXP 獲得済み</p>
                )}
              </div>
              <div className="text-right">
                <p className="font-mono text-lg text-sys-accent">{todayEval.score}</p>
                <p className="text-[10px] uppercase tracking-widest text-sys-muted">
                  score
                </p>
              </div>
            </div>

            <div className="space-y-2.5">
              <MacroBar label="カロリー" actual={todayTotals.kcal} target={effectiveTarget.kcal} unit=" kcal" tone="bad" />
              <MacroBar label="タンパク質 P" actual={todayTotals.protein} target={effectiveTarget.protein} unit=" g" tone="ok" />
              <MacroBar label="脂質 F" actual={todayTotals.fat} target={effectiveTarget.fat} unit=" g" tone="bad" />
              <MacroBar label="炭水化物 C" actual={todayTotals.carbs} target={effectiveTarget.carbs} unit=" g" tone="bad" />
            </div>
          </div>
        ) : (
          <div className="border border-dashed border-sys-border/30 px-4 py-8 text-center text-sm text-sys-muted">
            目標を設定すると、本日の食事が
            <br />
            自動で評価されます。
          </div>
        )}
      </SystemWindow>

      {/* ----- AI coach (BYO Gemini key) ----- */}
      <MealAiPanel uid={uid} meals={meals} today={today} target={effectiveTarget} />

      {/* ----- Record / edit a meal ----- */}
      <div ref={formRef}>
      <SystemWindow title="Record" subtitle={editingId ? 'edit entry' : 'log a meal'}>
        <form onSubmit={submit} className="space-y-3">
          {editingId && (
            <div className="flex items-center justify-between border border-sys-gold/40 bg-sys-gold/5 px-2.5 py-1.5 text-[11px]">
              <span className="text-sys-gold">
                {dayLabel(editingDate, today)} の記録を編集中
              </span>
              <button
                type="button"
                onClick={cancelEdit}
                className="text-sys-muted hover:text-sys-text"
              >
                取消
              </button>
            </div>
          )}

          {presets.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-sys-muted">
                  <Bookmark className="h-3 w-3" /> プリセット
                </p>
                <button
                  type="button"
                  onClick={() => setManagePresets((v) => !v)}
                  className="text-[11px] text-sys-muted hover:text-sys-accent"
                >
                  {managePresets ? '完了' : '管理'}
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {presets.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center border border-sys-border/30 text-xs"
                  >
                    <button
                      type="button"
                      onClick={() => applyPreset(p)}
                      disabled={busy}
                      className="px-2.5 py-1 text-sys-text transition hover:text-sys-accent disabled:opacity-50"
                      title={`${p.kcal}kcal · P${p.protein} F${p.fat} C${p.carbs}`}
                    >
                      {p.name}
                      <span className="ml-1 font-mono text-[10px] text-sys-muted">
                        {p.kcal}k
                      </span>
                    </button>
                    {managePresets && (
                      <button
                        type="button"
                        onClick={() => void removePreset(p.id)}
                        className="border-l border-sys-border/30 px-1.5 py-1 text-sys-muted hover:text-sys-danger"
                        aria-label={`プリセット「${p.name}」を削除`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <ChipGroup
            value={slot}
            onChange={setSlot}
            options={MEAL_SLOT_ORDER.map((s) => ({ id: s, label: MEAL_SLOT_LABELS[s] }))}
          />

          <input
            type="text"
            placeholder="メニュー名 (例: 鶏むね肉と玄米)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="sys-input"
            disabled={busy}
          />

          <div className="grid grid-cols-4 gap-2">
            <label className="text-[10px] uppercase tracking-widest text-sys-muted">
              kcal
              <input
                type="number"
                inputMode="numeric"
                min={0}
                placeholder="0"
                value={kcal}
                onChange={(e) => setKcal(e.target.value)}
                className="sys-input mt-1 px-2 text-center"
                disabled={busy}
              />
            </label>
            <label className="text-[10px] uppercase tracking-widest text-sys-muted">
              P (g)
              <input
                type="number"
                inputMode="decimal"
                step="any"
                min={0}
                placeholder="0"
                value={protein}
                onChange={(e) => setProtein(e.target.value)}
                className="sys-input mt-1 px-2 text-center"
                disabled={busy}
              />
            </label>
            <label className="text-[10px] uppercase tracking-widest text-sys-muted">
              F (g)
              <input
                type="number"
                inputMode="decimal"
                step="any"
                min={0}
                placeholder="0"
                value={fat}
                onChange={(e) => setFat(e.target.value)}
                className="sys-input mt-1 px-2 text-center"
                disabled={busy}
              />
            </label>
            <label className="text-[10px] uppercase tracking-widest text-sys-muted">
              C (g)
              <input
                type="number"
                inputMode="decimal"
                step="any"
                min={0}
                placeholder="0"
                value={carbs}
                onChange={(e) => setCarbs(e.target.value)}
                className="sys-input mt-1 px-2 text-center"
                disabled={busy}
              />
            </label>
          </div>

          <p className="text-[10px] text-sys-muted/70">
            kcal を空欄にすると PFC から自動計算します (P・C×4 / F×9)。
          </p>

          {error && <p className="text-[11px] text-sys-danger">{error}</p>}

          <button type="submit" className="sys-button w-full justify-center" disabled={busy}>
            {editingId ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {busy ? '保存中…' : editingId ? '更新する' : '記録する'}
          </button>

          <button
            type="button"
            onClick={() => void saveAsPreset()}
            disabled={busy}
            className="inline-flex w-full items-center justify-center gap-1.5 border border-sys-border/40 py-2 text-xs text-sys-muted transition hover:border-sys-accent hover:text-sys-accent disabled:opacity-50"
          >
            <BookmarkPlus className="h-3.5 w-3.5" />
            現在の内容をプリセット保存
          </button>
          {presetMsg && (
            <p className="text-center text-[11px] text-sys-ok">{presetMsg}</p>
          )}
        </form>
      </SystemWindow>
      </div>

      {/* ----- Goal settings ----- */}
      <SystemWindow title="Goal" subtitle="nutrition target">
        <div className="space-y-4">
          {/* weight + deadline */}
          <div className="grid grid-cols-2 gap-3">
            <label className="text-[10px] uppercase tracking-widest text-sys-muted">
              目標体重 (kg)
              <input
                type="number"
                step="0.1"
                min={MIN_WEIGHT}
                max={MAX_WEIGHT}
                inputMode="decimal"
                placeholder="例 68.0"
                value={twDraft}
                onChange={(e) => setTwDraft(e.target.value)}
                onBlur={() => void commitTargetWeight()}
                className="sys-input mt-1"
              />
            </label>
            <label className="text-[10px] uppercase tracking-widest text-sys-muted">
              期限
              <input
                type="date"
                value={character.weightTargetDate ?? ''}
                onChange={(e) =>
                  void onSetNutritionConfig({ weightTargetDate: e.target.value || null })
                }
                className="sys-input mt-1"
              />
            </label>
          </div>

          <p className="text-[11px] text-sys-muted">
            現在体重{' '}
            <span className="font-mono text-sys-text">
              {currentWeight != null ? currentWeight.toFixed(1) : '--.-'}
            </span>{' '}
            kg
            {daysLeft != null && (
              <>
                {' · '}期限まで <span className="font-mono text-sys-text">{daysLeft}</span> 日
              </>
            )}
            {currentWeight == null && (
              <span className="block text-sys-danger/80">
                ※ 体重を記録すると自動計算が有効になります
              </span>
            )}
          </p>

          {/* diet preset */}
          <div className="space-y-1.5">
            <p className="text-[10px] uppercase tracking-widest text-sys-muted flex items-center gap-1.5">
              <Target className="h-3 w-3" /> ダイエット方針
            </p>
            <ChipGroup
              value={character.dietType}
              onChange={(v) => void onSetNutritionConfig({ dietType: v })}
              options={DIET_TYPE_ORDER.map((d) => ({ id: d, label: DIET_TYPE_LABELS[d].jp }))}
            />
            {character.dietType && (
              <p className="text-[10px] text-sys-muted/80">
                {DIET_TYPE_LABELS[character.dietType].desc}
              </p>
            )}
          </div>

          {/* activity level */}
          <div className="space-y-1.5">
            <p className="text-[10px] uppercase tracking-widest text-sys-muted flex items-center gap-1.5">
              <Flame className="h-3 w-3" /> 活動量
            </p>
            <ChipGroup
              value={character.activityLevel}
              onChange={(v) => void onSetNutritionConfig({ activityLevel: v })}
              options={ACTIVITY_ORDER.map((a) => ({ id: a, label: ACTIVITY_LABELS[a].jp }))}
            />
            {character.activityLevel && (
              <p className="text-[10px] text-sys-muted/80">
                {ACTIVITY_LABELS[character.activityLevel].desc}
                {currentWeight != null && (
                  <>
                    {' · '}維持カロリー 約{' '}
                    <span className="font-mono text-sys-text">
                      {Math.round(maintenanceCalories(currentWeight, character.activityLevel))}
                    </span>{' '}
                    kcal
                  </>
                )}
              </p>
            )}
          </div>

          {/* computed / manual target */}
          <div className="border-t border-sys-border/20 pt-3">
            {editingTarget ? (
              <div className="space-y-2">
                <p className="text-[10px] uppercase tracking-widest text-sys-muted">
                  手動調整 (1日あたり)
                </p>
                <div className="grid grid-cols-4 gap-2">
                  {(['kcal', 'protein', 'fat', 'carbs'] as const).map((k) => (
                    <label
                      key={k}
                      className="text-[10px] uppercase tracking-widest text-sys-muted"
                    >
                      {k === 'kcal' ? 'kcal' : k === 'protein' ? 'P' : k === 'fat' ? 'F' : 'C'}
                      <input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        value={mDraft[k]}
                        onChange={(e) => setMDraft((d) => ({ ...d, [k]: e.target.value }))}
                        className="sys-input mt-1 px-2 text-center"
                      />
                    </label>
                  ))}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="sys-button flex-1 justify-center"
                    onClick={() => void saveTargetOverride()}
                  >
                    保存
                  </button>
                  <button
                    type="button"
                    className="border border-sys-border/40 px-3 text-xs text-sys-muted hover:text-sys-text"
                    onClick={() => setEditingTarget(false)}
                  >
                    取消
                  </button>
                </div>
              </div>
            ) : effectiveTarget ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] uppercase tracking-widest text-sys-muted">
                    1日の目標{' '}
                    {character.nutritionTarget ? (
                      <span className="text-sys-gold">手動設定中</span>
                    ) : (
                      <span className="text-sys-accent">自動算出</span>
                    )}
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={openTargetEditor}
                      className="inline-flex items-center gap-1 text-[11px] text-sys-muted hover:text-sys-accent"
                    >
                      <SlidersHorizontal className="h-3 w-3" /> 手動調整
                    </button>
                    {character.nutritionTarget && (
                      <button
                        type="button"
                        onClick={() => void onSetNutritionTarget(null)}
                        className="text-[11px] text-sys-muted hover:text-sys-accent"
                      >
                        自動に戻す
                      </button>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-2 text-center">
                  {[
                    { label: 'kcal', value: effectiveTarget.kcal },
                    { label: 'P', value: effectiveTarget.protein },
                    { label: 'F', value: effectiveTarget.fat },
                    { label: 'C', value: effectiveTarget.carbs },
                  ].map((cell) => (
                    <div key={cell.label} className="border border-sys-border/20 bg-black/20 py-2">
                      <p className="font-mono text-base text-sys-text">{cell.value}</p>
                      <p className="text-[9px] uppercase tracking-widest text-sys-muted">
                        {cell.label}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-[11px] text-sys-muted">
                目標体重・期限・方針・活動量・現在体重がそろうと、1日の目標を自動算出します。
              </p>
            )}
          </div>
        </div>
      </SystemWindow>

      {/* ----- History ----- */}
      <SystemWindow title="Log" subtitle="history">
        {days.length === 0 ? (
          <div className="border border-dashed border-sys-border/30 px-4 py-8 text-center text-sm text-sys-muted">
            <UtensilsCrossed className="mx-auto mb-2 h-5 w-5 opacity-50" />
            まだ食事の記録がありません。
          </div>
        ) : (
          <div className="space-y-2">
            {days.map((day) => {
              const dayGrade = effectiveTarget
                ? evaluateDay(day.totals, effectiveTarget).grade
                : null;
              return (
                <details key={day.date} className="border border-sys-border/20 bg-black/20" open={day.date === today}>
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2">
                    <span className="text-sm text-sys-text">{dayLabel(day.date, today)}</span>
                    <span className="flex items-center gap-3">
                      <span className="font-mono text-xs text-sys-muted">
                        {day.totals.kcal} kcal
                      </span>
                      {dayGrade && (
                        <span className={`font-mono text-sm font-black ${GRADE_TEXT[dayGrade]}`}>
                          {dayGrade}
                        </span>
                      )}
                    </span>
                  </summary>
                  <div className="space-y-1.5 border-t border-sys-border/20 px-3 py-2">
                    {day.items.map((m) => (
                      <div
                        key={m.id}
                        className={`flex items-center gap-2 text-xs ${
                          m.id === editingId ? 'bg-sys-gold/5' : ''
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <span className="text-[10px] text-sys-muted">
                            {MEAL_SLOT_LABELS[m.slot]}
                          </span>{' '}
                          <span className="text-sys-text">{m.name}</span>
                        </div>
                        <span className="shrink-0 font-mono text-[10px] text-sys-muted">
                          {m.kcal}k · P{m.protein} F{m.fat} C{m.carbs}
                        </span>
                        <button
                          type="button"
                          onClick={() => startEdit(m)}
                          className="shrink-0 text-sys-muted/60 hover:text-sys-accent"
                          aria-label="編集"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void removeMeal(m.id)}
                          className="shrink-0 text-sys-muted/60 hover:text-sys-danger"
                          aria-label="削除"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </details>
              );
            })}
          </div>
        )}
      </SystemWindow>
    </div>
  );
}
