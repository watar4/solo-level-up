import { useEffect, useState } from 'react';
import { SystemWindow } from './SystemWindow';
import { ALL_STATS, DIFFICULTY_EXP, STAT_LABELS } from '../types';
import type { Difficulty, Quest, QuestType, StatKey } from '../types';
import { X } from 'lucide-react';

export interface QuestFormInput {
  title: string;
  description: string;
  type: QuestType;
  targetStat: StatKey;
  difficulty: Difficulty;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: QuestFormInput) => Promise<void>;
  // When `initial` is provided the modal acts as an edit form.
  initial?: Quest | null;
}

const DIFFICULTIES: Difficulty[] = ['E', 'D', 'C', 'B', 'A', 'S'];

export function AddQuestModal({ open, onClose, onSubmit, initial }: Props) {
  const isEdit = !!initial;
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<QuestType>('daily');
  const [targetStat, setTargetStat] = useState<StatKey>('STR');
  const [difficulty, setDifficulty] = useState<Difficulty>('E');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Re-seed state whenever the modal is opened (or initial changes), so reopen
  // doesn't carry over stale values from a previous edit/create.
  useEffect(() => {
    if (!open) return;
    setTitle(initial?.title ?? '');
    setDescription(initial?.description ?? '');
    setType(initial?.type ?? 'daily');
    setTargetStat(initial?.targetStat ?? 'STR');
    setDifficulty(initial?.difficulty ?? 'E');
    setError(null);
  }, [open, initial]);

  if (!open) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onSubmit({
        title: title.trim(),
        description: description.trim(),
        type,
        targetStat,
        difficulty,
      });
      onClose();
    } catch (err) {
      console.error('[quest:submit] failed', err);
      const msg = err instanceof Error ? err.message : String(err);
      setError(`保存に失敗しました: ${msg}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm animate-flash"
      onClick={onClose}
    >
      <div className="w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        <SystemWindow
          title={isEdit ? 'クエスト編集' : 'クエスト発行'}
          subtitle={isEdit ? 'quest edit' : 'quest issue'}
        >
          <form onSubmit={submit} className="space-y-4">
            <div className="flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="text-sys-muted hover:text-sys-text"
                aria-label="閉じる"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <label className="block">
              <span className="block text-xs uppercase tracking-widest text-sys-muted mb-1">
                Quest Title
              </span>
              <input
                type="text"
                className="sys-input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="例: 腕立て伏せ 30回"
                maxLength={60}
                autoFocus
              />
            </label>

            <label className="block">
              <span className="block text-xs uppercase tracking-widest text-sys-muted mb-1">
                Description <span className="lowercase">(optional)</span>
              </span>
              <textarea
                className="sys-input min-h-[60px]"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={140}
              />
            </label>

            <div className="grid grid-cols-3 gap-3">
              <label className="block">
                <span className="block text-xs uppercase tracking-widest text-sys-muted mb-1">
                  Type
                </span>
                <select
                  className="sys-input"
                  value={type}
                  onChange={(e) => setType(e.target.value as QuestType)}
                >
                  <option value="daily">デイリー</option>
                  <option value="weekly">ウィークリー</option>
                  <option value="one-time">単発</option>
                </select>
              </label>

              <label className="block">
                <span className="block text-xs uppercase tracking-widest text-sys-muted mb-1">
                  Target Stat
                </span>
                <select
                  className="sys-input"
                  value={targetStat}
                  onChange={(e) => setTargetStat(e.target.value as StatKey)}
                >
                  {ALL_STATS.map((s) => (
                    <option key={s} value={s}>
                      {STAT_LABELS[s].en} ({STAT_LABELS[s].jp})
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="block text-xs uppercase tracking-widest text-sys-muted mb-1">
                  Difficulty
                </span>
                <select
                  className="sys-input"
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value as Difficulty)}
                >
                  {DIFFICULTIES.map((d) => (
                    <option key={d} value={d}>
                      {d} (+{DIFFICULTY_EXP[d]} EXP)
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {isEdit && initial && initial.completedDates.length > 0 && (
              <p className="text-[11px] text-sys-muted">
                ※ 既に獲得した EXP / ステータスは編集の影響を受けません。難易度を変えても遡及計算はしません。
              </p>
            )}

            {error && (
              <div className="border border-sys-danger/60 bg-sys-danger/10 p-3 text-xs text-sys-danger">
                {error}
                <div className="mt-1 text-[10px] text-sys-danger/70">
                  DevTools(F12) → Console の詳細を確認してください。
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="sys-button flex-1 justify-center"
              >
                キャンセル
              </button>
              <button
                type="submit"
                className="sys-button flex-1 justify-center"
                disabled={!title.trim() || busy}
              >
                {busy ? (isEdit ? '更新中…' : '発行中…') : isEdit ? '更新する' : '発行する'}
              </button>
            </div>
          </form>
        </SystemWindow>
      </div>
    </div>
  );
}
