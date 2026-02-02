// Type definitions for AI Council Commander

export type AgentRole = 'visionary' | 'analyst' | 'realist' | 'guardian' | 'moderator';

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
  outputMode: 'implementation' | 'documentation';
  messages: Message[];
  currentPlan: string;
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
}

export const AGENT_INFO: Record<AgentRole, { name: string; emoji: string; color: string; role: string }> = {
  visionary: { name: 'Visionary', emoji: '🔵', color: 'blue', role: '起案・情熱' },
  analyst: { name: 'Analyst', emoji: '⚪', color: 'gray', role: '分析・根拠' },
  realist: { name: 'Realist', emoji: '🟠', color: 'orange', role: '現実・兵站' },
  guardian: { name: 'Guardian', emoji: '🔴', color: 'red', role: '安全・リスク' },
  moderator: { name: 'Moderator', emoji: '🟢', color: 'green', role: '書記・進行' }
};
