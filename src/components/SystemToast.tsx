import { AnimatePresence, motion } from 'framer-motion';
import type { SystemEvent } from '../types';

interface Props {
  event: SystemEvent | null;
  onDismiss: () => void;
}

const ACCENT_TEXT: Record<NonNullable<SystemEvent['accent']>, string> = {
  gold: 'text-sys-gold drop-shadow-[0_0_10px_rgba(255,215,0,0.8)]',
  cyan: 'text-sys-accent drop-shadow-[0_0_10px_rgba(0,212,255,0.7)]',
  purple: 'text-purple-300 drop-shadow-[0_0_10px_rgba(192,132,252,0.7)]',
  rose: 'text-rose-300 drop-shadow-[0_0_10px_rgba(244,114,182,0.7)]',
};

export function SystemToast({ event, onDismiss }: Props) {
  return (
    <AnimatePresence mode="wait">
      {event && (
        <motion.div
          key={event.id}
          className="fixed inset-0 z-40 flex items-start justify-center pt-24 px-4 pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="sys-window relative px-8 py-6 text-center pointer-events-auto cursor-pointer max-w-md"
            initial={{ scale: 0.6, y: -20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 20 }}
            onClick={onDismiss}
          >
            <span className="corner-mark tl" />
            <span className="corner-mark tr" />
            <span className="corner-mark bl" />
            <span className="corner-mark br" />
            <div className="flex items-center justify-center gap-3">
              {event.icon && <span className="text-2xl">{event.icon}</span>}
              <p className="sys-title text-base">{event.title}</p>
              {event.icon && <span className="text-2xl">{event.icon}</span>}
            </div>
            <p
              className={`mt-2 text-3xl font-black tracking-wider ${
                event.accent ? ACCENT_TEXT[event.accent] : 'text-sys-text'
              }`}
            >
              {event.primary}
            </p>
            {event.secondary && (
              <p className="mt-2 text-sm text-sys-text/80">{event.secondary}</p>
            )}
            <p className="mt-4 text-[10px] uppercase tracking-widest text-sys-muted">
              click to dismiss
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
