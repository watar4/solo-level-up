# DS検定 問題演習アプリ

データサイエンティスト検定 リテラシーレベル（**DS検定★**）合格を目的とした、個人学習用の問題演習アプリです。
**GitHub Pages 上の静的Webアプリ**として動作し、演習・採点・成績管理はすべてブラウザ内（localStorage）で完結します。

- 分野別練習 / ランダム練習 / 模擬試験（100問100分）/ 復習（間隔反復ライト）
- 分野別の成績可視化・履歴・推移グラフ
- 問題は静的JSON同梱 + AI生成 + JSONインポートで拡充（コード変更不要）
- **AI問題生成**：方式A（ローカル事前生成）と方式B（アプリ内BYOK）
- AI生成を除く全機能がオフラインで動作

## 技術スタック

Vite + React + TypeScript / Tailwind CSS / Zustand（localStorage 永続化）/ React Router（**HashRouter**）/ Recharts / react-markdown

## セットアップ・起動

```bash
npm install
npm run dev      # 開発サーバ（http://localhost:5173/ds-quiz/）
npm run build    # 本番ビルド -> dist/
npm run preview  # ビルド結果のプレビュー
npm run lint     # 型チェック（tsc --noEmit）
```

> Vite の `base` は `'/ds-quiz/'`（GitHub Pages プロジェクトサイト用）。ローカルで `/` 配信したい場合は `VITE_BASE=/ npm run dev`。

## 問題データの追加（コード変更不要）

問題は次の3経路で増やせます。いずれも 5.1 スキーマに準拠します。

1. **同梱バンクに直接追記**：`src/data/questions.json` に追記してコミット（方式Aのスクリプトが自動で行います）。
2. **AI生成（アプリ内・方式B）**：`AI生成` 画面で生成 → プレビュー → 採用。localStorage に保存されます。
3. **JSONインポート**：`設定` 画面の「問題JSONを取込」から取り込み。

### 問題スキーマ（抜粋）

```jsonc
{
  "id": "ds-0001",
  "category": "データサイエンス力",      // 4分類のいずれか
  "subCategory": "統計数理基礎",
  "type": "single",                     // "single" | "multiple"
  "difficulty": 2,                       // 1〜3
  "question": "設問（Markdown可）",
  "choices": [{ "key": "a", "text": "..." }],
  "answer": ["b"],                       // 正解キーの配列
  "explanation": "解説（Markdown可）",
  "tags": ["..."],
  "origin": "builtin"                    // "builtin" | "ai-generated" | "imported"
}
```

## AI問題生成

### 方式A：ローカル事前生成（推奨・既定）

ローカルPCでスクリプトを実行して問題を生成し、レビューしてコミットします。公開サイトは静的・オフラインのままです。

```bash
cp .env.example .env
# .env を開いて ANTHROPIC_API_KEY=実値 を設定（.env は .gitignore 済み）

npm run generate -- --category "データサイエンス力" --subCategory "統計数理基礎" --difficulty 2 --count 5
npm run generate -- --category "ビジネス力" --count 3 --dry-run   # 追記せず確認のみ
```

引数: `--category`（必須）/ `--subCategory` / `--difficulty 1-3` / `--count` / `--model` / `--dry-run`。
生成結果は `src/data/questions.json` に追記されるので、`git diff` で内容を確認してからコミットしてください。

### 方式B：アプリ内生成（BYOK＝キー持ち込み・任意）

`設定` 画面で自分の Anthropic APIキーを入力し、`AI生成` 画面から生成します。

## 🔑 APIキーの取り扱い（BYOK / 厳守）

- **APIキーはソースコード・リポジトリ・ビルド成果物・Actions ログに一切含めません。**
- 方式A：キーはローカルの `.env`（.gitignore 済み）または OS 環境変数からのみ読み込みます。
- 方式B：キーは**あなたのブラウザの localStorage にのみ保存**され、サーバーやリポジトリには送信・保存されません。設定画面で伏字表示・消去できます。共用端末では使用後に必ず消去してください。
- 本番ビルド（公開サイト）はキーを一切必要としません。

## GitHub Pages へのデプロイ

1. このプロジェクトを `ds-quiz` リポジトリに push。
2. リポジトリ **Settings → Pages → Source** を「**GitHub Actions**」に設定。
3. `main` への push で `.github/workflows/deploy.yml` が自動ビルド＆公開。
4. 公開URL: `https://<あなたのGitHubアカウント名>.github.io/ds-quiz/`

> リポジトリ名を変える場合は `vite.config.ts` の `base` を合わせて変更してください（例: `base: '/<repo>/'`）。ワークフローには秘密情報を渡しません。

## データのバックアップ

`設定` 画面から全学習データ（成績・履歴・生成問題・設定）をJSONでエクスポート/インポートできます。生成・取込問題だけを書き出して方式Aの問題バンクへ取り込むこともできます。
