# Firestoreルールの認可回帰テスト

Node.js 24とJava 21以上を用意し、このディレクトリで実行します。

```sh
npm ci --ignore-scripts
npx firebase emulators:exec --only firestore --project demo-security-fixes --config ../firebase.test.json "node --test gates.test.mjs"
```

デモ専用プロジェクトと127.0.0.1:18080だけを使います。本番DBや本番の資格情報は不要です。
所有者による作成・更新・削除、他ユーザーによるUIDの乗っ取り拒否、未認証の書き込み拒否、読み取り用ショートカットの互換性、private characterの所有者制限を確認します。

ここで使うFirebase CLI等はテスト専用です。アプリの依存関係や公開バンドルには含めません。

2026-10-22の監査では、grpc-jsを修正版にoverrideした上で、テスト用ツリーにHigh 3 / Moderate 4の警告が残っています。現行Firebase CLIのchokidar/bracesやPub/Sub・gaxiosの推移依存が対象です。本番の資格情報を渡したり、エミュレーターをネットワーク公開したりせず、上記デモプロジェクトとlocalhostでだけ利用してください。
