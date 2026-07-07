import { makeChapter, mv } from './factory';
import type { EnemyDef } from './types';

// Chapter 12 — グーたら城 (最終章). Lord gimmick: uiSleep (degrades gracefully).
const c = makeChapter(12);

export const CH12_ENEMIES: EnemyDef[] = [
  c.mob('makurahei', 'マクラヘイ', 'shu', {
    shape: 'golem',
    moves: [mv.atk(3), mv.status(1, 'sleep', 0.25, '枕投げ!')],
    lore: '城の衛兵(寝ている)。',
    loreAfter: '目を覚まし、真面目な門番に。',
  }),
  c.mob('oftoner', 'オフトナー', 'shu', {
    shape: 'ghost',
    moves: [mv.atk(3), mv.debuff(1, 'ふとんを かぶせた')],
    lore: 'ふとんの騎士。包み込んで動きを止める。',
    loreAfter: '寝具店の看板騎士に。',
  }),
  c.mob('yumemaboroshi', 'ユメマボロシ', 'ma', {
    shape: 'ghost',
    moves: [mv.atk(3), mv.status(1, 'burn', 0.2, '悪夢の かけら'), mv.debuff(1, 'まどろみ')],
    lore: '城に溜まった夢のかけら。各地の技をまねる。',
    loreAfter: '良い夢を配る夢の使いに。',
  }),
  c.elite('nebosukerion', 'ネボスケリオン', 'go', {
    shape: 'beast',
    moves: [mv.atk(3), mv.atk(2, 1.0, '寝たまま 尻尾!'), mv.p2(3, 1.5, '起きて 2回行動!')],
    lore: '魔王の飼い猫(巨大)。起きると2回動く。',
    loreAfter: '城の番猫として昼寝を再開(平和)。',
    quotes: { open: 'ぐるる……(寝てる)' },
  }),
  c.lord('gutara', 'サボり魔王グータラ', 'go', {
    shape: 'golem',
    gimmick: 'uiSleep',
    hpTurns: 22,
    breakGauge: 7,
    moves: [mv.atk(3), mv.gimmick(2, 'あくびが うつる…画面が zzz'), mv.charge(2, 'おおきく のびを している…'), mv.unleash(2.6, '百年の あくび!'), mv.p2(3, 1.9, '……はっ、起きた!本気!')],
    lore: '百年寝ていた初代ハンター。「もう頑張らなくていい」と囁く虚無の王。',
    loreAfter: 'ギルド食堂で伝説のパン焼き係に就職。よく寝てよく働く。',
    quotes: {
      open: 'きみもさ、もう 寝ちゃいなよ……',
      phase2: 'んん……しかたない。ちょっとだけ、本気 出すか。',
      defeat: 'あー…… よく寝た! ……さて、なにか するか。',
    },
  }),
];
