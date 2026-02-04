// Type definitions for AI Council Commander

export type AgentRole = 'visionary' | 'analyst' | 'realist' | 'guardian' | 'moderator' | 'secretary';

export type CouncilMode = 'free' | 'brainstorm' | 'requirements' | 'implementation' | 'review';

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
  brainstorm: {
    name: 'Brainstorm',
    nameJa: '思考整理/壁打ちモード',
    description: '曖昧な状態からの具体化、視点の拡張'
  },
  requirements: {
    name: 'Requirements',
    nameJa: '要件検討モード',
    description: '上流工程の定義（あらゆるユースケースに対応）'
  },
  implementation: {
    name: 'Implementation',
    nameJa: '実装モード',
    description: '定義された要件の具現化'
  },
  review: {
    name: 'Review',
    nameJa: 'テスト/レビューモード',
    description: '既存成果物の品質担保'
  }
};
