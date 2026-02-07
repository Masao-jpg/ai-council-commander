import { Router } from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as fs from 'fs';
import * as path from 'path';
import {
  AGENT_CONFIGS,
  NEW_PHASES,
  FREE_MODE_PHASE,
  AgentRole,
  PhaseConfig,
  CouncilMode
} from '../councilConfig';

const router = Router();

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// Session storage
interface DebateSession {
  sessionId: string;
  theme: string;
  mode: string;
  outputMode: 'implementation' | 'documentation';
  currentPhase: number;
  currentTurn: number;
  speakerDeck: AgentRole[];
  history: Array<{ agent: AgentRole; content: string }>;
  currentPlan: string;
  currentMemo: string;
  extensionCount: number;
  currentStep: string;  // "1-1", "2-3", etc.
  currentStepName: string;  // "全体目的 (Why)", etc.
  estimatedStepTurns: number;  // Facilitator's estimated turns for current step
  actualStepTurns: number;  // Actual turns completed in current step (Facilitatorを除く)
  turnsSinceLastFacilitator: number;  // 前回Facilitatorから何ターン経過したか
  stepExtended: boolean;  // このステップが既に延長されたかどうか
  proposedExtensionTurns: number;  // Facilitatorが提案した延長ターン数
  autoProgress: boolean;  // バックグラウンド自動進行モード
  lastUserQuestion: string;  // 最後にユーザーに投げた質問
}

const debateSessions = new Map<string, DebateSession>();

// --- 永続化機能（非同期・バッチ保存） ---
const DATA_FILE = path.join(__dirname, '..', 'data', 'sessions.json');
let saveScheduled = false;
let saveTimer: NodeJS.Timeout | null = null;

/**
 * セッションデータをJSONファイルに保存（非同期・バッチ処理）
 * 頻繁な呼び出しを防ぐため、最後の呼び出しから5秒後に実際の保存を実行
 */
function scheduleSave() {
  if (saveTimer) {
    clearTimeout(saveTimer);
  }

  saveTimer = setTimeout(() => {
    saveSessionsToDisk();
    saveTimer = null;
  }, 5000); // 5秒後に保存（バッチ処理）
}

/**
 * 実際の保存処理
 */
function saveSessionsToDisk() {
  try {
    // データディレクトリの作成（存在しない場合）
    const dataDir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    // Mapを配列に変換してJSON化
    const data = JSON.stringify(Array.from(debateSessions.entries()), null, 2);
    fs.writeFileSync(DATA_FILE, data, 'utf8');
    console.log(`💾 Sessions saved to disk (${debateSessions.size} sessions)`);
  } catch (error) {
    console.error('❌ Failed to save sessions:', error);
  }
}

/**
 * 起動時にセッションデータを復元
 */
function loadSessionsFromDisk() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const data = fs.readFileSync(DATA_FILE, 'utf8');
      const entries = JSON.parse(data);
      entries.forEach(([key, value]: [string, any]) => {
        debateSessions.set(key, value);
      });
      console.log(`✅ Loaded ${debateSessions.size} sessions from disk.`);
    } else {
      console.log('ℹ️ No saved sessions found. Starting fresh.');
    }
  } catch (error) {
    console.error('❌ Failed to load sessions:', error);
  }
}

// サーバー起動時にデータをロード
loadSessionsFromDisk();

// プロセス終了時に強制保存
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down... Saving sessions...');
  saveSessionsToDisk();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down... Saving sessions...');
  saveSessionsToDisk();
  process.exit(0);
});
// ----------------------------------------

// モックレスポンス生成関数（新エージェント対応）
function generateMockResponse(agent: AgentRole, session: DebateSession, phase: PhaseConfig): string {
  // 新システムでは基本的にモックモードは使用しない想定
  // 必要に応じて各エージェントの簡易レスポンスを返す
  const config = AGENT_CONFIGS[agent];
  return `[Mock] ${config.name}: ${session.theme}について、${phase.nameJa}フェーズの議論を進めます。`;
}

// 成果物名取得関数
function getArtifactName(phaseNumber: number): string {
  const artifacts = [
    'プロジェクト憲章 (Project Charter)',      // Phase 1
    '仮説シート (Hypothesis Sheet)',           // Phase 2
    '骨子案 (Outline)',                        // Phase 3
    '初稿 (Draft)',                            // Phase 4
    '成果物パッケージ (Deliverable Package)'   // Phase 5
  ];
  return artifacts[phaseNumber - 1] || '成果物';
}

// セッション情報から現在のフェーズ設定を取得するヘルパー関数
function getPhaseConfig(session: DebateSession): PhaseConfig {
  if (session.mode === 'free') {
    return FREE_MODE_PHASE;
  }
  // 通常モードの場合は既存の配列から取得
  const index = (session.currentPhase >= 1) ? session.currentPhase - 1 : 0;
  return NEW_PHASES[index] || NEW_PHASES[0];
}

// Facilitator keyword detection functions
interface StepStartInfo {
  stepNumber: string;  // "1-1", "2-3", etc.
  stepName: string;
  estimatedTurns: number;
}

