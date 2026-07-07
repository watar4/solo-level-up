import { makeChapter, mv } from './factory';
import type { EnemyDef } from './types';

// Chapter 8 — みっかぼうず湖 (三日坊主). Lord gimmick: triTurnReset.
const c = makeChapter(8);

export const CH08_ENEMIES: EnemyDef[] = [
  c.mob('sannichi', 'サンニチワンコ', 'jin', {
    shape: 'beast',
    moves: [mv.atk(3), mv.debuff(1, '3日で 飽きて にげ腰')],
    lore: '散歩は三日で飽きた犬。',
    loreAfter: '毎日の散歩が習慣になった。えらい。',
  }),
  c.mob('yametokebi', 'ヤメトケビ', 'ma', {
    shape: 'ghost',
    moves: [mv.atk(3), mv.debuff(1, '「やめとけば?」')],
    lore: '火の玉。すぐ消えたがる。',
    loreAfter: '「もう少しだけ」と背中を押す係に。',
  }),
  c.mob('reseton', 'リセットン', 'shu', {
    shape: 'crystal',
    moves: [mv.atk(3), mv.gimmick(1, '白紙に もどそうとした')],
    gimmick: 'triTurnReset',
    lore: '白紙に戻したがるノートの精。',
    loreAfter: '「続きから」を勧める頼れる相棒に。',
  }),
  c.elite('nagedashishi', 'ナゲダシシシ', 'go', {
    shape: 'beast',
    moves: [mv.opening(3, 1.8, '初手 全力!'), mv.atk(3, 0.7, 'なげやり…'), mv.debuff(1, '投げ出し')],
    lore: '三日分の全力を初手に出す獅子。',
    loreAfter: 'ペース配分を覚えた長距離ランナーに。',
    quotes: { open: '最初だけ、本気 出すぞ!' },
  }),
  c.lord('mikkaboze', '湖の主ミッカボーズ', 'shin', {
    shape: 'slime',
    gimmick: 'triTurnReset',
    moves: [mv.atk(3), mv.gimmick(2, 'ぜんぶ「なかったこと」に!'), mv.status(2, 'poison', 0.4, '油断させる やさしさ'), mv.p2(3, 1.6, '「もう じゅうぶんだよ」')],
    lore: '優しいことしか言わない湖の主。3ターンごとに強化も傷もリセットする。継続ダメージと「しるし」だけが積み上がる。',
    loreAfter: '湖の「四日目 応援係」に。続きを見守っている。',
    quotes: {
      open: '三日も つづいたんだよ? もう じゅうぶん。',
      phase2: 'むりしないで。ね?',
      defeat: '……つづきって、あるんだね。',
    },
  }),
];
