# 08. 継続率と信頼性の改修 改善提案書(v2)

> **この文書も次の実装担当 AI(Opus)への引き継ぎドキュメントである。**
> v1(01〜07)が「戦闘・ストーリー・キャラクリ・ボス」という**遊びの中身**を作ったのに対し、
> 本 v2 は「**その遊びが毎日続くか / データを失わないか**」という**土台**を扱う。
> ファイルパス・行番号はすべて 2026-07-07 時点の `main`(commit `cdcbf5c`)基準。

---

## 背景:機能量に対して「土台」が薄い

v1 の全5増分で 12 章クリアまで遊べるようになった。だが**このアプリの本業は習慣化**であり、
遊びの中身がどれだけ厚くても、以下が欠けていると継続率は上がらない。

| # | 現状の穴 | 根拠(現行コード) | 効き目 |
|---|----------|------------------|--------|
| A① | **リマインダー通知がゼロ**。ユーザーが自発的に開くまでアプリは何もしない | `src/` に `new Notification` / `Notification.requestPermission` / `showNotification` の呼び出しが**一件も無い**。SW(`public/sw.js`)はアプリシェルのキャッシュのみで `push`/`notificationclick` ハンドラ無し | 習慣化アプリの継続率はリマインダーでほぼ決まる。**最大の穴** |
| A② | **「三日坊主の救済」がメカニクス化されていない**。連続が途切れると即ゼロ | `useGameData.ts:459-464` — 昨日未達成なら `streak` は無条件で `1` に戻る。物語の核(よっかめメダル/みっかぼうず湖)が数値に落ちていない | 物語思想と直結。**最大の差別化余地** |
| A③ | 初回の即・成功体験が薄い | 作成完了後ダッシュボードに着地するだけ。最初の1勝までの導線が無い | 初日離脱の抑制 |
| B④ | **Firestore オフライン永続化が未設定**。オフラインだと画面は出るがデータが読めない/書けない | `src/firebase.ts:29-31` は `initializeFirestore(app, { ignoreUndefinedProperties: true })` のみ。`localCache` 未指定=メモリキャッシュ。SW もクロスオリジン(Firestore)は素通し | 「進捗が消えた」体験の予防。**低工数・高保険** |
| B⑤ | **campaign の書き込み競合**。まるごと1オブジェクトで上書き | `useGameData.ts:1126-1136` `saveCampaign` が `updateCharacter(uid, { campaign: next })` で全体置換 → 複数端末/タブで last-writer-wins。章クリアやメダルが消え得る | 進捗消失リスク |
| B⑥ | **character がライブ購読でない**。別端末の進行と乖離 | `useGameData.ts:315` は `loadCharacter()`(一度きり `getDoc`)。quest 側は `onSnapshot` 済みなのに character だけ非対称 | マルチデバイス整合 |

## コア思想(3行)

1. **「開かなくても背中を押す」** — 通知でループの起点をアプリ側から作る(A①)。
2. **「途切れても戻れる」** — 三日坊主を罰さず、四日目を作る仕組みを数値に落とす(A②)。物語のメッセージとメカニクスを一致させる。
3. **「絶対に失わせない」** — オフラインでも書け、競合でも消えない(B④⑤⑥)。習慣アプリで進捗消失は一発退場。

## 壊さないもの(v1 の資産)

- 戦闘エンジン・影・経済・章ゲート・PixelArt はいずれも**無改修**。本 v2 は永続化層(`firebase.ts`/`firestore.ts`/`useGameData.ts`)と、`completeQuest` のストリーク計算、通知用の SW ハンドラだけを触る。
- `firebaseReady === false`(env 未設定)のデモ/CI 環境で必ず動くこと。通知・永続化はすべて **`firebaseReady` / `'Notification' in window` / `'serviceWorker' in navigator` でガード**する(v1 の `firebaseReady` ガード方針を踏襲)。

---

# Part A — 習慣化の効き目

## §1. リマインダー通知(現状ゼロ)

### 1-1. 制約の直視

このアプリは**サーバー無し**(クライアントのみ Firestore、Cloud Functions 無し)。
したがって「サーバーから定時プッシュ」は本 v2 の範囲では持てない。現実的な三層で段階導入する。

