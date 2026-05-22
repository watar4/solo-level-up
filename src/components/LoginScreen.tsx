import { SystemWindow } from './SystemWindow';
import { LogIn, Sparkles } from 'lucide-react';

interface Props {
  onSignIn: () => void;
  configured: boolean;
}

export function LoginScreen({ onSignIn, configured }: Props) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <p className="sys-title mb-2">System</p>
          <h1 className="text-4xl font-black tracking-wider text-sys-text">
            <span className="text-sys-accent drop-shadow-[0_0_8px_rgba(0,212,255,0.6)]">
              SOLO
            </span>{' '}
            LEVEL UP
          </h1>
          <p className="mt-3 text-sm text-sys-muted">
            毎日の習慣をクエストに。 ハンターよ、目覚めの時だ。
          </p>
        </div>

        <SystemWindow title="召喚">
          <div className="space-y-5 py-2">
            <div className="flex items-start gap-3 text-sm text-sys-text/80">
              <Sparkles className="mt-0.5 h-4 w-4 text-sys-accent" />
              <p>
                Googleアカウントで「召喚陣」を起動します。<br />
                同じアカウントで再ログインすれば、いつでもステータスと
                クエストの進捗が引き継がれます。
              </p>
            </div>

            {!configured && (
              <div className="border border-sys-danger/60 bg-sys-danger/10 p-3 text-xs text-sys-danger">
                Firebase 環境変数が未設定です。<br />
                README の手順に沿って <code>.env.local</code> を作成してください。
              </div>
            )}

            <button
              type="button"
              className="sys-button w-full justify-center py-3"
              onClick={onSignIn}
              disabled={!configured}
            >
              <LogIn className="h-4 w-4" />
              Google で召喚を開始
            </button>
          </div>
        </SystemWindow>
      </div>
    </div>
  );
}
