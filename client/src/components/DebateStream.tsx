import { useEffect, useRef, useState } from 'react';
import { MessageSquare, Loader2, CheckCircle } from 'lucide-react';
import type { Message, AgentRole, UserResponse } from '../types';
import { AGENT_INFO } from '../types';
import UserInputBox from './UserInputBox';
import PhaseInstructionBox from './PhaseInstructionBox';
import StepInstructionBox from './StepInstructionBox';
import { getApiUrl } from '../config';

interface DebateStreamProps {
  messages: Message[];
  theme: string;
  mode: string;
  outputMode: string;
  sessionId: string;
  isDebating: boolean;
  isWaitingForPhaseTransition: boolean;
  isWaitingForStepTransition: boolean;
  completedStep: string;
  completedStepName: string;
  isWaitingForUserResponse: boolean;
  currentUserQuestion: string;
  currentPhase: number;
  userResponses: UserResponse[];
  userPhaseInstructions: Record<number, string>;
  onMessage: (message: Message) => void;
  onUserResponse: (question: string, answer: string) => void;
  onPlanUpdate: (plan: string) => void;
  onMemoUpdate: (memo: string) => void;
  onPhaseInfoUpdate: (
    phase: number,
    phaseName: string,
    turn: number,
    totalTurns: number,
    step?: string,
    stepName?: string,
    estimatedStepTurns?: number,
    actualStepTurns?: number
  ) => void;
  onWaitingForPhaseTransition: (waiting: boolean) => void;
  onWaitingForStepTransition: (waiting: boolean, step?: string, stepName?: string) => void;
  onPhaseInstruction: (phase: number, instruction: string) => void;
  onDebateEnd: () => void;
}

