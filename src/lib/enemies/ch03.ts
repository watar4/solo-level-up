import { makeChapter, mv } from './factory';
import type { EnemyDef } from './types';

// Chapter 3 — ピコピコ峡谷 (通知・散漫).
const c = makeChapter(3);

export const CH03_ENEMIES: EnemyDef[] = [
  c.mob('picon', 'ピコン', 'jin', {
    shape: 'bug',
    moves: [mv.atk(3, 0.9), mv.debuff(1, 'ピコン!ちゅういを そらした')],
    lore: '通知音の羽虫。1匹は弱いが気が散る。',
    loreAfter: '「大事なときだけ」鳴く伝書虫に。',
  }),
  c.mob('vibra', 'バイブラ', 'jin', {
    shape: 'bird',
    moves: [mv.atk(3), mv.status(1, 'paralyze', 0.3, 'ぶるっと しびれさせた!')],
    lore: 'マナーモードのコウモリ。震動で痺れさせる。',
    loreAfter: '目覚まし振動係として一躍人気に。',
  }),
  c.mob('akabadge', 'アカバッジ', 'go', {
    shape: 'crystal',
    moves: [mv.atk(3), mv.buff(1, '未読が たまって こうげきアップ!')],
    lore: '「未読①」の精。数字が増えるほど気になる。',
    loreAfter: '既読をつける喜びを覚え、静かになった。',
  }),
  c.elite('scrollworm', 'スクロールワーム', 'ma', {
    shape: 'serpent',
    moves: [mv.atk(3), mv.charge(2, 'むげんスクロール 準備中…'), mv.unleash(2.3, '一挙 表示!')],
    lore: '無限スクロールのミミズ。終わりが見えない。',
    loreAfter: '「ここまで読んだ」しおり係に。',
    quotes: { open: 'まだ つづきが あるよ…' },
  }),
  c.lord('picorn', '通知の主ピコーン', 'jin', {
    shape: 'bug',
    gimmick: 'fakeNotification',
    moves: [mv.atk(3), mv.gimmick(2, 'にせの通知を ばらまいた!'), mv.debuff(1, 'ピコピコ 連打'), mv.p2(3, 1.7, '通知ラッシュ!')],
    lore: '百眼の蟲の群れの主。偽の通知で気を散らす。',
    loreAfter: '本当に大事な知らせだけを届ける伝書係に。',
    quotes: {
      open: 'ピコン! ピコン! みてみて!',
      phase2: 'まだまだ おしらせ あるよ〜!',
      defeat: '……大事な話って、年に 1回 くらいか。',
    },
  }),
];
