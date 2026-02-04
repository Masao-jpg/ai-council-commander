import { useEffect, useRef, useState } from 'react';
import { MessageSquare, Loader2, CheckCircle } from 'lucide-react';
import type { Message, AgentRole, UserResponse } from '../types';
import { AGENT_INFO } from '../types';
import UserInputBox from './UserInputBox';
import PhaseInstructionBox from './PhaseInstructionBox';
import { getApiUrl } from '../config';

interface DebateStreamProps {
  messages: Message[];
  theme: string;
  mode: string;
  outputMode: string;
  sessionId: string;
  isDebating: boolean;
  isWaitingForPhaseTransition: boolean;
  isWaitingForUserResponse: boolean;
  currentUserQuestion: string;
  currentPhase: number;
  userResponses: UserResponse[];
  userPhaseInstructions: Record<number, string>;
  onMessage: (message: Message) => void;
  onUserResponse: (question: string, answer: string) => void;
  onPlanUpdate: (plan: string) => void;
  onMemoUpdate: (memo: string) => void;
  onPhaseInfoUpdate: (phase: number, phaseName: string, turn: number, totalTurns: number) => void;
  onWaitingForPhaseTransition: (waiting: boolean) => void;
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
  isWaitingForUserResponse,
  currentUserQuestion,
  currentPhase,
  userResponses,
  userPhaseInstructions,
  onMessage,
  onUserResponse,
  onPlanUpdate,
  onMemoUpdate,
  onPhaseInfoUpdate,
  onWaitingForPhaseTransition,
  onPhaseInstruction,
  onDebateEnd,
}: DebateStreamProps) {
  const [currentAgent, setCurrentAgent] = useState<AgentRole | null>(null);
  const [nextPhaseName, setNextPhaseName] = useState('');
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
  }, [isDebating, sessionId]);

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
      setCurrentAgent('moderator' as AgentRole); // Temporary loading indicator

      // Use immediate response if provided, otherwise get latest from state
      const latestUserResponse = immediateUserResponse || (userResponses.length > 0
        ? userResponses[userResponses.length - 1]
        : null);

      if (latestUserResponse) {
        console.log('📤 Sending user response to API:', latestUserResponse.answer.substring(0, 100));
      }

      // Get phase instruction for next phase
      const phaseInstruction = userPhaseInstructions[currentPhase + 1];

      const requestBody: any = { sessionId };
      if (latestUserResponse) {
        requestBody.userResponse = latestUserResponse;
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
      setCurrentAgent(data.agent);

      // Simulate thinking time
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Check for user question
      console.log('🔍 Checking for user question in content (first 200 chars):', data.content.substring(0, 200));
      console.log('🔍 Contains USER_QUESTION marker:', data.content.includes('---USER_QUESTION---'));
      const userQuestionMatch = data.content.match(/---USER_QUESTION---([\s\S]*?)---USER_QUESTION---/);
      const hasUserQuestion = userQuestionMatch !== null;
      const userQuestion = userQuestionMatch ? userQuestionMatch[1].trim() : '';

      if (hasUserQuestion) {
        console.log(`✅ User question detected! Question length: ${userQuestion.length} chars`);
        console.log(`📋 Question preview: "${userQuestion.substring(0, 150)}..."`);
      } else if (data.content.includes('---USER_QUESTION---')) {
        console.warn('⚠️ Found USER_QUESTION marker but regex did not match! Content:', data.content);
      } else {
        console.log('ℹ️ No user question in this turn');
      }

      // Add message
      const message: Message = {
        agent: data.agent,
        content: data.content,
        timestamp: new Date(),
        hasUserQuestion,
        userQuestion,
      };
      onMessage(message);

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

      // Update phase info
      onPhaseInfoUpdate(
        data.phase,
        data.phaseName,
        data.turn,
        data.totalTurnsInPhase
      );

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

      console.log(`⏭️ Checking if should continue... (isDebating=${currentIsDebating}, isWaitingForPhaseTransition=${currentIsWaiting})`);

      if (!currentIsDebating) {
        console.log('⏹️ Stopping: debate ended');
        return;
      }

      if (currentIsWaiting) {
        console.log('⏸️ Stopping: waiting for phase transition');
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
        agent: 'moderator' as AgentRole, // Use moderator to display user messages
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
      visionary: 'bg-blue-500',
      analyst: 'bg-gray-500',
      realist: 'bg-orange-500',
      guardian: 'bg-red-500',
      moderator: 'bg-green-500',
      secretary: 'bg-purple-500',
    };
    return colors[agent];
  };

  return (
    <div className="h-full w-full flex flex-col bg-gray-900">
      <div className="border-b border-gray-700 px-3 md:px-6 py-3 flex items-center gap-2 flex-shrink-0">
        <MessageSquare className="w-5 h-5 text-green-400" />
        <h2 className="text-lg font-semibold">Debate Stream</h2>
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

        {messages.map((message, index) => (
          <div key={index} className="flex gap-2 md:gap-3">
            <div className={`w-1 md:w-2 rounded-full ${getAgentColor(message.agent)}`} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="text-2xl md:text-lg">{AGENT_INFO[message.agent].emoji}</span>
                <span className="font-semibold text-base md:text-sm">
                  {AGENT_INFO[message.agent].name}
                </span>
                <span className="text-xs text-gray-500">
                  {message.timestamp.toLocaleTimeString()}
                </span>
              </div>
              <div className="text-base md:text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">
                {message.content}
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
        ))}

        {currentAgent && (
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

        {/* Checkpoint UI with Phase Instruction */}
        {isWaitingForPhaseTransition && !isWaitingForUserResponse && (
          <PhaseInstructionBox
            currentPhase={currentPhase}
            nextPhaseName={nextPhaseName}
            onContinue={handlePhaseTransition}
            onExtend={handleExtendDiscussion}
          />
        )}

        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}
