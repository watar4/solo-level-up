# 10. サーバーサイドAIへの移行(ストア公開向け) 検討資料

> **ステータス:未実装(検討資料)。** App Store 等への一般公開時に、
> 「ユーザーが Gemini API キーを自分で発行して貼り付ける」現行方式(BYOK)をやめ、
> **アプリに最初から組み込まれたAI**(キーはサーバー側)に切り替えるための実装方法と考慮事項をまとめる。
> 前提コードは 2026-07-13 時点の `main`(commit `b4cd7c5`)。

---

## 0. 現状と、なぜ公開時に BYOK では駄目か

**現状**:AI 呼び出しは2箇所のみ。どちらも `apiKey` を引数に取り、ブラウザから Gemini REST API を直叩きしている。

| 機能 | 実装 | 呼び出し |
|---|---|---|
| 食事レビュー(AI Coach) | `src/lib/mealAi.ts` `requestMealReview({apiKey, model, message})` | テキストのみ |
| 食事の自動入力(写真OCR/推定) | `src/lib/mealEstimate.ts` `requestMealEstimate({apiKey, model, name, image})` | マルチモーダル |
| キー管理 | `src/hooks/useAiSettings.ts`(localStorage、uid スコープ) | — |

**公開時の問題**:
1. **UX の壁**:一般ユーザーに「Google AI Studio でキーを発行して貼る」は求められない。機能が事実上死ぬ。
2. **かといって開発者のキーをクライアントに埋め込むのは絶対不可**:JS バンドルからキーは数分で抽出され、第三者に使い放題にされる(請求は開発者持ち)。「リファラ制限付きキー」も偽装可能で防御にならない。
3. **無料枠の規約とプライバシー**:Gemini API 無料枠は**入力データがモデル改善に利用され得る**。自分専用なら許容でも、他人の食事写真を無断でそこに流すのは公開アプリとして不適切(プライバシーポリシー上も説明が苦しい)。

→ 結論:**キーをサーバー側に置き、クライアントは認証済みの窓口だけを叩く**構成に移行する。

## 結論(推奨)

**Firebase AI Logic + Firebase App Check + Firestore ベースの per-user クォータ**を推奨する。

理由:このアプリは既に Firebase(Auth + Firestore)の上に建っており、**自前サーバーを1行も書かずに**「キー非公開・乱用対策・利用量監視」が揃う唯一の選択肢だから。専用バックエンドの新設(Cloud Functions / Workers)は、プロンプトの完全秘匿や独自課金が必要になった段階で足せばよい。

---

## §1. アーキテクチャ選択肢の比較

| 方式 | 仕組み | 長所 | 短所 | 費用 |
|---|---|---|---|---|
| **A. Firebase AI Logic**(推奨) | Firebase クライアント SDK(`firebase/ai`)が Google のプロキシ経由で Gemini を呼ぶ。キーは端末に存在しない | サーバー実装ゼロ/既存 Firebase に自然に統合/App Check で乱用防止/マルチモーダル対応/コンソールに AI 監視ダッシュボード | プロンプトがクライアントに残る(隠せない)/細かいレート制御は自前(§3)/Vertex AI バックエンドは Blaze(従量)プラン必須 | Gemini API 従量(§4)。Developer API バックエンドなら無料枠から開始可 |
| B. Cloud Functions(自前プロキシ) | `onCall` 関数がキーを Secret Manager から読み、Gemini を叩く。クライアントは Auth トークン付きで関数を呼ぶ | プロンプト・モデル名を完全にサーバー秘匿/レート制限・ログ・課金を関数内で自由に実装/将来の課金機能(IAP検証)と同居できる | サーバーコードの保守が発生/コールドスタート(画像で体感しやすい)/Blaze 必須 | 関数実行費(微少)+ Gemini 従量 |
| C. Cloudflare Workers 等の外部エッジ | Worker がキーを保持し、Firebase ID トークンを JWKS で検証してから中継 | 無料枠が厚い(10万req/日)/Blaze 不要/低レイテンシ | Firebase 外に運用対象が増える/App Check との統合は自前/トークン検証の実装責任 | ほぼ無料+ Gemini 従量 |
| D. BYOK 併存(現状維持+) | 上記いずれかを既定にし、設定画面の奥に現行 BYOK を残す | ヘビーユーザーが自分の枠で使える/開発者コスト転嫁 | 露出させると審査・サポートが面倒 | — |

> **判断**:まず A。B は「プロンプトを秘匿したくなった」「サブスク課金を始めた」時点で A から差し替え(クライアント側はゲートウェイ interface(§6)のおかげで transport 差し替えだけで済む)。C は Firebase 課金を避けたい場合の代替。D は隠しオプションとして残す価値あり(開発・検証にも便利)。

## §2. 推奨構成(A)の実装スケッチ

### 2-1. クライアント(既存2関数の置き換え)

`firebase` v12 系は `firebase/ai` を同梱している(追加依存なし)。**実装時に SDK の正確な API 形状を要確認**(この分野は改名が多い。旧称 "Vertex AI in Firebase")。

