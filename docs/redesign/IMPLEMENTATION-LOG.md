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

## Increment 5 — P5 仕上げ ✅ 完了

**方針:** 4本柱(UI依存ギミックの本演出/演出磨き/バランス調整/エンディング)で全体を仕上げ。

### UI依存ギミックの本実装

- **鏡(mirror・9章ネガミラー):** `createBattle` で敵をプレイヤーのコピー化(属性=プレイヤー属性で「自分に弱点はない」、攻撃力=自分の力からスケール)。`AdventurePanel` が敵スプライトにプレイヤーアバターを流用+「(あなたのコピー)」表示。
- **偽通知(fakeNotification・3章ピコーン):** エンジンが `fx:'fakeNotification'` イベントを発火→`BattleScene` が偽通知カードを表示。**タップすると手番を無駄にする**新アクション `wait` を追加(通知を無視する訓練の機械化)。放置で自動消滅。
- **UI侵食(uiSleep・12章グータラ):** `fx:'uiSleep'` → 画面に「Zzz…」が漂う演出。

### 演出磨き(juice)

- 奥義カットイン(`ultimate` イベント→横スライドのバナー)、会心の全画面フラッシュ、敵の被弾フラッシュ(白)、ダメージポップ強化。すべて演出レイヤーとして `BattleScene` に集約。

### バランス調整

- 敵HP/攻撃を HP/ダメージ曲線に合わせて再調整(`factory.ts`、及び ch01/06/12 の手書き値)。lord hpTurns 16→10 等。
- **バランス自動テスト**(`balance.test.ts`、決定的RNG):①推奨Lv+3 の熟練プレイで全12幹部を安定撃破(≥60%)②低レベル+雑な操作は罰される(-6/攻撃連打で勝率≤85%)③雑魚は平均8手番以内で撃破。数理でペーシングは章ゲートが担保する設計を確認。

### エンディング

- `EndingScene`:最終章クリア後に「THE END / ダラリア大陸、平和!」+**1年の記録**(Lv・メダル12・総EXP・討伐数・最長ストリーク・称号「継続の証」)+**12幹部の“その後”**(改心後の近況スタッフロール)+「明日のクエストへ」→日常のクエスト画面へ。無限回廊の開放案内。

### 検証

- **71 ユニットテスト(全 green)**。新規 `balance.test.ts`(3)・`p5-gimmicks.test.ts`(4:鏡の属性コピー/偽通知・UI侵食のfx発火/waitの手番消費)。
- `tsc -b`・`npm run build` 成功。
- **実ブラウザ確認**(pageerror 0):`30-ultimate-cutin`(最終戦で奥義カットイン+uiSleepのZzz+ブレイク+ダメージ同時)・`31-ending`(エンディング全景)。

---

## Increment 6 — 影のロール/作戦指示 本実装 ✅ 完了

P2で簡略化していた影を、docs 03 §6 の設計どおりに本実装。

- **ロール**(`shadows.ts`):影の主ステータスから導出 ―― VIT=ヒーラー / INT=サポート / STR・AGI・PER=アタッカー。`shadowRole()` + ラベルを追加し、影の軍団パネル(編成画面)にも表示。
- **作戦指示**(`engine.ts` `Tactic` + `setTactic`、手番消費なし):
  - ガンガンいこうぜ:全員 攻撃
  - いのちだいじに:ヒーラーは味方HP<50%で回復、他は攻撃
  - じゅんびをととのえろ:サポートは敵弱体化、ヒーラーは危険時回復、他は攻撃
  - くずしをねらえ:弱点属性の影だけ攻撃(ブレイク特化)、他は待機
- `resolveShadowTurn` を tactic×role で分岐するよう書き換え。`BattleScene` に「さくせん」コマンド+サブメニュー+現作戦/ロール表示を追加。

**検証:** 新規 `tactics.test.ts`(5:ロール導出/各作戦の挙動)。**計76テスト全green**。`tsc -b`・`npm run build` 成功。実ブラウザで作戦メニュー確認(`screenshots/40-tactics-menu.png`、pageerror 0)。

---

## Increment 7 — 製造チェック&アドバーサリアル・レビュー(Fable 4並列)→ 修正 ✅ 完了

全差分(main比 104ファイル)に対し、4領域(バトルエンジン/進行・永続化/React UI/コンテンツ・データ)の並列アドバーサリアル・レビューを実施。**Blocker 1・Major 8・Minor/Nit 多数**を検出し、以下を修正した。

### 修正済み(重大度順)

