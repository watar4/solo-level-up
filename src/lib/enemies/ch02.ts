import { makeChapter, mv } from './factory';
import type { EnemyDef } from './types';

// Chapter 2 — あしたやる沼 (先延ばし). Roster: 06-boss-design.md §3.
const c = makeChapter(2);

export const CH02_ENEMIES: EnemyDef[] = [
  c.mob('aterdemon', 'アトデーモン', 'ma', {
    shape: 'ghost',
    moves: [mv.atk(3), mv.debuff(1, '「あとでいいよ」と ささやいた')],
    lore: '小悪魔。悪気はないが、なんでも後回しにさせる。',
    loreAfter: '「いま やろう」係に転職。まだ半分 後回し。',
  }),
  c.mob('kamendokusa', 'カメンドクサ', 'shu', {
    shape: 'beast',
    moves: [mv.atk(3), mv.buff(1, 'こうらに こもった!')],
    lore: 'めんどうくさがりの亀。甲羅からなかなか出ない。',
    loreAfter: '甲羅を脱いで日光浴を始めた。えらい。',
  }),
  c.mob('nobinobin', 'ノビノビン', 'jin', {
    shape: 'slime',
    moves: [mv.atk(3, 0.8), mv.atk(1, 1.3, 'のびて 2回 こうげき!')],
    lore: '「のびのび」が服を着たようなダラモン。よく伸びる。',
    loreAfter: 'ストレッチ教室の講師に。伸びしろが本業に。',
  }),
  c.elite('guzuguzu', '沼の番人グズグズ', 'shu', {
    shape: 'golem',
    moves: [mv.atk(3), mv.debuff(1, 'どろはね!めいちゅうダウン'), mv.charge(2, 'おもい こしを あげている…'), mv.unleash(2.2, 'よっこいしょ突進!')],
    lore: '腰を上げるのに3ターンかかる泥の番人。',
    loreAfter: '朝いちで動けるようになり、沼の掃除係に。',
    quotes: { open: '…いま、たちあがる…から…', defeat: 'うごくと、けっこう すっきり するな…' },
  }),
  c.lord('ashitabake', 'のばしのばしのアシタバケ', 'shin', {
    shape: 'ghost',
    moves: [mv.atk(3), mv.buff(2, '「本気は明日」と ためこむ'), mv.debuff(1, 'めくらましの きり'), mv.p2(3, 1.9, 'あしたから 本気だ!!')],
    lore: '「明日から本気出す」おばけ。逃げ回り、時間で強くなる。',
    loreAfter: '「きょうやるリスト」を配って歩く世話焼きに改心。',
    quotes: {
      open: 'あしたの ほうが 本気 だせるって〜',
      phase2: '……しかたない。ちょっとだけ 本気!',
      defeat: 'きょう やるのも……わるくないか。',
    },
  }),
];