function detectStepStart(text: string): StepStartInfo | null {
  // 1. タグがなければ即終了
  if (!text.includes('---STEP_START---')) {
    return null;
  }

  console.log('🔍 STEP_START tag detected. parsing details (lax mode)...');

  // 2. 情報を抽出してみる（失敗してもOK）
  // "Step 1-1" や "ステップ 1-1" や "Step F-1"（英字許可）
  const stepNumMatch = text.match(/(?:ステップ|Step)\s*([a-zA-Z0-9]+-[0-9]+)/i);
  // "Estimate: 10" や "10 turns" や "見積もり: 10"
  const turnMatch = text.match(/(?:見積もり|Estimate|Turns?).*?(\d+)/i);
  // コロンの後の名前（英数字許可）
  const nameMatch = text.match(/(?:ステップ|Step)\s*[a-zA-Z0-9]+-[0-9]+\s*[:：]\s*([^\n]+)/i);

  return {
    // 見つかればその番号、なければ null (呼び出し元で session.currentStep を使う)
    stepNumber: stepNumMatch ? stepNumMatch[1] : null,

    // 見つかればその名前、なければ null
    stepName: nameMatch ? nameMatch[1].trim().replace(/\*\*/g, '').replace(/【.*?】/g, '').trim() : null,

    // 見つかればその数字、なければデフォルト値8
    estimatedTurns: turnMatch ? parseInt(turnMatch[1], 10) : 8
  } as any;
}

function detectStepCompleted(text: string): { stepNumber: string; stepName: string } | null {
  // 厳格なチェックをやめ、単にタグが含まれているか確認する
  if (text.includes('---STEP_COMPLETED---')) {
    // 詳細は後続のロジックで session 情報から補完するため、ここでは仮の値を返す
    return {
      stepNumber: 'SESSION_CURRENT',
      stepName: 'SESSION_CURRENT'
    };
  }
  return null;
}

function detectStepExtensionNeeded(text: string): { needed: boolean; additionalTurns: number } {
  if (!text.includes('---STEP_EXTENSION_NEEDED---')) {
    return { needed: false, additionalTurns: 0 };
  }

  // 追加ターン数を抽出（例: "追加で【 3 ターン 】"）
  const turnsMatch = text.match(/追加で?【\s*(\d+)\s*ターン\s*】/);
  const additionalTurns = turnsMatch ? parseInt(turnsMatch[1], 10) : 3; // デフォルト3ターン

  return { needed: true, additionalTurns };
}

function detectPhaseCompleted(text: string, currentPhase: number): boolean {
  // フェーズ完了タグの厳格な検証：現在のフェーズ番号と一致する必要がある
  const regex = new RegExp(`---PHASE_COMPLETED---\\s*Phase\\s*${currentPhase}\\s*完了\\s*---PHASE_COMPLETED---`);
  const match = regex.test(text);

  if (text.includes('---PHASE_COMPLETED---') && !match) {
    console.log(`⚠️ Found PHASE_COMPLETED tag but not for current phase ${currentPhase}`);
  }

  return match;
}

// 議事メモ係用のメモを生成
function generateSecretaryMemo(session: DebateSession): string {
  const recentMessages = session.history.slice(-1000);
  let memo = '---MEMO_UPDATE---\n';

  recentMessages.forEach((msg) => {
    const config = AGENT_CONFIGS[msg.agent];
    memo += `## ${config.name} の発言要約\n`;
    memo += `- **要点**: ${msg.content.substring(0, 100)}...\n`;
  });

  memo += '---MEMO_UPDATE---';
  return memo;
}

// モデレーター用の計画書更新を生成
function generateModeratorPlanUpdate(session: DebateSession, phase: PhaseConfig): string {
  return `これまでの議論を計画書にまとめます。

---PLAN_UPDATE---
# ${session.theme}

## 概要
${session.outputMode === 'implementation' ? '実装を前提とした' : 'ドキュメントベースの'}プロジェクトとして、段階的に進めます。

## 現在のフェーズ
Phase ${session.currentPhase}: ${phase.nameJa}

## 実装計画
### 1. 初期調査
- 要件定義の確認
- 技術選定
- リソース確保

### 2. プロトタイプ開発
- MVP（最小機能製品）の作成
- 初期テスト
- フィードバック収集

### 3. 本格開発
- 機能拡張
- 品質向上
- ドキュメント整備

## リスクと対策
- **リスク**: スケジュール遅延
  - **対策**: バッファを30%確保

- **リスク**: セキュリティ脆弱性
  - **対策**: 定期的なセキュリティ監査

## 必要リソース
- 時間: 3-6ヶ月
- 予算: 未定（要見積もり）
- 人材: 開発者2名、デザイナー1名

## 注意点
- 段階的なアプローチを維持
- 定期的なレビューを実施
- ステークホルダーとの密な連携
---PLAN_UPDATE---`;
}

