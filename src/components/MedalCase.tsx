import { MEDALS, type MedalId } from '../lib/story/medals';

// Medal case — the 12 habit medals, earned ones lit. Shown on the status page
// (docs 04 §7).
export function MedalCase({ owned }: { owned: MedalId[] }) {
  const set = new Set(owned);
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-xs font-bold text-sys-text">しゅうかんメダル</span>
        <span className="text-[10px] text-sys-muted">{owned.length} / {MEDALS.length}</span>
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        {MEDALS.map((m) => {
          const has = set.has(m.id as MedalId);
          return (
            <div
              key={m.id}
              title={has ? `${m.jp}：${m.desc}` : `第${m.chapter}章で獲得`}
              className={`flex flex-col items-center gap-0.5 rounded-sm border p-1.5 text-center ${
                has ? 'border-amber-500/50 bg-amber-500/5' : 'border-sys-border/30 opacity-40'
              }`}
            >
              <span className="text-lg">{has ? '🏅' : '🔒'}</span>
              <span className="text-[8px] leading-tight text-sys-muted">{has ? m.jp.replace('メダル', '') : `${m.chapter}章`}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
