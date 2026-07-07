import type { StatKey } from '../types';
import { ALL_STATS } from '../types';

// Tiny pentagon radar showing a class's growth emphasis (growth stats spike).
// Purely illustrative — not tied to live stat values.
export function StatRadar({ growth, size = 60 }: { growth: StatKey[]; size?: number }) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 4;
  const n = ALL_STATS.length;
  const axis = (i: number) => {
    const ang = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    return { x: Math.cos(ang), y: Math.sin(ang) };
  };
  const value = (s: StatKey) => (growth.includes(s) ? 1 : 0.45);
  const pts = ALL_STATS.map((s, i) => {
    const a = axis(i);
    const v = value(s);
    return `${cx + a.x * r * v},${cy + a.y * r * v}`;
  }).join(' ');
  const ring = ALL_STATS.map((_, i) => {
    const a = axis(i);
    return `${cx + a.x * r},${cy + a.y * r}`;
  }).join(' ');

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
      <polygon points={ring} fill="none" stroke="#2a3550" strokeWidth={1} />
      <polygon points={pts} fill="rgba(0,212,255,0.25)" stroke="#00d4ff" strokeWidth={1.5} />
    </svg>
  );
}
