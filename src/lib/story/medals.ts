// Habit Medals (しゅうかんメダル) — docs/redesign/02-story.md (§1, §3) and
// 03-battle-system.md §8-4. Twelve medals, one per chapter lord, each granting
// a small permanent passive so story progress also feeds character growth.

export type MedalId =
  | 'hayaoki'   // はやおき  (ch1)
  | 'kyouyaru'  // きょうやる (ch2)
  | 'shuuchuu'  // しゅうちゅう (ch3)
  | 'harahachi' // はらはちぶ (ch4)
  | 'kotsukotsu'// こつこつ  (ch5)
  | 'undou'     // うんどう  (ch6)
  | 'oyasumi'   // おやすみ  (ch7)
  | 'yokkame'   // よっかめ  (ch8)
  | 'homeru'    // じぶんをほめる (ch9)
  | 'bochibochi'// ぼちぼち  (ch10)
  | 'ippozutsu' // いっぽずつ (ch11)
  | 'tsuzuketa';// つづけた  (ch12 — awarded for the player's own year)

// Passive effect kinds. Values are small on purpose; the engine reads these
// when computing quest EXP, extraction odds, shop prices, etc.
export type MedalPassive =
  | { kind: 'morningQuestExp'; pct: number }
  | { kind: 'todayQuestExp'; pct: number }
  | { kind: 'focusBonusExp'; pct: number }
  | { kind: 'mealStreakExp'; pct: number }
  | { kind: 'goldGain'; pct: number }
  | { kind: 'maxHp'; pct: number }
  | { kind: 'nightQuestExp'; pct: number }
  | { kind: 'streakCapBonus'; add: number }
  | { kind: 'critChance'; add: number }
  | { kind: 'burnResist'; pct: number }
  | { kind: 'extractionOdds'; add: number }
  | { kind: 'allExp'; pct: number };

export interface MedalDef {
  id: MedalId;
  chapter: number;
  jp: string;          // medal name
  desc: string;        // one-line passive description
  passive: MedalPassive;
}

export const MEDALS: MedalDef[] = [
  { id: 'hayaoki', chapter: 1, jp: 'はやおきメダル', desc: '午前中のクエストEXP +5%', passive: { kind: 'morningQuestExp', pct: 0.05 } },
  { id: 'kyouyaru', chapter: 2, jp: 'きょうやるメダル', desc: 'デイリークエストEXP +4%', passive: { kind: 'todayQuestExp', pct: 0.04 } },
  { id: 'shuuchuu', chapter: 3, jp: 'しゅうちゅうメダル', desc: 'フォーカスゲート達成日のEXP +6%', passive: { kind: 'focusBonusExp', pct: 0.06 } },
  { id: 'harahachi', chapter: 4, jp: 'はらはちぶメダル', desc: '食事記録した日のEXP +5%', passive: { kind: 'mealStreakExp', pct: 0.05 } },
  { id: 'kotsukotsu', chapter: 5, jp: 'こつこつメダル', desc: '獲得ゴールド +8%', passive: { kind: 'goldGain', pct: 0.08 } },
  { id: 'undou', chapter: 6, jp: 'うんどうメダル', desc: '最大HP +5%', passive: { kind: 'maxHp', pct: 0.05 } },
  { id: 'oyasumi', chapter: 7, jp: 'おやすみメダル', desc: '夜のクエストEXP +5%', passive: { kind: 'nightQuestExp', pct: 0.05 } },
  { id: 'yokkame', chapter: 8, jp: 'よっかめメダル', desc: 'ストリーク補正の上限 +0.2倍', passive: { kind: 'streakCapBonus', add: 0.2 } },
  { id: 'homeru', chapter: 9, jp: 'じぶんをほめるメダル', desc: '会心率 +3%', passive: { kind: 'critChance', add: 0.03 } },
  { id: 'bochibochi', chapter: 10, jp: 'ぼちぼちメダル', desc: 'やけどダメージ -30%', passive: { kind: 'burnResist', pct: 0.30 } },
  { id: 'ippozutsu', chapter: 11, jp: 'いっぽずつメダル', desc: '影の抽出成功率 +5%', passive: { kind: 'extractionOdds', add: 0.05 } },
  { id: 'tsuzuketa', chapter: 12, jp: 'つづけたメダル', desc: '全EXP +10%', passive: { kind: 'allExp', pct: 0.10 } },
];

export const MEDAL_BY_ID: Record<MedalId, MedalDef> = Object.fromEntries(
  MEDALS.map((m) => [m.id, m])
) as Record<MedalId, MedalDef>;

export const MEDAL_BY_CHAPTER: Record<number, MedalDef> = Object.fromEntries(
  MEDALS.map((m) => [m.chapter, m])
);

// Sum a specific passive's magnitude across the player's owned medals. Unknown
// ids are ignored so a corrupt save never throws.
export function sumMedalPassive(
  owned: MedalId[],
  kind: MedalPassive['kind']
): number {
  let total = 0;
  for (const id of owned) {
    const def = MEDAL_BY_ID[id];
    if (!def || def.passive.kind !== kind) continue;
    const p = def.passive as Extract<MedalPassive, { kind: typeof kind }>;
    total += 'pct' in p ? p.pct : p.add;
  }
  return total;
}
