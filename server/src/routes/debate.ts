import { Router } from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import {
  AGENT_CONFIGS,
  NEW_PHASES,
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
}

const debateSessions = new Map<string, DebateSession>();

// モックレスポンス生成関数（新エージェント対応）
function generateMockResponse(agent: AgentRole, session: DebateSession, phase: PhaseConfig): string {
  // 新システムでは基本的にモックモードは使用しない想定
  // 必要に応じて各エージェントの簡易レスポンスを返す
  const config = AGENT_CONFIGS[agent];
  return `[Mock] ${config.name}: ${session.theme}について、${phase.nameJa}フェーズの議論を進めます。`;
}

// Facilitator keyword detection functions
interface StepStartInfo {
  stepNumber: string;  // "1-1", "2-3", etc.
  stepName: string;
  estimatedTurns: number;
}

function detectStepStart(text: string): StepStartInfo | null {
  const regex = /---STEP_START---\s*ステップ\s*([0-9\-]+)\s*[:：]\s*([^\n]+)\s*見積もりターン数\s*[:：]\s*(\d+)\s*ターン\s*---STEP_START---/;
  const match = text.match(regex);
  if (match) {
    return {
      stepNumber: match[1].trim(),
      stepName: match[2].trim(),
      estimatedTurns: parseInt(match[3], 10)
    };
  }
  return null;
}

