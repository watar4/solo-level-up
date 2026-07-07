import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import type { DialogueLine } from '../../lib/story/dialogue/ch01';

const SPEAKER_NAMES: Record<DialogueLine['speaker'], string> = {
  aria: 'アリア',
  balgas: 'バルガス',
  kain: 'カイン',
  merle: 'メルル',
  enemy: '???',
  narration: '',
};

interface Props {
  lines: DialogueLine[];
  onDone: () => void;
}

// Full-screen tap-to-advance dialogue. Aria speaks in the system-window style;
// everyone else uses a DQ-style bottom window (docs 04 §6).
export function StoryDialog({ lines, onDone }: Props) {
  const [i, setI] = useState(0);
  const line = lines[i];

  // Empty script → close, but via an effect: onDone triggers parent setState
  // (and async campaign saves), which must not run during render.
  const empty = !line;
  useEffect(() => {
    if (empty) onDone();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empty]);
  if (empty) return null;

  const advance = () => {
    if (i + 1 >= lines.length) onDone();
    else setI(i + 1);
  };

  const speakerName = line.name ?? SPEAKER_NAMES[line.speaker];
  const isAria = line.speaker === 'aria' || line.window === 'system';
  const isNarration = line.speaker === 'narration' && !line.name;

  return (
    // Outer layer is the dialog; the tap-to-advance control is a real button
    // inside it (role="dialog" on the button itself would erase its button
    // semantics for assistive tech).
    <div role="dialog" aria-modal="true" aria-label="かいわ" className="fixed inset-0 z-[60]">
      <button
        type="button"
        onClick={advance}
        className="flex h-full w-full flex-col justify-end bg-[#04070f]/95 p-4 text-left"
        aria-label="つぎへ"
      >
      <motion.div
        key={i}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18 }}
        className={
          isAria
            ? 'sys-window mx-auto w-full max-w-xl p-4'
            : 'mx-auto w-full max-w-xl rounded-md border-2 border-sys-border bg-[#0a0f1c] p-4'
        }
      >
        {speakerName && !isNarration && (
          <div
            className={`mb-1 text-xs font-bold tracking-wide ${
              isAria ? 'text-sys-accent' : 'text-sys-text'
            }`}
          >
            {speakerName}
          </div>
        )}
        <p
          className={`leading-relaxed ${
            isNarration ? 'text-sys-muted italic' : 'text-sys-text'
          }`}
        >
          {line.text}
        </p>
        <div className="mt-2 flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-widest text-sys-muted">
            {i + 1} / {lines.length}
          </span>
          <motion.span
            animate={{ y: [0, 3, 0] }}
            transition={{ repeat: Infinity, duration: 0.9 }}
            className="text-sys-accent"
          >
            ▼
          </motion.span>
        </div>
      </motion.div>
      </button>
    </div>
  );
}
