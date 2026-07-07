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

## 次の増分(未着手)

- **Increment 3 — P3 キャラクリv2**(パーツ式アバター・職業差別化の永続化・転職・信条・衣装)。
- **Increment 4 — P4 コンテンツ量産(2〜12章:敵60体・会話・スプライト・ギミック本実装)。**
- **Increment 5 — P5 仕上げ**(バランス調整・演出磨き・ED)。詳細は `07-implementation.md` §7。