// デッキ生成関数（発言者リストを作成）
// 新システム: Facilitatorは2ターンごとに強制介入、他は均等配置
function createSpeakerDeck(phase: PhaseConfig, forceFacilitatorFirst: boolean = false): AgentRole[] {
  // Facilitator以外のメンバーを抽出
  const nonFacilitators = phase.participants.filter(a => a !== 'facilitator');

  // 通常メンバーのデッキを作成（Facilitatorは含めない）
  // totalTurnsは目安として使用（実際はFacilitatorの見積もりで動的に決まる）
  const turnsPerAgent = Math.floor(phase.totalTurns / phase.participants.length);

  const memberDeck: AgentRole[] = [];
  nonFacilitators.forEach((agent) => {
    for (let i = 0; i < turnsPerAgent; i++) {
      memberDeck.push(agent);
    }
  });

  // シャッフル
  for (let i = memberDeck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [memberDeck[i], memberDeck[j]] = [memberDeck[j], memberDeck[i]];
  }

  // Facilitatorを2ターンごとに挿入
  const finalDeck: AgentRole[] = [];

  // 最初はFacilitator（ステップ開始宣言のため）
  if (forceFacilitatorFirst) {
    finalDeck.push('facilitator');
  }

  // 通常メンバーを2人ずつ配置し、その後にFacilitatorを挿入
  for (let i = 0; i < memberDeck.length; i++) {
    finalDeck.push(memberDeck[i]);

    // 2ターンごとにFacilitatorを挿入（ただし最後のターンの後は除く）
    if ((i + 1) % 2 === 0 && i < memberDeck.length - 1) {
      finalDeck.push('facilitator');
    }
  }

  return finalDeck;
}

// --- セッション復元用エンドポイント ---
router.post('/restore', async (req, res) => {
  try {
    const {
      sessionId,
      theme,
      mode,
      outputMode,
      currentPhase,
      history,
      currentStep,
      currentStepName,
      estimatedStepTurns,
      actualStepTurns,
      currentPlan
    } = req.body;

    console.log(`♻️ Restoring session: ${sessionId}`);

    if (!theme) {
      return res.status(400).json({ error: 'Theme is required for restoration' });
    }

    // フェーズ情報の取得（モードに応じて分岐）
    let phaseConfig: PhaseConfig;
    if (mode === 'free') {
      phaseConfig = FREE_MODE_PHASE;
    } else {
      const phaseIndex = (currentPhase && currentPhase >= 1 && currentPhase <= NEW_PHASES.length)
        ? currentPhase - 1
        : 0;
      phaseConfig = NEW_PHASES[phaseIndex];
    }

    // デッキの再生成（Facilitatorを先頭に）
    const speakerDeck = createSpeakerDeck(phaseConfig, true);

    // 履歴データの整形（フロントエンド形式 → バックエンド形式）
    const formattedHistory = history ? history.map((msg: any) => ({
      agent: msg.agent,
      content: msg.content
    })) : [];

    const session: DebateSession = {
      sessionId,
      theme,
      mode: mode || 'free',
      outputMode: outputMode || 'implementation',
      currentPhase: currentPhase || 1,
      currentTurn: formattedHistory.length, // 履歴数からターン数を推測
      speakerDeck,
      history: formattedHistory,
      currentPlan: currentPlan || `# ${theme}\n\n議論を復元しました...`,
      currentMemo: '',
      extensionCount: 0,
      currentStep: currentStep || '',
      currentStepName: currentStepName || '',
      estimatedStepTurns: estimatedStepTurns || 0,
      actualStepTurns: actualStepTurns || 0,
      turnsSinceLastFacilitator: 0,
      stepExtended: false,
      proposedExtensionTurns: 0,
      autoProgress: true,
      lastUserQuestion: ''
    };

    debateSessions.set(sessionId, session);
    scheduleSave();

    console.log(`✅ Session ${sessionId} restored successfully with ${formattedHistory.length} history items.`);

    res.json({
      success: true,
      message: 'Session restored successfully',
      sessionId
    });
  } catch (error: any) {
    console.error('❌ Error restoring session:', error);
    res.status(500).json({ error: error.message });
  }
});

// セッション初期化
router.post('/start', async (req, res) => {
  try {
    const { sessionId, theme, mode, outputMode, startPhase } = req.body;

    if (!theme) {
      return res.status(400).json({ error: 'Theme is required' });
    }

    // モードによる分岐
    let initialPhaseConfig: PhaseConfig;
    let initialPhaseNumber = 1;
    let totalPhasesCount = NEW_PHASES.length;

    if (mode === 'free') {
      // フリーモードは特別なフェーズ1として扱う
      initialPhaseConfig = FREE_MODE_PHASE;
      initialPhaseNumber = 1;
      totalPhasesCount = 1; // フリーモードは1フェーズ（実質フェーズなし）扱い
    } else {
      // 通常モード: 開始フェーズの決定（デフォルトは1）
      initialPhaseNumber = startPhase && startPhase >= 1 && startPhase <= NEW_PHASES.length
        ? startPhase
        : 1;
      initialPhaseConfig = NEW_PHASES[initialPhaseNumber - 1];
    }

    // デッキを生成（Facilitatorを最初に配置）
    const speakerDeck = createSpeakerDeck(initialPhaseConfig, true);

    const session: DebateSession = {
      sessionId,
      theme,
      mode: mode || 'free',
      outputMode,
      currentPhase: initialPhaseNumber,
      currentTurn: 0,
      speakerDeck,
      history: [],
      currentPlan: `# ${theme}\n\n議論を開始します...`,
      currentMemo: `# 議事メモ\n\n## セッション開始\n- 議題: ${theme}\n- モード: ${mode || 'free'}\n- 開始フェーズ: Phase ${initialPhaseNumber} (${initialPhaseConfig.nameJa})\n`,
      extensionCount: 0,
      currentStep: '',
      currentStepName: '',
      estimatedStepTurns: 0,
      actualStepTurns: 0,
      turnsSinceLastFacilitator: 0,
      stepExtended: false,
      proposedExtensionTurns: 0,
      autoProgress: true,  // デフォルトで自動進行ON
      lastUserQuestion: ''
    };

    debateSessions.set(sessionId, session);
    scheduleSave(); // ★追加: 保存スケジュール

    res.json({
      success: true,
      message: 'Debate session initialized',
      sessionId,
      phase: initialPhaseConfig,
      totalPhases: totalPhasesCount
    });
  } catch (error: any) {
    console.error('Error starting debate:', error);
    res.status(500).json({ error: error.message });
  }
});

