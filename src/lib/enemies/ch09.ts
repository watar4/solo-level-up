import { makeChapter, mv } from './factory';
import type { EnemyDef } from './types';

// Chapter 9 — かがみ山 (自己否定). Lord gimmick: mirror (degrades gracefully).
const c = makeChapter(9);

export const CH09_ENEMIES: EnemyDef[] = [
  c.mob('hikakugarasu', 'ヒカクガラス', 'shin', {
    shape: 'bird',
    moves: [mv.atk(3), mv.debuff(1, '「となりの芝生」')],
    lore: '他人と比べてくるカラス。',
    loreAfter: '「あなたはあなた」と励ます係に。',
  }),
  c.mob('dosemuri', 'ドーセムリ', 'ma', {
    shape: 'slime',
    moves: [mv.atk(3), mv.debuff(1, '「どうせ むり」')],
    lore: '口ぐせが名前になったナメクジ。',
    loreAfter: '「やってみよ」が新しい口ぐせに。',
  }),
  c.mob('damedashi', 'ダメダシバット', 'jin', {
    shape: 'bird',
    moves: [mv.atk(3, 0.6, 'こづき'), mv.atk(2, 0.6, '連続 こづき!')],
    lore: '細かいダメ出しのコウモリ。',
    loreAfter: '細かいイイ出しをする応援係に。',
  }),
  c.elite('hekomi', 'ヘコミアーマー', 'shu', {
    shape: 'golem',
    moves: [mv.atk(3), mv.buff(2, '凹んで かたくなった!')],
    lore: '落ち込むほど硬くなる鎧。攻め急ぐと手強い。',
    loreAfter: '打たれ強い頼れる盾役に。',
    quotes: { open: '……どうせ、また 凹むし。' },
  }),
  c.lord('negamirror', 'うつしのネガミラー', 'ma', {
    shape: 'crystal',
    gimmick: 'mirror',
    moves: [mv.atk(3), mv.gimmick(1, 'あなたの姿を うつした!'), mv.buff(2, '「今日のあなた、イマイチ」'), mv.p2(3, 1.8, 'ネガティブ 全開!')],
    lore: '悪口しか映さない鏡。登る者の駄目な姿を見せる。',
    loreAfter: '「今日のいいとこ」を映す姿見として山小屋に就職。',
    quotes: {
      open: '今日の あなた、なんか イマイチですね。',
      phase2: 'ほら、やっぱり ダメでしょう?',
      defeat: '……案外、悪くない 顔してる。',
    },
  }),
];
