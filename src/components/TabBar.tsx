import type { LucideIcon } from 'lucide-react';
import { ScrollText, UserRound, UtensilsCrossed, Swords, Menu } from 'lucide-react';

export type DashboardTab = 'quest' | 'status' | 'meal' | 'combat' | 'menu';

const TABS: { id: DashboardTab; label: string; Icon: LucideIcon }[] = [
  { id: 'quest', label: 'クエスト', Icon: ScrollText },
  { id: 'status', label: 'ステータス', Icon: UserRound },
  { id: 'meal', label: '食事', Icon: UtensilsCrossed },
  { id: 'combat', label: '戦闘', Icon: Swords },
  { id: 'menu', label: 'メニュー', Icon: Menu },
];

interface Props {
  active: DashboardTab;
  onChange: (tab: DashboardTab) => void;
}

// Fixed bottom tab bar — the primary navigation on mobile. Replaces the old
// cramped header button row. The bottom padding = iOS safe-area inset plus a
// little extra breathing room so the tappable area sits clear of the home
// indicator / gesture zone and is easier to hit on phones. Modals (z-50)
// intentionally render above this bar (z-40).
export function TabBar({ active, onChange }: Props) {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-sys-border/50 bg-[#04070f]/95 backdrop-blur-sm"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 0.5rem)' }}
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
              className={`flex flex-1 select-none flex-col items-center gap-0.5 py-2.5 text-[10px] font-bold uppercase tracking-wider transition ${
                isActive ? 'text-sys-accent' : 'text-sys-muted hover:text-sys-text'
              }`}
            >
              <Icon
                className={`h-5 w-5 ${
                  isActive ? 'drop-shadow-[0_0_6px_rgba(0,212,255,0.6)]' : ''
                }`}
              />
              {label}
              <span
                className={`mt-0.5 h-0.5 w-6 transition ${
                  isActive
                    ? 'bg-sys-accent shadow-[0_0_6px_rgba(0,212,255,0.8)]'
                    : 'bg-transparent'
                }`}
              />
            </button>
          );
        })}
      </div>
    </nav>
  );
}