// 次のターンを実行
router.post('/next-turn', async (req, res) => {
  try {
    const { sessionId, userResponse, userPhaseInstruction } = req.body;
    console.log(`📥 Received next-turn request for session: ${sessionId}`);
    if (userResponse) {
      console.log(`💬 User response: ${userResponse.answer}`);
    }
    if (userPhaseInstruction) {
      console.log(`📝 User phase instruction: ${userPhaseInstruction}`);
    }

    const session = debateSessions.get(sessionId);

    if (!session) {
      console.error(`❌ Session not found: ${sessionId}`);
      return res.status(404).json({ error: 'Session not found' });
    }

    // ユーザーの回答を履歴に追加（記憶喪失バグの修正）
    if (userResponse) {
      console.log(`💾 Saving user response to history...`);
      session.history.push({
        agent: 'facilitator' as AgentRole, // Userの回答もFacilitatorとして記録
        content: `【ユーザーの回答】\n質問: ${userResponse.question}\n回答: ${userResponse.answer}`
      });

      // 延長承認の処理
      if (userResponse.question.includes('延長') && userResponse.answer.trim().toUpperCase() === 'A') {
        if (session.proposedExtensionTurns > 0 && !session.stepExtended) {
          console.log(`✅ User approved extension: adding ${session.proposedExtensionTurns} turns to estimate`);
          session.estimatedStepTurns += session.proposedExtensionTurns;
          session.stepExtended = true;
          console.log(`📊 New estimated turns: ${session.estimatedStepTurns}`);
        }
      }
    }

    // デッキから次の発言者を取得
    if (session.speakerDeck.length === 0) {
      console.log(`⚠️ Speaker deck empty, but phase continues until Facilitator declares PHASE_COMPLETED`);

      // デッキが空になっても、Facilitatorが正式にPHASE_COMPLETEDを宣言するまでフェーズは続行
      // Facilitatorを追加して、次のステップ開始またはフェーズ完了を促す
      session.speakerDeck.push('facilitator');
      console.log(`✅ Added Facilitator to deck to continue phase management`);
    }

    const nextAgent = session.speakerDeck.shift()!;
    session.currentTurn++;

    // Facilitator以外のターン数をカウント（ステップの実質的な議論ターン）
    const isFacilitator = nextAgent === 'facilitator';
    if (!isFacilitator) {
      session.turnsSinceLastFacilitator++;
    }

    console.log(`💬 Turn ${session.currentTurn}: ${nextAgent} speaking (${session.speakerDeck.length} remaining, turnsSinceLastFacilitator=${session.turnsSinceLastFacilitator})`);

    // AIに発言を生成させる
    const agentConfig = AGENT_CONFIGS[nextAgent];
    const currentPhase = getPhaseConfig(session);

    console.log(`🤖 Calling Gemini API for ${nextAgent}...`);

    let text: string;
    const startTime = Date.now();

    // モックモードの判定
    if (process.env.USE_MOCK === 'true') {
      console.log('🎭 Using MOCK mode');
      // モックレスポンスを生成
      text = generateMockResponse(nextAgent, session, currentPhase);
      await new Promise(resolve => setTimeout(resolve, 500)); // 遅延をシミュレート
    } else {
      // 実際のGemini API呼び出し
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-pro' });

      // コンテキスト構築
      let contextPrompt = `${agentConfig.systemPrompt}\n\n`;

      contextPrompt += `【議題】${session.theme}\n`;
      contextPrompt += `【出力モード】${session.outputMode === 'implementation' ? '実装モード' : 'ドキュメントモード'}\n`;
      contextPrompt += `【現在のフェーズ】Phase ${session.currentPhase}: ${currentPhase.nameJa}\n`;
      contextPrompt += `【フェーズの目的】${currentPhase.purpose}\n`;
      contextPrompt += `【議論スタイル】${currentPhase.discussionStyle}\n\n`;

      // Facilitator専用の追加コンテキスト
      if (nextAgent === 'facilitator') {
        contextPrompt += `【指揮者専用情報】\n`;

        // 🔥 成果物定義の強制注入（Phase目的を忘れさせないための強制リマインダー）
        // モード判定済みの currentPhase を使用（Free Modeにも対応）
        const currentStepObj = currentPhase.steps?.find(s => s.id === session.currentStep);
        const artifactName = getArtifactName(session.currentPhase);

        contextPrompt += `\n【現在地と目的の再確認（重要）】\n`;
        contextPrompt += `- **現在のフェーズ**: Phase ${session.currentPhase} 「${currentPhase.nameJa}」\n`;
        contextPrompt += `- **フェーズの目的**: ${currentPhase.purpose}\n`;
        if (currentStepObj) {
          contextPrompt += `- **現在のステップ**: ${session.currentStep} 「${currentStepObj.name}」\n`;
          contextPrompt += `- **ステップの実行内容**: ${currentStepObj.description}\n`;
        }

        contextPrompt += `\n【成果物（Markdownエリア）の管理定義】\n`;
        contextPrompt += `- **管理対象の成果物名**: **「${artifactName}」**\n`;
        contextPrompt += `- **禁止事項**: 現在のフェーズ/ステップの目的と乖離した内容（例: 発散フェーズなのに詳細な実装スケジュールを書く、等）は絶対に避けてください。\n`;

        contextPrompt += `\n**現在の成果物の状態:**\n`;
        contextPrompt += `\`\`\`markdown\n${session.currentPlan}\n\`\`\`\n`;
        contextPrompt += `(議論の進捗に合わせて、この ${artifactName} を \`---PLAN_UPDATE---\` で更新してください。フォーマットを勝手に変えないでください)\n\n`;

        // ステップ進行中の場合
        if (session.currentStep) {
          console.log(`📍 Current step: ${session.currentStep} - ${session.currentStepName}`);
          console.log(`📊 Step progress: ${session.actualStepTurns}/${session.estimatedStepTurns} turns (extended: ${session.stepExtended})`);

          contextPrompt += `現在のステップ: ${session.currentStep} - ${session.currentStepName}\n`;
          contextPrompt += `見積もりターン数: ${session.estimatedStepTurns}ターン\n`;
          contextPrompt += `実際の経過ターン数: ${session.actualStepTurns}ターン（メンバーの議論ターン）\n`;

          // 延長状態の表示
          if (session.stepExtended) {
            contextPrompt += `延長状態: ✅ このステップは既に延長されています（延長は1回まで）\n`;
          }

          // 見積もりターン到達チェック
          if (session.actualStepTurns >= session.estimatedStepTurns) {
            contextPrompt += `\n🔔 **重要**: 見積もりターン数に到達しました。ステップ完了判定を行ってください。\n`;

            if (session.stepExtended) {
              // 既に延長済みの場合は完了のみ
              contextPrompt += `⚠️ このステップは既に延長されています。これ以上議論を続けず、直ちに完了させてください。\n`;
              contextPrompt += `完了宣言: 文末に必ず \`---STEP_COMPLETED---\` とだけ出力してください。\n\n`;
            } else {
              // 初回の場合は延長可能
              contextPrompt += `- 成果物が十分に定義できている → 文末に \`---STEP_COMPLETED---\` を出力して完了\n`;
              contextPrompt += `- まだ不足がある → ---STEP_EXTENSION_NEEDED--- を宣言し、不足点と追加ターン数を提示\n\n`;
            }
          } else {
            const remaining = session.estimatedStepTurns - session.actualStepTurns;
            contextPrompt += `残りターン数: ${remaining}ターン\n\n`;
          }

          // 2ターンごとの監視
          if (session.turnsSinceLastFacilitator >= 2) {
            contextPrompt += `\n🔍 【必須】2ターン監視タイミング\n`;
            contextPrompt += `前回の介入から${session.turnsSinceLastFacilitator}ターン経過しました。\n`;
            contextPrompt += `直近の議論がステップの目的（${session.currentStepName}）から逸脱していないか**必ず確認**してください。\n\n`;
            contextPrompt += `**判定と発言:**\n`;
            contextPrompt += `- 順調な場合: 「進行良好です。このまま続けてください。」\n`;
            contextPrompt += `- 逸脱時: 目的に立ち返るよう明確に軌道修正\n`;
            contextPrompt += `  例: 「議論が『具体的な解決策（How）』に偏っています。現在は『目的（Why）』を定義する時間ですので、視座を戻してください。」\n\n`;
          }
        } else {
          // ステップ未開始の場合（フェーズの最初など）
          contextPrompt += `\n🎬 **ステップ開始**: これから最初のステップを開始してください。\n`;
          contextPrompt += `フェーズ${session.currentPhase}のステップ一覧:\n`;
          if (currentPhase.steps) {
            currentPhase.steps.forEach(step => {
              contextPrompt += `  - ${step.id}: ${step.name} - ${step.description}\n`;
            });
          }
          contextPrompt += `\n最初のステップについて ---STEP_START--- を宣言し、見積もりターン数を提示してください。\n\n`;
        }
      }

      // ユーザーのフェーズ指示を追加
      if (userPhaseInstruction) {
        contextPrompt += `\n【ユーザーからの追加指示】\n${userPhaseInstruction}\n\n`;
      }

      if (session.history.length > 0) {
        contextPrompt += `【これまでの議論】\n`;
        session.history.slice(-1000).forEach((msg) => {
          const config = AGENT_CONFIGS[msg.agent];
          contextPrompt += `${config.emoji} ${config.name}: ${msg.content}\n\n`;
        });
      }

      // ユーザーレスポンスを追加
      if (userResponse) {
        console.log(`✅ Adding user response to context for ${nextAgent}:`);
        console.log(`   Q: ${userResponse.question.substring(0, 80)}...`);
        console.log(`   A: ${userResponse.answer.substring(0, 80)}...`);
        contextPrompt += `\n【ユーザーの回答】\n質問: ${userResponse.question}\n回答: ${userResponse.answer}\n\n`;

        // Facilitatorの場合は進行管理のみ、それ以外は議論を続ける
        if (nextAgent === 'facilitator') {
          contextPrompt += `上記のユーザー回答が得られました。あなたは議論の中身には介入せず、進行管理に徹してください。\n`;
          contextPrompt += `- 2ターン監視: 議論が目的から逸脱していないか確認し、必要に応じて軌道修正\n`;
          contextPrompt += `- ステップ完了判定: 見積もりターン到達時は完了判定を実施\n`;
        } else {
          contextPrompt += `上記のユーザー回答を踏まえて、議論を続けてください。\n`;
        }
      }

      // Facilitatorの場合、計画書更新を促す
      if (nextAgent === 'facilitator') {
        contextPrompt += `\n【重要】必要に応じて ---PLAN_UPDATE--- で囲んだMarkdown形式の計画書を更新してください。\n`;
      }

      // ステップ単位でのターン表示
      if (session.currentStep && session.estimatedStepTurns > 0) {
        contextPrompt += `\nあなた（${agentConfig.name}）の意見を述べてください。現在ステップ ${session.currentStep}（${session.currentStepName}）: ${session.actualStepTurns}/${session.estimatedStepTurns} ターンです。`;
      } else {
        contextPrompt += `\nあなた（${agentConfig.name}）の意見を述べてください。Phase ${session.currentPhase} Turn ${session.currentTurn} です。`;
      }

      const result = await model.generateContent(contextPrompt);
      const response = result.response;
      text = response.text();
    }

    const duration = Date.now() - startTime;
    console.log(`✅ Response received in ${duration}ms (${text.length} chars)`);

    // 履歴に追加
    session.history.push({ agent: nextAgent, content: text });

    // Facilitatorのキーワード検出
    let stepUpdate = null;
    let needsExtensionJudgment = false;
    let phaseCompleted = false;
    let stepCompleted = false;
    let completedStepInfo: { stepNumber: string; stepName: string } | null = null;

    if (nextAgent === 'facilitator') {
      // STEP_START検出
      const stepStart = detectStepStart(text);
      if (stepStart) {
        // 【重要】情報が欠けていても、現在のセッション情報を正として補完する
        // これにより「タグはあるのにフォーマット違いで開始しない」を防ぐ
        const stepNumber = stepStart.stepNumber || session.currentStep || '1-1';
        const stepName = stepStart.stepName || session.currentStepName || 'ステップ開始';

        console.log(`🎯 STEP_START confirmed: ${stepNumber} - ${stepName} (${stepStart.estimatedTurns} turns)`);

        session.currentStep = stepNumber;
        session.currentStepName = stepName;
        session.estimatedStepTurns = stepStart.estimatedTurns;
        session.actualStepTurns = 0;
        session.stepExtended = false; // 新しいステップなので延長フラグをリセット
        session.proposedExtensionTurns = 0;

        // 🔥 ステップ開始時にデッキを補充（無限ループ防止）
        // Facilitatorは今喋ったばかりなので、次はメンバーから始める
        const currentPhaseConfig = NEW_PHASES.find(p => p.phase === session.currentPhase);
        if (currentPhaseConfig) {
          session.speakerDeck = createSpeakerDeck(currentPhaseConfig, false);
          console.log(`🔄 Deck regenerated for Step ${stepNumber}. Deck length: ${session.speakerDeck.length}, Next speaker: ${session.speakerDeck[0] || 'none'}`);
        } else {
          // 安全策: フェーズ設定が見つからない場合はFacilitatorを入れる
          session.speakerDeck = ['facilitator'];
          console.warn('⚠️ Phase config not found, fallback to facilitator');
        }

        stepUpdate = {
          type: 'start',
          step: stepNumber,
          stepName: stepName,
          estimatedTurns: stepStart.estimatedTurns
        };
      }

      // STEP_COMPLETED検出
      const stepCompletedResult = detectStepCompleted(text);
      if (stepCompletedResult) {
        console.log(`✅ STEP_COMPLETED detected`);

        stepCompleted = true;

        // ★修正点: タグから情報が取れない場合は、現在のセッション情報を使う
        completedStepInfo = {
          stepNumber: stepCompletedResult.stepNumber === 'SESSION_CURRENT' ? session.currentStep : stepCompletedResult.stepNumber,
          stepName: stepCompletedResult.stepName === 'SESSION_CURRENT' ? session.currentStepName : stepCompletedResult.stepName
        };

        // Reset step counters for next step
        session.currentStep = '';
        session.currentStepName = '';
        session.estimatedStepTurns = 0;
        session.actualStepTurns = 0;
        session.stepExtended = false;
        session.proposedExtensionTurns = 0;

        // 🔥 デッキをクリアして次のターンでFacilitatorを確実に呼ぶ
        session.speakerDeck = [];
        console.log(`🔄 Speaker deck cleared for next step - Facilitator will speak next`);
      }

      // STEP_EXTENSION_NEEDED検出
      const extensionInfo = detectStepExtensionNeeded(text);
      if (extensionInfo.needed) {
        console.log(`⏰ STEP_EXTENSION_NEEDED detected for step ${session.currentStep}, proposed additional turns: ${extensionInfo.additionalTurns}`);

        // 延長提案を保存
        session.proposedExtensionTurns = extensionInfo.additionalTurns;

        needsExtensionJudgment = true;
        stepUpdate = {
          type: 'extension_needed',
          step: session.currentStep,
          stepName: session.currentStepName,
          estimatedTurns: session.estimatedStepTurns,
          actualTurns: session.actualStepTurns
        };
      }

      // PHASE_COMPLETED検出（現在のフェーズ番号と一致する必要がある）
      if (detectPhaseCompleted(text, session.currentPhase)) {
        console.log(`🏁 PHASE_COMPLETED detected for phase ${session.currentPhase}`);
        phaseCompleted = true;
      }
    }

    // カウント更新（ステップ進行中の場合、Facilitator以外のターンをカウント）
    if (session.currentStep && nextAgent !== 'facilitator') {
      session.actualStepTurns++;
    }

    // Facilitatorが発言した場合、カウンターをリセット
    if (nextAgent === 'facilitator') {
      session.turnsSinceLastFacilitator = 0;
    }

    // ★追加: ターン終了時に保存スケジュール
    scheduleSave();

    // 計画書の更新をチェック（Facilitatorのみ）
    let planUpdate = null;
    if (nextAgent === 'facilitator') {
      const planMatch = text.match(/---PLAN_UPDATE---([\s\S]*?)---PLAN_UPDATE---/);
      if (planMatch) {
        planUpdate = planMatch[1].trim();
        session.currentPlan = planUpdate;
      }
    }

    // 議事メモの更新をチェック（新システムでは不使用）
    let memoUpdate = null;

    // フェーズ完了判定
    // IMPORTANT: Phase completion is determined by Facilitator's ---PHASE_COMPLETED--- tag, NOT by speaker deck length
    // Speaker deck is just for turn order management, not phase progress
    const isPhaseComplete = phaseCompleted;

    // チェックポイントはフェーズ完了時とする（フェーズ選択機能対応）
    const isCheckpoint = isPhaseComplete;

    console.log(`📊 Turn complete: isPhaseComplete=${isPhaseComplete}, phaseCompleted=${phaseCompleted}, remainingInDeck=${session.speakerDeck.length}`);

    res.json({
      success: true,
      agent: nextAgent,
      content: text,
      planUpdate,
      memoUpdate,
      stepUpdate,
      needsExtensionJudgment,
      phaseCompleted,
      stepCompleted,
      completedStep: completedStepInfo?.stepNumber || '',
      completedStepName: completedStepInfo?.stepName || '',
      turn: session.currentTurn,
      phase: session.currentPhase,
      phaseName: currentPhase.nameJa,
      totalTurnsInPhase: currentPhase.totalTurns,
      remainingInDeck: session.speakerDeck.length,
      isCheckpoint,
      isPhaseComplete,
      nextPhaseAvailable: (session.mode === 'free')
        ? false // フリーモードは次フェーズなし
        : session.currentPhase < NEW_PHASES.length,
      currentStep: session.currentStep,
      currentStepName: session.currentStepName,
      estimatedStepTurns: session.estimatedStepTurns,
      actualStepTurns: session.actualStepTurns
    });
  } catch (error: any) {
    console.error('Error in next turn:', error);
    res.status(500).json({ error: error.message });
  }
});

