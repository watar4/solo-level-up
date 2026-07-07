import { makeChapter, mv } from './factory';
import type { EnemyDef } from './types';

// Chapter 10 — もえつき火山 (燃え尽き). Lord gimmick: selfBurn.
const c = makeChapter(10);

export const CH10_ENEMIES: EnemyDef[] = [
  c.mob('harikiribachi', 'ハリキリバチ', 'jin', {
    shape: 'bug',
    moves: [mv.opening(3, 1.7, '初手 超火力!'), mv.atk(3, 0.6, '失速…')],
    lore: '初日に全力を出す蜂。すぐ息切れする。',
    loreAfter: 'ペース配分を覚え、皆勤の働き者に。',
  }),
  c.mob('moekasu', 'モエカス', 'ma', {
    shape: 'ghost',
    moves: [mv.atk(3), mv.status(1, 'burn', 0.3, 'くすぶり やけど!')],
    lore: '燃えかすの精。倒しても小さく再燃する。',
    loreAfter: '暖炉の種火として重宝されている。',
  }),
  c.mob('ikkiniyaru', 'イッキニヤルゾウ', 'go', {
    shape: 'beast',
    moves: [mv.charge(2, '一気に やる準備…'), mv.unleash(2.2, '3連撃!'), mv.atk(2)],
    lore: '計画性のない象。ためて一気にやる。',
    loreAfter: '小分けにやる計画派の象に。',
  }),
  c.elite('fullkain', 'フルパワーカイン', 'go', {
    shape: 'beast',
    moves: [mv.opening(4, 2.0, '全力 全開!!'), mv.atk(3, 0.6, 'はぁ…はぁ…息切れ'), mv.debuff(1, 'やけくそ')],
    lore: 'ライバル、近道の果て。開幕は強いが息切れする。',
    loreAfter: 'ギルドで一から鍛錬をやり直している。',
    quotes: { open: '努力? そんなの 効率わるいだろ!', defeat: '……近道、ぜんぶ 行き止まりだったわ。' },
  }),
  c.lord('moetsuki', '灰のドラゴン モエツキー', 'go', {
    shape: 'serpent',
    gimmick: 'selfBurn',
    moves: [mv.atk(3), mv.gimmick(2, 'みをこがして 力に した!'), mv.charge(2, '全てを 燃やそうと している…'), mv.unleash(2.6, '業火!'), mv.p2(2, 1.6, '残り火の あがき')],
    lore: '全力を出しすぎて灰になった竜。自分のHPを燃やして戦う。',
    loreAfter: '窯焼きパン屋の火力担当に(適材適所)。',
    quotes: {
      open: '一気に、ぜんぶ、燃やしつくす!',
      phase2: 'まだ……燃えられる……!',
      defeat: 'ぼちぼち、が いちばん 長つづき するんだな。',
    },
  }),
];
