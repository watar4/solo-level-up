import { makeChapter, mv } from './factory';
import type { EnemyDef } from './types';

// Chapter 6 — うごかず山 (運動不足). Lord = high-HP break tutorial.
const c = makeChapter(6);

export const CH06_ENEMIES: EnemyDef[] = [
  c.mob('goroneko', 'ゴロネコ', 'shin', {
    shape: 'cat',
    moves: [mv.atk(3), mv.buff(1, 'ごろごろ して みがまえた')],
    lore: '猫は元からこう。ごろごろしている。',
    loreAfter: 'ラジオ体操のあと、またごろごろしている。',
  }),
  c.mob('kotatsumuri', 'コタツムリ', 'shu', {
    shape: 'blob',
    moves: [mv.atk(3), mv.buff(2, 'コタツに こもった!ぼうぎょアップ')],
    lore: '出たら負けだと思っているカタツムリ。',
    loreAfter: '春になり、殻から出て散歩を始めた。',
  }),
  c.mob('daruomoni', 'ダルオモーニ', 'shu', {
    shape: 'golem',
    moves: [mv.atk(3, 1.2, 'おもい いちげき')],
    lore: '体が鉛の日、の鎧。鈍いが一撃は重い。',
    loreAfter: '準備運動を覚えて軽やかになった。',
  }),
  c.elite('sofa', 'ソファーベヒーモス', 'shu', {
    shape: 'golem',
    moves: [mv.atk(3), mv.buff(1, '座り込み!ぼうぎょアップ'), mv.charge(2, 'たちあがろうと している…'), mv.unleash(2.4, '立ち上がり 突進!')],
    lore: '人をダメにするソファの王。',
    loreAfter: 'スタンディングデスク派に転向。',
    quotes: { open: 'あぁ……このまま でいいや……' },
  }),
  c.lord('ugokazaru', '山になった巨人ウゴカザール', 'shu', {
    shape: 'golem',
    breakGauge: 8,
    hpTurns: 20,
    moves: [mv.atk(3, 1.1, 'いわ落とし'), mv.charge(2, 'ゆっくり ふりかぶる…'), mv.unleash(2.6, '地ひびき!'), mv.p2(2, 1.6, '山が うごいた!')],
    lore: '休憩が100年続いた巨人。ブレイクでしか大きく崩せない。',
    loreAfter: '毎朝のラジオ体操の音頭役に(山が体操する絵面)。',
    quotes: {
      open: 'ふぅ……ちょっと 休んで 100年か。',
      phase2: 'よっ……こい……しょ!',
      defeat: 'うごくと、けっこう きもちいいな。',
    },
  }),
];
