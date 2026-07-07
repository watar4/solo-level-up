# 09. AIコーチ(ローカルLLM対応) 改善提案書(v3)

> **この文書も次の実装担当 AI(Opus)への引き継ぎドキュメントである。**
> v1(01〜07)=遊びの中身、v2(08)=継続の土台、に続く v3 は「**アプリが自分の言葉で話しかけてくる**」層を扱う。
> ファイルパス・行番号はすべて 2026-07-07 時点の `main`(commit `2d399ba`)基準。

---

## 依頼内容と、できる/できないの判断

依頼:「**ローカルLLMを組み込んで無料で使えるAIコーチを用意できないか。**
起動時に直近の動向を簡潔にまとめ、今日やることを喚起し、各種ログを参照した対話・アドバイスもしたい。」

**結論:できる。ただし「ローカルLLM一本足」にはしない。**

| エンジン候補 | 無料? | 対応環境 | 判断 |
|---|---|---|---|
| **WebLLM**(`@mlc-ai/web-llm`、WebGPU でブラウザ内推論) | 完全無料・通信不要・ログが端末外に出ない | デスクトップ Chrome/Edge ◎、Android Chrome ○(RAM 8GB 目安)、**iOS Safari は WebGPU 対応済みだがタブのメモリ上限的に 1B 級でも不安定** | **採用(オプトインのエンジンとして)** |
| transformers.js(WASM/WebGPU) | 無料 | マルチスレッド WASM に COOP/COEP ヘッダが必要 → **GitHub Pages では設定不可**(`vite.config.ts` の base 参照) | 見送り |
| Chrome 内蔵 Prompt API(Gemini Nano) | 無料・DL はブラウザ管理 | Chrome デスクトップ/一部 Android のみ。API 形状がまだ動く | 将来の追加エンジン枠(§3 の interface に足すだけ) |
| **Gemini BYOK**(既存 `src/lib/mealAi.ts` の方式) | 無料枠内なら無料(AI Studio キー) | **iOS 含む全環境**。既にアプリに実装済み | **採用(流用)** |
| ルールベース(LLMなし) | 無料 | 全環境・即時・確実 | **採用(常時の土台+フォールバック)** |

> **iOS についての正直な注記**:このアプリの主戦場はスマホ(iOS Shortcut 連携あり)。iPhone の Safari はタブあたりのメモリ制限が厳しく、1〜2B のモデルでもロード中に落ちることがある。だから「ローカルLLMだけ」だと**主要デバイスでコーチが動かない**。逆に、このアプリには既に **BYOK Gemini(無料枠)** の配線(`src/lib/mealAi.ts` + `src/hooks/useAiSettings.ts`、食事タブの `MealPanel.tsx:507` に搭載済み)がある。よって:

**設計方針 = 3層エンジンの差し替え構造**
1. **L0 ルールベース**(常時) — 起動時ダイジェストと行動喚起は**LLMなしで成立させる**。
2. **ローカルLLM(WebLLM)** — 対応端末でオプトイン。無料・オフライン・プライベート。
3. **Gemini BYOK** — 非対応端末(iOS)向け。既存実装の一般化だけで済む。

## コア思想(3行)

1. **事実は関数が作り、言葉はLLMが作る。** 数値の集計・判定はすべて純粋関数(§1)。LLM には構造化済みコンテキストを渡して「言い回し」と「対話」だけを任せる。統計のでっち上げ(幻覚)を構造的に防ぐ。
2. **どの環境でも段階的に劣化する。** WebGPU なし→Gemini、キーなし→ルールベース。コーチカードは**全員に**出る(v2 の `firebaseReady` ガード方針と同じ)。
3. **ログは端末の外に出さない(デフォルト)。** ローカルLLMなら完全に、Gemini でも「その1リクエスト分のコンテキスト」だけ。チャット履歴は Firestore に**保存しない**。

## 壊さないもの

- v1/v2 の全機能は無改修。触るのは新規ファイル(`src/lib/coach/`、`src/components/CoachCard.tsx`/`CoachPanel.tsx`)と、Dashboard へのカード1枚のマウント、`mealAi.ts` からの Gemini 呼び出し関数の切り出しのみ。
- `firebaseReady===false`(env なしのデモ/CI)で必ず動くこと。コーチはデータフックが空でもルールベース文を出す。
- バンドル予算:`@mlc-ai/web-llm` は数MBある。**必ず動的 import**(エンジン有効化時に初めて取得)。`vite.config.ts` の `manualChunks` は `node_modules` 内を vendor 分割しているが、動的 import 起点なら自然に別チャンクになる — **初期チャンクに混ぜないことをビルド後に確認**する。

---