| 層 | 手段 | 対応環境 | 前提 | 本 v2 |
|---|------|----------|------|-------|
| L0 | **アプリ内キャッチアップ**:起動時に「最後に開いてから」を計算し、未達成クエスト/途切れそうなストリークをトースト+バッジで提示 | 全環境 | なし | **必須(まず入れる)** |
| L1 | **ローカル通知**:`Notification` 権限を取り、アプリ表示中は `setTimeout`、インストール済み PWA は **Periodic Background Sync** で「今日のクエスト」を定時通知 | Chrome/Android(インストール済み) | 通知許可 | **推奨** |
| L2 | **Web Push(FCM)**:真のバックグラウンド定時通知 | iOS 16.4+ 含む全プラットフォーム(要ホーム追加) | **送信トリガ(サーバー/サーバーレス cron)が別途必要** | **将来**(サーバーレス送信を足す時) |

> **iOS の正直な注記**:iOS の PWA は Periodic Background Sync 非対応で、ローカルのスケジュール通知も持てない。iOS で本当の定時通知を出すには L2(Web Push, 16.4+ かつホーム追加済み)しか道がなく、それには送信側が要る。**本 v2 は L0+L1 まで**とし、L2 は「サーバーレス送信を導入する回」に切り出す。

### 1-2. L0(アプリ内キャッチアップ)設計 — 最優先・低工数

- 既存 `Character.lastSeenAt`(`types.ts`)を使い、起動時に「前回からの経過」と「今日の未達成デイリー数」「途切れ間近のストリーク(§2)」を算出。
- 既存 `SystemToast`(`src/components/SystemToast.tsx`)+ `game.pendingEvents` の仕組みに `reminder` イベント種別を1つ足すだけ。新規パネル不要。
- コピー例(アリア節):「おかえりなさい。今日のクエストが◯件、まだ残っています。」「連続◯日。あと1日で途切れます——今日、ひとつだけでも。」

### 1-3. L1(ローカル通知)設計

**新規** `src/lib/notify.ts`:
```ts
// すべて 'Notification' in window / serviceWorker 前提でガード。未対応は no-op。
export function notificationsSupported(): boolean;
export async function requestNotificationPermission(): Promise<NotificationPermission>;
// アプリ表示中のスケジュール(タブが開いている間だけ)。
export function scheduleLocalReminder(at: Date, payload: ReminderPayload): void;
// インストール済み PWA 向け。失敗(未対応/未許可)は握りつぶして false。
export async function registerPeriodicReminder(minInterval: number): Promise<boolean>;
```

**`public/sw.js` への追記**(既存のキャッシュ戦略は無改修、ハンドラ追加のみ):
```js
// 定時同期:その日の未達成クエスト数を Firestore から読み、あれば通知。
self.addEventListener('periodicsync', (e) => {
  if (e.tag === 'daily-reminder') e.waitUntil(showDailyReminder());
});
// 通知タップでアプリを前面に(既存タブがあれば focus、無ければ open)。
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(clients.matchAll({ type: 'window' }).then(/* focus or openWindow */));
});
```

**設定 UI**:`Character.settings` を新設(下記スキーマ)し、メニュータブに「リマインダー」トグル+時刻ピッカー1つ。権限リクエストは**ユーザー操作起点**(トグル ON 時)で行う(ブラウザ要件)。

### 1-4. データモデル(通知設定)

`types.ts` の `Character` に追加(すべて任意フィールド。`ignoreUndefinedProperties` により旧セーブと互換):
```ts
export interface CharacterSettings {
  reminders?: {
    enabled: boolean;
    hour: number;        // 0-23、ローカル時刻
    minute: number;      // 0/15/30/45 程度
    lastFiredDate?: string; // YYYY-MM-DD 二重発火防止
  };
}
// Character に: settings?: CharacterSettings;
```
永続化は §5 と同じくフィールド単位:`updateCharacter(uid, { 'settings.reminders': ... })`(ドット記法)。

---

## §2. 三日坊主の救済(ストリーク救済) — 最大の差別化

### 2-1. なぜやるか

物語の中心メッセージは「三日坊主でいい、四日目を始めよう」(`02-story.md`、みっかぼうず湖=第8章、よっかめメダル)。
なのに `useGameData.ts:459-464` は**昨日サボったら streak を無条件で 1 にリセット**する。物語と機構が矛盾している。ここを一致させる。

### 2-2. 3つの救済メカニクス(併用可)

1. **ストリーク・フリーズ(継続の盾)**
   - 週に N 個(初期 1、うんどう/よっかめ等メダルで +)の「フリーズ」を自動付与。1日の抜けを1個消費して肩代わりし、streak を維持。
   - `Character.settings` 隣に `streakFreeze?: { stock: number; weekStartDate: string }`。
2. **おかえりクエスト(再点火)**
   - 3日以上の不在から復帰した初回起動時、低難度の特別クエスト1件を自動生成 → 即完了で「再スタート」。streak は 0 でなく `Math.max(1, floor(prevStreak * 0.5))` から再開(減衰式)。
   - コピーはアリアが「記録は消えません。四日目から、いきましょう。」
