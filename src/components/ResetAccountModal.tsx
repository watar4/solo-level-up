import { useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { SystemWindow } from './SystemWindow';
import type { Character, Quest } from '../types';

interface Props {
  open: boolean;
  character: Character;
  quests: Quest[];
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

const CONFIRM_PHRASE = 'リセット';

export function ResetAccountModal({ open, character, quests, onClose, onConfirm }: Props) {
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const completionCount = quests.reduce((sum, q) => sum + q.completedDates.length, 0);
  const achievementCount = character.unlocked?.achievements.length ?? 0;
  const skillCount = character.unlocked?.skills.length ?? 0;

  const canConfirm = typed.trim() === CONFIRM_PHRASE && !busy;

  const handle = async () => {
    if (!canConfirm) return;
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
      setTyped('');
      onClose();
    } catch (err) {
      console.error('[reset] failed', err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 py-6 backdrop-blur-sm overflow-y-auto"
      onClick={onClose}
    >
      <div className="w-full max-w-md my-auto" onClick={(e) => e.stopPropagation()}>
        <SystemWindow title="ハンター登録抹消" subtitle="irreversible">
          <div className="flex justify-end -mt-2 mb-1">
            <button type="button" onClick={onClose} className="text-sys-muted hover:text-sys-text" aria-label="閉じる">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-4">
            <div className="flex items-start gap-3 border border-sys-danger/60 bg-sys-danger/10 p-3 text-sm text-sys-danger">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
              <p>
                ハンター <span className="font-bold">「{character.name}」</span>{' '}
                の記録を <span className="font-bold">完全に消去</span> します。<br />
                この操作は<span className="font-bold">元に戻せません</span>。
              </p>
            </div>

            <div>
              <p className="text-[10px] uppercase tracking-widest text-sys-muted mb-1.5">
                削除される情報
              </p>
              <ul className="text-xs text-sys-text/80 space-y-1">
                <li className="flex justify-between"><span>キャラクター</span><span className="font-mono text-sys-muted">Lv.{character.level} / 累計 {character.totalExp} EXP</span></li>
                <li className="flex justify-between"><span>クエスト</span><span className="font-mono text-sys-muted">{quests.length} 件</span></li>
                <li className="flex justify-between"><span>完了履歴</span><span className="font-mono text-sys-muted">{completionCount} 件</span></li>
                <li className="flex justify-between"><span>獲得した実績</span><span className="font-mono text-sys-muted">{achievementCount} 件</span></li>
                <li className="flex justify-between"><span>習得スキル</span><span className="font-mono text-sys-muted">{skillCount} 件</span></li>
              </ul>
              <p className="mt-2 text-[10px] text-sys-muted">
                Google ログイン状態は維持されます。リセット後、再びハンター登録画面に戻ります。
              </p>
            </div>

            <label className="block">
              <span className="block text-xs text-sys-text/80 mb-1.5">
                確認のため、下に <span className="font-bold text-sys-danger">{CONFIRM_PHRASE}</span> と入力してください:
              </span>
              <input
                type="text"
                className="sys-input"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                placeholder={CONFIRM_PHRASE}
                disabled={busy}
                autoFocus
              />
            </label>

            {error && (
              <div className="border border-sys-danger/60 bg-sys-danger/10 p-2 text-xs text-sys-danger">
                {error}
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="sys-button flex-1 justify-center"
                disabled={busy}
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={handle}
                className="sys-button sys-button-danger flex-1 justify-center"
                disabled={!canConfirm}
              >
                {busy ? '抹消中…' : '抹消を実行'}
              </button>
            </div>
          </div>
        </SystemWindow>
      </div>
    </div>
  );
}