# §1. コンテキスト基盤(全エンジン共通・LLM 非依存)

**新規 `src/lib/coach/context.ts`** — 各フックのデータから「コーチが見る世界」を1つの構造体に集約する純粋関数。

```ts
export interface CoachContext {
  today: string;                    // YYYY-MM-DD(lib/leveling.ts の todayKey)
  character: {
    name: string; level: number; rank: string;
    daysSinceLastSeen: number;      // v2 ナッジと同じ算出(useGameData.ts:406-)
    freezeStock: number;            // streakFreeze(types.ts:85)
  };
  quests: {
    dailyTotal: number; dailyDoneToday: number;
    topStreak: { title: string; streak: number } | null;
    atRisk: { title: string; streak: number }[];   // 昨日達成済みで今日未達成(=今日サボると減衰)
    recent7d: { date: string; done: number }[];    // 完了数の7日推移
  };
  weight: { latest: number | null; delta14d: number | null; target: number | null; loggedToday: boolean };
  meals:  { gradeToday: string | null; avgScore7d: number | null; loggedToday: boolean };
  economy: { gold: number; savingsProgress: number | null; budgetLeft: number | null };
  campaign: { chapter: number; medals: number } | null;
}
export function buildCoachContext(input: {...}): CoachContext;
// LLM に渡す整形テキスト(トークン節約のため簡潔な日本語箇条書き、~600字上限)
export function contextToPrompt(ctx: CoachContext): string;
```

- 入力は `Character` / `Quest[]` / `WeightEntry[]` / `MealEntry[]` / `SavingsEntry[]` の**生配列**。フック呼び出しはしない(テスト可能性のため)。
- 集計は既存関数を再利用:`evaluateDay`/`sumMeals`(`lib/nutrition.ts:147,182`)、`todayKey`/`yesterdayKey`(`lib/leveling.ts:69,77`)、`walletGold`(`lib/economy.ts`)。
- **テスト**(`src/lib/coach/__tests__/context.test.ts`):atRisk 判定(昨日◯今日✗のみ拾う)/ 7日推移の日付整列 / データ空でも落ちない / delta14d の符号。

# §2. L0 ルールベース・ダイジェスト(最初に価値が出る所)

**新規 `src/lib/coach/digest.ts`** — `CoachContext` から**決定論的に**「起動時あいさつ+今日の一手」を組む。

```ts
export interface CoachDigest {
  headline: string;      // 「おかえりなさい。3日ぶりですね」
  bullets: string[];     // 直近動向 最大3行(継続・体重・食事から効いてる順)
  callToAction: string;  // 「まずは『腕立て10回』——連続12日を守りましょう」
  mood: 'praise' | 'nudge' | 'rescue';  // UI の色味用(rescue=不在復帰)
}
export function buildDigest(ctx: CoachContext): CoachDigest;
```

- 優先順位ルール(上から最初に当たったものが callToAction):
  1. atRisk あり → その最長ストリークを守る一手
  2. 今日のデイリー未消化あり → 残り件数と一番軽い1件
  3. 体重/食事が今日未記録 → 記録を促す
  4. 全部済み → 称賛+明日の予告(mood: praise)
- 口調は v2 のナッジと同じ「アリア節」(です・ます、絵文字なし、押しつけない)。文言テンプレは配列で持ち、`ctx.today` の文字列ハッシュで選ぶ(**`Math.random()` 禁止** — テスト決定性のため)。
- **テスト**:優先順位の分岐網羅 / 同じ入力→同じ出力 / 空コンテキスト。

> これだけで「アプリ開いたら直近の動向を簡潔にまとめて何をやろうと喚起」の要件は satisfied。LLM は §3 以降の**上乗せ**。

# §3. エンジン抽象(差し替え可能なコーチの頭脳)

**新規 `src/lib/coach/engine.ts`**:

```ts
export type CoachEngineKind = 'rules' | 'webllm' | 'gemini';
export interface CoachMessage { role: 'user' | 'assistant'; text: string }
export interface CoachEngine {
  kind: CoachEngineKind;
  // ダイジェストの言い換え(nullなら L0 の文をそのまま使う)
  narrate(ctx: CoachContext, digest: CoachDigest): Promise<string | null>;
  // ログ参照つき対話。onToken でストリーミング表示
  chat(ctx: CoachContext, history: CoachMessage[], onToken?: (t: string) => void): Promise<string>;
}
export function detectBestEngine(hasGeminiKey: boolean): CoachEngineKind;
// 'gpu' in navigator && オプトイン済み → webllm、キーあり → gemini、他 → rules
```

