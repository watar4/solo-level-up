import { useMemo, useRef, useState } from 'react';
import {
  PiggyBank,
  Upload,
  Target,
  CreditCard,
  Trash2,
  Coins,
  TrendingUp,
} from 'lucide-react';
import { SystemWindow } from './SystemWindow';
import type { SavingsData } from '../hooks/useSavings';
import {
  SOURCE_LABEL,
  decodeCsvBuffer,
  formatYen,
  monthlyTotals,
  parseStatementCsv,
  thisMonthKey,
  type ParsedStatement,
} from '../lib/savings';
import {
  BUDGET_REWARD_EXP,
  BUDGET_REWARD_GOLD,
  YEN_PER_GOLD,
  goldForSavings,
} from '../lib/economy';
import { todayKey } from '../lib/leveling';
import type { Character, SavingsGoal, SavingsSource, SystemEvent } from '../types';

interface Props {
  character: Character;
  savings: SavingsData;
  onSetSavingsGoal: (goal: SavingsGoal | null) => Promise<void>;
  onSetMonthlyBudget: (amount: number | null) => Promise<void>;
  onMarkBudgetRewarded: (month: string) => Promise<void>;
  onAwardGold: (amount: number) => Promise<void>;
  onAwardExp: (amount: number) => Promise<void>;
  onEnqueueEvent: (event: SystemEvent) => void;
}

const FORMAT_LABEL: Record<ParsedStatement['format'], string> = {
  'yucho-csv': 'ゆうちょ銀行 入出金明細',
  'rakuten-csv': '楽天カード 利用明細',
  generic: '汎用CSV (日付, 金額, メモ)',
};

function formatToSource(format: ParsedStatement['format']): SavingsSource {
  return format === 'generic' ? 'manual' : format;
}

