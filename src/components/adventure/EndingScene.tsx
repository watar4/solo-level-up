import { motion } from 'framer-motion';
import { CHAPTERS } from '../../lib/story/chapters';
import { getEnemy } from '../../lib/enemies/registry';

interface Props {
  stats: { level: number; totalExp: number; medals: number; defeated: number; streak: number };
  onClose: () => void;
}

// Ending — shown after the final chapter clear (docs 02 §3 EDと終章). A
// staff-roll of the year: the player's record + every ex-boss's new life, then
// back to the everyday quest screen ("習慣は続く").
export function EndingScene({ stats, onClose }: Props) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="エンディング"
      className="fixed inset-0 z-[65] overflow-y-auto bg-gradient-to-b from-[#0a1230] to-[#04070f] p-6"
    >
      <div className="mx-auto max-w-md space-y-8 py-8 text-center">
        <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.8 }}>
          <div className="text-[11px] uppercase tracking-[0.3em] text-sys-muted">the end</div>
          <h1 className="mt-2 text-3xl font-black text-amber-300 drop-shadow-[0_0_12px_rgba(217,164,65,0.5)]">
            ダラリア大陸、平和!
          </h1>
          <p className="mt-3 text-sm text-sys-text/80 leading-relaxed">
            サボり魔王グータラは 百年ぶりに 目を覚まし、<br />大陸に 朝が もどった。
          </p>
        </motion.div>

        {/* Year's record */}
        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
          className="rounded-md border border-sys-accent/40 bg-sys-accent/5 p-4"
        >
          <div className="mb-2 text-xs font-bold tracking-wide text-sys-accent">この 1年の 記録</div>
          <div className="grid grid-cols-2 gap-2 text-left text-[12px]">
            <Stat label="ハンターLv" value={`${stats.level}`} />
            <Stat label="しゅうかんメダル" value={`${stats.medals} / 12`} />
            <Stat label="総獲得EXP" value={stats.totalExp.toLocaleString('ja-JP')} />
            <Stat label="ダラモン討伐" value={`${stats.defeated}`} />
            <Stat label="最長ストリーク" value={`${stats.streak} 日`} />
            <Stat label="称号" value="継続の証" />
          </div>
        </motion.div>

        {/* Ex-bosses' new lives */}
        <div className="space-y-1.5 text-left">
          <div className="text-center text-xs font-bold tracking-wide text-sys-muted">― その後 ―</div>
          {CHAPTERS.map((ch, i) => {
            const lord = getEnemy(ch.lordId);
            if (!lord) return null;
            return (
              <motion.div
                key={ch.id}
                initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.6 + i * 0.06 }}
                className="rounded-sm border border-sys-border/30 bg-black/20 px-3 py-1.5 text-[11px]"
              >
                <span className="font-bold text-sys-text/90">{lord.name}</span>
                <span className="ml-1 text-sys-muted">{lord.loreAfter}</span>
              </motion.div>
            );
          })}
        </div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.4 }} className="space-y-2 pt-4">
          <p className="text-sm text-sys-text/80">「それでは、明日の クエストです。」</p>
          <p className="text-[11px] text-sys-muted">――そして 習慣は、つづく。</p>
        </motion.div>

        <button type="button" onClick={onClose} className="sys-button-arise mt-4 w-full py-2.5 text-sm font-bold">
          明日のクエストへ
        </button>
        <p className="pt-2 text-[11px] text-sys-muted">つぎの ちょうせん:地下の「無限回廊」で さらなる 高みへ。</p>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-sm border border-sys-border/30 bg-black/20 px-2 py-1.5">
      <div className="text-[9px] uppercase tracking-wide text-sys-muted">{label}</div>
      <div className="font-mono text-sm font-bold text-sys-text">{value}</div>
    </div>
  );
}
