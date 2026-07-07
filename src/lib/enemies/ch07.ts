import { makeChapter, mv } from './factory';
import type { EnemyDef } from './types';

// Chapter 7 — よふかしの森 (夜更かし). Lord gimmick: darkening.
const c = makeChapter(7);

export const CH07_ENEMIES: EnemyDef[] = [
  c.mob('yonakidori', 'ヨナキドリ', 'jin', {
    shape: 'bird',
    moves: [mv.atk(3), mv.debuff(1, 'よなき!ATBダウン')],
    lore: '夜中に元気になる鳥。',
    loreAfter: '朝いちの目覚まし合唱団に加入。',
  }),
  c.mob('bluelight', 'ブルーライトフライ', 'ma', {
    shape: 'bug',
    moves: [mv.atk(3), mv.buff(1, '発光!かたくなった'), mv.debuff(1, 'まぶしくて 命中ダウン')],
    lore: '画面の光に集まる蛾。',
    loreAfter: '夜は自ら暗くなる、やさしい常夜灯に。',
  }),
  c.mob('mouiwwa', 'モウイッワ', 'shin', {
    shape: 'ghost',
    moves: [mv.atk(3), mv.buff(1, '「もう一話!」')],
    lore: '次回予告の妖精。「もう一話」で夜を延ばす。',
    loreAfter: '「続きは明日」を勧める良心予告係に。',
  }),
  c.elite('tsuzukimi', '真夜中の映写機ツヅキミー', 'ma', {
    shape: 'golem',
    moves: [mv.atk(3), mv.buff(1, '挑発!'), mv.charge(2, '一挙放送 準備中…'), mv.unleash(2.3, 'イッキ見 上映!')],
    lore: '眠らせない装置。「続きが気になる」で釘付けにする。',
    loreAfter: '「そろそろ寝よう」と促す親切映写機に。',
    quotes: { open: 'つづきが、きになるでしょ?' },
  }),
  c.lord('yofukashi', '夜ふかしフクロウ ヨフカシー', 'shin', {
    shape: 'bird',
    gimmick: 'darkening',
    moves: [mv.atk(3), mv.gimmick(2, 'あたりが くらくなってきた…'), mv.buff(1, '「まだ宵の口」回復'), mv.p2(3, 1.7, '真夜中モード!')],
    lore: '「夜はこれからっしょ」と森の時間を止めるフクロウ。',
    loreAfter: '森の消灯係として、みんなを寝かしつける。',
    quotes: {
      open: '夜は これからっしょ〜',
      phase2: 'まだまだ! よは ながい!',
      defeat: '……たまには、はやね も いいな。',
    },
  }),
];
