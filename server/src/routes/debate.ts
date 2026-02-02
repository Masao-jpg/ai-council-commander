import { Router } from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import {
  AGENT_CONFIGS,
  DEBATE_PHASES,
  CHECKPOINTS,
  AgentRole,
  PhaseConfig
} from '../councilConfig';

const router = Router();

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// Session storage
interface DebateSession {
  sessionId: string;
  theme: string;
  outputMode: 'implementation' | 'documentation';
  currentPhase: number;
  currentTurn: number;
  speakerDeck: AgentRole[];
  history: Array<{ agent: AgentRole; content: string }>;
  currentPlan: string;
}

const debateSessions = new Map<string, DebateSession>();

// モックレスポンス生成関数
function generateMockResponse(agent: AgentRole, session: DebateSession, phase: PhaseConfig): string {
  const responses: Record<AgentRole, string[]> = {
    visionary: [
      `この「${session.theme}」というテーマは非常に魅力的です！理想を追求することで、新しい価値を生み出せると確信しています。`,
      `想像してみてください。もしこれが実現したら、どれほど素晴らしい未来が待っているでしょうか？可能性は無限大です。`,
      `本来の目的は何でしょうか？単なる機能実装ではなく、ユーザーに感動を与えることではないでしょうか。`
    ],
    analyst: [
      `データに基づいて分析すると、このアプローチには一定の根拠があります。過去の事例を見ても、類似のケースで70%の成功率が報告されています。`,
      `ISO/IEC標準に照らし合わせると、この計画は準拠性を満たしています。ただし、詳細な検証が必要です。`,
      `客観的な数値で見ると、現状の課題は以下の3点に集約されます：1) リソース不足 2) 技術的制約 3) タイムライン`
    ],
    realist: [
      `現実的に考えると、予算は約XX万円、期間は3ヶ月程度が妥当です。人材は最低でも2名必要になります。`,
      `その理想は素晴らしいですが、実現可能性を考慮すると、まずは小規模なMVPから始めるべきです。`,
      `効率性の観点から、既存のツールやライブラリを活用することで、開発期間を50%短縮できます。`
    ],
    guardian: [
      `しかし、セキュリティリスクを見落としていませんか？個人情報の取り扱いには十分な注意が必要です。`,
      `最悪のシナリオを想定すると、システム障害が発生した場合の影響範囲が大きすぎます。バックアップ体制を構築すべきです。`,
      `法的リスクとして、著作権やライセンス違反の可能性があります。弁護士に相談することを強く推奨します。`
    ],
    moderator: [
      `これまでの議論を整理します。Visionaryからは理想像が、Analystからはデータに基づく分析が、Realistからは実現可能な計画が提示されました。`,
      `合意点として、段階的なアプローチを採用し、リスク対策を講じながら進めることが確認されました。`,
      generateModeratorPlanUpdate(session, phase)
    ]
  };

  const agentResponses = responses[agent];
  const randomIndex = Math.floor(Math.random() * agentResponses.length);
  return agentResponses[randomIndex];
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
function createSpeakerDeck(phase: PhaseConfig, forceAnalystFirst: boolean = false): AgentRole[] {
  const deck: AgentRole[] = [];

  // 各エージェントの発言回数分だけデッキに追加
  Object.entries(phase.turnQuotas).forEach(([agent, count]) => {
    for (let i = 0; i < count; i++) {
      deck.push(agent as AgentRole);
    }
  });

  // Analystが含まれていて、フェーズ開始時の場合は最初に配置
  if (forceAnalystFirst && deck.includes('analyst')) {
    // Analystを一旦除外
    const analystIndex = deck.indexOf('analyst');
    deck.splice(analystIndex, 1);

    // 残りをシャッフル
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }

    // Analystを先頭に追加
    deck.unshift('analyst');
  } else {
    // 通常のシャッフル
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
  }

  return deck;
}

