# 実装ログ

改善提案(`docs/redesign/01`〜`07`)の実装進捗を記録する。フル実装は数ヶ月規模のため、
**アプリを常に動く状態に保ちながら増分(increment)で積み上げる**方針。

---

## Increment 1 — P1基盤(ロジック層) ✅ 完了

**方針:** UI に一切触れず、純粋・型安全・テスト済みのロジック層だけを先に敷く。
既存アプリの挙動は 1 ミリも変わらない(新モジュールはまだどこからも import されていない)。

### 追加したもの

| ファイル | 内容 | 対応章 |
|---|---|---|
| `src/lib/battle/elements.ts` | 五行属性(剛迅魔守心)。弱点・耐性をサイクルから導出 | 03 §4 |
| `src/lib/battle/status.ts` | 状態異常6種の定義と tick 処理(毒/やけど/眠/麻痺/しるし/シールド) | 03 §5 |
| `src/lib/battle/break.ts` | ブレイクゲージの状態機械(弱点でのみ削れる/スタン/再生) | 03 §5 |
| `src/lib/battle/will.ts` | 戦意システム(習慣→戦闘権)。獲得上限・消費・返還 | 03 §1 |
| `src/lib/story/medals.ts` | しゅうかんメダル12種+恒久パッシブ | 02, 03 §8-4 |
| `src/lib/story/chapters.ts` | 全12章のメタ定義(解放ゲート・推奨Lv・領地) | 02 §3,§6 |
| `src/lib/story/chapterGate.ts` | 章解放判定(レベル AND 継続条件)。保存値から都度導出 | 02 §6 |
| `src/lib/enemies/types.ts` | 敵(ダラモン)データモデル。宣言的な行動スクリプト | 06 §5 |
| `src/lib/enemies/ch01.ts` | 第1章の敵5体(データ実証) | 06 §3 |
| `src/lib/leveling.ts`(改修) | レベル曲線を `45·L^1.4+55` に再スロープ(1年ペーシング) | 03 §8-2 |

### テスト・検証

- `vitest` を devDependency に追加(`npm test` / `npm run test:watch`)。
- 純粋ロジックに **38 テスト**(全 green):属性サイクル/状態異常 tick/ブレイク状態機械/戦意の上限・返還/章ゲートの境界値/メダル集計/レベル曲線のデータ安全性。
- `npx tsc -b` 型チェック通過、`npm run build` 本番ビルド成功。

### 設計上の判断メモ

- **弱点はロスター表(06)の「弱点」列ではなく属性から導出**。提案書内で両者が一部矛盾していたため、`elements.ts` を単一の真実とした(06 §5 の明記通り)。
- レベル曲線変更は `totalExp` 単一情報源方式のおかげでデータ安全(既存プレイヤーは次回ロードで新Lvに再計算されるだけ)。テストで往復整合を確認済み。
- 第12章ゲートの「メダル11 AND ストリーク60」の複合ANDは、メダル11到達が実質支配的なため `メダル11 OR 累計650` に簡約した。

---

## Increment 2 — P2 縦切り(第1章プレイアブル) ✅ 完了

**方針:** 既存の無限タワー(`DailyBossPanel`)は残したまま、新しい全画面「冒険」機能を
戦闘タブから起動する形で**追加**。動いているアプリを壊さず、第1章を通しで遊べる状態にした。

### 追加したもの(ロジック層)

| ファイル | 内容 |
|---|---|
| `src/lib/battle/formulas.ts` | 属性ベースのダメージ計算(旧 `boss.ts` 係数を移植・`BossDef` から分離) |
| `src/lib/battle/engine.ts` | **純粋関数のバトルエンジン**。ATB・状態異常・ブレイク・奥義・影の援護・敵AI行動スクリプト・勝敗。UI非依存の reducer(`advance`/`playerAction`) |
| `src/lib/battle/loadout.ts` | Character → エンジン設定(職業→属性、装備スキル解決、影の戦力、メダルパッシブ) |
| `src/lib/story/campaign.ts` | キャンペーン save-state(戦意・章進行・メダル)。Character doc に保存 |
| `src/lib/story/dialogue/ch01.ts` + `index.ts` | 第1章の会話データ+登録 |
| `src/lib/story/regions.ts` | 地方ノードマップ(第1章:イベント3+雑魚3+中ボス+幹部) |
| `src/lib/enemies/registry.ts` | 敵IDレジストリ |
| `src/lib/enemies/sprites.ts` | 第1章5体のドット絵(属性色) |

