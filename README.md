# ルーティン盤面

マス目状の盤面でルーティンを1つずつチェックしていく、ボードゲーム風のルーティン管理PWA。

## 機能

- ルーティン盤面: マス目をタップしてチェック。過去14日分の後追い入力も可
- ToDoレーシング: 完了するほど車がゴールに近づく単発ToDoリスト
- バックアップ: 設定画面からJSONエクスポート/インポート

## 構成

- HTML/CSS/JavaScript のみの静的サイト（ビルド工程なし・依存パッケージなし）
- データは端末の localStorage に保存（サーバーには何も送らない）

## 開発時の動作確認

`index.html` をブラウザで直接開けば動く（service worker はHTTPS配信時のみ有効）。

## 公開（GitHub Pages）

1. GitHubに公開リポジトリを作成して push
2. リポジトリの Settings → Pages → Branch: `main` / `(root)` を選んで保存
3. `https://<ユーザー名>.github.io/<リポジトリ名>/` を Android の Chrome で開き、メニューから「ホーム画面に追加」