// 次のフェーズへ進む
router.post('/next-phase', async (req, res) => {
  try {
    const { sessionId } = req.body;
    const session = debateSessions.get(sessionId);

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // フリーモードの場合はフェーズ進行不可（または完了扱い）
    if (session.mode === 'free') {
      return res.json({
        success: true,
        message: 'Free mode completed',
        isComplete: true
      });
    }

    if (session.currentPhase >= NEW_PHASES.length) {
      return res.json({
        success: true,
        message: 'All phases completed',
        isComplete: true
      });
    }

    // 次のフェーズへ
    session.currentPhase++;
    const nextPhase = NEW_PHASES[session.currentPhase - 1];

    // 新しいデッキを生成（Facilitatorを最初に配置）
    session.speakerDeck = createSpeakerDeck(nextPhase, true); // 常にFacilitatorを先頭に
    session.currentTurn = 0;

    // ステップ情報をリセット（新しいフェーズの最初のステップはFacilitatorが宣言）
    session.currentStep = '';
    session.currentStepName = '';
    session.estimatedStepTurns = 0;
    session.actualStepTurns = 0;
    session.turnsSinceLastFacilitator = 0;

    scheduleSave(); // ★追加: フェーズ変更時に保存スケジュール

    res.json({
      success: true,
      message: `Phase ${session.currentPhase} started`,
      phase: nextPhase,
      currentPhase: session.currentPhase,
      totalPhases: NEW_PHASES.length
    });
  } catch (error: any) {
    console.error('Error transitioning phase:', error);
    res.status(500).json({ error: error.message });
  }
});

