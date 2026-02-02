import { useState } from 'react';
import CouncilSettings from './components/CouncilSettings';
import DebateStream from './components/DebateStream';
import ArtifactPanel from './components/ArtifactPanel';
import ActionBar from './components/ActionBar';
import type { DebateState, Message } from './types';

function App() {
  const [debateState, setDebateState] = useState<DebateState>({
    sessionId: '',
    theme: '',
    outputMode: 'implementation',
    messages: [],
    currentPlan: '# AI Council Commander\n\n議論を開始すると、ここに計画が表示されます。',
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
  });

  const handleStartDebate = (theme: string, outputMode: 'implementation' | 'documentation') => {
    const sessionId = `session_${Date.now()}`;
    setDebateState({
      sessionId,
      theme,
      outputMode,
      messages: [],
      currentPlan: '# ' + theme + '\n\n議論を準備中...',
      isDebating: true,
      currentPhase: 1,
      currentPhaseName: '定義・目標設定',
      currentTurn: 0,
      totalTurnsInPhase: 8,
      isWaitingForPhaseTransition: false,
      isWaitingForUserResponse: false,
      currentUserQuestion: '',
      userResponses: [],
      userPhaseInstructions: {},
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
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">
            <span className="text-blue-400">AI Council</span> Commander
            <span className="text-gray-500 text-sm ml-3">v3.1.0</span>
          </h1>

          {/* Phase Indicator */}
          {debateState.isDebating && (
            <div className="flex items-center gap-4 text-sm">
              <div className="bg-gray-700 px-4 py-2 rounded-lg">
                <span className="text-gray-400">Phase {debateState.currentPhase}:</span>
                <span className="text-white ml-2 font-semibold">{debateState.currentPhaseName}</span>
              </div>
              <div className="bg-gray-700 px-4 py-2 rounded-lg">
                <span className="text-gray-400">Turn:</span>
                <span className="text-white ml-2 font-semibold">
                  {debateState.currentTurn}/{debateState.totalTurnsInPhase}
                </span>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Side: Settings + Debate */}
        <div className="w-1/2 flex flex-col border-r border-gray-700">
          {/* Council Settings - Fixed small height */}
          <div className="border-b border-gray-700 flex-shrink-0">
            <CouncilSettings
              onStartDebate={handleStartDebate}
              isDebating={debateState.isDebating}
            />
          </div>

          {/* Debate Stream - Takes remaining space */}
          <div className="flex-1 overflow-hidden min-h-0">
            <DebateStream
              messages={debateState.messages}
              theme={debateState.theme}
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
              onPhaseInfoUpdate={updatePhaseInfo}
              onWaitingForPhaseTransition={setWaitingForPhaseTransition}
              onPhaseInstruction={setPhaseInstruction}
              onDebateEnd={stopDebate}
            />
          </div>
        </div>

        {/* Right Side: Artifact */}
        <div className="w-1/2 flex flex-col">
          <ArtifactPanel plan={debateState.currentPlan} />
        </div>
      </div>

      {/* Action Bar */}
      <ActionBar
        plan={debateState.currentPlan}
        theme={debateState.theme}
        outputMode={debateState.outputMode}
        isDebating={debateState.isDebating}
      />
    </div>
  );
}

export default App;
