import { useState, useEffect } from 'react';
import CouncilSettings from './components/CouncilSettings';
import DebateStream from './components/DebateStream';
import ArtifactPanel from './components/ArtifactPanel';
import ActionBar from './components/ActionBar';
import ErrorBoundary from './components/ErrorBoundary';
import type { DebateState, Message, CouncilMode } from './types';
import { saveSessionInfo, loadSessionInfo, clearSessionInfo } from './utils/storage';
import { getApiUrl } from './config';
import { BackgroundMode } from '@anuradev/capacitor-background-mode';
import { Capacitor } from '@capacitor/core';

// 初期状態を定数として定義（リセット時に再利用）
const INITIAL_DEBATE_STATE: DebateState = {
  sessionId: '',
  theme: '',
  mode: 'free',
  outputMode: 'implementation',
  messages: [],
  currentPlan: '# AI Council Commander\n\n議論を開始すると、ここに計画が表示されます。',
  currentMemo: '# 議事メモ\n\n議論を開始すると、ここに議事メモが表示されます。',
  isDebating: false,
  currentPhase: 0,
  currentPhaseName: '',
  currentStep: '',
  currentStepName: '',
  currentTurn: 0,
  totalTurnsInPhase: 0,
  estimatedStepTurns: 0,
  actualStepTurns: 0,
  isWaitingForPhaseTransition: false,
  isWaitingForStepTransition: false,
  completedStep: '',
  completedStepName: '',
  isWaitingForUserResponse: false,
  currentUserQuestion: '',
  userResponses: [],
  userPhaseInstructions: {},
  extensionCount: 0,
};

