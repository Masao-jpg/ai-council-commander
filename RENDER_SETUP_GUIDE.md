# Render セットアップガイド（Google Drive連携）

このガイドでは、RenderでGoogle Drive連携を正しく設定する方法を説明します。

## 重要な前提知識

**普通のAPIキーとサービスアカウントキーの違い：**

| 種類 | 環境変数に入れるもの | 例 |
|------|---------------------|-----|
| **普通のAPIキー** | キー本体（文字列） | `GEMINI_API_KEY=AIza...` |
| **サービスアカウントキー** | **ファイルのパス** | `GOOGLE_SERVICE_ACCOUNT_KEY=server/google-credentials.json` |

❌ **間違った理解：** 「環境変数に全部入れればいい」
✅ **正しい理解：** 「ファイルを作成 + パスを指定」の2ステップ

---

## Renderでの正しい設定手順

### 1. Google Cloud Consoleでの準備

1. **プロジェクトを作成/選択**
   - [Google Cloud Console](https://console.cloud.google.com) にアクセス
   - 新しいプロジェクトを作成、または既存のプロジェクトを選択

2. **APIを有効化**
   - 「APIとサービス」 > 「ライブラリ」
   - 以下のAPIを検索して有効化：
     - Google Docs API
     - Google Drive API

3. **サービスアカウントを作成**
   - 「IAMと管理」 > 「サービスアカウント」
   - 「サービスアカウントを作成」をクリック
   - 名前を入力（例: `ai-council-docs`）
   - 「キーを作成」 > 「JSON」を選択してダウンロード
   - **サービスアカウントのメールアドレスをコピー**
     - 形式: `ai-council-docs@project-id.iam.gserviceaccount.com`

4. **Google Driveフォルダを準備**
   - Google Driveでドキュメント保存用のフォルダを作成
   - フォルダを**サービスアカウントのメールアドレスと共有**（編集者権限）
   - フォルダのIDをコピー
     - URL: `https://drive.google.com/drive/folders/FOLDER_ID_HERE`
     - `FOLDER_ID_HERE` の部分がフォルダID

### 2. Renderでの設定

#### Step 1: Secret Files（ファイルの実体を作る）

1. Renderダッシュボードで対象サービスを選択
2. 左メニューから **「Secret Files」** をクリック
3. **「Add Secret File」** をクリック
4. 以下のように設定：
   - **Filename:** `google-credentials.json`
     - ⚠️ **注意:** スラッシュ（`/`）は使用できません
   - **File Content:** ダウンロードしたJSONファイルの中身を全てコピペ
     ```json
     {
       "type": "service_account",
       "project_id": "your-project-id",
       "private_key_id": "...",
       "private_key": "-----BEGIN PRIVATE KEY-----\n...",
       ...
     }
     ```
5. **Save** をクリック

#### Step 2: Environment Variables（ファイルの場所を教える）

1. 左メニューから **「Environment」** をクリック
2. 既存の環境変数を編集または新規追加：

```bash
# 必須
GEMINI_API_KEY=your_gemini_api_key_here

# Google Drive連携（オプション）
GOOGLE_SERVICE_ACCOUNT_KEY=google-credentials.json
GOOGLE_DRIVE_FOLDER_ID=your_folder_id_here

# その他
PORT=3001
```

3. **⚠️ 最重要：** `GOOGLE_SERVICE_ACCOUNT_KEY` の値は **`google-credentials.json`** （ファイルパス）
   - ❌ **間違い:** JSON文字列を直接入れる
   - ✅ **正しい:** ファイルパスを入れる

4. **Save Changes** をクリック

#### Step 3: デプロイ

1. 環境変数を保存すると自動的に再デプロイが開始されます
2. ログを確認して正常に起動したか確認

---

## 動作確認

### 1. アプリにアクセス
   - Renderのデプロイ完了後、URLにアクセス

### 2. Google Docsエクスポートをテスト
   - 評議会を実行して成果物を作成
   - 「Google Docs」ボタンをクリック
   - ✅ 成功: 「Document created successfully」というメッセージとリンクが表示される
   - ❌ 失敗: エラーメッセージを確認（下記トラブルシューティング参照）

### 3. Google Driveで確認
   - 指定したフォルダにドキュメントが作成されているか確認

---

## トラブルシューティング

### エラー: `Credentials file not found`

**原因:** Secret Filesでファイルが正しく作成されていない

**解決策:**
1. Secret Filesのファイル名が **`google-credentials.json`** になっているか確認
2. ファイル内容が正しいJSONかチェック（カッコの欠けや改行の問題など）
3. 再度保存して再デプロイ

### エラー: `Invalid credentials`

**原因:** サービスアカウントのJSONファイルが壊れている

**解決策:**
1. Google Cloud Consoleで新しいキーを作成
2. ダウンロードしたJSONファイルをテキストエディタで開いて確認
3. Secret Filesに再度アップロード

### エラー: `Permission denied` / `The caller does not have permission`

**原因:** サービスアカウントにGoogle Drive APIの権限がない、またはフォルダが共有されていない

**解決策:**
1. Google Cloud ConsoleでGoogle Drive APIが有効になっているか確認
2. Google Driveのフォルダをサービスアカウントのメールアドレスと共有（編集者権限）
3. フォルダIDが正しいか確認

### エラー: `Document created but could not be made public`

**原因:** 組織のポリシーにより公開設定ができない（問題ではない）

**影響:** ドキュメントは正常に作成されています。手動で共有が必要です。

**解決策:**
- そのまま使用可能（ドキュメントは作成されています）
- 必要に応じてGoogle Driveから手動で共有

### フォルダに保存されない（ルートに作成される）

**原因:** `GOOGLE_DRIVE_FOLDER_ID` が設定されていない、またはサービスアカウントがフォルダにアクセスできない

**解決策:**
1. フォルダIDが正しく設定されているか確認
2. フォルダをサービスアカウントと共有しているか確認
3. Renderの環境変数を再確認

---

## まとめ

✅ **Renderでの正しい設定:**
1. **Secret Files**: `google-credentials.json` にJSON内容を保存
2. **Environment Variables**: `GOOGLE_SERVICE_ACCOUNT_KEY=google-credentials.json` と設定

❌ **よくある間違い:**
- 環境変数にJSON文字列を直接入れる
- ファイル名にスラッシュ（`/`）を含める
- サービスアカウントとフォルダを共有し忘れる

---

## ローカル開発での設定（参考）

ローカルでの開発時は、以下のように設定します：

```bash
# server/.env
GEMINI_API_KEY=your_gemini_api_key_here
GOOGLE_SERVICE_ACCOUNT_KEY=./google-credentials.json
GOOGLE_DRIVE_FOLDER_ID=your_folder_id_here
```

- `google-credentials.json` ファイルを `server/` ディレクトリに配置
- `.gitignore` に追加して、Git管理対象外にする