```ts
// src/lib/aiGateway.ts(新規)— 呼び出し口を1つに集約
import { getAI, getGenerativeModel, GoogleAIBackend } from 'firebase/ai';
import { app } from '../firebase';

const ai = getAI(app, { backend: new GoogleAIBackend() }); // or VertexAIBackend
const model = getGenerativeModel(ai, { model: 'gemini-2.5-flash' });

export async function generate(parts: Part[], config: GenConfig): Promise<string> {
  const res = await model.generateContent({ contents: [{ role: 'user', parts }], generationConfig: config });
  return res.response.text();
}
```

- `mealAi.ts` / `mealEstimate.ts` は fetch 部分だけをこの `generate()` に差し替え。**プロンプト・パース(`parseMealEstimate` 等)・画像縮小は無改修で流用**できる。
- 既存の `system_instruction` / `responseMimeType: 'application/json'` / `thinkingConfig` 相当は SDK のオプションで同等指定が可能。

### 2-2. App Check(乱用対策の土台・必須)

キーが消えても「**正規アプリ以外からエンドポイントを叩かれる**」攻撃面は残る。App Check はリクエストに「本物のアプリから来た」証明を付ける仕組みで、Firebase AI Logic はこれと直結できる。

| 配布形態 | アテステーション |
|---|---|
| Web(PWA/GitHub Pages) | reCAPTCHA Enterprise(または v3) |
| iOS(Capacitor でラップ、§5) | **App Attest / DeviceCheck**(要 Apple Developer アカウント・実 bundle ID) |
| Android | Play Integrity |

- 導入は `initializeAppCheck(app, { provider, isTokenAutoRefreshEnabled: true })` を `src/firebase.ts` に足すだけ。移行期間は「メトリクスのみ(未強制)」で影響を観測してから強制に切り替えられる。
- **限界も正直に**:App Check は敷居を大きく上げるが絶対ではない(実端末上の改造アプリ等)。だから §3 のクォータが二段目として要る。

### 2-3. Remote Config(プロンプトとモデルの遠隔管理)

モデル名・システムプロンプト・機能フラグ(AI機能のキルスイッチ)を **Firebase Remote Config** に載せる。

- 効能:**アプリの再リリース(=Apple 審査)なしで**プロンプト改善・モデル切替・緊急停止ができる。ネイティブ配布では審査に数日かかるため、これの有無で運用が段違い。
- 現在ハードコードされている `SYSTEM_PROMPT`(mealAi.ts / mealEstimate.ts)を RC キー(fallback はコード内既定値)にする。

## §3. 乱用対策・課金ガード(サーバーAI化で新たに背負うもの)

BYOK では「使いすぎ=そのユーザー自身の枠が枯れる」だけだったが、サーバーAI化後は**全ユーザーの利用が開発者の請求書に直結**する。ここが最大の考慮事項。

1. **per-user 日次クォータ(必須)**
   - 例:食事の自動入力 20回/日・レビュー 5回/日。無料機能としては十分、暴走・悪用時の損害上限が計算できる。
   - 実装:`usage/{uid}/{YYYY-MM-DD}` ドキュメントにカウンタ。クライアントは呼び出し前に increment → 超過なら呼ばない。Firestore ルールで「自分のカウンタは increment のみ可・減算不可・上限超の書込拒否」を強制すれば、クライアント改造でもすり抜け不可(方式 A ではこれが唯一のサーバー側強制点。方式 B なら関数内で強制でき、より確実)。
2. **入力の上限**:画像は既存の 1280px 縮小(実装済み)+ base64 で ~500KB 上限チェック、テキストは длина制限。`maxOutputTokens` は現行どおり小さく。
3. **プロジェクト側の防波堤**:
   - Google Cloud **予算アラート**(例:$10/$25/$50 で通知)。※予算アラートは**自動停止ではない**。
   - Gemini API 側の**プロジェクト単位クォータ(RPM/RPD)を手動で低めに設定**——これが事実上のハードキャップになる。
   - Firebase コンソールの AI Logic 監視ダッシュボードで異常検知。
4. **認証ゲート**:AI 呼び出しは**サインイン済みユーザーのみ**(既に全機能が Auth 前提なので追加コストなし)。匿名認証は許可しない(クォータ回避の温床)。
5. **プロンプトインジェクション**:栄養抽出はスキーマ固定 JSON+`parseMealEstimate` のクランプ(実装済み)が既に防御になっている。レビュー系も出力は表示のみで、ツール実行等の権限を持たせない設計を維持する。

## §4. コスト試算(目安。単価は実装時に要再確認)

gemini-2.5-flash 従量(2025年時点の公表値目安:入力 ~$0.30/1M tokens、出力 ~$2.50/1M tokens):

| 操作 | トークン目安 | 1回あたり |
|---|---|---|
| 食事写真の自動入力(1280px画像+短文) | 入力 ~1.5k + 出力 ~0.2k | **~$0.001(≒0.15円)** |
| 食事レビュー(1週間ぶんテキスト) | 入力 ~1.5k + 出力 ~0.4k | ~$0.0015 |