| # | 指摘 | 修正 |
|---|---|---|
| BLOCKER | **戦闘報酬の消失**:`handleBattleEnd` の gold→影→campaign の連鎖が全て同一レンダーの stale `character` を spread → 最後の campaign 保存がゴールド/図鑑を巻き戻し、次の絶対値書き込みでサーバー側も恒久消失 | `useGameData` に `characterRef`+`commitCharacter` を導入。連鎖ミューテータ(addGold/spendGold/buy・useConsumable/recordDexShadow/saveCampaign/awardExp/updateCreed/advanceJob)を全て ref 基準の同期コミットに書き換え |
| MAJOR | **EXPトグル稼ぎ**:uncheck 時の払い戻しを現在の信条/時刻で再計算(付与時と不一致) | 払い戻しを completion ログの実測 `expGained` 合計に変更(ログ欠落時のみ再計算にフォールバック) |
| MAJOR | **戦意トグル稼ぎ**:uncheck が戦意を返還しない → 1クエストで3/3到達可能 | `logCompletion` に `willGained` を記録し、uncheck は `ungrantWill` でログ実測分だけ返還(stock/earnedToday 双方、0クランプ) |
| MAJOR | **カーブ改定の再計算欠落**:「ロード時に再導出」というコメントに実装がなく、初回 uncheck でレベル急騰+ポイント湧き | `migrateCharacterFields` で `levelFromTotalExp` により**昇格のみ**再導出(+レベル差×5pt)。マスターシード(level>導出値)は据え置き |
| MAJOR | **章ゲート代替条件が死亡**:snapshot が食事/貯金/体重/フォーカスを 0 固定 | AdventurePanel で useMeals/useWeights/useSavings を購読し実数を供給(`firebaseReady` ガード付き)。フォーカスゲートは履歴データが存在しないため ch3 の代替条件を累計40回に差し替え(chapters.ts に注記) |
| MAJOR | **鏡の弱点表示が嘘**:エンジンは live 属性(=プレイヤー属性)、UI は静的定義の弱点を表示 | BattleScene を live actor の element 基準に変更 |
| MAJOR | **DoT死で不死鳥不発**:蘇生判定が敵ターンのみ | `beginPlayerTurn` にも蘇生を実装(+`revive` イベント発行) |
| MAJOR | **不死鳥が未消費**:冒険戦闘では発動しても在庫が減らない | `revive` イベントで BattleScene が `onUseConsumable('phoenix-feather')` を実行 |
| MAJOR | **ch12中ボスの看板技が不発**:elite に `phase2` 条件技(elite は phases:1) | `mv.enrage`(HP<50%)を新設して差し替え+「非lordのphase2技禁止」の不変条件テストを追加 |
| MINOR | 偽通知タップが敵ターン中は無害な no-op | タップを「次の自ターンを浪費」に(pendingWaste キュー) |
| MINOR | どうぐ二度押しで在庫だけ2消費 | `itemBusyRef` の in-flight ガード |
| MINOR | ch11「メダルが無効化を打ち破る」未実装 | `nullifyResist`(メダル×0.04)で drain の下限を引き上げ+発動ログ |
| MINOR | こつこつメダル(goldGain)未消費 | 冒険の戦闘ゴールドに配線(クエストゴールドは払い戻し精度のため flat 維持) |
| MINOR | advanceJob がレベル/系譜を未検証 | Lv20/40・parent 系譜・重複転職を検証 |
| MINOR | 作成時の job/creed が fire-and-forget | await 化(失敗時も進行は継続) |
| MINOR | ch5/ch11 の会話・ロアが実装と矛盾、孤児異名(金蟲侯/虚妃) | テキストを実装に一致させ実名に修正 |
| NIT | StoryDialog/AdventurePanel の render 中 setState、burnResist の post-tick 判定、pickMove の空 moves クラッシュ、enemy HP 見積りが非攻撃ステで膨張、RegionMap の elite コスト表示、pick() の rng=1.0、未使用データ(TIER_SPRITE_SIZE / ch1-lord-open) | すべて修正・削除 |

### 検証

- **81テスト全green**(回帰テスト追加:ungrantWill×2 / DoT蘇生+revive イベント / nullifyResist の下限 / 非lord phase2 禁止)。`tsc -b`・`npm run build` 成功。
- 実ブラウザスモーク(第1章通しプレイ)復旧確認 — なお、章ゲート配線が Firebase 未設定環境で throw する回帰をこのスモークが検出し、`firebaseReady` ガードで修正した。

### 見送り(既知の残課題として記録)

- **campaign の whole-object 書き込み競合**(マルチデバイス同時操作時の last-writer-wins)— 単一タブは charRef で実質解消。フィールド分割書き込みは将来課題。
- **focusBonusExp/しゅうちゅう・mealStreakExp/はらはちぶ メダルが未消費**(判定に「その日の記録有無」が必要で completeQuest から参照不可)— 配線は将来課題。
- shield 状態の吸収未実装/ブレイク中の敵DoT停止(現状どちらも到達不能)/どうぐ回復の奥義ゲージ非加算/BattleScene の interval が props を固定(現状無害)— レビュー指摘として記録のみ。

---

## まとめ:全5増分 完了

P1(ロジック基盤)→P2(第1章プレイアブル)→P4(2〜12章量産)→P3(キャラクリv2)→P5(仕上げ)を完了。
不満①(戦闘/ストーリー)②(キャラクリ)③(ボス)すべてに実装が入り、**全12章クリア+エンディングまで通しで遊べる**。総計 **71 ユニットテスト**、実ブラウザでの主要フロー実証済み。
残課題(将来):宝箱(武器)ドロップの冒険側接続、要所幹部の手描きスプライト差し替え、無限回廊のクリア後コンテンツ肉付け。(影のロール/作戦指示は Increment 6 で実装済み)
