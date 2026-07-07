# 07. 実装ガイド(Opus 向け)

> ここが**実装の起点**。仕様の正は各分冊(02〜06)にあり、本章は「どう作るか」だけを扱う。
> 原則:**既存の資産(ATB・影・経済・PixelArt・Firestore 購読)を壊さず、その上に載せる。**

---

## 1. 新規ディレクトリ構成

```
src/
  lib/
    battle/
      engine.ts        # 純粋関数のバトルエンジン(§3)。UI非依存
      actions.ts       # コマンド→エンジン入力の変換
      status.ts        # 状態異常6種の定義と tick 処理
      break.ts         # ブレイクゲージ計算
      will.ts          # 戦意の獲得・消費・上限(§4 スキーマ)
    story/
      chapters.ts      # 12章のメタ定義(解放条件・ノード構成・報酬)
      chapterGate.ts   # 章解放条件の判定(02 §6 の表を実装)
      medals.ts        # メダル12種と恒久パッシブ
      dialogue/        # 章ごとの会話データ(ch01.ts 〜 ch12.ts)
    enemies/
      types.ts         # EnemyDef / BossBehavior / EnemySprite(§2)
      ch01.ts 〜 ch12.ts  # 各章5体のデータ+スプライト
      corridor.ts      # 無限回廊(既存 BOSSES 7体をここへ移設)
    jobs.ts            # 職業・転職ツリー・信条(05)
    cosmetics.ts       # 衣装データ(05 §3)
  components/
    scenes/            # WorldMapScene / RegionMapScene / BattleScene
    battle/            # EnemyStage / PartyStrip / CommandDeck / LogTicker / FxOverlay / ResultScreen
    story/             # StoryDialog / MedalCase
```

## 2. 中核の型定義(たたき台)

```ts
// lib/enemies/types.ts
export type Element = 'go' | 'jin' | 'ma' | 'shu' | 'shin'; // 剛迅魔守心(03 §4)
export type EnemyTier = 'mob' | 'elite' | 'lord' | 'king';

export interface EnemySprite {
  size: 16 | 24 | 32;
  frames: string[][];            // フレーム毎の文字グリッド(idle 2枚が基本)
  palette: Record<string, string>;
  phase2Palette?: Record<string, string>; // 幹部のフェーズ2差し替え(06 §2)
}

export interface EnemyMove {
  id: string;
  kind: 'attack' | 'charge' | 'unleash' | 'buff' | 'debuff' | 'status' | 'summon' | 'gimmick';
  power?: number;                // 攻撃倍率
  status?: StatusId; statusChance?: number;
  weight: number;                // 重み抽選
  condition?: 'hpBelow50' | 'phase2' | 'everyNTurns' | 'opening'; // 条件付き行動
  n?: number;
  log: string;                   // かな書きログ(「ちからを ためている!」)
}

export interface EnemyDef {
  id: string; name: string; tier: EnemyTier;
  element: Element;              // 弱点は五行サイクルから導出(03 §4)
  chapter: number;
  hpTurns: number;               // 「想定火力の何ターン分か」で指定(03 §8-3)。実HPはエンジンが算出
  breakGauge: number;
  moves: EnemyMove[];            // 行動スクリプト。エンジン側に個体 if 文を書かない(06 §5)
  gimmick?: 'fakeNotification' | 'buffEater' | 'triTurnReset' | 'mirror' | 'selfBurn'
          | 'darkening' | 'nullify' | 'goldScatter' | 'uiSleep'; // フック(実装は engine 内の gimmick モジュール)
  lore: string; loreAfter: string; // 図鑑用:ロア/改心後の近況(06 §4)
  battleQuotes?: { open?: string; phase2?: string; defeat?: string };
}
```

```ts
// lib/story/chapters.ts
export interface ChapterDef {
  id: number; title: string; medalId: string;
  gate: { level: number; either: [GateCond, GateCond] | null }; // 02 §6
  nodes: RegionNode[];
  recommendedLevel: number;
}
export type GateCond =
  | { kind: 'totalQuests'; count: number }
  | { kind: 'streak'; days: number }
  | { kind: 'featureUse'; feature: 'focusGate' | 'meal' | 'savings' | 'weight' | 'weeklyQuest' | 'achievements' | 'medals'; count: number };

export type RegionNode =
  | { kind: 'battle'; enemies: string[] }        // EnemyDef id
  | { kind: 'elite' | 'lord'; enemy: string }
  | { kind: 'event'; dialogueId: string }
  | { kind: 'treasure'; table: string }
  | { kind: 'rest' };
```

```ts
// lib/story/dialogue/ch0X.ts — 会話データ(04 §6)
export interface DialogueLine {
  speaker: 'aria' | 'balgas' | 'kain' | 'merle' | 'enemy' | 'narration';
  text: string;
  window?: 'system' | 'dq';      // アリアのみ system(SystemWindow 様式)
}
```

## 3. バトルエンジンの抽出(最重要リファクタ)

現行 `DailyBossPanel.tsx` は UI・ATB tick・ダメージ計算・報酬処理が1ファイルに同居(1,678行)。これを**「状態+入力→新状態+イベント列」の純粋 reducer** に抽出する:

```ts
// lib/battle/engine.ts
export function tick(state: BattleState, dtMs: number): BattleState;        // ATBゲージ進行のみ
export function act(state: BattleState, input: BattleInput): BattleStepResult;
export interface BattleStepResult {
  state: BattleState;
  events: BattleEvent[];  // {type:'damage', amount, crit, weak} | {type:'log', text} | {type:'break'} | {type:'phase2'} | ...
}
```

