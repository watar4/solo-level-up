import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { CATEGORY_SHORT, type Category } from '../types/question';
import type { CategoryScore } from '../lib/scoring';

/** カテゴリ別正答率の横棒グラフ */
export function CategoryBarChart({ data }: { data: CategoryScore[] }) {
  const rows = data.map((d) => ({
    name: CATEGORY_SHORT[d.category as Category] ?? d.category,
    rate: Math.round(d.rate * 100),
    full: d.category,
  }));
  const color = (rate: number) => (rate >= 80 ? '#16a34a' : rate >= 60 ? '#d97706' : '#dc2626');

  return (
    <ResponsiveContainer width="100%" height={Math.max(140, rows.length * 48)}>
      <BarChart data={rows} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.25} />
        <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} fontSize={12} />
        <YAxis type="category" dataKey="name" width={64} fontSize={12} />
        <Tooltip formatter={(v: number) => [`${v}%`, '正答率']} labelFormatter={(_l, p) => p?.[0]?.payload?.full ?? ''} />
        <Bar dataKey="rate" radius={[0, 6, 6, 0]}>
          {rows.map((r, i) => (
            <Cell key={i} fill={color(r.rate)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export interface TrendPoint {
  label: string;
  rate: number; // 0..100
}

/** 正答率の推移（折れ線） */
export function TrendLineChart({ data }: { data: TrendPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ left: 0, right: 16, top: 8, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
        <XAxis dataKey="label" fontSize={11} />
        <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} fontSize={12} width={40} />
        <Tooltip formatter={(v: number) => [`${v}%`, '正答率']} />
        <Line type="monotone" dataKey="rate" stroke="#1f59db" strokeWidth={2} dot={{ r: 3 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}
