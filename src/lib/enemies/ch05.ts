import { makeChapter, mv } from './factory';
import type { EnemyDef } from './types';

// Chapter 5 — つかいすぎ廃坑 (浪費). Lord gimmick: goldScatter.
const c = makeChapter(5);

export const CH05_ENEMIES: EnemyDef[] = [
  c.mob('kozenitori', 'コゼニトリ', 'jin', {
    shape: 'bird',
    moves: [mv.atk(3), mv.debuff(1, 'こぜにを ばらまかせた')],
    lore: '小銭の音に敏感な鳥。財布が軽くなる。',
    loreAfter: '募金箱の呼び込み係に。',
  }),
  c.mob('pochiris', 'ポチリス', 'shin', {
    shape: 'cat',
    moves: [mv.atk(3), mv.debuff(1, '「ポチッ」')],
    lore: '購入ボタンが好きなリス。つい ポチる。',
    loreAfter: '「本当に必要?」と一声かける良心係に。',
  }),
  c.mob('subscrabbit', 'サブスクラビット', 'ma', {
    shape: 'beast',
    moves: [mv.atk(3), mv.buff(1, '毎月 じどう更新!')],
    lore: '毎月ニンジン代を請求してくるウサギ。',
    loreAfter: '本当に使うものだけ勧める良心的プランに。',
  }),
  c.elite('salehyena', 'セールハイエナ', 'go', {
    shape: 'beast',
    moves: [mv.atk(3), mv.charge(2, '「今だけ!」ためている…'), mv.unleash(2.3, '限定 大セール!'), mv.debuff(1, '限定に よわい心')],
    lore: '赤札を見ると走り出すハイエナ。',
    loreAfter: '本当のお買い得だけ教える名バイヤーに。',
    quotes: { open: '今だけ! 半額だよ!' },
  }),
  c.lord('mudazukain', '成金モグラのムダヅカイン', 'go', {
    shape: 'golem',
    gimmick: 'goldScatter',
    moves: [mv.atk(3), mv.gimmick(2, '金貨を ばらまかせた!'), mv.buff(1, '成金 パワー'), mv.p2(3, 1.8, '大盤振る舞い!')],
    lore: '財貨を食らうモグラ。「金は使ってこそ」が口ぐせ。',
    loreAfter: '町の銀行(呼び方だけ)頭取として貯金を布教。',
    quotes: {
      open: 'い〜んだよ、金は 使ってこそ!',
      phase2: 'ぜんぶ つかっちゃえ〜!',
      defeat: '……こつこつ 貯めるのも、ありか。',
    },
  }),
];
