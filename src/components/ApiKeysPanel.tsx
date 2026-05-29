import { useState } from 'react';
import { Check, Copy, KeyRound, Plus, Trash2, X } from 'lucide-react';
import { SystemWindow } from './SystemWindow';
import { useApiKeys } from '../hooks/useApiKeys';
import { firebaseProjectId } from '../firebase';

interface Props {
  open: boolean;
  uid: string;
  onClose: () => void;
}

function formatDate(t: number): string {
  const d = new Date(t);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
}

function maskSecret(secret: string): string {
  // Show first 6 + last 4 so the user can identify the row, hide the middle.
  if (secret.length <= 12) return secret.slice(0, 4) + '...';
  return `${secret.slice(0, 6)}...${secret.slice(-4)}`;
}

export function ApiKeysPanel({ open, uid, onClose }: Props) {
  const { keys, loading, generate, revoke } = useApiKeys(uid);
  const [label, setLabel] = useState('iPhone Shortcut');
  const [busy, setBusy] = useState(false);
  // The most recent secret we just generated. Shown ONCE — once dismissed
  // the user has to issue a new key to recover it.
  const [freshSecret, setFreshSecret] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${firebaseProjectId}/databases/(default)/documents/weightInbox`;

  const handleGenerate = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const secret = await generate(label);
      setFreshSecret(secret);
    } catch (err) {
      console.error('[apikey:generate] failed', err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const handleRevoke = async (secret: string, label: string) => {
    if (!window.confirm(`API キー「${label}」を削除しますか?\nこのキーを使っている Shortcut は即座に動かなくなります。`)) return;
    try {
      await revoke(secret);
    } catch (err) {
      console.error('[apikey:revoke] failed', err);
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const copy = async (value: string, marker: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(marker);
      setTimeout(() => setCopied((c) => (c === marker ? null : c)), 1500);
    } catch (err) {
      console.error('clipboard write failed', err);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-sm overflow-y-auto"
      onClick={onClose}
    >
      <div className="w-full max-w-2xl my-auto" onClick={(e) => e.stopPropagation()}>
        <SystemWindow title="API Keys" subtitle="external integrations">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs uppercase tracking-widest text-sys-muted flex items-center gap-1.5">
              <KeyRound className="h-3.5 w-3.5" />
              iPhone ヘルスケア連携用のキーを発行
            </p>
            <button type="button" onClick={onClose} className="text-sys-muted hover:text-sys-text" aria-label="閉じる">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Fresh secret reveal */}
          {freshSecret && (
            <div className="mb-4 border border-sys-gold/60 bg-sys-gold/10 p-3">
              <p className="text-xs text-sys-gold font-bold mb-2">
                新しい API キーを発行しました。<br />
                <span className="text-sys-text/80 font-normal">この画面を閉じると二度と表示されません。Shortcut に貼り付けてから「了解」を押してください。</span>
              </p>
              <div className="flex items-center gap-2 border border-sys-border/40 bg-black/50 px-2 py-1.5 font-mono text-xs break-all">
                <span className="flex-1">{freshSecret}</span>
                <button
                  type="button"
                  onClick={() => copy(freshSecret, 'secret')}
                  className="shrink-0 text-sys-accent hover:text-sys-gold"
                  title="コピー"
                >
                  {copied === 'secret' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
              <button
                type="button"
                onClick={() => setFreshSecret(null)}
                className="sys-button mt-3"
              >
                了解(コピーした)
              </button>
            </div>
          )}

          {/* Generator */}
          {!freshSecret && (
            <div className="mb-4 border border-sys-border/30 bg-black/30 p-3">
              <label className="block">
                <span className="block text-[10px] uppercase tracking-widest text-sys-muted mb-1">
                  ラベル(分かりやすい名前)
                </span>
                <div className="flex gap-2">
                  <input
                    type="text"
                    className="sys-input flex-1"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    maxLength={32}
                    placeholder="例: iPhone Shortcut"
                  />
                  <button
                    type="button"
                    onClick={handleGenerate}
                    disabled={busy || !label.trim()}
                    className="sys-button"
                  >
                    <Plus className="h-4 w-4" />
                    発行
                  </button>
                </div>
              </label>
            </div>
          )}

          {/* Existing keys */}
          <div className="border-t border-sys-border/20 pt-3">
            <p className="mb-2 text-[10px] uppercase tracking-widest text-sys-muted">
              発行済みのキー ({keys.length})
            </p>
            {loading ? (
              <p className="py-4 text-center text-sm text-sys-muted">読み込み中…</p>
            ) : keys.length === 0 ? (
              <p className="border border-dashed border-sys-border/30 px-3 py-6 text-center text-sm text-sys-muted">
                まだキーがありません。
              </p>
            ) : (
              <ul className="space-y-1.5">
                {keys.map((k) => (
                  <li
                    key={k.id}
                    className="flex items-center gap-2 border border-sys-border/30 bg-black/30 px-3 py-2 text-xs"
                  >
                    <KeyRound className="h-3.5 w-3.5 text-sys-muted shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-sys-text truncate">{k.label}</p>
                      <p className="font-mono text-[10px] text-sys-muted">
                        {maskSecret(k.id)} · {formatDate(k.createdAt)} 発行
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRevoke(k.id, k.label)}
                      className="text-sys-muted hover:text-sys-danger"
                      aria-label="キーを削除"
                      title="キーを削除"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {error && (
            <div className="mt-3 border border-sys-danger/60 bg-sys-danger/10 p-2 text-xs text-sys-danger">
              {error}
            </div>
          )}

          {/* Shortcut configuration helper */}
          <details className="mt-5 border-t border-sys-border/20 pt-3">
            <summary className="cursor-pointer text-xs uppercase tracking-widest text-sys-muted hover:text-sys-text">
              iOS Shortcut の設定方法
            </summary>
            <div className="mt-3 space-y-3 text-xs text-sys-text/80">
              <p>
                ヘルスケアの体重保存をトリガーに、Shortcut で以下を POST します。
              </p>

              <div>
                <p className="text-[10px] uppercase tracking-widest text-sys-muted mb-1">
                  リクエスト URL (POST)
                </p>
                <div className="flex items-center gap-2 border border-sys-border/40 bg-black/50 px-2 py-1.5 font-mono text-[11px] break-all">
                  <span className="flex-1">{firestoreUrl}</span>
                  <button
                    type="button"
                    onClick={() => copy(firestoreUrl, 'url')}
                    className="shrink-0 text-sys-accent hover:text-sys-gold"
                    title="コピー"
                  >
                    {copied === 'url' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div>
                <p className="text-[10px] uppercase tracking-widest text-sys-muted mb-1">
                  あなたの uid (Shortcut にハードコード)
                </p>
                <div className="flex items-center gap-2 border border-sys-border/40 bg-black/50 px-2 py-1.5 font-mono text-[11px] break-all">
                  <span className="flex-1">{uid}</span>
                  <button
                    type="button"
                    onClick={() => copy(uid, 'uid')}
                    className="shrink-0 text-sys-accent hover:text-sys-gold"
                    title="コピー"
                  >
                    {copied === 'uid' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div>
                <p className="text-[10px] uppercase tracking-widest text-sys-muted mb-1">
                  リクエスト本文 (JSON / 辞書アクションに貼り付け)
                </p>
                <pre className="border border-sys-border/40 bg-black/50 p-2 font-mono text-[11px] overflow-x-auto">{`{
  "fields": {
    "secret":     { "stringValue":    "ここに発行したキーを貼る" },
    "uid":        { "stringValue":    "${uid}" },
    "weight":     { "doubleValue":    [ヘルスケア → 数量] },
    "recordedAt": { "timestampValue": [ヘルスケア → 開始日 → ISO 8601] },
    "source":     { "stringValue":    "ios-shortcut" }
  }
}`}</pre>
              </div>

              <p className="text-sys-muted">
                体重は kg、ISO 8601 形式の日付(例: 2026-05-30T07:00:00Z)で送ってください。
                取り込みは次にアプリを開いた時に自動で行われます。
              </p>
            </div>
          </details>
        </SystemWindow>
      </div>
    </div>
  );
}