- **システムプロンプト**は `mealAi.ts:15-24` の管理栄養士プロンプトを手本に、コーチ版を1つ(「システム」風・アリア口調・数値は渡されたコンテキストのみ引用・300字以内・医療/極端な助言禁止)。
- **rulesEngine**:`narrate` は null、`chat` は定型応答(「その質問には AI エンジンの有効化が必要です」+設定への導線)。

## 3-1. geminiEngine(工数最小のLLMパス)

- `mealAi.ts:113-178` の `requestMealReview` は Gemini 呼び出しとして汎用 — **`src/lib/gemini.ts` に `requestGemini({apiKey, model, system, messages})` として切り出し**、`mealAi.ts` は薄いラッパに変える(既存の食事レビューは無改修で通ること)。
- キーは既存 `useAiSettings`(localStorage、uid スコープ)を**そのまま共用**。設定 UI も食事タブに既にある。
- 制約:Gemini API はトークン単位ストリーミングを SSE で出せるが、既存実装は非ストリーム。v3 では**非ストリームで開始**し、応答全文を一括表示で可(300字以内なので体感は許容)。

## 3-2. webllmEngine(本題のローカルLLM)

**新規 `src/lib/coach/webllm.ts`**(必ず `await import('@mlc-ai/web-llm')` で遅延ロード):

```ts
export function webgpuAvailable(): boolean;          // 'gpu' in navigator
export async function loadLocalModel(
  modelId: string,
  onProgress: (p: { text: string; progress: number }) => void
): Promise<CoachEngine>;                              // CreateMLCEngine ラップ
export async function deleteLocalModel(modelId: string): Promise<void>;  // Cache Storage 掃除
```

- **モデル候補**(q4f16 系、Cache Storage にDLキャッシュ):

  | モデル | DL目安 | 日本語 | 位置づけ |
  |---|---|---|---|
  | Qwen2.5-1.5B-Instruct | ~1.0GB | ○ | **既定**。日本語と重さのバランス |
  | Llama-3.2-1B-Instruct | ~0.7GB | △ | 軽量側の逃げ道 |
  | Gemma-2-2B-it | ~1.4GB | ○ | 品質側(デスクトップ向け) |

  > **実装時の必須確認**:モデルIDは WebLLM の `prebuiltAppConfig.model_list` から**実在するIDを実行時に列挙**して選ばせること(本書のID表記をハードコードしない — ライブラリ更新で ID は変わる。Qwen3 系が入っていればそちらを既定候補に昇格してよい)。
- 生成は `engine.chat.completions.create({stream: true})` → `onToken` に流す。`max_tokens` 300 程度、`temperature` 0.7。
- **ガード**:`webgpuAvailable()` 偽なら設定画面でボタン自体を出さない(グレーアウト+理由表示)。ロード失敗(メモリ不足含む)は catch して gemini/rules に自動フォールバック+トースト。初回DLは**Wi-Fi 想定の明示同意**(容量を表示して「ダウンロード開始」を押させる)。`navigator.storage.persist()` を試みてキャッシュ蒸発を抑える。
- エンジン選択・DL済みモデルIDは **localStorage**(`useAiSettings` と同型の `slu:coachEngine:${uid}`)。端末能力に依存する設定なので Firestore に同期**しない**。

# §4. UI

| 部品 | 置き場所 | 内容 |
|---|---|---|
| **CoachCard**(新規) | `Dashboard.tsx` メインタブ、StatusPanel 直下 | `buildDigest` の headline+bullets+callToAction を常時表示。LLM 有効時は `narrate` 結果で言い換え(ロード中は L0 文を先に出す=**体感ゼロ遅延**)。「相談する」ボタンで CoachPanel へ |
| **CoachPanel**(新規) | 他パネル同様 `lazy()` +条件レンダ(`Dashboard.tsx:29-46` の並びに追加) | チャットUI。履歴は**メモリ+sessionStorage**(最大20往復、Firestore 保存なし)。ストリーミング表示。ヘッダにエンジン表示(ローカル/Gemini/ルール) |
| **設定** | メニュータブ(NavTile 追加)or CoachPanel 内の歯車 | エンジン選択・モデルDL/削除(容量表示)・Gemini キー(既存 `useAiSettings` を再掲) |

- ダイジェストは v2 の起動時ナッジ(`useGameData.ts:406-`)と**役割が重なる**:CoachCard 導入後、`reminder` トーストは「不在復帰(rescue)時のみ」に絞る(常設情報はカードに移す)。トースト連発を避ける。
- キャラ性:話者は既存ストーリーの案内役「アリア」。`02-story.md` のトーン(ゆるポップ)から逸脱しない。

# §5. 制約の直視(実装者への正直メモ)

