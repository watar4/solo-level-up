import { useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  BarChart3,
  Database,
  GraduationCap,
  Home,
  Moon,
  RefreshCcw,
  Settings as SettingsIcon,
  Sparkles,
  Sun,
} from 'lucide-react';
import { useStore } from '../store/useStore';

const NAV = [
  { to: '/', label: 'ホーム', icon: Home, end: true },
  { to: '/setup', label: '出題', icon: GraduationCap },
  { to: '/review', label: '復習', icon: RefreshCcw },
  { to: '/stats', label: '成績', icon: BarChart3 },
  { to: '/questions', label: '問題管理', icon: Database },
  { to: '/generate', label: 'AI生成', icon: Sparkles },
  { to: '/settings', label: '設定', icon: SettingsIcon },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const theme = useStore((s) => s.theme);
  const setTheme = useStore((s) => s.setTheme);
  const location = useLocation();

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  // 画面遷移時にトップへスクロール
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  return (
    <div className="min-h-full">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <NavLink to="/" className="flex items-center gap-2 font-bold text-brand-700 dark:text-brand-300">
            <GraduationCap size={22} />
            <span>DS検定 演習</span>
          </NavLink>
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="btn-ghost ml-auto !px-2 !py-1"
            aria-label={theme === 'dark' ? 'ライトモードに切替' : 'ダークモードに切替'}
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
        <nav className="mx-auto flex max-w-3xl gap-1 overflow-x-auto px-2 pb-2 text-sm">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium transition ${
                  isActive
                    ? 'bg-brand-600 text-white'
                    : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                }`
              }
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-5 pb-20">{children}</main>
    </div>
  );
}