- **UI(BattleScene)は events を順に再生するだけ**にする。演出(04 §4)とロジックが分離され、テストが書ける。
- 数式は現行 `boss.ts` の `computePlayerAttack` / `computeBossAttack` / ATB定数をベースに移植(01 §4 の再利用方針)。
- 移行手順:①engine を新設し既存数式を移植+ユニットテスト → ②BattleScene を新規で組む → ③旧 `DailyBossPanel` を無限回廊入口ごと差し替え → ④削除。**旧パネルを直しながら使い回そうとしないこと**(密結合のため二度手間になる)。

## 4. Firestore スキーマ追加

既存の user doc / サブコレクションに追加(`firestore.rules` は uid 所有権ルールをそのまま適用):

```
users/{uid}/progress/story        # 新規 doc
  chapter: number                 # 挑戦中の章
  clearedNodes: { [chapterId]: number[] }
  medals: string[]                # 獲得メダルid
  defeatedEnemies: string[]       # 図鑑解放用
  dialogueSeen: string[]
users/{uid}/progress/will         # 戦意
  stock: number                   # 0..3
  earnedToday: number             # 日次上限判定
  date: string                    # YYYY-MM-DD(日付変わりでリセット)
users/{uid}                       # 既存 doc に追加フィールド
  job: { base, tier2?, tier3? }   # 転職(05 §2)
  creed: string                   # 信条(05 §1 STEP3)
  appearance: { skin, hair, hairColor, eyes, eyeColor, outfit, accessory, primary, accent }
  cosmetics: string[]             # 所持衣装
```

- 戦意の獲得は既存 `completeQuest`(`useGameData.ts:375`)のトランザクション内に +1 を追加(上限判定込み)。**クエスト取り消し(リファンド)時は戦意を戻さない**(悪用防止、仕様として明記)。
- 章解放判定(`chapterGate.ts`)は保存済みデータ(completedDates 総和・streak・実績数)から都度導出。**判定結果をキャッシュ保存しない**(改竄面・整合面で導出が安全)。

## 5. レベル曲線改定の適用

- `leveling.ts:5` を `expForLevel(L) = floor(45 * L**1.40 + 55)` に変更(根拠:`03` §8-2)。
- `totalExp` 単一情報源方式(`leveling.ts:51`)のため、デプロイ後の初回ロードで自動的に新レベルへ再計算される。**上振れ分のステータスポイント付与**は既存のポイント逆算ロジックで整合することをテストで確認。

## 6. 既存ユーザーのデータ移行

初回起動時に1回だけ走るマイグレーション(user doc にバージョンフラグ):

| 既存データ | 移行先 |
|---|---|
| `bossesDefeated`(タワー到達) | 無限回廊の初期到達層としてそのまま継承。**加えて** `bossesDefeated >= 5` なら1章、`>= 15` なら2章までクリア済みで開始(古参を退屈させない) |
| クラス(見た目のみ) | 同名職業として `job.base` に設定+成長ボーナスを現レベル分**遡及付与**(05 §1) |
| 16×16 アバター | 24×24 のデフォルト組み合わせ(職業初期服+旧主色/差し色)に変換。初回に「見た目を作り直せます」の案内 |
| 装備武器・影・スキル・ゴールド | 無変更 |
| 実績・ストリーク・completedDates | 無変更(章解放条件の判定にそのまま使われる) |

## 7. 実装ロードマップ(5フェーズ)

| フェーズ | 内容 | 完了条件 |
|---|---|---|
| **P1 基盤** | バトルエンジン抽出(§3)+状態異常・ブレイク・奥義・作戦+ユニットテスト。レベル曲線改定(§5) | 旧パネルと同等の戦闘が新エンジンで動き、テストが通る |
| **P2 縦切り1章** | 戦意(§4)+WorldMap/RegionMap/BattleScene/StoryDialog+**第1章を通しで遊べる**(スヤリンまで) | 新規ユーザーが「作成→1章クリア→メダル」を体験できる |
| **P3 キャラクリv2** | 4ステップウィザード+24×24パーツスプライト+職業差別化+信条+移行(§6) | 新旧ユーザーとも新アバター・職業で遊べる |
| **P4 コンテンツ量産** | 2〜12章のデータ(敵60体・会話・スプライト)+転職+衣装+図鑑改装+無限回廊 | 全章がデータ上到達可能。12章まで通し確認 |
| **P5 仕上げ** | バランス調整(03 §8 の設計値と実測の突き合わせ)+演出磨き+実績・称号追加+ED実装 | 想定プレイモデルで各章の所要日数が 02 §6 の表に収まる |

- P2 の「縦切り(vertical slice)」を最優先すること。**1章ぶんが面白ければ残りはデータ量産**、面白くなければ設計に戻る、の判断点になる。
- P4 のスプライト60体は `06` §2 の規格に従えば機械的に量産できる。章単位で PR を分けること。

## 8. テスト観点(最低限)

- engine.ts:ダメージ式・相性・ブレイク・状態異常 tick・ミッカボーズのリセット(しるし・毒は残る)・ネガミラーのコピー生成。
- chapterGate.ts:02 §6 の全行を境界値でテーブルテスト。
- will.ts:日次上限・日付切替・敗北時非返還・幹部初回敗北の返還。
- leveling 改定:既存 totalExp サンプルでレベル・残ポイントが破綻しないこと。
- マイグレーション:旧スキーマの user doc フィクスチャ→新スキーマ(冪等性=2回走っても同じ)。

## 9. 書かないこと(スコープ外)

- URL ルーター導入、状態管理ライブラリ導入(現行方式で足りる)。
- 対人・ランキング等のソーシャル機能。
- 課金・広告。**時間だけが進行資源**という設計思想(02 §6)を守る。
- 効果音/BGM(将来課題。演出は視覚のみで成立させる)。
