import { makeChapter, mv } from './factory';
import type { EnemyDef } from './types';

// Chapter 11 — しーんの雪原 (無気力). Lord gimmick: nullify.
const c = makeChapter(11);

export const CH11_ENEMIES: EnemyDef[] = [
  c.mob('shirakedori', 'シラケドリ', 'shin', {
    shape: 'bird',
    moves: [mv.atk(3), mv.debuff(1, '「しらー」会心率ダウン')],
    lore: '盛り上がりを吸う鳥。',
    loreAfter: '場を盛り上げる名司会に転身。',
  }),
  c.mob('tameikey', 'タメイキー', 'ma', {
    shape: 'ghost',
    moves: [mv.atk(3), mv.debuff(1, 'ため息!ATBダウン')],
    lore: 'ため息が凍って生まれたダラモン。',
    loreAfter: '深呼吸を教える健康係に。',
  }),
  c.mob('bonyarin', 'ボンヤリン', 'shu', {
    shape: 'slime',
    moves: [mv.atk(3), mv.buff(1, '霧化!物理を すかす')],
    lore: '頭にかかる霧そのもの。',
    loreAfter: '晴れ渡り、見通しのよい案内係に。',
  }),
  c.elite('shizukanight', '静寂の門番シズカナイト', 'shu', {
    shape: 'golem',
    moves: [mv.atk(3), mv.buff(1, '無言の構え(カウンター)'), mv.charge(2, '……'), mv.unleash(2.4, '沈黙 斬り!')],
    lore: 'しゃべらない騎士。予告なく斬りかかる。',
    loreAfter: '静かに見守る頼れる門番に。',
    quotes: { open: '……' },
  }),
  c.lord('mukiryokurage', 'ふわふわのムキリョクラゲ', 'ma', {
    shape: 'blob',
    gimmick: 'nullify',
    moves: [mv.gimmick(3, '「いみない」と 力を けした'), mv.atk(2, 0.8), mv.p2(3, 1.5, '「……ほんとに、いみ ある?」')],
    lore: '攻撃してこない。毎ターン、力を「意味がない」と消していく。集めたメダルが打ち破る。',
    loreAfter: '温泉の湯もみ係に。「いみ、あった」が口ぐせ。',
    quotes: {
      open: 'がんばっても、いみ なくない?',
      phase2: '……ほんとに、つづける いみ、ある?',
      defeat: '……いみ、あったんだ。',
    },
  }),
];
