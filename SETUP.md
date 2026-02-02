# AI Council Commander - セットアップ手順

## ✅ 完了済み

- ✅ プロジェクトファイル作成
- ✅ npm install 完了
- ✅ Gemini APIキー設定済み
- ✅ Gemini 1.5 Pro 使用設定済み

## 🖥️ デスクトップショートカットの作成

### 方法1: PowerShellスクリプトで自動作成（推奨）

1. `create-desktop-shortcut.ps1` を右クリック
2. 「PowerShellで実行」を選択

または、PowerShellを管理者として開いて：

```powershell
cd "C:\Users\masa0\OneDrive\デスクトップ\ai-council-commander"
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
.\create-desktop-shortcut.ps1
```

### 方法2: 手動でショートカット作成

1. `start-ai-council.bat` を右クリック
2. 「ショートカットの作成」を選択
3. 作成されたショートカットをデスクトップに移動
4. ショートカットを右クリック → 「プロパティ」
5. 名前を「AI Council Commander」に変更

## 🚀 起動方法

### デスクトップショートカットから起動（推奨）

1. デスクトップの「AI Council Commander」アイコンをダブルクリック
2. ブラウザで http://localhost:5173 を開く

### 手動起動

```bash
cd "C:\Users\masa0\OneDrive\デスクトップ\ai-council-commander"
npm run dev
```

## 🎯 使い方

1. 議題を入力
2. 出力モードを選択（Implementation / Documentation）
3. 「評議会を開始」ボタンをクリック
4. AI同士の議論を観察
5. 議論終了後、「Run Claude」または「Export Doc」を実行

## ⚙️ 設定情報

- **Gemini APIキー**: 設定済み（server/.env）
- **Geminiモデル**: gemini-1.5-pro
- **フロントエンド**: http://localhost:5173
- **バックエンド**: http://localhost:3001

## 🛑 アプリケーションの停止

起動したコマンドプロンプトで `Ctrl + C` を押す

## 📝 トラブルシューティング

### ポートが使用中の場合

```bash
# 別のポートを使用する場合は server/.env を編集
PORT=3002
```

### 依存関係の再インストール

```bash
npm run install:all
```

### ブラウザが自動で開かない場合

手動で http://localhost:5173 を開いてください