// セッション初期化
router.post('/start', async (req, res) => {
  try {
    const { sessionId, theme, outputMode } = req.body;

    if (!theme) {
      return res.status(400).json({ error: 'Theme is required' });
    }

    // Phase 1のデッキを生成（Analystを最初に配置）
    const phase1 = DEBATE_PHASES[0];
    const speakerDeck = createSpeakerDeck(phase1, true);

    const session: DebateSession = {
      sessionId,
      theme,
      outputMode,
      currentPhase: 1,
      currentTurn: 0,
      speakerDeck,
      history: [],
      currentPlan: `# ${theme}\n\n議論を開始します...`
    };

    debateSessions.set(sessionId, session);

    res.json({
      success: true,
      message: 'Debate session initialized',
      sessionId,
      phase: phase1,
      totalPhases: DEBATE_PHASES.length,
      checkpoints: CHECKPOINTS
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

    console.log(`💬 Turn ${session.currentTurn}: ${nextAgent} speaking (${session.speakerDeck.length} remaining)`);

    // AIに発言を生成させる
    const agentConfig = AGENT_CONFIGS[nextAgent];
    const currentPhase = DEBATE_PHASES[session.currentPhase - 1];

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
      contextPrompt += `【フェーズの目的】${currentPhase.purpose}\n\n`;

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

      // Analystがフェーズ開始時（Turn 1）の場合、質問を促す
      if (nextAgent === 'analyst' && session.currentTurn === 1) {
        contextPrompt += `\n【🔴 絶対必須の指示 🔴】\n`;
        contextPrompt += `これはフェーズの最初のターンです。\n`;
        contextPrompt += `あなたは**必ず**以下のルールに従ってユーザーに質問してください：\n\n`;
        contextPrompt += `1. 出力は必ず "---USER_QUESTION---" で開始し、"---USER_QUESTION---" で終了すること\n`;
        contextPrompt += `2. マーカーの前後に説明文を書かないこと\n`;
        contextPrompt += `3. マーカーの中に【確認事項】として質問を箇条書きで記載すること\n\n`;
        contextPrompt += `【正しい出力例】\n`;
        contextPrompt += `---USER_QUESTION---\n`;
        contextPrompt += `【確認事項】\n`;
        contextPrompt += `1. 目標の具体的な定義は？\n`;
        contextPrompt += `2. 予算と人数は？\n`;
        contextPrompt += `3. 利用可能な設備は？\n`;
        contextPrompt += `4. 時間的制約は？\n`;
        contextPrompt += `5. 品質・安全基準は？\n`;
        contextPrompt += `---USER_QUESTION---\n\n`;
        contextPrompt += `※マーカーの外に文章を書くと、システムが質問を検出できなくなります。必ずマーカーで囲んでください。\n`;
      }

      // モデレーターの場合、計画書更新を促す
      if (nextAgent === 'moderator') {
        contextPrompt += `\n【重要】あなたは議長として、これまでの議論を整理し、必ず ---PLAN_UPDATE--- で囲んだMarkdown形式の計画書を出力してください。\n`;
      }

      contextPrompt += `\nあなた（${agentConfig.name}）の意見を述べてください。現在 Turn ${session.currentTurn}/${currentPhase.totalTurns} です。`;

      const result = await model.generateContent(contextPrompt);
      const response = result.response;
      text = response.text();
    }

    const duration = Date.now() - startTime;
    console.log(`✅ Response received in ${duration}ms (${text.length} chars)`);

    // Check for user question markers (especially for Turn 1 Analyst)
    if (nextAgent === 'analyst' && session.currentTurn === 1) {
      const hasMarkers = text.includes('---USER_QUESTION---');
      console.log(`🔍 Turn 1 Analyst: Contains USER_QUESTION markers? ${hasMarkers}`);
      if (hasMarkers) {
        const match = text.match(/---USER_QUESTION---([\s\S]*?)---USER_QUESTION---/);
        console.log(`🔍 Regex match successful? ${match !== null}`);
        if (match) {
          console.log(`📋 Extracted question (first 150 chars): "${match[1].substring(0, 150)}..."`);
        }
      } else {
        console.warn('⚠️ Turn 1 Analyst did NOT include USER_QUESTION markers in response!');
        console.log(`📄 Response preview: ${text.substring(0, 300)}...`);
      }
    }

    // 履歴に追加
    session.history.push({ agent: nextAgent, content: text });

    // 計画書の更新をチェック
    let planUpdate = null;
    if (nextAgent === 'moderator') {
      const planMatch = text.match(/---PLAN_UPDATE---([\s\S]*?)---PLAN_UPDATE---/);
      if (planMatch) {
        planUpdate = planMatch[1].trim();
        session.currentPlan = planUpdate;
      }
    }

    // チェックポイント判定
    const totalTurnsSoFar = DEBATE_PHASES
      .slice(0, session.currentPhase)
      .reduce((sum, p) => sum + p.totalTurns, 0);

    const isCheckpoint = CHECKPOINTS.includes(totalTurnsSoFar);
    const isPhaseComplete = session.speakerDeck.length === 0;

    console.log(`📊 Turn complete: isPhaseComplete=${isPhaseComplete}, remainingInDeck=${session.speakerDeck.length}`);

    res.json({
      success: true,
      agent: nextAgent,
      content: text,
      planUpdate,
      turn: session.currentTurn,
      phase: session.currentPhase,
      phaseName: currentPhase.nameJa,
      totalTurnsInPhase: currentPhase.totalTurns,
      remainingInDeck: session.speakerDeck.length,
      isCheckpoint,
      isPhaseComplete,
      nextPhaseAvailable: session.currentPhase < DEBATE_PHASES.length
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

    if (session.currentPhase >= DEBATE_PHASES.length) {
      return res.json({
        success: true,
        message: 'All phases completed',
        isComplete: true
      });
    }

    // 次のフェーズへ
    session.currentPhase++;
    const nextPhase = DEBATE_PHASES[session.currentPhase - 1];

    // 新しいデッキを生成（Analystを最初に配置）
    session.speakerDeck = createSpeakerDeck(nextPhase, true);
    session.currentTurn = 0;

    res.json({
      success: true,
      message: `Phase ${session.currentPhase} started`,
      phase: nextPhase,
      currentPhase: session.currentPhase,
      totalPhases: DEBATE_PHASES.length
    });
  } catch (error: any) {
    console.error('Error transitioning phase:', error);
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

  const currentPhase = DEBATE_PHASES[session.currentPhase - 1];

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