// ステップ延長判断を処理
router.post('/step-extension-judgment', async (req, res) => {
  try {
    const { sessionId, extend } = req.body;
    const session = debateSessions.get(sessionId);

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (extend) {
      // ユーザーが延長を選択 - Facilitatorに追加ターンを与える
      console.log(`✅ User approved step extension for ${session.currentStep}`);

      // Facilitatorを1回デッキに追加（追加見積もりを再提示させる）
      session.speakerDeck.unshift('facilitator');

      res.json({
        success: true,
        message: 'ステップを延長します',
        action: 'extended'
      });
    } else {
      // ユーザーがこのまま完了を選択
      console.log(`⏭️ User chose to complete step ${session.currentStep} as-is`);

      // ステップをリセット（次のステップへ）
      session.currentStep = '';
      session.currentStepName = '';
      session.estimatedStepTurns = 0;
      session.actualStepTurns = 0;

      scheduleSave(); // ★追加: ステップ完了時に保存スケジュール

      res.json({
        success: true,
        message: 'ステップを完了しました',
        action: 'completed'
      });
    }
  } catch (error: any) {
    console.error('Error handling step extension judgment:', error);
    res.status(500).json({ error: error.message });
  }
});

// 議論を延長する
router.post('/extend-discussion', async (req, res) => {
  try {
    const { sessionId } = req.body;
    const session = debateSessions.get(sessionId);

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const currentPhase = getPhaseConfig(session);

    // 延長カウントを増やす
    session.extensionCount++;

    // 各エージェント1回ずつ追加のデッキを作成
    const extensionDeck: AgentRole[] = [...currentPhase.participants];

    // デッキをシャッフル
    for (let i = extensionDeck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [extensionDeck[i], extensionDeck[j]] = [extensionDeck[j], extensionDeck[i]];
    }

    // 既存のデッキに追加
    session.speakerDeck = [...session.speakerDeck, ...extensionDeck];

    console.log(`🔄 Discussion extended! Added ${extensionDeck.length} more turns. Extension count: ${session.extensionCount}`);

    scheduleSave(); // ★追加: 延長時に保存スケジュール

    res.json({
      success: true,
      message: `議論を延長しました（延長回数: ${session.extensionCount}）`,
      extensionCount: session.extensionCount,
      addedTurns: extensionDeck.length,
      remainingInDeck: session.speakerDeck.length
    });
  } catch (error: any) {
    console.error('Error extending discussion:', error);
    res.status(500).json({ error: error.message });
  }
});

