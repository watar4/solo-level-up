import { AnimatePresence, motion } from 'framer-motion';
import type { LevelUpEvent } from '../types';
import { Star } from 'lucide-react';

interface Props {
  event: LevelUpEvent | null;
  onDismiss: () => void;
}

export function LevelUpToast({ event, onDismiss }: Props) {
  return (
    <AnimatePresence>
      {event && (
        <motion.div
          className="fixed inset-0 z-40 flex items-start justify-center pt-24 px-4 pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="sys-window relative px-8 py-6 text-center pointer-events-auto cursor-pointer"
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
              <Star className="h-6 w-6 text-sys-gold drop-shadow-[0_0_10px_rgba(255,215,0,0.8)]" />
              <p className="sys-title text-base">Level Up!</p>
              <Star className="h-6 w-6 text-sys-gold drop-shadow-[0_0_10px_rgba(255,215,0,0.8)]" />
            </div>
            <p className="mt-2 text-4xl font-black tracking-wider">
              Lv.{event.fromLevel}{' '}
              <span className="text-sys-accent drop-shadow-[0_0_10px_rgba(0,212,255,0.7)]">
                →
              </span>{' '}
              Lv.{event.toLevel}
            </p>
            <p className="mt-3 text-sm text-sys-text/80">
              +{event.statPointsGained} ステータスポイントを獲得
            </p>
            {event.newRank && (
              <p className="mt-2 text-sm text-sys-gold">
                ランクアップ! → <span className="font-black text-lg">{event.newRank}</span>
              </p>
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
