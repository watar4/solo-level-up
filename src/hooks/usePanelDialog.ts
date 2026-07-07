import { useEffect, useRef } from 'react';

// Minimal dialog semantics for the app's full-screen panels: labels the
// container as a modal dialog, moves focus into it on mount (so keyboard /
// screen-reader users aren't left "standing" on the covered dashboard),
// restores focus on unmount, and closes on Escape.
//
// `escapeEnabled` lets callers suspend Escape-close while an inner flow must
// not be abandoned silently (e.g. mid-battle).
export function usePanelDialog(onClose: () => void, escapeEnabled = true) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const escRef = useRef(escapeEnabled);
  escRef.current = escapeEnabled;

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && escRef.current) {
        e.stopPropagation();
        closeRef.current();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      previous?.focus?.();
    };
  }, []);

  return {
    ref,
    role: 'dialog' as const,
    'aria-modal': true as const,
    tabIndex: -1,
  };
}