function App() {
  const [debateState, setDebateState] = useState<DebateState>(INITIAL_DEBATE_STATE);

  // 開始Phase番号を保持（Phase 1より前のPhaseを非表示にするため）
  const [_startPhase, setStartPhase] = useState<number>(1);
  const [_isRestoringSession, setIsRestoringSession] = useState(true);

  // 起動時にセッション復元を試みる
  useEffect(() => {
    const restoreSession = async () => {
      const savedSession = loadSessionInfo();
      if (savedSession) {
        console.log('🔄 Attempting to restore session:', savedSession.sessionId);

        try {
          const response = await fetch(getApiUrl(`/api/debate/session/${savedSession.sessionId}`));
          const data = await response.json();

          if (data.success && data.session) {
            console.log('✅ Session restored successfully');

            // Date型の復元
            const messages = data.session.messages.map((m: any) => ({
              ...m,
              timestamp: new Date(m.timestamp)
            }));

            setDebateState({
              sessionId: data.session.sessionId,
              theme: data.session.theme,
              mode: data.session.mode,
              outputMode: data.session.outputMode,
              messages: messages,
              currentPlan: data.session.currentPlan,
              currentMemo: data.session.currentMemo,
              isDebating: true,
              currentPhase: data.session.currentPhase,
              currentPhaseName: data.session.currentPhaseName,
              currentStep: data.session.currentStep,
              currentStepName: data.session.currentStepName,
              currentTurn: data.session.currentTurn,
              totalTurnsInPhase: data.session.totalTurnsInPhase,
              estimatedStepTurns: data.session.estimatedStepTurns,
              actualStepTurns: data.session.actualStepTurns,
              isWaitingForPhaseTransition: false,
              isWaitingForStepTransition: false,
              completedStep: '',
              completedStepName: '',
              isWaitingForUserResponse: false,
              currentUserQuestion: '',
              userResponses: [],
              userPhaseInstructions: {},
              extensionCount: 0,
            });
          } else {
            console.log('⚠️ Session not found on server, clearing local storage');
            clearSessionInfo();
          }
        } catch (error) {
          console.error('❌ Failed to restore session:', error);
          clearSessionInfo();
        }
      }

      setIsRestoringSession(false);
    };

    restoreSession();
  }, []);

  // セッションIDが変わったらLocalStorageに保存
  useEffect(() => {
    if (debateState.sessionId && debateState.isDebating) {
      saveSessionInfo({
        sessionId: debateState.sessionId,
        theme: debateState.theme,
        mode: debateState.mode,
        outputMode: debateState.outputMode,
        currentPhase: debateState.currentPhase,
      });
    }
  }, [debateState.sessionId, debateState.theme, debateState.mode, debateState.outputMode, debateState.currentPhase]);

  // バックグラウンドモードの制御
  useEffect(() => {
    const handleBackgroundMode = async () => {
      // ネイティブアプリ（iOS/Android）の場合のみ実行
      if (Capacitor.isNativePlatform()) {
        try {
          if (debateState.isDebating) {
            // 議論中はバックグラウンドモードを有効化
            // Android用の設定を含めて有効化
            const settings = Capacitor.getPlatform() === 'android' ? {
              title: "AI評議会 進行中",
              text: "バックグラウンドで議論を継続しています...",
              icon: "ic_launcher",
              color: "0044FF",
              resume: true,
              hidden: false,
              bigText: true
            } : {};

            await BackgroundMode.enable(settings);
            console.log('📱 Background Mode Enabled');
          } else {
            // 議論終了時は無効化
            await BackgroundMode.disable();
            console.log('📱 Background Mode Disabled');
          }
        } catch (err) {
          console.error('Failed to toggle background mode:', err);
        }
      }
    };

    handleBackgroundMode();
  }, [debateState.isDebating]);

  const handleStartDebate = (theme: string, mode: CouncilMode, outputMode: 'implementation' | 'documentation', startPhaseNumber: number) => {
    // 新規開始時は前のセッションをクリア
    clearSessionInfo();

    const sessionId = `session_${Date.now()}`;

    // フリーモード用の初期設定
    let initialPhase;

    if (mode === 'free') {
      // フリーモードは特別なフェーズ1として扱う
      initialPhase = {
        phase: 1,
        nameJa: 'フリーモード',
        totalTurns: 100
      };
      setStartPhase(1);
    } else {
      // 通常モードの定義
      const phaseConfigs = [
        { phase: 1, nameJa: '情報収集', totalTurns: 11 },
        { phase: 2, nameJa: '発散', totalTurns: 11 },
        { phase: 3, nameJa: '構造化', totalTurns: 11 },
        { phase: 4, nameJa: '生成', totalTurns: 8 },
        { phase: 5, nameJa: '洗練', totalTurns: 11 },
      ];
      initialPhase = phaseConfigs[startPhaseNumber - 1];
      // 開始Phase番号を保存（UI表示に使用）
      setStartPhase(startPhaseNumber);
    }

    setDebateState({
      sessionId,
      theme,
      mode,
      outputMode,
      messages: [],
      currentPlan: '# ' + theme + '\n\n議論を準備中...',
      currentMemo: '# 議事メモ\n\n議論を準備中...',
      isDebating: true,
      currentPhase: initialPhase.phase,
      currentPhaseName: initialPhase.nameJa,
      currentStep: '',
      currentStepName: '',
      currentTurn: 0,
      totalTurnsInPhase: initialPhase.totalTurns,
      estimatedStepTurns: 0,
      actualStepTurns: 0,
      isWaitingForPhaseTransition: false,
      isWaitingForStepTransition: false,
      completedStep: '',
      completedStepName: '',
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

  const updatePhaseInfo = (
    phase: number,
    phaseName: string,
    turn: number,
    totalTurns: number,
    step?: string,
    stepName?: string,
    estimatedStepTurns?: number,
    actualStepTurns?: number
  ) => {
    setDebateState(prev => ({
      ...prev,
      currentPhase: phase,
      currentPhaseName: phaseName,
      currentStep: step || prev.currentStep,
      currentStepName: stepName || prev.currentStepName,
      currentTurn: turn,
      totalTurnsInPhase: totalTurns,
      estimatedStepTurns: estimatedStepTurns !== undefined ? estimatedStepTurns : prev.estimatedStepTurns,
      actualStepTurns: actualStepTurns !== undefined ? actualStepTurns : prev.actualStepTurns,
    }));
  };

  const setWaitingForPhaseTransition = (waiting: boolean) => {
    setDebateState(prev => ({
      ...prev,
      isWaitingForPhaseTransition: waiting,
    }));
  };

  const setWaitingForStepTransition = (waiting: boolean, step?: string, stepName?: string) => {
    setDebateState(prev => ({
      ...prev,
      isWaitingForStepTransition: waiting,
      completedStep: step || prev.completedStep,
      completedStepName: stepName || prev.completedStepName,
    }));
  };

  const stopDebate = () => {
    setDebateState(prev => ({
      ...prev,
      isDebating: false,
      isWaitingForPhaseTransition: false,
      isWaitingForStepTransition: false,
    }));
  };

  const handleAbortSession = () => {
    if (window.confirm('現在のセッションを終了し、初期画面に戻りますか？\n※現在の議論データは破棄されます。')) {
      clearSessionInfo();
      setDebateState(INITIAL_DEBATE_STATE);
    }
  };

  return (
    <ErrorBoundary>
      <div className="h-screen bg-gray-900 text-white flex flex-col">
      {/* Header - Mobile Optimized */}
      <header className="bg-gray-800 border-b border-gray-700 px-3 py-3 md:px-6 md:py-4 flex-shrink-0">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h1 className="text-lg md:text-2xl font-bold">
            <span className="text-blue-400">AI Council</span>
            <span className="text-gray-500 text-xs md:text-sm ml-2">v3.1.0</span>
          </h1>

          {/* Phase & Step Indicator - Mobile Optimized */}
          {debateState.isDebating && (
            <div className="flex flex-col items-end gap-1 text-xs">
              {/* Phase info - Always visible */}
              <div className="flex items-center gap-1.5">
                <div className="bg-gray-700 px-2 py-1 rounded flex items-center gap-1">
                  <span className="text-gray-400">P{debateState.currentPhase}</span>
                  <span className="text-white font-semibold">{debateState.currentPhaseName}</span>
                </div>
                <div className="bg-gray-700 px-2 py-1 rounded">
                  <span className="text-white font-semibold">
                    {debateState.currentTurn}T
                  </span>
                </div>
              </div>

              {/* Step info - Shown when available */}
              {debateState.currentStep && (
                <div className="bg-blue-900 bg-opacity-50 px-2 py-1 rounded border border-blue-700 flex items-center gap-1">
                  <span className="text-blue-300 font-semibold">{debateState.currentStep}</span>
                  <span className="text-white text-xs">{debateState.currentStepName}</span>
                  {debateState.estimatedStepTurns > 0 && (
                    <span className="text-blue-300 ml-1">
                      ({debateState.actualStepTurns}/{debateState.estimatedStepTurns})
                    </span>
                  )}
                </div>
              )}
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
              isWaitingForStepTransition={debateState.isWaitingForStepTransition}
              completedStep={debateState.completedStep}
              completedStepName={debateState.completedStepName}
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
              onWaitingForStepTransition={setWaitingForStepTransition}
              onPhaseInstruction={setPhaseInstruction}
              onDebateEnd={stopDebate}
              onAbort={handleAbortSession}
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
    </ErrorBoundary>
  );
}

export default App;