### 追加したもの(UI層)

`src/components/adventure/`:`AdventurePanel`(オーケストレータ)/ `WorldMapScene`(大陸図・章解放ゲート表示)/ `RegionMapScene`(ノード進行)/ `StoryDialog`(会話)/ `BattleScene`(全画面ATB戦闘:コマンド・スキル・道具・奥義・ダメージポップ・ブレイク・状態異常表示)。

### 配線(既存アプリへ)

- `types.ts`:`Character.campaign?` 追加(任意なので既存セーブは無変更)。
- `useGameData`:`campaign` を派生公開+`saveCampaign`+**`completeQuest` で戦意を獲得**(習慣→戦闘権のループが成立)。
- `Dashboard`:戦闘タブ先頭に「冒険にでる」ボタン+`AdventurePanel` を lazy マウント。旧タワーは「無限回廊」に改称。

### 検証

- **47 ユニットテスト(全 green)**。うち engine 6 + **実データ結合テスト3**(実際の第1章幹部スヤリンを本物のローダウト+エンジンで撃破まで通す e2e)。
- `tsc -b` 通過、`npm run build` 成功(AdventurePanel は 44kB の独立チャンク)。
- **実ブラウザ起動確認**:pageerror ゼロでマウント(types→campaign の循環 import なし)。
- **実ブラウザ操作確認(追加実施):** Firebase を回避するデモハーネス(`demo/`)で `AdventurePanel` をモックデータ直マウントし、Chromium で第1章を自動プレイ(会話→雑魚3→中ボス→幹部スヤリン撃破)。全戦闘が解決、意味のあるJSエラー0。証跡スクショ `docs/redesign/screenshots/`:
  - `01-worldmap.png`:大陸マップ(章解放ゲート表示・戦意3/3)
  - `03-battle.png`:全画面バトル(敵スプライト・属性/弱点バッジ・HP・コマンド)
  - `04-lord-result.png`:幹部撃破(ゴールド・影抽出・はやおきメダル獲得)
  - `05-cleared-worldmap.png`:第1章「クリア済み」表示(進行の永続を確認)

### 設計判断メモ

- 戦意/章進行は 07§4 のサブコレクション案ではなく **Character doc の `campaign` フィールド**に集約(既存の書き込みと同じ1パッチで済むため)。
- 弱点は属性サイクルから導出(Increment 1 の方針を戦闘でも適用)。影は当スライスでは「攻撃役の自動ATB」として簡略実装(HP・ロール・作戦指示は後の増分)。宝箱(武器)ドロップは未接続(既存タワー側にはある)。

---

## Increment 3 — P4 コンテンツ量産(2〜12章) ✅ 完了

**方針:** 60体を手描きせず、**スプライトキット(形状テンプレ×属性色)+データ駆動ファクトリ**で量産し、全12章の整合性を自動テストで担保。

### 追加したもの

| 領域 | 内容 |
|---|---|
| 敵データ | `enemies/ch02.ts`〜`ch12.ts`(各5体=**55体**)。`enemies/factory.ts`(章スケール自動)+`mv`(行動コンストラクタ)で簡潔に宣言 |
| スプライト | `enemies/spriteKit.ts`:描画プリミティブで10形状(blob/ghost/beast/bird/bug/golem/serpent/crystal/slime/cat)を生成→属性色で着色。`sprites.spriteFor(def)` が第1章は手描き・以降はキットを解決 |
| 地方 | `story/regions.ts`:2〜12章をロスターから自動生成(雑魚3→中ボス→幹部) |
| 会話 | `story/dialogue/rest.ts`:各章 intro/prelord/lord-clear。カイン堕落・バルガス過去・アリア正体などの伏線を配置 |
| ギミック | `battle/engine.ts` に純粋ギミック実装:buffEater(4章)/goldScatter(5章)/darkening(7章)/triTurnReset(8章)/selfBurn(10章)/nullify(11章)。UI依存の mirror/fakeNotification/uiSleep は自己バフに degrade(後の増分で本演出) |
| 登録 | `enemies/registry.ts` に全12章を統合、`dialogue/index.ts` に会話を統合 |

### 検証