3. **減衰式ストリーク(0 リセット廃止)**
   - 現行の `→1` を、`→ max(1, floor(streak * DECAY))`(DECAY=0.5 目安)に置換。「積み上げが一撃でゼロ」の絶望を無くす。

### 2-3. 実装ポイント(唯一の中核改修)

`useGameData.ts:459-464` の `newStreak` 算出を差し替える。**純粋関数に切り出してテスト可能に**する:
```ts
// 新規 src/lib/streak.ts
export function nextStreak(
  quest: Quest, today: string, yesterday: string,
  freeze: { stock: number },
): { streak: number; freezeUsed: boolean } {
  if (quest.type !== 'daily') return { streak: quest.streak, freezeUsed: false };
  if (quest.completedDates.includes(yesterday)) return { streak: quest.streak + 1, freezeUsed: false };
  // 昨日抜け:フリーズがあれば維持、無ければ減衰(0 にはしない)
  if (freeze.stock > 0) return { streak: quest.streak + 1, freezeUsed: true };
  return { streak: Math.max(1, Math.floor(quest.streak * 0.5)), freezeUsed: false };
}
```
- `streakMultiplier`(既存)への入力がこの `streak` になるだけで、報酬式は無改修。
- フリーズ在庫の週次補充は起動時(§1 の L0 キャッチアップと同じフック)で reconcile。

### 2-4. テスト(`src/lib/__tests__/streak.test.ts` 新規、5+ ケース)

昨日達成=+1 / 昨日抜け+フリーズ有=維持&消費 / 昨日抜け+フリーズ無=半減 / streak=1 で半減しても 1 を下回らない / one-time は不変。

---

## §3. 初回の即・成功体験

- `createCharacterWithName`(`useGameData.ts:428`)の直後に、**チュートリアル用の超簡単デイリー1件**(例:「水を1杯のむ」難度 easy)を自動生成 → 作成直後の画面で「まず1件やってみよう」に誘導。
- 完了で確実にレベル 1→2 の演出が出るよう、easy の EXP を初回だけ確実にレベルアップ域へ(既存 `applyExp`/`SystemToast` を利用、新規演出なし)。
- **工数小**。既存 `createQuest` と完了フローに乗るだけ。

---

# Part B — データ信頼性

## §4. Firestore オフライン永続化(低工数・高保険)

`src/firebase.ts:29-31` を差し替える(`ignoreUndefinedProperties` は維持、両立可):
```ts
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
export const db = app
  ? initializeFirestore(app, {
      ignoreUndefinedProperties: true,
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    })
  : null;
```
- 効果:オフライン時も読取(キャッシュ)+書込(キューイング)ができ、復帰時に自動同期。SW のアプリシェルキャッシュと合わせて「完全オフラインで一通り遊べる」に到達。
- 注意:永続キャッシュはブラウザ非対応時に throw し得るため、`initializeFirestore` を **try/catch し、失敗時はメモリキャッシュにフォールバック**(既存の `firebaseReady` パターンと同じ堅牢性方針)。
- テスト:env 未設定(`db===null`)で従来どおり動くこと、ビルドが通ること。

## §5. campaign の書き込み競合(進捗消失リスク)

`useGameData.ts:1126-1136` `saveCampaign` は `campaign` 全体を置換している。マルチデバイス/多タブで
「章クリアを書いた端末」と「メダルを書いた端末」が競合すると、後勝ちで一方が消える。

**対策(段階)**:
- **最小**:`onSnapshot`(§6)導入で「他端末の最新」を常に手元に持ち、`saveCampaign` は必ず `characterRef.current.campaign` を基に差分マージしてから書く(既に `characterRef` はある。読み→合成→書きの窓を最小化)。
- **本命**:更新をフィールド単位のドット記法にする。`updateCharacter(uid, { 'campaign.clearedChapters': next.clearedChapters, 'campaign.medals': next.medals, ... })`。配列は「追加のみ」の性質なら `arrayUnion` を使えば競合しても和集合になり消えない。
- 併せて `firestore.rules` は現状フィールド検証無し(`characters/{uid}` は本人 read/write 可)なので**ルール変更不要**。

## §6. character のライブ購読

`useGameData.ts:315` の `loadCharacter()`(一度きり)を、初回ロード後に `onSnapshot(doc(db,'characters',uid))` 購読へ移行(quest 側 `subscribeQuests` と対称に)。