- 月間アクティブ 100人 × 1日5回 × 30日 = 15,000回/月 → **月 $15〜25 程度**。флash-lite に落とせば 1/3。個人開発の持ち出しとしては現実的な水準だが、**ユーザー数に線形比例**するので、伸びたら §6 の課金(サブスク)を検討。
- **無料枠で始める場合の罠**:Developer API バックエンドの無料枠は**プロジェクト単位**(例:2.5-flash で ~10 RPM / 250 RPD)。BYOK では「1ユーザーの枠」だったものが「**全ユーザーで共有する枠**」になるため、ユーザー数十人で即枯れる。公開するなら最初から従量(Blaze)前提で予算を組むこと。

## §5. App Store 掲載そのものの考慮(AI 以外も含む)

1. **PWA のままでは App Store に載らない**。ラッパーが必要 → このスタック(Vite+React)なら **Capacitor** が素直。
   - **Firebase Auth の Google ログインは WKWebView で `signInWithPopup/Redirect` が動かない**(Google が WebView での OAuth をブロック)。ネイティブの Google Sign-In プラグイン → `signInWithCredential` への差し替えが必須。Sign in with Apple の追加も**審査要件**(3rd party ログインを出すなら Apple ログイン併設が原則必要)。
   - GitHub Pages 前提の `base: '/solo-level-up/'`(vite.config.ts)は Capacitor ビルドでは `/` に切替が要る。
   - SW キャッシュ・オフライン(v2 で実装済み)は Capacitor 内でも概ねそのまま活きる。
2. **審査・法務**:
   - **アカウント削除機能が必須**(App Store Review 5.1.1(v)。アカウント作成があるアプリは、アプリ内から削除できること)→ 既存 `resetAccount` はデータ消去。**Auth ユーザー自体の削除**まで含める改修が必要。
   - **プライバシーポリシー必須**+App Store の「アプリのプライバシー」欄で申告:食事写真・食事記録が AI 処理のため Google(Gemini API)に送信されること、**従量(有料)API ではプロンプトがモデル学習に使われない**こと(これが§0の「無料枠は学習に使われ得る」問題の解でもある)。
   - **健康系の免責**:栄養値は推定であり医療助言ではない旨を UI と説明文に明記(現状の「(目安)」表示は良い方向。説明ページにも一文)。
   - **生成AIの内容統制**:Gemini のセーフティ設定は既定で有効。本アプリは自由対話を持たない(構造化抽出+定型レビューのみ)ため、審査上のリスクは低い。
   - 将来 AI 機能を有料化する場合、**デジタル機能の課金は IAP 経由が原則**(3.1.1)。外部決済リンクは(地域の例外を除き)不可と考えておく。
3. **App Check(§2-2)は Apple Developer アカウントと実機 bundle ID が前提**。ストア公開作業と同じタイミングで設定するのが効率的。

## §6. 段階的移行プラン(実装するときのロードマップ)

| 順 | フェーズ | 内容 | 備考 |
|---|---|---|---|
| 1 | **S1 ゲートウェイ化** | `aiGateway.ts` を新設し、`mealAi.ts`/`mealEstimate.ts` の fetch を transport 差し替え可能に(`byok` \| `server`)。挙動不変・テスト流用 | 低リスク。BYOK のまま出荷可能 |
| 2 | **S2 Firebase AI Logic 接続(Web)** | Blaze 化 → `firebase/ai` で server transport 実装 → Remote Config にプロンプト/モデル/キルスイッチ → App Check(reCAPTCHA、まず未強制) | ここで「キー貼り付け不要」が実現 |
| 3 | **S3 クォータ+監視** | `usage/{uid}` カウンタ+Firestore ルール強制、予算アラート、プロジェクトクォータ設定、App Check 強制化 | **これを終えるまで一般公開しない** |
| 4 | **S4 ストア対応** | Capacitor ラップ、ネイティブ Google/Apple ログイン、アカウント削除、App Attest、プライバシー表記、審査提出 | AI と独立して工数大。別増分扱い |
| — | (任意) S5 | Cloud Functions プロキシへ移行(プロンプト秘匿・IAP 連動クォータ) | 必要になってから |

## 実装時の要確認チェックリスト

- [ ] `firebase/ai`(AI Logic)の現行 API 形状・対応モデル・App Check 連携手順(公式ドキュメント。改名履歴が多い領域)
- [ ] Gemini 従量単価と無料枠 RPM/RPD の最新値(§4 の試算を更新)
- [ ] 従量プランでの「プロンプトを学習に使わない」規約文言の最新確認(プライバシーポリシーに引用するため)
- [ ] Firestore ルールでのカウンタ上限強制の書き方(increment-only + 上限チェック)の実装テスト
- [ ] Capacitor + Firebase Auth(Google/Apple ネイティブログイン)の動作検証
- [ ] App Store 審査ガイドライン(5.1.1 アカウント削除 / 3.1.1 IAP / AI 関連)の最新版確認

以上。実装判断が出たら S1 から着手する(S1 は既存挙動を変えないため、いつでも安全に始められる)。