function detectStepCompleted(text: string): { stepNumber: string; stepName: string } | null {
  const regex = /---STEP_COMPLETED---\s*ステップ\s*([0-9\-]+)\s*[:：]\s*([^\n]+)\s*完了\s*---STEP_COMPLETED---/;
  const match = text.match(regex);
  if (match) {
    return {
      stepNumber: match[1].trim(),
      stepName: match[2].trim()
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
  const recentMessages = session.history.slice(-3);
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

// セッション初期化
router.post('/start', async (req, res) => {
  try {
    const { sessionId, theme, mode, outputMode, startPhase } = req.body;

    if (!theme) {
      return res.status(400).json({ error: 'Theme is required' });
    }

    // 開始フェーズの決定（デフォルトは1）
    const initialPhaseNumber = startPhase && startPhase >= 1 && startPhase <= NEW_PHASES.length
      ? startPhase
      : 1;

    // 指定されたフェーズのデッキを生成（Facilitatorを最初に配置）
    const initialPhase = NEW_PHASES[initialPhaseNumber - 1];
    const speakerDeck = createSpeakerDeck(initialPhase, true);

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
      currentMemo: `# 議事メモ\n\n## セッション開始\n- 議題: ${theme}\n- モード: ${mode || 'free'}\n- 開始フェーズ: Phase ${initialPhaseNumber} (${initialPhase.nameJa})\n`,
      extensionCount: 0,
      currentStep: '',
      currentStepName: '',
      estimatedStepTurns: 0,
      actualStepTurns: 0,
      turnsSinceLastFacilitator: 0,
      stepExtended: false,
      proposedExtensionTurns: 0
    };

    debateSessions.set(sessionId, session);

    res.json({
      success: true,
      message: 'Debate session initialized',
      sessionId,
      phase: initialPhase,
      totalPhases: NEW_PHASES.length
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
      console.log(`⏸️ Phase ${session.currentPhase} complete, needs transition`);
      return res.status(400).json({
        error: 'No more speakers in current phase',
        needsPhaseTransition: true
      });
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
    const currentPhase = NEW_PHASES[session.currentPhase - 1];

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

        // ステップ進行中の場合
        if (session.currentStep) {
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
              contextPrompt += `⚠️ このステップは既に延長されています。**必ず** ---STEP_COMPLETED--- を宣言してください。\n`;
              contextPrompt += `（延長は1回までです。2回目の延長は禁止されています）\n\n`;
            } else {
              // 初回の場合は延長可能
              contextPrompt += `- 成果物が十分に定義できている → ---STEP_COMPLETED--- を宣言\n`;
              contextPrompt += `- まだ不足がある → ---STEP_EXTENSION_NEEDED--- を宣言し、不足点と追加ターン数を提示\n\n`;
            }
          } else {
            const remaining = session.estimatedStepTurns - session.actualStepTurns;
            contextPrompt += `残りターン数: ${remaining}ターン\n\n`;
          }

          // 2ターンごとの監視
          if (session.turnsSinceLastFacilitator >= 2) {
            contextPrompt += `🔍 **監視タイミング**: 前回の介入から${session.turnsSinceLastFacilitator}ターン経過しています。\n`;
            contextPrompt += `議論がステップの目的（${session.currentStepName}）から逸脱していないか確認してください。\n`;
            contextPrompt += `- 順調な場合: 「進行良好です」と短く促すか、静観\n`;
            contextPrompt += `- 逸脱時: 目的に立ち返るよう軌道修正（例: 「HowではなくWhyに集中してください」）\n\n`;
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
        session.history.slice(-10).forEach((msg) => {
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
        contextPrompt += `上記のユーザー回答を踏まえて、議論を続けてください。\n`;
      }

      // Facilitatorの場合、計画書更新を促す
      if (nextAgent === 'facilitator') {
        contextPrompt += `\n【重要】必要に応じて ---PLAN_UPDATE--- で囲んだMarkdown形式の計画書を更新してください。\n`;
      }

      contextPrompt += `\nあなた（${agentConfig.name}）の意見を述べてください。現在 Turn ${session.currentTurn}/${currentPhase.totalTurns} です。`;

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

    if (nextAgent === 'facilitator') {
      // STEP_START検出
      const stepStart = detectStepStart(text);
      if (stepStart) {
        console.log(`🎯 STEP_START detected: ${stepStart.stepNumber} - ${stepStart.stepName} (${stepStart.estimatedTurns} turns)`);
        session.currentStep = stepStart.stepNumber;
        session.currentStepName = stepStart.stepName;
        session.estimatedStepTurns = stepStart.estimatedTurns;
        session.actualStepTurns = 0;
        session.stepExtended = false; // 新しいステップなので延長フラグをリセット
        session.proposedExtensionTurns = 0;
        stepUpdate = {
          type: 'start',
          step: stepStart.stepNumber,
          stepName: stepStart.stepName,
          estimatedTurns: stepStart.estimatedTurns
        };
      }

      // STEP_COMPLETED検出
      const stepCompleted = detectStepCompleted(text);
      if (stepCompleted) {
        console.log(`✅ STEP_COMPLETED detected: ${stepCompleted.stepNumber} - ${stepCompleted.stepName}`);
        stepUpdate = {
          type: 'completed',
          step: stepCompleted.stepNumber,
          stepName: stepCompleted.stepName
        };
        // Reset step counters for next step
        session.currentStep = '';
        session.currentStepName = '';
        session.estimatedStepTurns = 0;
        session.actualStepTurns = 0;
        session.stepExtended = false;
        session.proposedExtensionTurns = 0;
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
    const isPhaseComplete = session.speakerDeck.length === 0;

    // チェックポイントはフェーズ完了時とする（フェーズ選択機能対応）
    const isCheckpoint = isPhaseComplete;

    console.log(`📊 Turn complete: isPhaseComplete=${isPhaseComplete}, remainingInDeck=${session.speakerDeck.length}`);

    res.json({
      success: true,
      agent: nextAgent,
      content: text,
      planUpdate,
      memoUpdate,
      stepUpdate,
      needsExtensionJudgment,
      phaseCompleted,
      turn: session.currentTurn,
      phase: session.currentPhase,
      phaseName: currentPhase.nameJa,
      totalTurnsInPhase: currentPhase.totalTurns,
      remainingInDeck: session.speakerDeck.length,
      isCheckpoint,
      isPhaseComplete,
      nextPhaseAvailable: session.currentPhase < NEW_PHASES.length,
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

    const currentPhase = NEW_PHASES[session.currentPhase - 1];

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

// セッション情報取得
router.get('/session/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  const session = debateSessions.get(sessionId);

  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  const currentPhase = NEW_PHASES[session.currentPhase - 1];

  res.json({
    success: true,
    session: {
      sessionId: session.sessionId,
      theme: session.theme,
      outputMode: session.outputMode,
      currentPhase: session.currentPhase,
      currentPhaseName: currentPhase.nameJa,
      currentTurn: session.currentTurn,
      totalTurnsInPhase: currentPhase.totalTurns,
      remainingInDeck: session.speakerDeck.length,
      currentPlan: session.currentPlan,
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