export default function DebateStream({
  messages,
  theme,
  mode,
  outputMode,
  sessionId,
  isDebating,
  isWaitingForPhaseTransition,
  isWaitingForStepTransition,
  completedStep,
  completedStepName,
  isWaitingForUserResponse,
  currentUserQuestion,
  currentPhase,
  userResponses: _userResponses, // Intentionally unused after bug fix
  userPhaseInstructions,
  onMessage,
  onUserResponse,
  onPlanUpdate,
  onMemoUpdate,
  onPhaseInfoUpdate,
  onWaitingForPhaseTransition,
  onWaitingForStepTransition,
  onPhaseInstruction,
  onDebateEnd,
}: DebateStreamProps) {
  const [currentAgent, setCurrentAgent] = useState<AgentRole | null>(null);
  const [nextPhaseName, setNextPhaseName] = useState('');
  const [isWaitingForExtensionJudgment, setIsWaitingForExtensionJudgment] = useState(false);
  const [extensionStepInfo, setExtensionStepInfo] = useState<any>(null);
  const [autoProgress, setAutoProgress] = useState(true); // 自動進行モード（デフォルトON）
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isDebatingRef = useRef(isDebating);
  const isWaitingRef = useRef(isWaitingForPhaseTransition);

  // Keep refs updated
  useEffect(() => {
    isDebatingRef.current = isDebating;
    isWaitingRef.current = isWaitingForPhaseTransition;
  }, [isDebating, isWaitingForPhaseTransition]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (isDebating && sessionId && messages.length === 0) {
      startDebate();
    }
  }, [isDebating, sessionId, currentPhase]);

  const startDebate = async () => {
    try {
      const response = await fetch(getApiUrl('/api/debate/start'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          theme,
          mode,
          outputMode,
          startPhase: currentPhase,
        }),
      });

      const data = await response.json();

      if (data.success) {
        onPhaseInfoUpdate(
          data.phase.phase,
          data.phase.nameJa,
          0,
          data.phase.totalTurns
        );

        // Start first turn
        await runNextTurn();
      }
    } catch (error) {
      console.error('Error starting debate:', error);
    }
  };

  const runNextTurn = async (immediateUserResponse?: { question: string; answer: string; timestamp: Date }) => {
    try {
      // Show loading state
      console.log('🔄 Requesting next turn...');
      setCurrentAgent('facilitator' as AgentRole); // Temporary loading indicator

      // CRITICAL: Only use immediateUserResponse if explicitly provided
      // DO NOT re-send old responses from userResponses array
      if (immediateUserResponse) {
        console.log('📤 Sending user response to API:', immediateUserResponse.answer.substring(0, 100));
      } else {
        console.log('ℹ️ No user response to send this turn');
      }

      // Get phase instruction for next phase
      const phaseInstruction = userPhaseInstructions[currentPhase + 1];

      const requestBody: any = { sessionId };
      if (immediateUserResponse) {
        requestBody.userResponse = immediateUserResponse;
      }
      if (phaseInstruction) {
        requestBody.userPhaseInstruction = phaseInstruction;
      }

      const response = await fetch(getApiUrl('/api/debate/next-turn'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();
      console.log('✅ Received response:', data);
      console.log('🔍 Response keys:', Object.keys(data));
      console.log('🔍 Agent:', data.agent);
      console.log('🔍 Content length:', data.content?.length);
      console.log('🔍 Step update:', data.stepUpdate);

      // Check for phase transition first (even if status is 400)
      if (data.needsPhaseTransition) {
        console.log('⏸️ Phase complete, waiting for user');
        setCurrentAgent(null);
        onWaitingForPhaseTransition(true);
        return;
      }

      if (!response.ok) {
        throw new Error(data.error || `HTTP error! status: ${response.status}`);
      }

      if (!data.success) {
        throw new Error(data.error || 'Unknown error');
      }

      // Set current agent
      console.log(`💬 ${data.agent} is speaking...`);

      // Validate agent before setting
      if (!AGENT_INFO[data.agent as AgentRole]) {
        console.error(`❌ Unknown agent type from server: ${data.agent}`);
        console.error('Available agents:', Object.keys(AGENT_INFO));
        throw new Error(`Unknown agent type: ${data.agent}`);
      }

      try {
        setCurrentAgent(data.agent);
      } catch (err) {
        console.error('❌ Error setting current agent:', err);
        throw err;
      }

      // Simulate thinking time
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Check for user question (検出は全文を対象とする)
      console.log('🔍 Checking for user question in FULL content (length:', data.content.length, 'chars)');
      console.log('🔍 Contains USER_QUESTION marker:', data.content.includes('---USER_QUESTION---'));

      // 質問マーカーを検出（柔軟なロジック）
      let hasUserQuestion = false;
      let userQuestion = '';

      if (data.content.includes('---USER_QUESTION---')) {
        // まず、開始タグと終了タグの両方がある正しい形式を試す
        const matchWithClosingTag = data.content.match(/---USER_QUESTION---([\s\S]*?)---USER_QUESTION---/);

        if (matchWithClosingTag) {
          // 正しい形式で検出成功
          userQuestion = matchWithClosingTag[1].trim();
          hasUserQuestion = true;
          console.log('✅ User question detected with closing tag');
        } else {
          // 終了タグがない場合: 開始タグ以降の全文を質問とする（柔軟な検出）
          const parts = data.content.split('---USER_QUESTION---');
          if (parts.length > 1) {
            userQuestion = parts[parts.length - 1].trim();
            hasUserQuestion = userQuestion.length > 0;
            console.log('✅ User question detected WITHOUT closing tag (flexible mode)');
          }
        }
      }

      if (hasUserQuestion) {
        console.log(`✅ User question extracted! Question length: ${userQuestion.length} chars`);
        console.log(`📋 Question full text: "${userQuestion}"`);
      } else {
        console.log('ℹ️ No user question in this turn');
      }

      // Add message
      console.log('📝 Creating message object...');
      try {
        const message: Message = {
          agent: data.agent,
          content: data.content,
          timestamp: new Date(),
          hasUserQuestion,
          userQuestion,
        };
        console.log('📤 Calling onMessage...');
        onMessage(message);
        console.log('✅ Message added successfully');
      } catch (err) {
        console.error('❌ Error adding message:', err);
        throw err;
      }

      // If there's a user question, stop and wait for response
      if (hasUserQuestion) {
        console.log('⏸️ User question detected, waiting for response...');
        setCurrentAgent(null);
        return; // Stop debate until user responds
      }

      // Update plan if provided
      if (data.planUpdate) {
        onPlanUpdate(data.planUpdate);
      }

      // Update memo if provided
      if (data.memoUpdate) {
        onMemoUpdate(data.memoUpdate);
      }

      // Handle step updates from Facilitator
      console.log('🔍 Checking for step updates...');
      if (data.stepUpdate) {
        console.log('🎯 Step update detected:', JSON.stringify(data.stepUpdate));

        try {
          if (data.stepUpdate.type === 'start') {
            // Step started
            console.log(`▶️ Step ${data.stepUpdate.step} started: ${data.stepUpdate.stepName} (${data.stepUpdate.estimatedTurns} turns)`);
          } else if (data.stepUpdate.type === 'extension_needed') {
            // Extension judgment needed
            console.log(`⏰ Step ${data.stepUpdate.step} needs extension judgment`);
          }
        } catch (err) {
          console.error('❌ Error processing step update:', err);
        }
      } else {
        console.log('ℹ️ No step update in this turn');
      }

      // Check for extension judgment needed
      if (data.needsExtensionJudgment) {
        console.log('⏸️ Extension judgment needed, waiting for user decision...');
        setIsWaitingForExtensionJudgment(true);
        setExtensionStepInfo(data.stepUpdate);
        setCurrentAgent(null);
        return; // Stop and wait for user decision
      }

      // Check for step completion (triggered by Facilitator keyword)
      if (data.stepCompleted) {
        console.log('🎉 Step completed by Facilitator, showing completion UI...');
        setCurrentAgent(null);
        onWaitingForStepTransition(true, data.completedStep, data.completedStepName);
        return;
      }

      // Check for phase completion (triggered by Facilitator keyword)
      if (data.phaseCompleted) {
        console.log('🏁 Phase completed by Facilitator, transitioning...');
        onWaitingForPhaseTransition(true);
        return;
      }

      // Update phase info (including step info and turn counts)
      console.log('📊 Updating phase info...');
      try {
        onPhaseInfoUpdate(
          data.phase,
          data.phaseName,
          data.turn,
          data.totalTurnsInPhase,
          data.currentStep,
          data.currentStepName,
          data.estimatedStepTurns,
          data.actualStepTurns
        );
        console.log('✅ Phase info updated successfully');
      } catch (err) {
        console.error('❌ Error updating phase info:', err);
        throw err;
      }

      setCurrentAgent(null);

      // Check if phase is complete
      console.log(`🔍 Checking phase completion: isPhaseComplete=${data.isPhaseComplete}, remainingInDeck=${data.remainingInDeck}`);

      if (data.isPhaseComplete) {
        console.log('⏸️ Phase complete! Showing checkpoint...');
        onWaitingForPhaseTransition(true);

        // Set next phase name - 新5フェーズ対応
        const phaseNames = ['情報収集', '発散', '構造化', '生成', '洗練'];
        if (data.nextPhaseAvailable) {
          setNextPhaseName(phaseNames[data.phase]);
        }
        return;
      }

      // Continue to next turn - use refs to get latest state
      const currentIsDebating = isDebatingRef.current;
      const currentIsWaiting = isWaitingRef.current;

      console.log(`⏭️ Checking if should continue... (isDebating=${currentIsDebating}, isWaitingForPhaseTransition=${currentIsWaiting}, autoProgress=${autoProgress})`);

      if (!currentIsDebating) {
        console.log('⏹️ Stopping: debate ended');
        return;
      }

      if (currentIsWaiting) {
        console.log('⏸️ Stopping: waiting for phase transition');
        return;
      }

      // 自動進行モードがOFFの場合は停止（ユーザーが手動で進める）
      if (!autoProgress) {
        console.log('⏸️ Stopping: auto-progress is OFF');
        setCurrentAgent(null);
        return;
      }

      console.log('✅ Conditions met, continuing to next turn in 1000ms...');
      await new Promise(resolve => setTimeout(resolve, 1000));
      await runNextTurn();
    } catch (error) {
      console.error('❌ Error in next turn:', error);
      setCurrentAgent(null);
      alert(`エラーが発生しました: ${error instanceof Error ? error.message : '不明なエラー'}\n\nコンソールを確認してください。`);
      onDebateEnd();
    }
  };

  const handleUserResponse = async (answer: string, imageUrl?: string) => {
    console.log('📝 User answered:', answer);
    if (imageUrl) {
      console.log('📷 With image:', imageUrl);
    }

    // If there's an image, add it as a user message
    if (imageUrl) {
      const userMessage: Message = {
        agent: 'facilitator' as AgentRole, // Use facilitator to display user messages
        content: `ユーザーの回答: ${answer}`,
        timestamp: new Date(),
        imageUrl: imageUrl
      };
      onMessage(userMessage);
    }

    // Create response object
    const userResponseObj = {
      question: currentUserQuestion,
      answer: imageUrl ? `${answer}\n\n[画像を添付: ${imageUrl}]` : answer,
      timestamp: new Date()
    };

    // Save user response to state
    onUserResponse(currentUserQuestion, imageUrl ? `${answer}\n[画像: ${imageUrl}]` : answer);

    // Continue debate with user's answer (pass directly to avoid state delay)
    await new Promise(resolve => setTimeout(resolve, 500));
    console.log('▶️ Continuing to next turn with user response...');
    await runNextTurn(userResponseObj);
  };

  const handlePhaseTransition = async (instruction: string) => {
    console.log('🚀 Phase transition with instruction:', instruction);

    if (instruction) {
      onPhaseInstruction(currentPhase + 1, instruction);
    }

    await handleContinueToNextPhase();
  };

  const handleStepTransition = async () => {
    console.log('🚀 Step transition - continuing to next step');

    // Clear the step transition flag
    onWaitingForStepTransition(false);

    // Start the next turn which will begin the next step
    await runNextTurn();
  };

  const handleExtendDiscussion = async () => {
    console.log('🔄 User requested discussion extension');

    try {
      const response = await fetch(getApiUrl('/api/debate/extend-discussion'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });

      const data = await response.json();

      if (data.success) {
        console.log(`✅ Discussion extended! Added ${data.addedTurns} turns.`);

        // Reset phase transition flag and continue debate
        onWaitingForPhaseTransition(false);

        // Continue debate with extended turns
        await new Promise(resolve => setTimeout(resolve, 500));
        await runNextTurn();
      }
    } catch (error) {
      console.error('❌ Error extending discussion:', error);
      alert(`議論延長エラー: ${error}`);
    }
  };

  const handleStepExtensionJudgment = async (extend: boolean) => {
    console.log(`🎯 User decided to ${extend ? 'extend' : 'complete'} step`);

    try {
      const response = await fetch(getApiUrl('/api/debate/step-extension-judgment'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, extend }),
      });

      const data = await response.json();

      if (data.success) {
        console.log(`✅ Step extension judgment processed: ${data.action}`);

        // Reset extension judgment flag
        setIsWaitingForExtensionJudgment(false);
        setExtensionStepInfo(null);

        // Continue debate
        await new Promise(resolve => setTimeout(resolve, 500));
        await runNextTurn();
      }
    } catch (error) {
      console.error('❌ Error handling step extension judgment:', error);
      alert(`ステップ延長判断エラー: ${error}`);
    }
  };

  const handleContinueToNextPhase = async () => {
    console.log('🚀 User clicked "Continue to Next Phase" button');
    console.log('Current state:', { isDebating, isWaitingForPhaseTransition, currentPhase });

    try {
      console.log(`📤 Sending next-phase request for session: ${sessionId}`);

      const response = await fetch(getApiUrl('/api/debate/next-phase'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });

      const data = await response.json();
      console.log('📥 Next-phase response:', data);

      if (data.success) {
        if (data.isComplete) {
          console.log('🏁 All phases complete!');
          onDebateEnd();
          return;
        }

        console.log(`✅ Moving to Phase ${data.currentPhase}: ${data.phase.nameJa}`);

        // Reset phase transition flag FIRST
        onWaitingForPhaseTransition(false);

        // Update phase info
        onPhaseInfoUpdate(
          data.currentPhase,
          data.phase.nameJa,
          0,
          data.phase.totalTurns
        );

        // Start next phase with slight delay
        console.log('⏳ Starting next phase in 1000ms...');
        await new Promise(resolve => setTimeout(resolve, 1000));

        console.log('🎬 Calling runNextTurn for new phase...');
        await runNextTurn();

        console.log('✅ First turn of new phase completed');
      }
    } catch (error) {
      console.error('❌ Error transitioning to next phase:', error);
      alert(`フェーズ移行エラー: ${error}`);
    }
  };

  const getAgentColor = (agent: AgentRole): string => {
    const colors: Record<AgentRole, string> = {
      facilitator: 'bg-white',
      futurePotentialSeeker: 'bg-blue-500',
      constraintChecker: 'bg-orange-500',
      logicalConsistencyChecker: 'bg-gray-500',
      userValueAdvocate: 'bg-green-500',
      innovationCatalyst: 'bg-red-500',
      constructiveCritic: 'bg-yellow-500',
    };
    return colors[agent] || 'bg-gray-500';
  };

  return (
    <div className="h-full w-full flex flex-col bg-gray-900">
      <div className="border-b border-gray-700 px-3 md:px-6 py-3 flex items-center gap-2 flex-shrink-0">
        <MessageSquare className="w-5 h-5 text-green-400" />
        <h2 className="text-lg font-semibold">Debate Stream</h2>

        {/* 自動進行モードトグル */}
        <label className="flex items-center gap-2 ml-4 cursor-pointer">
          <input
            type="checkbox"
            checked={autoProgress}
            onChange={(e) => setAutoProgress(e.target.checked)}
            className="w-4 h-4"
          />
          <span className="text-xs md:text-sm text-gray-400">
            自動進行
          </span>
        </label>

        {isDebating && !isWaitingForPhaseTransition && (
          <span className="ml-auto flex items-center gap-2 text-sm text-gray-400">
            <Loader2 className="w-4 h-4 animate-spin" />
            進行中...
          </span>
        )}
        {isWaitingForPhaseTransition && (
          <span className="ml-auto flex items-center gap-2 text-sm text-yellow-400">
            <CheckCircle className="w-4 h-4" />
            チェックポイント
          </span>
        )}
      </div>

      <div
        className="flex-1 overflow-y-auto p-3 md:p-6 space-y-3 md:space-y-4"
        style={{
          WebkitOverflowScrolling: 'touch',
          overscrollBehavior: 'contain'
        }}
      >
        {messages.length === 0 && !isDebating && (
          <div className="text-center text-gray-500 mt-8 text-base md:text-sm px-4">
            議題を設定して評議会を開始してください
          </div>
        )}

        {messages.map((message, index) => {
          const agentInfo = AGENT_INFO[message.agent];
          if (!agentInfo) {
            console.error(`Unknown agent type: ${message.agent}`);
            return null;
          }

          // Check if this is a step completion message
          const isStepCompleted = message.content.includes('[STEP_COMPLETED]');
          const displayContent = message.content.replace('[STEP_COMPLETED]\n', '');

          return (
            <div key={index} className="flex gap-2 md:gap-3">
              <div className={`w-1 md:w-2 rounded-full ${getAgentColor(message.agent)}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="text-2xl md:text-lg">{agentInfo.emoji}</span>
                  <span className="font-semibold text-base md:text-sm">
                    {agentInfo.name}
                  </span>
                  <span className="text-xs text-gray-500">
                    {message.timestamp.toLocaleTimeString()}
                  </span>
                </div>
                <div className={`text-base md:text-sm whitespace-pre-wrap leading-relaxed ${
                  isStepCompleted
                    ? 'bg-green-900 bg-opacity-30 border border-green-700 rounded-lg p-3 text-green-100 font-semibold'
                    : 'text-gray-300'
                }`}>
                  {displayContent}
                </div>
                {message.imageUrl && (
                  <div className="mt-2">
                    <img
                      src={message.imageUrl}
                      alt="Uploaded image"
                      className="max-w-full md:max-w-md rounded-lg border border-gray-600"
                    />
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {currentAgent && AGENT_INFO[currentAgent] && (
          <div className="flex gap-3 opacity-60">
            <div className={`w-2 rounded-full ${getAgentColor(currentAgent)} animate-pulse`} />
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">{AGENT_INFO[currentAgent].emoji}</span>
                <span className="font-semibold text-sm">
                  {AGENT_INFO[currentAgent].name}
                </span>
                <Loader2 className="w-4 h-4 animate-spin" />
              </div>
              <div className="text-sm text-gray-400">
                思考中...
              </div>
            </div>
          </div>
        )}

        {/* User Question Input */}
        {isWaitingForUserResponse && currentUserQuestion && (
          <UserInputBox
            question={currentUserQuestion}
            onSubmit={handleUserResponse}
            placeholder="AIの質問に回答してください..."
          />
        )}

        {/* Step Extension Judgment */}
        {isWaitingForExtensionJudgment && extensionStepInfo && (
          <div className="bg-yellow-900 bg-opacity-30 border-2 border-yellow-500 rounded-lg p-4 md:p-6">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-2xl">⏰</span>
              <h3 className="text-lg font-bold text-yellow-300">ステップ延長の判断</h3>
            </div>
            <div className="text-sm text-gray-300 mb-4 space-y-2">
              <p>
                <strong>現在のステップ:</strong> {extensionStepInfo.step} - {extensionStepInfo.stepName}
              </p>
              <p>
                <strong>見積もりターン数:</strong> {extensionStepInfo.estimatedTurns}ターン
              </p>
              <p>
                <strong>実際のターン数:</strong> {extensionStepInfo.actualTurns}ターン
              </p>
              <p className="text-yellow-200">
                Facilitatorがステップの延長が必要と判断しました。追加の議論を行いますか？
              </p>
            </div>
            <div className="flex flex-col md:flex-row gap-3">
              <button
                onClick={() => handleStepExtensionJudgment(true)}
                className="flex-1 py-3 bg-green-600 hover:bg-green-700 rounded-lg font-semibold transition-colors"
              >
                A) 延長する
              </button>
              <button
                onClick={() => handleStepExtensionJudgment(false)}
                className="flex-1 py-3 bg-gray-600 hover:bg-gray-700 rounded-lg font-semibold transition-colors"
              >
                B) このまま完了とする
              </button>
            </div>
          </div>
        )}

        {/* Checkpoint UI with Phase Instruction */}
        {isWaitingForPhaseTransition && !isWaitingForUserResponse && !isWaitingForExtensionJudgment && (
          <PhaseInstructionBox
            currentPhase={currentPhase}
            nextPhaseName={nextPhaseName}
            onContinue={handlePhaseTransition}
            onExtend={handleExtendDiscussion}
          />
        )}

        {/* Step Completion UI */}
        {isWaitingForStepTransition && !isWaitingForUserResponse && !isWaitingForExtensionJudgment && (
          <StepInstructionBox
            completedStep={completedStep}
            completedStepName={completedStepName}
            onContinue={handleStepTransition}
          />
        )}

        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}
