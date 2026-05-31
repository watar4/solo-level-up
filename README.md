# Solo Level Up

「俺だけレベルアップな件」のシステムウィンドウ風 UI で、毎日の習慣をクエスト化して
レベルアップしていく Web アプリ。

- Google ログイン (Firebase Auth)
- データは Firestore に保存。複数端末でも同じアカウントで同期
- React + Vite + TypeScript + Tailwind CSS + Framer Motion
- GitHub Pages に GitHub Actions で自動デプロイ

## 主な機能

- **ステータスウィンドウ**: Lv / Rank / EXP バー / 5 ステータス (STR/AGI/INT/VIT/PER)
- **クエスト**: デイリー / ウィークリー / 単発 の 3 種類。難易度 E〜S で EXP が変動
- **連続日数 (Streak) ボーナス**: 連続達成で EXP +10% / 日 (最大 2 倍)
- **レベルアップ演出**: フラッシュ + ステータスポイント獲得アニメーション
- **ランク**: Lv 1-9: E / 10: D / 20: C / 30: B / 40: A / 50: S / 60+: SS

## iPhone ヘルスケア連携(体重の自動取り込み)

iPhone の「ヘルスケア → 体重」を保存したタイミングで、iOS Shortcut から
Firestore に直接 POST → 次回アプリ起動時に取り込まれる仕組みです。
専用サーバー不要・追加費用 0 円。

### 仕組み(ユーザー別 API キーで隔離)

1. アプリの **「連携」ボタン → API キーを発行**(秘密文字列が 1 回だけ表示される)
2. その文字列を iPhone Shortcut の JSON ボディに貼り付け
3. Shortcut から `weightInbox` コレクションに POST
4. Firestore ルールが `apiKeys/{secret}.uid == payload.uid` を検証
   → 他人のキーで他人の uid に書き込むことは不可能
5. アプリ次回起動時、`drainWeightInbox` が `weightEntries` に変換

### iOS Shortcut の組み方

1. ショートカット App → **オートメーション → 新規 → ヘルスケア → 体重 → 値が変化したとき**
2. 以下を順番に追加:

   | アクション | 設定 |
   |---|---|
   | ヘルスケアサンプルを取得 | サンプルタイプ: 体重 / 期間: 直近 / 制限: 1 |
   | テキスト(辞書本文) | アプリの「連携」パネルに表示される JSON テンプレをコピペ |
   | URL を取得 | アプリの「連携」パネルに表示される Firestore URL |
   | URL の内容を取得 | メソッド: POST / 本文: JSON / 上のテキストを設定 |

3. JSON の `weight` 値はヘルスケアの「数量」変数、`recordedAt` は「開始日」を ISO 8601 形式に変換した変数を埋め込み
4. 動作確認: 適当に体重を 1 回手動入力 → アプリを再読み込み → トーストで「ヘルスケアから N 件取り込み」が出れば成功

### キーの管理

- アプリの **連携 → 発行済みのキー** から旧キーを削除すれば即無効化
- キーが漏洩した疑いがある場合も同じ手順でローテーション可能
- 失効したキーで送信された POST は Firestore ルールで拒否される(自分の他のデータには絶対影響しない)

## 開発環境のセットアップ

```powershell
cd C:\Users\ihciu\ツール\solo-level-up
npm install
```

### Firebase プロジェクトを用意

1. <https://console.firebase.google.com/> で新しいプロジェクトを作成 (Analytics は無しでOK)
2. 「ビルド > Authentication > Sign-in method」で **Google** を有効化
3. 「ビルド > Firestore Database」を作成 (本番モードで開始)
4. プロジェクト設定 → **マイアプリ → Web** で新規アプリを登録し、構成オブジェクトを取得
5. `firestore.rules` の内容を「ルール」タブに貼り付けて公開
6. 「Authentication > Settings > 承認済みドメイン」に下記を追加:
   - `localhost` (デフォルト)
   - `<github-user>.github.io` (公開 URL)

### `.env.local` を作成

```powershell
Copy-Item .env.example .env.local
```

`.env.local` に Firebase コンソールで取得した値を貼り付け。

### ローカル起動

```powershell
npm run dev
```

<http://localhost:5173/solo-level-up/> でアプリが立ち上がります。

## GitHub に公開する

```powershell
git init
git add .
git commit -m "Initial Solo Level Up"
gh repo create solo-level-up --public --source=. --push
```

GitHub 上で **Settings → Pages → Source = GitHub Actions** に設定。

その後、**Settings → Secrets and variables → Actions** で以下のシークレットを登録:

| Name | Value |
| ---- | ----- |
| `VITE_FIREBASE_API_KEY` | apiKey |
| `VITE_FIREBASE_AUTH_DOMAIN` | authDomain |
| `VITE_FIREBASE_PROJECT_ID` | projectId |
| `VITE_FIREBASE_STORAGE_BUCKET` | storageBucket |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | messagingSenderId |
| `VITE_FIREBASE_APP_ID` | appId |

main にプッシュすると `.github/workflows/deploy.yml` が走り、
`https://<github-user>.github.io/solo-level-up/` に公開されます。

> **メモ**: リポジトリ名を変える場合は `vite.config.ts` の `base` も合わせて変更してください
> (例: `/<repo>/`)。

## ディレクトリ構成

```
src/
  App.tsx                       # ルーティング (login / character / dashboard)
  firebase.ts                   # Firebase 初期化 + env 検出
  types.ts                      # Character / Quest / StatKey
  hooks/
    useAuth.ts                  # Google ログイン状態管理
    useGameData.ts              # キャラクター + クエスト購読 + 完了処理
  lib/
    firestore.ts                # Firestore CRUD ラッパ
    leveling.ts                 # EXP 曲線 / ランク判定 / 日付ユーティリティ
  components/
    LoginScreen.tsx
    CharacterCreation.tsx
    Dashboard.tsx
    StatusPanel.tsx
    QuestCard.tsx
    AddQuestModal.tsx
    LevelUpToast.tsx
    SystemWindow.tsx            # 共通のシステムウィンドウシェル
firestore.rules                 # uid ベースの所有権ルール
.github/workflows/deploy.yml    # GH Pages デプロイ
```
