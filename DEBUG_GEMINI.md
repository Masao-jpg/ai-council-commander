# Gemini API エラーのデバッグ

## 🔴 発生したエラー

```
403 Forbidden: Method doesn't allow unregistered callers
```

このエラーは、Gemini APIキーが無効か、APIが有効化されていないことを示しています。

## ✅ 解決方法

### 1. Google AI Studioで新しいAPIキーを取得

1. https://makersuite.google.com/app/apikey にアクセス
2. Googleアカウントでログイン
3. 「Create API Key」をクリック
4. 新しいAPIキーをコピー

### 2. APIキーを更新

`server/.env` ファイルを編集：

```bash
GEMINI_API_KEY=新しいAPIキーをここに貼り付け
PORT=3001
NODE_ENV=development
```

### 3. サーバーを再起動

```bash
# 既存のサーバーを停止 (Ctrl+C)
# デスクトップアイコンをダブルクリックして再起動
```

## 🧪 APIキーのテスト

サーバー起動後、以下のURLにアクセス：

```
http://localhost:3001/api/debate/test-gemini
```

成功すると以下のようなレスポンスが返ります：

```json
{
  "success": true,
  "message": "Gemini API is working",
  "response": "こんにちは...",
  "duration": "1234ms"
}
```

## 📝 現在のAPIキー情報

- **APIキー**: AIzaSyBPVYV4mlGMwgE6BEUEg_35M5zjh3EDfLI
- **ステータス**: ❌ 無効または未承認

## 🔧 トラブルシューティング

### 問題1: APIキーが無効
→ 新しいAPIキーを取得してください

### 問題2: Generative Language APIが無効
→ Google Cloud Consoleで有効化してください：
   https://console.cloud.google.com/apis/library/generativelanguage.googleapis.com

### 問題3: 課金アカウントが未設定
→ Google Cloudで課金アカウントを設定してください

### 問題4: API利用制限
→ APIの割り当て制限を確認してください

## 🚀 次のステップ

1. ✅ 新しいAPIキーを取得
2. ✅ server/.envファイルを更新
3. ✅ サーバーを再起動
4. ✅ http://localhost:3001/api/debate/test-gemini でテスト
5. ✅ 成功したらアプリを使用開始

## 📞 サポート

Google AI Studio: https://makersuite.google.com/
Gemini APIドキュメント: https://ai.google.dev/
