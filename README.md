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
```

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

### Council Settings (評議会設定)
- 議題入力
- 出力モード選択: Implementation / Documentation
- 評議員構成: Planner, Critic, Moderator

### Debate Stream (議論ログ)
- AI同士のリアルタイム議論
- ロール別色分け表示

### The Artifact (成果物プレビュー)
- current_plan.md のリアルタイムプレビュー
- マークダウンレンダリング

### Action Bar
- **Run Claude**: Claude Code CLI で実装実行
- **Export Doc**: ドキュメントとして保存

## AI Agents (Gems)

1. **Planner** 📋
   - 具体的な計画立案
   - 実装可能な提案作成

2. **Critic** 🔍
   - 批判的検証
   - リスク指摘と改善提案

3. **Moderator** ⚖️
   - 議論進行管理
   - 合意形成とドキュメント更新

## License

MIT