1. **iOS でローカルLLMは当面「動けば儲け物」**。既定は `detectBestEngine` に任せ、iOS は実質 Gemini/rules。将来 iOS 側の WebGPU メモリ事情が改善したら設定から解禁するだけ。
2. **1〜2Bモデルの日本語はときどき破綻する**。システムプロンプトで「短く・箇条書き・数値はコンテキストの引用のみ」と縛り、`narrate` が空文字/異常に長い出力を返したら **L0 文へ差し戻す**(出力検証: 20〜400字、改行8行以内、数字はコンテキストに存在する値のみかの緩い検査)。
3. **熱と電池**:モバイルでの常時推論はしない。`narrate` は起動時1回+手動更新のみ、chat はユーザー発話駆動のみ。
4. **`prebuiltAppConfig` のバージョン追随**:`@mlc-ai/web-llm` はモデルリストが頻繁に変わる。package.json は**キャレットなし固定**で入れ、更新時にモデルIDテスト(list に既定IDが存在するか)を落として気づけるようにする。

---

# ロードマップ(推奨実装順)

各フェーズ末で `tsc -b` / `npm test` / `npm run build` green。C1〜C3 まで到達すれば iOS 含む全環境で「AIコーチ」が成立し、C4 はその上の完全無料・プライベート強化。

| 順 | フェーズ | 内容 | 効き目 | 工数 | 依存 |
|---|---------|------|--------|------|------|
| 1 | **C1 コンテキスト+ダイジェスト** | §1 `context.ts` + §2 `digest.ts` + テスト | 起動時サマリ(全環境・即時) | 小 | なし |
| 2 | **C2 UI 搭載** | §4 CoachCard(rules エンジン)+ v2 ナッジの整理 | 「開いたら話しかけてくる」体験 | 小 | C1 |
| 3 | **C3 Gemini エンジン** | §3-1 `gemini.ts` 切り出し + CoachPanel チャット | ログ参照対話(iOS 含む) | 中 | C2 |
| 4 | **C4 WebLLM エンジン** | §3-2 DL 管理 UI・ストリーミング・フォールバック | 完全無料・オフライン・プライベート | 中〜大 | C3(fallback 先として) |
| — | (将来) C5 | Chrome 内蔵 Prompt API エンジン / 週次ふりかえりレポート生成 | — | — | C4 |

> **私(提案者)の推し**:C1→C2 をまず出す。LLM ゼロでも「直近の動向まとめ+行動喚起」という依頼の核は満たせて、しかも全環境で確実に動く。C3 は既存コードの一般化だけなので安い。C4(ローカルLLM)は一番夢があるが、端末依存が強いので**最後に、フォールバックが揃った状態で**入れるのが安全。

# テスト方針(v1/v2 を踏襲)

- **純粋関数最優先**:`context.ts` / `digest.ts` は Firebase・LLM 非依存で全分岐をユニットテスト。
- エンジンは interface 越しにモック(`narrate`/`chat` をスタブ)して CoachCard のフォールバック挙動をテスト。
- `firebaseReady===false` / WebGPU なし / キーなしの3通りで**必ず rules に落ちる**ことを担保。
- 実機スモーク:デスクトップ Chrome でモデルDL→オフラインにして chat が動く(C4)/ iOS Safari で CoachCard・Gemini chat が動く(C3)。

## 変更が触るファイル(一覧)

| ファイル | 変更 |
|---|---|
| `src/lib/coach/context.ts`(新規) | §1 コンテキスト集約 |
| `src/lib/coach/digest.ts`(新規) | §2 ルールベース文生成 |
| `src/lib/coach/engine.ts`(新規) | §3 エンジン interface + rules/gemini 実装 |
| `src/lib/coach/webllm.ts`(新規) | §3-2 WebLLM ラッパ(動的 import) |
| `src/lib/gemini.ts`(新規) | `mealAi.ts:113-178` から汎用呼び出しを切り出し |
| `src/lib/mealAi.ts` | 上記切り出しの薄ラッパ化(挙動不変) |
| `src/components/CoachCard.tsx`(新規) | §4 ダイジェストカード |
| `src/components/CoachPanel.tsx`(新規) | §4 チャット+設定(lazy) |
| `src/components/Dashboard.tsx` | CoachCard マウント+lazy 登録+ナッジ整理 |
| `src/lib/coach/__tests__/*.test.ts`(新規) | §1/§2 テスト |
| `package.json` | `@mlc-ai/web-llm`(バージョン固定、C4 時点で追加) |

以上。実装の正は本章、既存 AI 配線の実態は `src/lib/mealAi.ts` / `src/hooks/useAiSettings.ts`、既存実装の実態は `IMPLEMENTATION-LOG.md` を参照。
