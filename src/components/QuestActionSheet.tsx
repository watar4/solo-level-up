import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, ChevronUp, Pencil, Trash2, X } from 'lucide-react';
import type { Quest } from '../types';

interface Props {
  quest: Quest | null;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onClose: () => void;
  onEdit: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
}

// Bottom-sheet action menu. Replaces the cluster of small icons that were
// crammed into each card — tap targets are now full-width rows that comfortably
// clear the 44px touch guideline.
export function QuestActionSheet({
  quest,
  canMoveUp,
  canMoveDown,
  onClose,
  onEdit,
  onMoveUp,
  onMoveDown,
  onDelete,
}: Props) {
  const open = !!quest;

  // Lock body scroll while the sheet is open so the underlying list doesn't
  // jump when the user flicks within the sheet.
  useEffect(() => {
    if (!open) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = original;
    };
  }, [open]);

  // Esc closes — convenient on desktop, harmless on mobile.
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && quest && (
        <motion.div
          key="quest-sheet"
          className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={onClose}
        >
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

          <motion.div
            className="relative z-10 w-full sm:max-w-sm"
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ type: 'tween', duration: 0.22, ease: 'easeOut' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sys-window p-4 sm:p-5">
              <span className="corner-mark tl" />
              <span className="corner-mark tr" />
              <span className="corner-mark bl" />
              <span className="corner-mark br" />

              <div className="mb-3 flex items-start justify-between gap-3 border-b border-sys-border/30 pb-3">
                <div className="min-w-0">
                  <p className="sys-title">Quest Actions</p>
                  <p className="mt-0.5 truncate font-bold text-sys-text">{quest.title}</p>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="閉じる"
                  className="shrink-0 p-2 text-sys-muted hover:text-sys-text"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="flex flex-col gap-1.5">
                <SheetAction
                  icon={<Pencil className="h-5 w-5" />}
                  label="編集"
                  onClick={() => {
                    onEdit();
                    onClose();
                  }}
                />
                <SheetAction
                  icon={<ChevronUp className="h-5 w-5" />}
                  label="上に移動"
                  disabled={!canMoveUp}
                  onClick={() => {
                    onMoveUp();
                    onClose();
                  }}
                />
                <SheetAction
                  icon={<ChevronDown className="h-5 w-5" />}
                  label="下に移動"
                  disabled={!canMoveDown}
                  onClick={() => {
                    onMoveDown();
                    onClose();
                  }}
                />
                <SheetAction
                  icon={<Trash2 className="h-5 w-5" />}
                  label="削除"
                  variant="danger"
                  onClick={() => {
                    onDelete();
                    onClose();
                  }}
                />
              </div>

              <button
                type="button"
                onClick={onClose}
                className="sys-button mt-3 w-full justify-center"
              >
                キャンセル
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

interface SheetActionProps {
  icon: React.ReactNode;
  label: string;
  disabled?: boolean;
  variant?: 'default' | 'danger';
  onClick: () => void;
}

function SheetAction({ icon, label, disabled, variant = 'default', onClick }: SheetActionProps) {
  const danger = variant === 'danger';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex w-full items-center gap-3 border px-4 py-3 text-left text-sm font-bold tracking-wider transition active:translate-y-px ${
        danger
          ? 'border-sys-danger/40 text-sys-danger hover:bg-sys-danger/10 hover:border-sys-danger/70'
          : 'border-sys-border/40 text-sys-text hover:bg-sys-accent/10 hover:border-sys-accent/70 hover:text-sys-accent'
      } disabled:opacity-30 disabled:hover:bg-transparent disabled:active:translate-y-0`}
    >
      <span className={danger ? 'text-sys-danger' : 'text-sys-muted'}>{icon}</span>
      <span>{label}</span>
    </button>
  );
}
