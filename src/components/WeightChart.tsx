import type { WeightEntry } from '../types';

interface Props {
  entries: WeightEntry[]; // expected sorted oldest-first
  target?: number;        // kg — draw a dashed reference line at this y
}

const VIEW_W = 320;
const VIEW_H = 140;
const PAD = { top: 12, right: 12, bottom: 22, left: 34 };

// Collapse to one point per date (the most recent measurement for that day),
// which is what the user generally cares about for a daily-weigh-in chart.
function dailyPoints(entries: WeightEntry[]): WeightEntry[] {
  const byDate = new Map<string, WeightEntry>();
  for (const e of entries) {
    const prev = byDate.get(e.date);
    if (!prev || e.createdAt > prev.createdAt) byDate.set(e.date, e);
  }
  return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
}

function formatTick(date: string): string {
  // YYYY-MM-DD → M/D
  const [, m, d] = date.split('-');
  return `${parseInt(m, 10)}/${parseInt(d, 10)}`;
}

export function WeightChart({ entries, target }: Props) {
  const points = dailyPoints(entries);

  if (points.length === 0) {
    return (
      <div className="border border-dashed border-sys-border/30 px-4 py-8 text-center text-xs text-sys-muted">
        記録がまだありません
      </div>
    );
  }

  const weights = points.map((p) => p.weight);
  // When a target is set, extend the value range so the dashed reference line
  // is guaranteed to be visible inside the chart even if the user is far from
  // their goal.
  const minW = target !== undefined ? Math.min(...weights, target) : Math.min(...weights);
  const maxW = target !== undefined ? Math.max(...weights, target) : Math.max(...weights);
  const span = Math.max(0.5, maxW - minW);
  const yMin = minW - span * 0.15;
  const yMax = maxW + span * 0.15;
  const yRange = Math.max(0.5, yMax - yMin);

  const chartW = VIEW_W - PAD.left - PAD.right;
  const chartH = VIEW_H - PAD.top - PAD.bottom;

  const xAt = (i: number) =>
    points.length === 1
      ? PAD.left + chartW / 2
      : PAD.left + (i / (points.length - 1)) * chartW;
  const yAt = (w: number) => PAD.top + chartH - ((w - yMin) / yRange) * chartH;

  const linePath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${xAt(i).toFixed(2)} ${yAt(p.weight).toFixed(2)}`)
    .join(' ');

  const areaPath =
    points.length > 1
      ? `${linePath} L ${xAt(points.length - 1).toFixed(2)} ${(PAD.top + chartH).toFixed(2)} L ${xAt(0).toFixed(2)} ${(PAD.top + chartH).toFixed(2)} Z`
      : null;

  // Decide how many X ticks to show — at most ~5 to avoid clutter.
  const tickIndices: number[] = [];
  if (points.length <= 5) {
    points.forEach((_, i) => tickIndices.push(i));
  } else {
    for (let i = 0; i < 5; i++) {
      tickIndices.push(Math.round((i / 4) * (points.length - 1)));
    }
  }

  return (
    <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className="block w-full h-auto" role="img" aria-label="体重推移">
      <defs>
        <linearGradient id="weight-area" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="rgba(0, 212, 255, 0.35)" />
          <stop offset="100%" stopColor="rgba(0, 212, 255, 0)" />
        </linearGradient>
      </defs>

      {/* Horizontal gridlines at min/mid/max */}
      {[yMin, (yMin + yMax) / 2, yMax].map((v, i) => (
        <g key={i}>
          <line
            x1={PAD.left}
            x2={VIEW_W - PAD.right}
            y1={yAt(v)}
            y2={yAt(v)}
            stroke="rgba(95, 201, 255, 0.12)"
            strokeWidth="1"
          />
          <text
            x={PAD.left - 4}
            y={yAt(v) + 3}
            textAnchor="end"
            fontSize="9"
            fill="rgba(170, 200, 230, 0.6)"
            fontFamily="monospace"
          >
            {v.toFixed(1)}
          </text>
        </g>
      ))}

      {/* Filled area under the line */}
      {areaPath && <path d={areaPath} fill="url(#weight-area)" />}

      {/* Target reference line (dashed) — drawn before the data line so the
          line/points clearly sit on top. */}
      {target !== undefined && (
        <g>
          <line
            x1={PAD.left}
            x2={VIEW_W - PAD.right}
            y1={yAt(target)}
            y2={yAt(target)}
            stroke="rgba(255, 207, 86, 0.85)"
            strokeWidth="1.4"
            strokeDasharray="5 4"
          />
          <text
            x={VIEW_W - PAD.right - 4}
            y={yAt(target) - 4}
            textAnchor="end"
            fontSize="9"
            fill="rgba(255, 207, 86, 0.95)"
            fontFamily="monospace"
          >
            目標 {target.toFixed(1)}
          </text>
        </g>
      )}

      {/* Line */}
      <path d={linePath} fill="none" stroke="#5fc9ff" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />

      {/* Points */}
      {points.map((p, i) => (
        <circle
          key={p.id}
          cx={xAt(i)}
          cy={yAt(p.weight)}
          r="2.5"
          fill="#00d4ff"
          stroke="#02040a"
          strokeWidth="1.5"
        />
      ))}

      {/* X axis ticks */}
      {tickIndices.map((i) => (
        <text
          key={i}
          x={xAt(i)}
          y={VIEW_H - 6}
          textAnchor="middle"
          fontSize="9"
          fill="rgba(170, 200, 230, 0.55)"
          fontFamily="monospace"
        >
          {formatTick(points[i].date)}
        </text>
      ))}
    </svg>
  );
}
