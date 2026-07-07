import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { MessageCircle, Sparkles } from 'lucide-react';
import type { CoachContext } from '../lib/coach/context';
import { buildDigest, type CoachMood } from '../lib/coach/digest';

interface Props {
  ctx: CoachContext;
  onOpenChat: () => void;
}

const MOOD_ACCENT: Record<CoachMood, string> = {
  praise: 'text-sys-gold',
  nudge: 'text-sys-accent',
  rescue: 'text-purple-300',
};

// The always-on "AI coach" card at the top of the quest tab: a one-glance
// digest of recent activity + the single most useful next action. Pure
// rule-based text (deterministic, zero cost, no rate limit); the on-device LLM,
// when enabled, only enriches the chat behind the "相談する" button.
export function CoachCard({ ctx, onOpenChat }: Props) {
  const digest = useMemo(() => buildDigest(ctx), [ctx]);

  return (
    <motion.div
      className="sys-window relative p-4"
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <span className="corner-mark tl" />
      <span className="corner-mark tr" />
      <span className="corner-mark bl" />
      <span className="corner-mark br" />

      <div className="flex items-start gap-3">
        <Sparkles className={`h-5 w-5 shrink-0 mt-0.5 ${MOOD_ACCENT[digest.mood]}`} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-sys-text">{digest.headline}</p>

          {digest.bullets.length > 0 && (
            <ul className="mt-2 space-y-0.5">
              {digest.bullets.map((b, i) => (
                <li key={i} className="text-xs text-sys-muted flex gap-1.5">
                  <span className="text-sys-border">·</span>
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          )}

          <p className={`mt-2.5 text-sm ${MOOD_ACCENT[digest.mood]}`}>{digest.callToAction}</p>

          <button
            type="button"
            onClick={onOpenChat}
            className="mt-3 inline-flex items-center gap-1.5 text-xs text-sys-muted hover:text-sys-accent transition"
          >
            <MessageCircle className="h-3.5 w-3.5" />
            アリアに相談する
          </button>
        </div>
      </div>
    </motion.div>
  );
}