// セッション情報取得（完全版 - フロントエンドでの状態復元用）
router.get('/session/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  const session = debateSessions.get(sessionId);

  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  const currentPhase = getPhaseConfig(session);

  // 履歴をメッセージ形式に変換
  const messages = session.history.map(h => ({
    agent: h.agent,
    content: h.content,
    timestamp: new Date().toISOString(), // 履歴にタイムスタンプがないため現在時刻を使用
    hasUserQuestion: false,
    userQuestion: ''
  }));

  res.json({
    success: true,
    session: {
      sessionId: session.sessionId,
      theme: session.theme,
      mode: session.mode,
      outputMode: session.outputMode,
      currentPhase: session.currentPhase,
      currentPhaseName: currentPhase.nameJa,
      currentStep: session.currentStep,
      currentStepName: session.currentStepName,
      currentTurn: session.currentTurn,
      totalTurnsInPhase: currentPhase.totalTurns,
      estimatedStepTurns: session.estimatedStepTurns,
      actualStepTurns: session.actualStepTurns,
      remainingInDeck: session.speakerDeck.length,
      currentPlan: session.currentPlan,
      currentMemo: session.currentMemo,
      messages: messages,
      historyCount: session.history.length
    }
  });
});

// 現在の計画書取得
router.get('/plan/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  const session = debateSessions.get(sessionId);

  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  res.json({
    success: true,
    plan: session.currentPlan
  });
});

// テスト用エンドポイント
router.get('/test-gemini', async (req, res) => {
  try {
    console.log('🧪 Testing Gemini API...');
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-pro' });

    const startTime = Date.now();
    const result = await model.generateContent('こんにちは。簡単に自己紹介してください。');
    const response = result.response;
    const text = response.text();
    const duration = Date.now() - startTime;

    console.log(`✅ Gemini test successful in ${duration}ms`);

    res.json({
      success: true,
      message: 'Gemini API is working',
      response: text,
      duration: `${duration}ms`
    });
  } catch (error: any) {
    console.error('❌ Gemini test failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      details: error.toString()
    });
  }
});

export default router;
