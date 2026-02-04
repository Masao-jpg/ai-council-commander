import { useState } from 'react';
import CouncilSettings from './components/CouncilSettings';
import DebateStream from './components/DebateStream';
import ArtifactPanel from './components/ArtifactPanel';
import ActionBar from './components/ActionBar';
import type { DebateState, Message, CouncilMode } from './types';

function App() {
  const [debateState, setDebateState] = useState<DebateState>({
    sessionId: '',
    theme: '',
    mode: 'brainstorm',
    outputMode: 'implementation',
    messages: [],
    currentPlan: '# AI Council Commander\n\n議論を開始すると、ここに計画が表示されます。',
    currentMemo: '# 議事メモ\n\n議論を開始すると、ここに議事メモが表示されます。',
    isDebating: false,
    currentPhase: 0,
    currentPhaseName: '',
    currentTurn: 0,
    totalTurnsInPhase: 0,
    isWaitingForPhaseTransition: false,
    isWaitingForUserResponse: false,
    currentUserQuestion: '',
    userResponses: [],
    userPhaseInstructions: {},
    extensionCount: 0,
  });

  const handleStartDebate = (theme: string, mode: CouncilMode, outputMode: 'implementation' | 'documentation') => {
    const sessionId = `session_${Date.now()}`;
    setDebateState({
      sessionId,
      theme,
      mode,
      outputMode,
      messages: [],
      currentPlan: '# ' + theme + '\n\n議論を準備中...',
      currentMemo: '# 議事メモ\n\n議論を準備中...',
      isDebating: true,
      currentPhase: 1,
      currentPhaseName: 'ヒアリング（現状把握）',
      currentTurn: 0,
      totalTurnsInPhase: 6,
      isWaitingForPhaseTransition: false,
      isWaitingForUserResponse: false,
      currentUserQuestion: '',
      userResponses: [],
      userPhaseInstructions: {},
      extensionCount: 0,
    });
  };

  const addMessage = (message: Message) => {
    setDebateState(prev => ({
      ...prev,
      messages: [...prev.messages, message],
      isWaitingForUserResponse: message.hasUserQuestion || false,
      currentUserQuestion: message.userQuestion || '',
    }));
  };

  const addUserResponse = (question: string, answer: string) => {
    setDebateState(prev => ({
      ...prev,
      userResponses: [...prev.userResponses, { question, answer, timestamp: new Date() }],
      isWaitingForUserResponse: false,
      currentUserQuestion: '',
    }));
  };

  const setPhaseInstruction = (phase: number, instruction: string) => {
    setDebateState(prev => ({
      ...prev,
      userPhaseInstructions: {
        ...prev.userPhaseInstructions,
        [phase]: instruction,
      },
    }));
  };

  const updatePlan = (plan: string) => {
    setDebateState(prev => ({
      ...prev,
      currentPlan: plan,
    }));
  };

  const updateMemo = (memo: string) => {
    setDebateState(prev => ({
      ...prev,
      currentMemo: prev.currentMemo + '\n\n' + memo,
    }));
  };

  const updatePhaseInfo = (phase: number, phaseName: string, turn: number, totalTurns: number) => {
    setDebateState(prev => ({
      ...prev,
      currentPhase: phase,
      currentPhaseName: phaseName,
      currentTurn: turn,
      totalTurnsInPhase: totalTurns,
    }));
  };

  const setWaitingForPhaseTransition = (waiting: boolean) => {
    setDebateState(prev => ({
      ...prev,
      isWaitingForPhaseTransition: waiting,
    }));
  };

  const stopDebate = () => {
    setDebateState(prev => ({
      ...prev,
      isDebating: false,
      isWaitingForPhaseTransition: false,
    }));
  };

  return (
    <div className="h-screen bg-gray-900 text-white flex flex-col">
      {/* Header - Mobile Optimized */}
      <header className="bg-gray-800 border-b border-gray-700 px-3 py-3 md:px-6 md:py-4 flex-shrink-0">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h1 className="text-lg md:text-2xl font-bold">
            <span className="text-blue-400">AI Council</span>
            <span className="text-gray-500 text-xs md:text-sm ml-2">v3.1.0</span>
          </h1>

          {/* Phase Indicator - Mobile Compact */}
          {debateState.isDebating && (
            <div className="flex items-center gap-2 text-xs md:text-sm">
              <div className="bg-gray-700 px-2 py-1 md:px-4 md:py-2 rounded">
                <span className="text-gray-400">P{debateState.currentPhase}</span>
                <span className="text-white ml-1 font-semibold hidden md:inline">{debateState.currentPhaseName}</span>
              </div>
              <div className="bg-gray-700 px-2 py-1 md:px-4 md:py-2 rounded">
                <span className="text-white font-semibold">
                  {debateState.currentTurn}/{debateState.totalTurnsInPhase}
                </span>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Main Content - Mobile: Single Column, Desktop: Two Columns */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Settings + Debate - Full width on mobile */}
        <div className="w-full md:w-1/2 h-full flex flex-col md:border-r border-gray-700">
          {/* Council Settings - Fixed small height */}
          <div className="border-b border-gray-700 flex-shrink-0">
            <CouncilSettings
              onStartDebate={handleStartDebate}
              isDebating={debateState.isDebating}
            />
          </div>

          {/* Debate Stream - Takes remaining space */}
          <div className="flex-1 h-0">
            <DebateStream
              messages={debateState.messages}
              theme={debateState.theme}
              mode={debateState.mode}
              outputMode={debateState.outputMode}
              sessionId={debateState.sessionId}
              isDebating={debateState.isDebating}
              isWaitingForPhaseTransition={debateState.isWaitingForPhaseTransition}
              isWaitingForUserResponse={debateState.isWaitingForUserResponse}
              currentUserQuestion={debateState.currentUserQuestion}
              currentPhase={debateState.currentPhase}
              userResponses={debateState.userResponses}
              userPhaseInstructions={debateState.userPhaseInstructions}
              onMessage={addMessage}
              onUserResponse={addUserResponse}
              onPlanUpdate={updatePlan}
              onMemoUpdate={updateMemo}
              onPhaseInfoUpdate={updatePhaseInfo}
              onWaitingForPhaseTransition={setWaitingForPhaseTransition}
              onPhaseInstruction={setPhaseInstruction}
              onDebateEnd={stopDebate}
            />
          </div>
        </div>

        {/* Right Side: Artifact - Hidden on mobile */}
        <div className="hidden md:flex md:w-1/2 flex-col">
          <ArtifactPanel plan={debateState.currentPlan} />
        </div>
      </div>

      {/* Action Bar - Visible on mobile */}
      <div className="flex-shrink-0">
        <ActionBar
          plan={debateState.currentPlan}
          memo={debateState.currentMemo}
          theme={debateState.theme}
          outputMode={debateState.outputMode}
          isDebating={debateState.isDebating}
        />
      </div>
    </div>
  );
}

export default App;