- **54 ユニットテスト(全 green)**。新規の**コンテンツ整合テスト**:全章に地方あり/全ノードが実敵・実会話を参照/幹部IDが `chapters.ts` と一致/全55体が整形済み(スプライト矩形)/**Lv60ハンターが全12幹部をエンジンで撃破**(全ギミックがクラッシュ/詰みなく通ることを保証)。
- `tsc -b`・`npm run build` 成功。
- **実ブラウザ確認**:全12章が選択可能、第5章の戦闘でキット生成スプライト(コゼニトリ=迅属性の緑鳥)描画、pageerror 0。証跡:`screenshots/10-worldmap-all.png`・`12-battle-ch5-kit.png`。

### 設計判断メモ

- スプライトはキット生成(形状10×属性5=最大50通り+手描き第1章)。第1章の主要敵のみ手描きで、以降は量産効率を優先。将来、要所の幹部を手描きで差し替え可能(`ENEMY_SPRITES` に id 登録すれば `spriteFor` が優先)。
- バランスは「hpTurns(プレイヤー火力比)×章別攻撃スケール」。詳細な数値調整は P5 に委ねる。

---

## Increment 4 — P3 キャラクリv2 ✅ 完了

**方針:** 不満②「選択に意味がない・楽しみがない」の核心。見た目のパーツ制だけで終わらせず、**職業・信条・転職の効果を戦闘/成長に実配線**した(データだけにしない)。

### 見た目(パーツ制アバター)

- `lib/appearance.ts`:**24×24 レイヤー合成アバター**を描画プリミティブで生成。はだ6・かみがた8・かみいろ12・め4種・めのいろ8・アクセ6・衣装10(4職デフォルト+進捗解放6)。`renderAvatar` / `normalizeAppearance` / `migrateAppearance`(旧16×16→v2) / `randomAppearance`。
- 全描画箇所(HUD・ステータス・戦闘・作成・クローゼット)を `renderClassSprite`→`renderAvatar` に置換。

### 職業(ついに意味を持つ)

- `lib/jobs.ts`:4職の成長ステータス・固有パッシブ・属性・奥義。**転職ツリー**(Lv20二次職/Lv40三次職、各分岐)。
- **実配線**:
  - 成長ボーナス=`classStatBonus`(装備ボーナスと同様に `effectiveStats` に派生加算。EXP巻き戻しでも破綻しない)。
  - 固有パッシブ=engine `PlayerConfig` に `damageTakenMult/atbBonus/cooldownReduction/firstStrikeBreak` を追加して戦闘に適用。tierで強度スケール。
  - 奥義=tierで倍率・名称が強化。

### 信条

- `lib/creeds.ts`:6信条。`questExpMultiplier`(朝型/夜型/一点突破+メダルEXP系)・`streakCapFor`(コツコツ+よっかめメダル)・`shopDiscountFor`(倹約家)・`extractionBonusFor`(収集家)を **`completeQuest`/`buyConsumable`/抽出ロールに実配線**。

### UI

- `CharacterCreation` を **4ステップ・ウィザード**に刷新(みため→しょくぎょう[レーダー]→しんじょう→なまえ、ライブプレビュー+ランダム)。`StatRadar` 追加。
- `ClosetPanel`(旧 AppearanceEditor 置換):全パーツ変更+進捗解放の衣装。
- `JobPanel`(ギルド):現職表示・転職・信条変更。
- `StatusPanel`:職業/信条/成長ボーナス表示+`MedalCase`(12メダル)。
- `useGameData`:`campaign`同様に `job/creed/cosmetics` を配線。`updateCreed`/`advanceJob` 追加。既存ユーザーの**マイグレーション**(load時に旧appearance→v2、job.base/creed 補完)。作成時に job/creed を種付け。

### 検証

- **64 ユニットテスト(全 green)**。新規 `character.test.ts`:アバター矩形/正規化/移行/乱数、成長ボーナスのレベルスケール、転職の解放ゲート、職業別・tier別コンバットmod、信条EXP倍率・上限・割引・抽出。
- `tsc -b`・`npm run build` 成功。
- **実ブラウザ確認**(pageerror 0)。証跡 `screenshots/`:`20-create-appearance`(パーツ)・`21-create-class`(レーダー+パッシブ)・`24-closet`(進捗解放衣装)・`25-job`(転職+信条、tier2パッシブ-12%)。

---

## 次の増分(未着手)

- **Increment 5 — P5 仕上げ**(バランス調整・演出磨き・UI依存ギミック本実装[mirror/fakeNotification/uiSleep]・ED)。詳細は `07-implementation.md` §7。