// YYYY-MM one month before the given YYYY-MM.
function prevMonthKey(month: string): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function SavingsPanel({
  character,
  savings,
  onSetSavingsGoal,
  onSetMonthlyBudget,
  onMarkBudgetRewarded,
  onAwardGold,
  onAwardExp,
  onEnqueueEvent,
}: Props) {
  // ── manual entry form ──
  const [entryDate, setEntryDate] = useState(todayKey());
  const [entryKind, setEntryKind] = useState<'deposit' | 'withdraw' | 'spending'>('deposit');
  const [entryAmount, setEntryAmount] = useState('');
  const [entryMemo, setEntryMemo] = useState('');
  const [entryBusy, setEntryBusy] = useState(false);

  // ── goal form ──
  const [goalEditing, setGoalEditing] = useState(false);
  const [goalAmount, setGoalAmount] = useState('');
  const [goalLabel, setGoalLabel] = useState('');
  const [goalMonthly, setGoalMonthly] = useState('');

  // ── budget form ──
  const [budgetEditing, setBudgetEditing] = useState(false);
  const [budgetAmount, setBudgetAmount] = useState('');

  // ── CSV import ──
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [preview, setPreview] = useState<{ statement: ParsedStatement; fileName: string } | null>(null);
  const [importBusy, setImportBusy] = useState(false);
  const [importNotice, setImportNotice] = useState<string | null>(null);

  const goal = character.savingsGoal;
  const month = thisMonthKey();

  // Bonus gold for a recorded saving — the motivational bridge to the game
  // economy. Real yen stay real; the game just celebrates the habit.
  const grantSavingBonus = async (savedYen: number, label: string) => {
    const bonus = goldForSavings(savedYen);
    if (bonus <= 0) return;
    try {
      await onAwardGold(bonus);
      onEnqueueEvent({
        id: `savings:${Date.now()}`,
        kind: 'savings',
        title: '貯金を記録',
        primary: `${formatYen(savedYen)} (${label})`,
        secondary: `ボーナス +${bonus} G (${YEN_PER_GOLD}円 = 1G)`,
        icon: '🏦',
        accent: 'gold',
      });
    } catch (err) {
      console.error('[savings] bonus award failed', err);
    }
  };

  const handleAddEntry = async () => {
    const raw = Number(entryAmount.replace(/[,，]/g, ''));
    if (!Number.isFinite(raw) || raw <= 0 || entryBusy) return;
    setEntryBusy(true);
    try {
      const kind = entryKind === 'spending' ? 'spending' : 'saving';
      const amount = entryKind === 'withdraw' ? -raw : raw;
      await savings.addEntry({
        date: entryDate,
        amount,
        kind,
        memo:
          entryMemo ||
          (entryKind === 'deposit' ? '貯金' : entryKind === 'withdraw' ? '引き出し' : 'カード利用'),
      });
      if (kind === 'saving' && amount > 0) {
        await grantSavingBonus(amount, '手動記帳');
      }
      setEntryAmount('');
      setEntryMemo('');
    } catch (err) {
      console.error('[savings] add entry failed', err);
    } finally {
      setEntryBusy(false);
    }
  };

  const handleFile = async (file: File) => {
    setImportNotice(null);
    try {
      const text = decodeCsvBuffer(await file.arrayBuffer());
      const statement = parseStatementCsv(text);
      if (statement.rows.length === 0) {
        setPreview(null);
        setImportNotice('読み取れる明細行が見つかりませんでした。CSVの形式を確認してください。');
        return;
      }
      setPreview({ statement, fileName: file.name });
    } catch (err) {
      console.error('[savings] csv parse failed', err);
      setPreview(null);
      setImportNotice('CSVの読み込みに失敗しました。');
    }
  };

  const handleImport = async () => {
    if (!preview || importBusy) return;
    setImportBusy(true);
    try {
      const { statement } = preview;
      const result = await savings.importRows(statement.rows, formatToSource(statement.format));
      const savedYen = statement.rows
        .filter((r) => r.kind === 'saving' && r.amount > 0)
        .reduce((sum, r) => sum + r.amount, 0);
      if (result.imported > 0 && savedYen > 0) {
        await grantSavingBonus(savedYen, FORMAT_LABEL[statement.format]);
      }
      setImportNotice(
        `${result.imported} 件を取り込みました` +
          (result.duplicates > 0 ? ` (重複 ${result.duplicates} 件はスキップ)` : '')
      );
      setPreview(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      console.error('[savings] import failed', err);
      setImportNotice('取り込みに失敗しました。');
    } finally {
      setImportBusy(false);
    }
  };

  const handleSaveGoal = async () => {
    const target = Number(goalAmount.replace(/[,，]/g, ''));
    if (!Number.isFinite(target) || target <= 0) return;
    const monthly = Number(goalMonthly.replace(/[,，]/g, ''));
    await onSetSavingsGoal({
      targetAmount: Math.round(target),
      ...(Number.isFinite(monthly) && monthly > 0 ? { monthlyAmount: Math.round(monthly) } : {}),
      ...(goalLabel.trim() ? { label: goalLabel.trim() } : {}),
    });
    setGoalEditing(false);
  };

  const handleSaveBudget = async () => {
    const v = Number(budgetAmount.replace(/[,，]/g, ''));
    if (!Number.isFinite(v) || v <= 0) {
      await onSetMonthlyBudget(null);
    } else {
      await onSetMonthlyBudget(Math.round(v));
    }
    setBudgetEditing(false);
  };

  // Previous-month budget check → claimable reward.
  const lastMonth = prevMonthKey(month);
  const lastMonthSpending = useMemo(
    () =>
      savings.entries
        .filter((e) => e.kind === 'spending' && e.date.slice(0, 7) === lastMonth)
        .reduce((sum, e) => sum + e.amount, 0),
    [savings.entries, lastMonth]
  );
  const lastMonthHadSpending = useMemo(
    () => savings.entries.some((e) => e.kind === 'spending' && e.date.slice(0, 7) === lastMonth),
    [savings.entries, lastMonth]
  );
  const budgetRewardClaimable =
    !!character.monthlyBudget &&
    lastMonthHadSpending &&
    lastMonthSpending <= character.monthlyBudget &&
    (character.lastBudgetRewardMonth ?? '') < lastMonth;

  const claimBudgetReward = async () => {
    if (!budgetRewardClaimable) return;
    try {
      await onMarkBudgetRewarded(lastMonth);
      await onAwardGold(BUDGET_REWARD_GOLD);
      await onAwardExp(BUDGET_REWARD_EXP);
      onEnqueueEvent({
        id: `budget:${lastMonth}`,
        kind: 'savings',
        title: '予算クエスト達成',
        primary: `${lastMonth} のカード利用 ${formatYen(lastMonthSpending)}`,
        secondary: `予算内クリア! +${BUDGET_REWARD_GOLD} G / +${BUDGET_REWARD_EXP} EXP`,
        icon: '🛡️',
        accent: 'gold',
      });
    } catch (err) {
      console.error('[savings] budget reward failed', err);
    }
  };

  // Last 6 months of saving/spending for the trend bars.
  const history = useMemo(() => {
    const saved = monthlyTotals(savings.entries, 'saving');
    const spent = monthlyTotals(savings.entries, 'spending');
    const months: { key: string; saved: number; spent: number }[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      months.push({ key, saved: saved.get(key) ?? 0, spent: spent.get(key) ?? 0 });
    }
    return months;
  }, [savings.entries]);
  const historyMax = Math.max(1, ...history.map((m) => Math.max(m.saved, m.spent)));

  const goalPct = goal
    ? Math.max(0, Math.min(100, (savings.total / goal.targetAmount) * 100))
    : 0;
  const monthlyPct = goal?.monthlyAmount
    ? Math.max(0, Math.min(100, (savings.thisMonthSaved / goal.monthlyAmount) * 100))
    : null;
  const budgetPct = character.monthlyBudget
    ? Math.min(100, (savings.thisMonthSpent / character.monthlyBudget) * 100)
    : null;
  const overBudget =
    !!character.monthlyBudget && savings.thisMonthSpent > character.monthlyBudget;

  const recentEntries = savings.entries.slice(0, 20);

  return (
    <div className="space-y-4">
      {/* ── Overview ── */}
      <SystemWindow title="Vault" subtitle="real savings">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="border border-sys-gold/40 bg-sys-gold/5 px-2 py-3">
            <p className="text-[9px] uppercase tracking-widest text-sys-muted">総貯金</p>
            <p className="gold-text mt-1 text-xl sm:text-2xl">{formatYen(savings.total)}</p>
          </div>
          <div className="border border-sys-border/40 bg-black/30 px-2 py-3">
            <p className="text-[9px] uppercase tracking-widest text-sys-muted">今月の貯金</p>
            <p className={`mt-1 font-display text-lg sm:text-xl ${savings.thisMonthSaved >= 0 ? 'text-sys-ok' : 'text-sys-danger'}`}>
              {formatYen(savings.thisMonthSaved)}
            </p>
          </div>
          <div className="border border-sys-border/40 bg-black/30 px-2 py-3">
            <p className="text-[9px] uppercase tracking-widest text-sys-muted">今月のカード利用</p>
            <p className={`mt-1 font-display text-lg sm:text-xl ${overBudget ? 'text-sys-danger' : 'text-sys-text'}`}>
              {formatYen(savings.thisMonthSpent)}
            </p>
          </div>
        </div>
        <p className="mt-2 text-[10px] text-sys-muted">
          ここに記録するのは<span className="text-sys-text">実際のお金 (円)</span> 。ゆうちょ銀行・楽天カードは個人向け公開APIが無いため、手動記帳か CSV 明細のインポートで連携する
        </p>
      </SystemWindow>

      {/* ── Savings goal (framed as an S-rank quest) ── */}
      <SystemWindow title="S-Rank Quest" subtitle="savings goal">
        {goal && !goalEditing ? (
          <div className="space-y-2">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-sm font-bold text-sys-text">
                <Target className="mr-1 inline h-4 w-4 align-[-2px] text-sys-gold" />
                軍資金を貯めよ{goal.label ? ` — ${goal.label}` : ''}
              </p>
              <button
                type="button"
                onClick={() => {
                  setGoalAmount(String(goal.targetAmount));
                  setGoalLabel(goal.label ?? '');
                  setGoalMonthly(goal.monthlyAmount ? String(goal.monthlyAmount) : '');
                  setGoalEditing(true);
                }}
                className="text-[10px] uppercase tracking-widest text-sys-muted hover:text-sys-accent"
              >
                編集
              </button>
            </div>
            <div className="flex items-baseline justify-between font-mono text-xs">
              <span className="text-sys-accent">{formatYen(savings.total)}</span>
              <span className="text-sys-muted">/ {formatYen(goal.targetAmount)} ({Math.floor(goalPct)}%)</span>
            </div>
            <div className="sys-bar h-3">
              <div
                className="sys-bar-fill bg-gradient-to-r from-amber-500 to-yellow-300"
                style={{ width: `${goalPct}%` }}
              >
                <span className="sys-bar-shine" />
              </div>
            </div>
            {monthlyPct !== null && goal.monthlyAmount && (
              <div className="pt-1">
                <div className="flex items-baseline justify-between text-[10px] text-sys-muted">
                  <span>今月のペース目標</span>
                  <span className="font-mono">
                    {formatYen(savings.thisMonthSaved)} / {formatYen(goal.monthlyAmount)}
                  </span>
                </div>
                <div className="sys-bar mt-1 h-2">
                  <div
                    className="sys-bar-fill bg-gradient-to-r from-sys-accent to-cyan-300"
                    style={{ width: `${monthlyPct}%` }}
                  >
                    <span className="sys-bar-shine" />
                  </div>
                </div>
              </div>
            )}
            {goalPct >= 100 && (
              <p className="border border-sys-gold/50 bg-sys-gold/10 px-3 py-2 text-center text-sm text-sys-gold">
                🏆 目標達成! 新たな目標を設定して次のクエストへ
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {!goal && !goalEditing && (
              <p className="text-xs text-sys-muted">
                目標金額を設定すると、貯金の進捗が S 級クエストとして表示される
              </p>
            )}
            {goalEditing || !goal ? (
              <div className="grid gap-2 sm:grid-cols-3">
                <input
                  className="sys-input"
                  inputMode="numeric"
                  placeholder="目標金額 (円)"
                  value={goalAmount}
                  onChange={(e) => setGoalAmount(e.target.value)}
                />
                <input
                  className="sys-input"
                  inputMode="numeric"
                  placeholder="月間目標 (任意)"
                  value={goalMonthly}
                  onChange={(e) => setGoalMonthly(e.target.value)}
                />
                <input
                  className="sys-input"
                  placeholder="用途 (例: 旅行)"
                  value={goalLabel}
                  onChange={(e) => setGoalLabel(e.target.value)}
                />
                <div className="flex gap-2 sm:col-span-3">
                  <button type="button" onClick={() => void handleSaveGoal()} className="sys-button sys-button-gold flex-1 justify-center !py-1.5 !text-xs">
                    目標を設定
                  </button>
                  {goal && (
                    <button
                      type="button"
                      onClick={() => setGoalEditing(false)}
                      className="sys-button flex-1 justify-center !py-1.5 !text-xs"
                    >
                      キャンセル
                    </button>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        )}
      </SystemWindow>

      {/* ── Manual entry ── */}
      <SystemWindow title="Record" subtitle="manual entry">
        <div className="space-y-2">
          <div className="grid grid-cols-3 gap-1.5">
            {(
              [
                { id: 'deposit', label: '貯金 (預入)', icon: <PiggyBank className="h-3.5 w-3.5" /> },
                { id: 'withdraw', label: '引き出し', icon: <TrendingUp className="h-3.5 w-3.5 rotate-180" /> },
                { id: 'spending', label: 'カード利用', icon: <CreditCard className="h-3.5 w-3.5" /> },
              ] as const
            ).map((k) => (
              <button
                key={k.id}
                type="button"
                onClick={() => setEntryKind(k.id)}
                className={`flex items-center justify-center gap-1 border px-2 py-1.5 text-[11px] font-bold transition ${
                  entryKind === k.id
                    ? 'border-sys-gold/70 bg-sys-gold/10 text-sys-gold'
                    : 'border-sys-border/40 bg-black/30 text-sys-muted hover:text-sys-text'
                }`}
              >
                {k.icon}
                {k.label}
              </button>
            ))}
          </div>
          <div className="grid gap-2 sm:grid-cols-4">
            <input
              type="date"
              className="sys-input"
              value={entryDate}
              onChange={(e) => setEntryDate(e.target.value)}
            />
            <input
              className="sys-input"
              inputMode="numeric"
              placeholder="金額 (円)"
              value={entryAmount}
              onChange={(e) => setEntryAmount(e.target.value)}
            />
            <input
              className="sys-input sm:col-span-2"
              placeholder="メモ (任意)"
              value={entryMemo}
              onChange={(e) => setEntryMemo(e.target.value)}
            />
          </div>
          <button
            type="button"
            onClick={() => void handleAddEntry()}
            disabled={entryBusy || !entryAmount}
            className="sys-button sys-button-gold w-full justify-center"
          >
            <Coins className="h-4 w-4" />
            記帳する
          </button>
          {entryKind === 'deposit' && (
            <p className="text-[10px] text-sys-muted">
              貯金を記録するとゲーム内ボーナス +1G / {YEN_PER_GOLD}円 (リアルマネーとは交換不可)
            </p>
          )}
        </div>
      </SystemWindow>

      {/* ── CSV import ── */}
      <SystemWindow title="Import" subtitle="bank / card csv">
        <div className="space-y-2">
          <p className="text-[11px] leading-relaxed text-sys-muted">
            <span className="text-sys-text">ゆうちょダイレクト / ゆうちょ通帳アプリ</span>の入出金明細CSV、
            <span className="text-sys-text">楽天e-NAVI</span>の利用明細CSVを自動判別して取り込む。再インポートしても重複しない
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleFile(f);
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="sys-button w-full justify-center"
          >
            <Upload className="h-4 w-4" />
            CSVファイルを選択
          </button>

          {preview && (
            <div className="border border-sys-accent/40 bg-sys-accent/5 px-3 py-2.5 space-y-2">
              <div className="flex items-baseline justify-between gap-2">
                <p className="truncate text-xs font-bold text-sys-text">{preview.fileName}</p>
                <span className="shrink-0 text-[10px] text-sys-accent">
                  {FORMAT_LABEL[preview.statement.format]}
                </span>
              </div>
              <p className="font-mono text-[11px] text-sys-muted">
                {preview.statement.rows.length} 行を検出
                {preview.statement.skipped > 0 && ` (${preview.statement.skipped} 行はスキップ)`}
              </p>
              <ul className="max-h-28 space-y-0.5 overflow-y-auto font-mono text-[10px] text-sys-text/80">
                {preview.statement.rows.slice(0, 8).map((r, i) => (
                  <li key={i} className="flex justify-between gap-2">
                    <span className="truncate">
                      {r.date} {r.memo}
                    </span>
                    <span className={`shrink-0 ${r.kind === 'spending' ? 'text-sys-danger' : r.amount >= 0 ? 'text-sys-ok' : 'text-sys-danger'}`}>
                      {formatYen(r.amount)}
                    </span>
                  </li>
                ))}
                {preview.statement.rows.length > 8 && (
                  <li className="text-sys-muted">… 他 {preview.statement.rows.length - 8} 行</li>
                )}
              </ul>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => void handleImport()}
                  disabled={importBusy}
                  className="sys-button sys-button-gold flex-1 justify-center !py-1.5 !text-xs"
                >
                  {importBusy ? '取り込み中…' : 'この内容で取り込む'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPreview(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  className="sys-button flex-1 justify-center !py-1.5 !text-xs"
                >
                  キャンセル
                </button>
              </div>
            </div>
          )}
          {importNotice && (
            <p className="border border-sys-border/30 bg-black/30 px-3 py-2 text-[11px] text-sys-text">
              {importNotice}
            </p>
          )}
        </div>
      </SystemWindow>

      {/* ── Card budget ── */}
      <SystemWindow title="Budget" subtitle="monthly card cap">
        <div className="space-y-2">
          {character.monthlyBudget && !budgetEditing ? (
            <>
              <div className="flex items-baseline justify-between">
                <p className="text-sm font-bold text-sys-text">
                  <CreditCard className="mr-1 inline h-4 w-4 align-[-2px] text-sys-accent" />
                  今月のカード予算
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setBudgetAmount(String(character.monthlyBudget));
                    setBudgetEditing(true);
                  }}
                  className="text-[10px] uppercase tracking-widest text-sys-muted hover:text-sys-accent"
                >
                  編集
                </button>
              </div>
              <div className="flex items-baseline justify-between font-mono text-xs">
                <span className={overBudget ? 'text-sys-danger' : 'text-sys-accent'}>
                  {formatYen(savings.thisMonthSpent)}
                </span>
                <span className="text-sys-muted">/ {formatYen(character.monthlyBudget)}</span>
              </div>
              <div className="sys-bar h-3">
                <div
                  className={`sys-bar-fill ${
                    overBudget
                      ? 'bg-gradient-to-r from-rose-600 to-rose-400'
                      : budgetPct !== null && budgetPct > 80
                      ? 'bg-gradient-to-r from-amber-600 to-amber-400'
                      : 'bg-gradient-to-r from-sys-accent to-cyan-300'
                  }`}
                  style={{ width: `${budgetPct ?? 0}%` }}
                >
                  <span className="sys-bar-shine" />
                </div>
              </div>
              {overBudget && (
                <p className="text-[11px] text-sys-danger">予算オーバー! 月末までカードを温存せよ</p>
              )}
            </>
          ) : (
            <div className="flex gap-2">
              <input
                className="sys-input flex-1"
                inputMode="numeric"
                placeholder="月間カード予算 (円)"
                value={budgetAmount}
                onChange={(e) => setBudgetAmount(e.target.value)}
              />
              <button type="button" onClick={() => void handleSaveBudget()} className="sys-button !py-1.5 !text-xs">
                設定
              </button>
              {budgetEditing && (
                <button
                  type="button"
                  onClick={() => setBudgetEditing(false)}
                  className="sys-button !py-1.5 !text-xs"
                >
                  戻る
                </button>
              )}
            </div>
          )}

          {budgetRewardClaimable && (
            <button
              type="button"
              onClick={() => void claimBudgetReward()}
              className="sys-button sys-button-gold w-full justify-center"
            >
              🛡️ {lastMonth} 予算内クリア! 報酬を受け取る (+{BUDGET_REWARD_GOLD} G / +{BUDGET_REWARD_EXP} EXP)
            </button>
          )}
        </div>
      </SystemWindow>

      {/* ── 6-month trend ── */}
      <SystemWindow title="Trend" subtitle="last 6 months">
        <div className="flex items-end justify-between gap-1.5" style={{ height: 120 }}>
          {history.map((m) => (
            <div key={m.key} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
              <div className="flex w-full flex-1 items-end justify-center gap-0.5">
                <div
                  title={`貯金 ${formatYen(m.saved)}`}
                  className="w-2/5 bg-gradient-to-t from-amber-600 to-yellow-300"
                  style={{ height: `${Math.max(m.saved > 0 ? 4 : 0, (Math.max(0, m.saved) / historyMax) * 100)}%` }}
                />
                <div
                  title={`カード利用 ${formatYen(m.spent)}`}
                  className="w-2/5 bg-gradient-to-t from-sky-700 to-sys-accent"
                  style={{ height: `${Math.max(m.spent > 0 ? 4 : 0, (m.spent / historyMax) * 100)}%` }}
                />
              </div>
              <span className="font-mono text-[9px] text-sys-muted">{m.key.slice(5)}月</span>
            </div>
          ))}
        </div>
        <div className="mt-2 flex justify-center gap-4 text-[10px] text-sys-muted">
          <span><span className="mr-1 inline-block h-2 w-2 bg-yellow-300 align-middle" />貯金</span>
          <span><span className="mr-1 inline-block h-2 w-2 bg-sys-accent align-middle" />カード利用</span>
        </div>
      </SystemWindow>

      {/* ── Ledger ── */}
      <SystemWindow title="Ledger" subtitle="recent entries">
        {savings.loading ? (
          <p className="text-xs text-sys-muted">読み込み中…</p>
        ) : recentEntries.length === 0 ? (
          <p className="border border-dashed border-sys-border/30 px-4 py-8 text-center text-sm text-sys-muted">
            まだ記録がありません。<br />上のフォームから記帳するか、CSVをインポートしよう
          </p>
        ) : (
          <ul className="divide-y divide-sys-border/15">
            {recentEntries.map((e) => (
              <li key={e.id} className="flex items-center gap-2 py-1.5">
                <span className="font-mono text-[10px] text-sys-muted">{e.date}</span>
                <span className="min-w-0 flex-1 truncate text-xs text-sys-text">{e.memo}</span>
                <span className="shrink-0 border border-sys-border/30 px-1 text-[9px] text-sys-muted">
                  {e.kind === 'spending' ? 'カード' : SOURCE_LABEL[e.source]}
                </span>
                <span
                  className={`shrink-0 font-mono text-xs ${
                    e.kind === 'spending'
                      ? 'text-sky-300'
                      : e.amount >= 0
                      ? 'text-sys-ok'
                      : 'text-sys-danger'
                  }`}
                >
                  {e.kind === 'spending' ? '' : e.amount >= 0 ? '+' : ''}
                  {formatYen(e.amount)}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm('この記録を削除しますか?')) void savings.removeEntry(e.id);
                  }}
                  className="shrink-0 text-sys-muted/50 hover:text-sys-danger"
                  aria-label="削除"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </SystemWindow>
    </div>
  );
}
