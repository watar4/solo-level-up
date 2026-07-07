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

## 次の増分(未着手)

- **Increment 2 — P2 縦切り(第1章を通しで遊べる):** バトルエンジン抽出(`lib/battle/engine.ts`、`DailyBossPanel` のロジック移植)+ WorldMap/RegionMap/BattleScene/StoryDialog + 戦意の Firestore 配線(`useGameData.completeQuest` に earn を追加、`progress/will`・`progress/story` doc 新設)。
- **Increment 3 — P3 キャラクリv2**、**Increment 4 — P4 コンテンツ量産(2〜12章)**、**Increment 5 — P5 仕上げ**。詳細は `07-implementation.md` §7。
