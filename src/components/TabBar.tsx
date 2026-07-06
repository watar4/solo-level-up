import type { LucideIcon } from 'lucide-react';
import { motion } from 'framer-motion';
import { ScrollText, UserRound, UtensilsCrossed, Swords, PiggyBank, Menu } from 'lucide-react';

export type DashboardTab = 'quest' | 'status' | 'meal' | 'combat' | 'savings' | 'menu';

const TABS: { id: DashboardTab; label: string; Icon: LucideIcon }[] = [
  { id: 'quest', label: 'クエスト', Icon: ScrollText },
  { id: 'status', label: 'ステータス', Icon: UserRound },
  { id: 'meal', label: '食事', Icon: UtensilsCrossed },
  { id: 'combat', label: '戦闘', Icon: Swords },
  { id: 'savings', label: '貯金', Icon: PiggyBank },
  { id: 'menu', label: 'メニュー', Icon: Menu },
];

interface Props {
  active: DashboardTab;
  onChange: (tab: DashboardTab) => void;
}

// Fixed bottom tab bar — the primary navigation on mobile. The active tab
// gets a shared-layout glow pill that springs between tabs (game-console
// feel), plus an icon pop on selection. The bottom padding = iOS safe-area
// inset plus a little extra so the tappable area sits clear of the home
// indicator / gesture zone. Modals (z-50) render above this bar (z-40).
export function TabBar({ active, onChange }: Props) {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-sys-border/50 bg-[#04070f]/95 backdrop-blur-sm"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 0.4rem)' }}
    >
      <div className="mx-auto flex max-w-5xl">
        {TABS.map(({ id, label, Icon }) => {
          const isActive = active === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onChange(id)}
              aria-current={isActive ? 'page' : undefined}
              className={`relative flex flex-1 select-none flex-col items-center gap-0.5 py-2.5 text-[9px] font-bold uppercase tracking-wider transition active:scale-95 ${
                isActive ? 'text-sys-accent' : 'text-sys-muted hover:text-sys-text'
              }`}
            >
              {isActive && (
                <motion.span
                  layoutId="tab-glow"
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                  className="absolute inset-x-2 top-1 bottom-1 -z-10 border border-sys-accent/30 bg-sys-accent/10"
                  style={{ borderRadius: 6 }}
                />
              )}
              <motion.span
                animate={isActive ? { scale: [1, 1.25, 1], y: [0, -2, 0] } : { scale: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <Icon
                  className={`h-5 w-5 ${
                    isActive ? 'drop-shadow-[0_0_8px_rgba(0,212,255,0.8)]' : ''
                  }`}
                />
              </motion.span>
              {label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
