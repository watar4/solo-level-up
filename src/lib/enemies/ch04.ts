import { makeChapter, mv } from './factory';
import type { EnemyDef } from './types';

// Chapter 4 — たべすぎ市場 (食). Lord gimmick: buffEater.
const c = makeChapter(4);

export const CH04_ENEMIES: EnemyDef[] = [
  c.mob('tsumamigui', 'ツマミグイ', 'jin', {
    shape: 'ghost',
    moves: [mv.atk(3), mv.debuff(1, 'つまみぐい!ちからを かすめた')],
    lore: '手だけのおばけ。ついつい つまみ食い。',
    loreAfter: '味見係として厨房で大活躍。',
  }),
  c.mob('calorin', 'カロリン', 'shu', {
    shape: 'blob',
    moves: [mv.atk(3, 1.1, 'ころがり たいあたり!')],
    lore: 'まるい。とにかく まるい。倒すとゴールド多め。',
    loreAfter: '転がって配達する名物おまんじゅうに。',
  }),
  c.mob('shimeramen', 'シメラーメン', 'ma', {
    shape: 'slime',
    moves: [mv.atk(3), mv.status(1, 'burn', 0.25, 'あつあつ スープ!')],
    lore: '深夜にだけ湯気が立つ、シメの一杯の化身。',
    loreAfter: '朝ラー専門になり、健全な湯気を上げている。',
  }),
  c.elite('okawari', 'オカワリオオカミ', 'go', {
    shape: 'beast',
    moves: [mv.atk(3), mv.buff(2, 'おかわり!こうげきアップ'), mv.atk(1, 1.4, 'がっつき!')],
    lore: '「おかわり!」しか言わない狼。食べるほど強い。',
    loreAfter: 'よく噛んで食べる大食い王に(健康的)。',
    quotes: { open: 'おかわり! おかわり!' },
  }),
  c.lord('kuishinboa', '大蛇のクイシンボア', 'shu', {
    shape: 'serpent',
    gimmick: 'buffEater',
    moves: [mv.atk(3), mv.gimmick(2, 'バフを ぱくっと 食べた!'), mv.charge(1, 'おおきく くちを あけた…'), mv.unleash(2.4, '丸のみ!'), mv.p2(2, 1.6, '消化 開始!')],
    lore: '市場ごと飲みこんだ大蛇。強化効果を捕食する。',
    loreAfter: '「腹八分」が座右の銘の食堂店主に。',
    quotes: {
      open: 'いただきま〜す。きみも デザートかな?',
      phase2: 'うぷっ……まだ 入るぞ!',
      defeat: 'ごちそうさま……たべすぎた……',
    },
  }),
];