- 受信データは `commitCharacter` と衝突しないよう、**自端末の書込エコーは無視/マージ**(`metadata.hasPendingWrites` を見る)。
- これにより §5 の競合検知も自然に働く(他端末の変更が流れてくる)。
- 影響範囲:`useGameData` の読取部のみ。書込 API 群(`commitCharacter`/`updateCharacter`)は無改修。

---

# Part C — 約束済みの穴埋め(v1 の deferred 回収)

`IMPLEMENTATION-LOG.md`「見送り」節から、継続率に効くものを優先で拾う:

| 項目 | 内容 | 優先 |
|---|------|------|
| メダル未消費 | しゅうちゅう(focusBonusExp)/はらはちぶ(mealStreakExp)が「その日の記録有無」を `completeQuest` から参照できず未配線 | 中(§1 の起動時 reconcile で「今日の記録フラグ」を持てば解決) |
| 宝箱ドロップ | 武器ドロップが冒険側に未接続(タワー側にはある) | 中 |
| 無限回廊 | クリア後エンドゲームの肉付け | 低(エンドゲーム到達者向け) |
| 手描きスプライト | 要所幹部の差し替え | 低(見栄え) |

---

# ロードマップ(推奨実装順)

各フェーズ末で `tsc -b` / `npm test` / `npm run build` を green に保つ。実機は既存デモハーネス(`character-demo.html` 等)+ Firebase 実接続の手動スモークで確認。

| 順 | フェーズ | 内容 | 効き目 | 工数 | 依存 |
|---|---------|------|--------|------|------|
| 1 | **R1 データ保険** | §4 オフライン永続化 + §6 ライブ購読 + §5 最小マージ | 消失予防(即効) | 小〜中 | なし |
| 2 | **R2 三日坊主救済** | §2 `streak.ts` + テスト + フリーズ在庫 + おかえりクエスト | 差別化最大 | 中 | R1(reconcile 基盤) |
| 3 | **R3 キャッチアップ+初回体験** | §1 L0(起動時ナッジ)+ §3 初回クエスト | 継続の起点 | 小 | R2 |
| 4 | **R4 ローカル通知** | §1 L1(権限・設定 UI・SW ハンドラ・Periodic Sync) | 継続率(Android) | 中 | R3 |
| 5 | **R5 穴埋め** | Part C の中優先(メダル配線・宝箱ドロップ) | 中 | 中 | R2 |
| — | (将来) R6 | §1 L2 Web Push(要サーバーレス送信) | iOS 継続率 | 大 | 別途送信基盤 |

> **私(提案者)の推し**:まず **R1 → R2 → R3**。R1 は低工数で最悪の離脱(進捗消失)を止める保険、R2 はこのアプリ固有の物語思想と一致し差別化が最も大きく、R3 は R2 を起動導線に載せて日次ループを閉じる。R4(通知)は効果は大きいが権限・SW・プラットフォーム差の実装コストがあるので R1-R3 の後。

---

# テスト方針(v1 を踏襲)

- **純粋関数を最優先でユニットテスト**:`streak.ts`(§2)、キャッチアップ算出(§1 L0)、campaign マージ(§5)。ここは Firebase 非依存で書ける。
- **`firebaseReady===false` / 通知非対応**の分岐で必ず no-op になることを担保(既存デモ/CI が env 無しで動く不変条件)。
- **実機スモーク**:オフライン→操作→オンライン復帰で同期されること(§4)、2タブでの同時章クリアで消えないこと(§5)、通知許可→時刻到来で通知が出ること(§1 L1、Android)。

---

## 変更が触るファイル(一覧)

| ファイル | 変更 |
|---|---|
| `src/firebase.ts` | §4 `localCache` 追加(try/catch フォールバック) |
| `src/hooks/useGameData.ts` | §6 `onSnapshot` 購読 / §5 差分マージ / §2 `nextStreak` 呼出 / §3 初回クエスト / §1 L0 reconcile |
| `src/lib/streak.ts`(新規) | §2 純粋関数 |
| `src/lib/notify.ts`(新規) | §1 L1 通知ヘルパ |
| `public/sw.js` | §1 `periodicsync` / `notificationclick` ハンドラ追加 |
| `src/types.ts` | §1/§2 `CharacterSettings` / `streakFreeze` フィールド |
| `src/components/SystemToast.tsx` ほか | §1 L0 `reminder` イベント種別 / 設定トグル UI |
| `src/lib/__tests__/streak.test.ts`(新規) | §2 テスト |

以上。実装の正は本章、遊びの中身の正は 02〜06、既存実装の実態は `IMPLEMENTATION-LOG.md` を参照。
