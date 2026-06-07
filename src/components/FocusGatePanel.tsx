import { useState } from 'react';
import { Check, Copy, Lock, LockOpen, ShieldOff, Smartphone, X } from 'lucide-react';
import { SystemWindow } from './SystemWindow';
import { firebaseProjectId } from '../firebase';

interface Props {
  open: boolean;
  gateSecret?: string;
  unlockedToday: boolean;
  onSetGateSecret: (secret: string | null) => Promise<void>;
  onClose: () => void;
}

// 256-bit URL-safe random secret (also the public gate doc id).
function generateSecret(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const b64 = btoa(String.fromCharCode(...bytes));
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function FocusGatePanel({
  open,
  gateSecret,
  unlockedToday,
  onSetGateSecret,
  onClose,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const gateUrl = gateSecret
    ? `https://firestore.googleapis.com/v1/projects/${firebaseProjectId}/databases/(default)/documents/gates/${gateSecret}`
    : '';

  const copy = async (value: string, marker: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(marker);
      setTimeout(() => setCopied((c) => (c === marker ? null : c)), 1500);
    } catch (err) {
      console.error('clipboard write failed', err);
    }
  };

  const enable = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await onSetGateSecret(generateSecret());
    } catch (err) {
      console.error('[gate] enable failed', err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    if (busy) return;
    if (!window.confirm('集中ゲートを無効化しますか?\n設定済みの iOS オートメーションは動かなくなります。')) return;
    setBusy(true);
    setError(null);
    try {
      await onSetGateSecret(null);
    } catch (err) {
      console.error('[gate] disable failed', err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const regenerate = async () => {
    if (busy) return;
    if (!window.confirm('新しい鍵を発行しますか?\n古い URL を使っているオートメーションは URL の貼り替えが必要になります。')) return;
    setBusy(true);
    setError(null);
    try {
      await onSetGateSecret(generateSecret());
    } catch (err) {
      console.error('[gate] regenerate failed', err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/70 px-4 py-6 backdrop-blur-sm"
      onClick={onClose}
    >
      <div className="my-auto w-full max-w-2xl" onClick={(e) => e.stopPropagation()}>
        <SystemWindow title="Focus Gate" subtitle="quest-locked apps">
          <div className="mb-3 flex items-center justify-between">
            <p className="flex items-center gap-1.5 text-xs uppercase tracking-widest text-sys-muted">
              <Smartphone className="h-3.5 w-3.5" />
              クエスト未達なら SNS を弾く（iOS）
            </p>
            <button type="button" onClick={onClose} className="text-sys-muted hover:text-sys-text" aria-label="閉じる">
              <X className="h-4 w-4" />
            </button>
          </div>

          <p className="mb-4 text-[11px] leading-relaxed text-sys-muted/90">
            iOS の「ショートカット」オートメーションが、SNS を開いた瞬間にこのアプリの
            「今日クエストを達成したか」を確認し、未達ならアプリに引き戻します。
            <span className="text-sys-danger/80">
              ※ これは“ソフトゲート”です。オートメーションを切れば回避できるので、強制ではなく自制の補助です。
            </span>
          </p>

          {!gateSecret ? (
            <div className="border border-sys-border/30 bg-black/30 p-4 text-center">
              <Lock className="mx-auto mb-2 h-6 w-6 text-sys-muted" />
              <p className="mb-3 text-sm text-sys-text/90">集中ゲートはまだ無効です。</p>
              <button type="button" onClick={() => void enable()} disabled={busy} className="sys-button justify-center">
                <LockOpen className="h-4 w-4" />
                {busy ? '発行中…' : '集中ゲートを有効化'}
              </button>
            </div>
          ) : (
            <>
              {/* Status */}
              <div
                className={`mb-4 flex items-center gap-2 border p-3 text-sm ${
                  unlockedToday
                    ? 'border-sys-ok/50 bg-sys-ok/10 text-sys-ok'
                    : 'border-sys-danger/50 bg-sys-danger/10 text-sys-danger'
                }`}
              >
                {unlockedToday ? <LockOpen className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                <span>
                  現在:{' '}
                  <strong>{unlockedToday ? '解除中（本日クエスト達成済み）' : 'ロック中（本日まだ未達成）'}</strong>
                </span>
              </div>

              {/* Gate URL */}
              <div className="mb-4">
                <p className="mb-1 text-[10px] uppercase tracking-widest text-sys-muted">
                  ゲート URL（ショートカットの「URLの内容を取得」に貼る）
                </p>
                <div className="flex items-center gap-2 border border-sys-border/40 bg-black/50 px-2 py-1.5 font-mono text-[11px] break-all">
                  <span className="flex-1">{gateUrl}</span>
                  <button
                    type="button"
                    onClick={() => copy(gateUrl, 'url')}
                    className="shrink-0 text-sys-accent hover:text-sys-gold"
                    title="コピー"
                  >
                    {copied === 'url' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Setup guide */}
              <details className="border-t border-sys-border/20 pt-3" open>
                <summary className="cursor-pointer text-xs uppercase tracking-widest text-sys-muted hover:text-sys-text">
                  iOS オートメーションの作り方
                </summary>
                <ol className="mt-3 space-y-2 text-xs leading-relaxed text-sys-text/85">
                  <li>
                    <span className="text-sys-accent">1.</span> 「ショートカット」App →{' '}
                    <strong>オートメーション</strong> → <strong>＋</strong> → 個人用オートメーションを作成
                  </li>
                  <li>
                    <span className="text-sys-accent">2.</span> <strong>App</strong> を選び、ブロックしたい SNS（Instagram / X / TikTok 等・複数可）→{' '}
                    <strong>「開いている」</strong>にチェック → <strong>「すぐに実行」</strong>
                  </li>
                  <li>
                    <span className="text-sys-accent">3.</span> アクションを順に追加:
                    <ul className="mt-1.5 space-y-1.5 border-l border-sys-border/30 pl-3">
                      <li>
                        <strong>URL の内容を取得</strong>: 上の<strong>ゲート URL</strong>を貼る（メソッド GET）
                      </li>
                      <li>
                        <strong>辞書の値を取得</strong>: キー{' '}
                        <code className="bg-black/50 px-1 font-mono text-[10px]">fields.unlockedDate.stringValue</code>
                        <button
                          type="button"
                          onClick={() => copy('fields.unlockedDate.stringValue', 'key')}
                          className="ml-1 align-middle text-sys-accent hover:text-sys-gold"
                          title="キーをコピー"
                        >
                          {copied === 'key' ? <Check className="inline h-3 w-3" /> : <Copy className="inline h-3 w-3" />}
                        </button>
                      </li>
                      <li>
                        <strong>現在の日付</strong> →{' '}
                        <strong>日付をフォーマット</strong>（カスタム{' '}
                        <code className="bg-black/50 px-1 font-mono text-[10px]">yyyy-MM-dd</code>）
                      </li>
                      <li>
                        <strong>if</strong>:〔辞書の値〕が〔フォーマットした日付〕と<strong>等しくない</strong>とき
                        <ul className="mt-1 space-y-1 border-l border-sys-border/20 pl-3 text-sys-muted">
                          <li>→ <strong>通知を表示</strong>「クエストを1つクリアして解除しよう」</li>
                          <li>→ <strong>App を開く</strong>: Solo Level Up（ホーム追加した PWA）</li>
                        </ul>
                      </li>
                    </ul>
                  </li>
                  <li>
                    <span className="text-sys-accent">4.</span> 完了。以後 SNS を開くと、本日クエスト未達なら通知＋このアプリへ引き戻されます。
                  </li>
                </ol>
                <p className="mt-3 text-[10px] leading-relaxed text-sys-muted/70">
                  仕組み: クエストを1つ達成すると、このアプリが今日の日付をゲート URL に書き込みます。
                  日付が今日と一致すれば「解除」。日付は毎晩自動で切り替わるので、翌日はまた未達＝ロックに戻ります。
                </p>
              </details>

              {/* Manage */}
              <div className="mt-5 flex flex-wrap gap-2 border-t border-sys-border/20 pt-3">
                <button
                  type="button"
                  onClick={() => void regenerate()}
                  disabled={busy}
                  className="border border-sys-border/40 px-3 py-1.5 text-xs text-sys-muted hover:border-sys-accent hover:text-sys-accent"
                >
                  鍵を再発行
                </button>
                <button
                  type="button"
                  onClick={() => void disable()}
                  disabled={busy}
                  className="inline-flex items-center gap-1 border border-sys-border/40 px-3 py-1.5 text-xs text-sys-muted hover:border-sys-danger hover:text-sys-danger"
                >
                  <ShieldOff className="h-3.5 w-3.5" /> 無効化
                </button>
              </div>
            </>
          )}

          {error && (
            <div className="mt-3 border border-sys-danger/60 bg-sys-danger/10 p-2 text-xs text-sys-danger">
              {error}
            </div>
          )}
        </SystemWindow>
      </div>
    </div>
  );
}
