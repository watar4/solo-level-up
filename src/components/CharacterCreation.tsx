import { useState } from 'react';
import { SystemWindow } from './SystemWindow';
import { Sword } from 'lucide-react';

interface Props {
  onCreate: (name: string) => Promise<void>;
}

export function CharacterCreation({ onCreate }: Props) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || busy) return;
    setBusy(true);
    try {
      await onCreate(name);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <SystemWindow title="ハンター登録" subtitle="initialise">
          <form onSubmit={submit} className="space-y-5">
            <p className="text-sm text-sys-text/80">
              これより貴方は<span className="text-sys-accent font-bold">Eランクハンター</span>
              として記録される。<br />
              呼び名を入力せよ。
            </p>
            <label className="block">
              <span className="block text-xs uppercase tracking-widest text-sys-muted mb-2">
                Hunter Name
              </span>
              <input
                type="text"
                className="sys-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="例: 影"
                maxLength={20}
                autoFocus
              />
            </label>
            <button
              type="submit"
              className="sys-button w-full justify-center py-3"
              disabled={!name.trim() || busy}
            >
              <Sword className="h-4 w-4" />
              {busy ? '召喚中…' : 'ステータスを開く'}
            </button>
          </form>
        </SystemWindow>
      </div>
    </div>
  );
}
