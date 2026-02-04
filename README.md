# AI-Council-Commander v3.1.0

Multi-AI Council Debate System with Dual Output Mode

## Overview

ユーザーのテーマ設定に対し、複数のAIエージェント（仮想Gems）が自律的に議論を行い、洗練された計画書・仕様書を作成する。最終的なアウトプットは、**「Claudeによる実作業（コーディング等）」または「ドキュメント出力（保存のみ）」**のいずれかを選択できるシステム。

## Tech Stack

- **Frontend**: React + TypeScript + Tailwind CSS + Vite
- **Backend**: Node.js + Express + TypeScript
- **AI Engine**: Google Gemini API (Pro model)
- **Executor**: Claude Code CLI (Local Environment)

## Setup

### Prerequisites

- Node.js 18+
- Google Gemini API Key
- Claude Code CLI (for implementation mode)

### Installation

```bash
# Install all dependencies
npm run install:all

# Or manually
npm install
cd client && npm install
cd ../server && npm install
```

### Environment Variables

Create `.env` file in `server/` directory:

```
GEMINI_API_KEY=your_gemini_api_key_here
PORT=3001

# Optional: Google Docs Export
GOOGLE_SERVICE_ACCOUNT_KEY=path/to/google-credentials.json
```

#### Google Docs Export Setup (Optional)

To enable Google Docs export functionality:

1. **Google Cloud Console Setup**
   - Go to [Google Cloud Console](https://console.cloud.google.com)
   - Create a new project or select an existing one
   - Enable the following APIs:
     - Google Docs API
     - Google Drive API

2. **Create Service Account**
   - Go to "IAM & Admin" > "Service Accounts"
   - Click "Create Service Account"
   - Name it (e.g., "ai-council-docs")
   - Create a JSON key and download it
   - Copy the service account email (e.g., `ai-council-docs@project-id.iam.gserviceaccount.com`)

3. **Prepare Google Drive Folder**
   - Open Google Drive and create a folder for AI Council documents
   - Share the folder with the service account email (as Editor)
   - Copy the folder ID from the URL: `https://drive.google.com/drive/folders/FOLDER_ID_HERE`

4. **Set Environment Variables**
   ```
   GOOGLE_SERVICE_ACCOUNT_KEY=./google-credentials.json
   GOOGLE_DRIVE_FOLDER_ID=your_folder_id_here
   ```

5. **For Render Deployment**
   - `GOOGLE_SERVICE_ACCOUNT_KEY`: Paste the entire JSON content as a string
   - `GOOGLE_DRIVE_FOLDER_ID`: Paste the folder ID

### Development

```bash
# Run both client and server
npm run dev

# Or run separately
npm run dev:client  # http://localhost:5173
npm run dev:server  # http://localhost:3001
```

## Project Structure

```
ai-council-commander/
├── client/              # React frontend
│   ├── src/
│   │   ├── components/  # UI components
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── package.json
│   └── vite.config.ts
├── server/              # Express backend
│   ├── src/
│   │   ├── routes/
│   │   └── index.ts
│   └── package.json
└── package.json
```

## Features

### Council Modes (評議会モード)

選択可能な6つのモード:

1. **フリーモード** - フェーズに縛られず自由に議論
2. **情報収集モード (Define)** - プロジェクト憲章の作成
3. **発散モード (Develop)** - ブレインストーミングと可能性の拡張
4. **構造化モード (Structure)** - 評価・決定・骨格設計
5. **生成モード (Generate)** - 本文生成
6. **洗練モード (Refine)** - 最終成果物パッケージの完成

### 5-Phase Process (5フェーズプロセス)

各モードは以下のフェーズに沿って進行:

- **Phase 1: 情報収集** (11ターン) - 全体目的とセッションゴール定義
- **Phase 2: 発散** (11ターン) - ブレインストーミング
- **Phase 3: 構造化** (11ターン) - 方針決定と骨格設計
- **Phase 4: 生成** (8ターン) - 本文作成
- **Phase 5: 洗練** (11ターン) - 検証・修正・完成

フェーズ選択機能により、任意のフェーズから開始可能。

### Council Settings (評議会設定)
- モード選択（6種類）
- 開始フェーズ選択（P1〜P5）
- 議題入力
- 出力モード選択: Implementation / Documentation

### Debate Stream (議論ログ)
- AI同士のリアルタイム議論
- ロール別色分け表示
- フェーズ進行管理
- チェックポイント機能

### The Artifact (成果物プレビュー)
- current_plan.md のリアルタイムプレビュー
- マークダウンレンダリング
- 議事メモ表示

### Action Bar
- **Run Claude**: Claude Code CLI で実装実行
- **Export Doc**: Markdown形式でドキュメント保存
- **Export Memo**: 議事メモを保存
- **Google Docs**: Google Docsとして直接エクスポート（要設定）

## AI Agents (評議員)

1. **Visionary (仮想Gem)** 🔵
   - 起案・情熱
   - ビジョンと理想の提示

2. **Analyst (分析Gem)** ⚪
   - 分析・根拠
   - データに基づく客観的分析

3. **Realist (現実Gem)** 🟠
   - 現実・兵站
   - 実現可能性と効率性の追求

4. **Guardian (守護Gem)** 🔴
   - 安全・リスク
   - リスク管理と品質保証

5. **Moderator (進行Gem)** 🟢
   - 進行・統合
   - 議論進行と合意形成

6. **Secretary (書記Gem)** 📝
   - 議事メモ係
   - 議論の要点を記録

## License

MIT
