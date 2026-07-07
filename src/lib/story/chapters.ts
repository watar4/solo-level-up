// Chapter metadata & unlock gates — docs/redesign/02-story.md §3, §6.
// The twin-gate (level AND a continuity condition) is what stretches the
// campaign across ~1 real year: continuity conditions can only be met in real
// time, so no amount of grinding shortcuts them.

import type { MedalId } from './medals';

// A single continuity requirement. The "either" pair on a chapter is satisfied
// when ANY one of its two conditions holds (feature-light players are never
// blocked by a feature they don't use).
export type GateCond =
  | { kind: 'totalQuests'; count: number }
  | { kind: 'streak'; days: number }
  | { kind: 'weeklyQuests'; count: number }
  | { kind: 'focusGate'; count: number }
  | { kind: 'mealDays'; days: number }
  | { kind: 'savingsWeeks'; weeks: number }
  | { kind: 'weightDays'; days: number }
  | { kind: 'achievements'; count: number }
  | { kind: 'medals'; count: number };

export interface ChapterGate {
  level: number;
  // null for the tutorial chapter (always open). Otherwise: satisfy either.
  either: [GateCond, GateCond] | null;
}

export interface ChapterDef {
  id: number;
  title: string;
  region: string;      // place name
  theme: string;       // habit theme, one line
  lordId: string;      // EnemyDef id of the chapter lord
  medalId: MedalId;
  gate: ChapterGate;
  recommendedLevel: number;
}

export const CHAPTERS: ChapterDef[] = [
  { id: 1, title: 'おはよう平原', region: 'おはよう平原', theme: '起きること', lordId: 'suyarin', medalId: 'hayaoki',
    gate: { level: 1, either: null }, recommendedLevel: 2 },
  { id: 2, title: 'あしたやる沼', region: 'あしたやる沼', theme: '先延ばし', lordId: 'ashitabake', medalId: 'kyouyaru',
    gate: { level: 5, either: [{ kind: 'totalQuests', count: 15 }, { kind: 'streak', days: 3 }] }, recommendedLevel: 6 },
  // NOTE: docs 02 §6 originally listed "フォーカスゲート5回" as ch3's alternate,
  // but focus-gate usage has no per-day history (the gate doc stores only
  // today's state), so the condition could never be evaluated. Replaced with a
  // cumulative-quests alternate between ch2's 15 and ch4's 60.
  { id: 3, title: 'ピコピコ峡谷', region: 'ピコピコ峡谷', theme: '通知・散漫', lordId: 'picorn', medalId: 'shuuchuu',
    gate: { level: 9, either: [{ kind: 'streak', days: 7 }, { kind: 'totalQuests', count: 40 }] }, recommendedLevel: 10 },
  { id: 4, title: 'たべすぎ市場', region: 'たべすぎ市場', theme: '食', lordId: 'kuishinboa', medalId: 'harahachi',
    gate: { level: 14, either: [{ kind: 'totalQuests', count: 60 }, { kind: 'mealDays', days: 7 }] }, recommendedLevel: 15 },
  { id: 5, title: 'つかいすぎ廃坑', region: 'つかいすぎ廃坑', theme: '浪費', lordId: 'mudazukain', medalId: 'kotsukotsu',
    gate: { level: 19, either: [{ kind: 'totalQuests', count: 100 }, { kind: 'savingsWeeks', weeks: 4 }] }, recommendedLevel: 20 },
  { id: 6, title: 'うごかず山', region: 'うごかず山', theme: '運動不足', lordId: 'ugokazaru', medalId: 'undou',
    gate: { level: 24, either: [{ kind: 'streak', days: 14 }, { kind: 'weightDays', days: 14 }] }, recommendedLevel: 25 },
  { id: 7, title: 'よふかしの森', region: 'よふかしの森', theme: '夜更かし', lordId: 'yofukashi', medalId: 'oyasumi',
    gate: { level: 29, either: [{ kind: 'totalQuests', count: 200 }, { kind: 'weeklyQuests', count: 8 }] }, recommendedLevel: 30 },
  { id: 8, title: 'みっかぼうず湖', region: 'みっかぼうず湖', theme: '三日坊主', lordId: 'mikkaboze', medalId: 'yokkame',
    gate: { level: 34, either: [{ kind: 'streak', days: 30 }, { kind: 'totalQuests', count: 280 }] }, recommendedLevel: 35 },
  { id: 9, title: 'かがみ山', region: 'かがみ山', theme: '自己否定', lordId: 'negamirror', medalId: 'homeru',
    gate: { level: 39, either: [{ kind: 'achievements', count: 20 }, { kind: 'totalQuests', count: 360 }] }, recommendedLevel: 40 },
  { id: 10, title: 'もえつき火山', region: 'もえつき火山', theme: '燃え尽き', lordId: 'moetsuki', medalId: 'bochibochi',
    gate: { level: 44, either: [{ kind: 'totalQuests', count: 450 }, { kind: 'streak', days: 45 }] }, recommendedLevel: 45 },
  { id: 11, title: 'しーんの雪原', region: 'しーんの雪原', theme: '無気力', lordId: 'mukiryokurage', medalId: 'ippozutsu',
    gate: { level: 49, either: [{ kind: 'totalQuests', count: 550 }, { kind: 'achievements', count: 30 }] }, recommendedLevel: 50 },
  { id: 12, title: 'グーたら城', region: 'グーたら城', theme: '「もうがんばらなくていい」', lordId: 'gutara', medalId: 'tsuzuketa',
    gate: { level: 54, either: [{ kind: 'medals', count: 11 }, { kind: 'totalQuests', count: 650 }] }, recommendedLevel: 55 },
];

export const CHAPTER_BY_ID: Record<number, ChapterDef> = Object.fromEntries(
  CHAPTERS.map((c) => [c.id, c])
);

export const FINAL_CHAPTER = 12;
