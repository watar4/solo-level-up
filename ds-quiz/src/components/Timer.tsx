import { useEffect, useState } from 'react';
import { AlarmClock } from 'lucide-react';

interface Props {
  deadline: number; // ms epoch
  onExpire: () => void;
}

/** 模擬試験用カウントダウンタイマー。残り時間を常時表示し、5分以下で警告色。 */
export default function Timer({ deadline, onExpire }: Props) {
  const [remaining, setRemaining] = useState(() => Math.max(0, deadline - Date.now()));

  useEffect(() => {
    const tick = () => {
      const r = Math.max(0, deadline - Date.now());
      setRemaining(r);
      if (r <= 0) onExpire();
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [deadline, onExpire]);

  const totalSec = Math.floor(remaining / 1000);
  const mm = String(Math.floor(totalSec / 60)).padStart(2, '0');
  const ss = String(totalSec % 60).padStart(2, '0');
  const warn = totalSec <= 300; // 残り5分以下で警告

  return (
    <div
      className={`chip gap-1 px-3 py-1 text-sm font-mono font-semibold tabular-nums ${
        warn
          ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-200 animate-pulse'
          : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-200'
      }`}
      role="timer"
      aria-live={warn ? 'assertive' : 'off'}
      aria-label={`残り時間 ${mm}分${ss}秒`}
    >
      <AlarmClock size={16} aria-hidden />
      {mm}:{ss}
    </div>
  );
}
