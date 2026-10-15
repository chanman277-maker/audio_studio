# Audio Studio Free

ブラウザ内で日本語の音声（MP3）を生成して保存できるシンプルなローカルTTSアプリケーションです。

主な特徴
- テキストを入力して日本語音声を生成（PiperPlus を使用）
- 生成した音声をMP3に変換して IndexedDB にローカル保存
- 一覧から再生・ダウンロード・削除が可能
- テキストのバックアップ（JSON）と復元（音声は再生成が必要）

注意（必ずお読みください）
- モデルとランタイムはブラウザにダウンロードされます。初回の読み込みは数十MB〜それ以上の通信が発生する場合があります。
- 生成は端末（ブラウザ）上で行われます。生成済みのMP3は端末にのみ保存され、無料版ではクラウド同期はありません。
- ブラウザによっては WebGL/WASM の実装差により動作が変わります。Chromium 系（Chrome / Edge / Brave）での動作が比較的安定しています。

動作環境
- Node.js（開発時、依存パッケージをインストールするため）
- モダンなデスクトップブラウザ（Chrome、Edge、Firefox、Safari など）

ローカルでの起動（開発）
1. リポジトリをクローン
   ```bash
   git clone https://github.com/chanman277-maker/audio_studio.git
   cd audio_studio
   ```
2. 依存インストール
   ```bash
   npm install
   ```
3. 開発サーバ起動
   ```bash
   npm run dev
   ```
4. ブラウザで開く
   - デフォルト: http://localhost:5173

ビルドと公開
- ビルド
  ```bash
  npm run build
  ```
- ビルド結果は `dist/` に出力されます。静的ホスティング（GitHub Pages など）へ配置可能です。

ファイル/構成の説明
- index.html — アプリのHTML（UI）
- src/main.js — 音声生成とUIロジック（PiperPlus, onnxruntime-web, lamejs を利用）
- package.json, vite.config.js — Vite 開発環境設定

バックアップ / 復元
- 「一覧をバックアップ」ボタンはテキスト情報（JSON）だけを保存します。MP3は含まれないため、別途ダウンロードしてください。
- 復元したテキストは "音声未生成" とマークされます。復元後は再生成してMP3を作成してください。

トラブルシューティング
- モデルの読み込みに失敗する場合
  - ネットワーク接続を確認してください。
  - ブラウザのコンソールに出るエラーを貼っていただければ個別に調査します。
- ブラウザで音が出ない/音声が生成されない場合
  - ブラウザが WebAudio / WebAssembly をサポートしているか確認してください。
  - コンソールのエラーを確認してください。

依存・参照
- piper-plus — ブラウザ上での音声合成エンジン
- onnxruntime-web — ONNX ランタイム（WASM / WebGL）
- lamejs — MP3 エンコード

ライセンス
MIT

貢献
バグ報告・改善提案は Issue を立ててください。簡単な修正はプルリクエスト歓迎します。

作者
chanman277-maker
