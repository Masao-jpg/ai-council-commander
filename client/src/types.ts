// Type definitions for AI Council Commander

export type AgentRole = 'visionary' | 'analyst' | 'realist' | 'guardian' | 'moderator' | 'secretary';

export type CouncilMode = 'free' | 'define' | 'develop' | 'structure' | 'generate' | 'refine';

export interface Message {
  agent: AgentRole;
  content: string;
  timestamp: Date;
  hasUserQuestion?: boolean;
  userQuestion?: string;
  imageUrl?: string;
}

export interface UserResponse {
  question: string;
  answer: string;
  timestamp: Date;
}

export interface PhaseInfo {
  phase: number;
  name: string;
  nameJa: string;
  purpose: string;
  totalTurns: number;
}

export interface DebateState {
  sessionId: string;
  theme: string;
  mode: CouncilMode;
  outputMode: 'implementation' | 'documentation';
  messages: Message[];
  currentPlan: string;
  currentMemo: string;
  isDebating: boolean;
  currentPhase: number;
  currentPhaseName: string;
  currentTurn: number;
  totalTurnsInPhase: number;
  isWaitingForPhaseTransition: boolean;
  isWaitingForUserResponse: boolean;
  currentUserQuestion: string;
  userResponses: UserResponse[];
  userPhaseInstructions: Record<number, string>;
  extensionCount: number;
}

export const AGENT_INFO: Record<AgentRole, { name: string; emoji: string; color: string; role: string }> = {
  visionary: { name: 'Visionary', emoji: '🔵', color: 'blue', role: '起案・情熱' },
  analyst: { name: 'Analyst', emoji: '⚪', color: 'gray', role: '分析・根拠' },
  realist: { name: 'Realist', emoji: '🟠', color: 'orange', role: '現実・兵站' },
  guardian: { name: 'Guardian', emoji: '🔴', color: 'red', role: '安全・リスク' },
  moderator: { name: 'Moderator', emoji: '🟢', color: 'green', role: '書記・進行' },
  secretary: { name: 'Secretary', emoji: '📝', color: 'purple', role: '議事メモ係' }
};

export const MODE_INFO: Record<CouncilMode, { name: string; nameJa: string; description: string }> = {
  free: {
    name: 'Free',
    nameJa: 'フリーモード',
    description: 'フェーズに縛られず自由に議論'
  },
  define: {
    name: 'Define',
    nameJa: '情報収集モード',
    description: '全体目的とゴール定義、情報収集'
  },
  develop: {
    name: 'Develop',
    nameJa: '発散モード',
    description: 'ブレインストーミングで可能性を拡張'
  },
  structure: {
    name: 'Structure',
    nameJa: '構造化モード',
    description: '評価・決定・骨格設計'
  },
  generate: {
    name: 'Generate',
    nameJa: '生成モード',
    description: '骨子に沿って本文を生成'
  },
  refine: {
    name: 'Refine',
    nameJa: '洗練モード',
    description: '検証・修正して完成させる'
  }
};
