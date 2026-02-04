// Type definitions for AI Council Commander

export type AgentRole =
  | 'facilitator'                  // 指揮者
  | 'futurePotentialSeeker'        // 発展可能性の探求者
  | 'constraintChecker'            // 制約条件の確認者
  | 'logicalConsistencyChecker'    // 論理整合性の検証者
  | 'userValueAdvocate'            // ユーザー価値の代弁者
  | 'innovationCatalyst'           // 革新性の推進者
  | 'constructiveCritic';          // 建設的批評家

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

export interface StepInfo {
  id: string;
  name: string;
  description: string;
}

export interface PhaseInfo {
  phase: number;
  name: string;
  nameJa: string;
  purpose: string;
  totalTurns: number;
  steps?: StepInfo[];
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
  currentStep: string;  // 現在のステップ (例: "1-1", "2-3")
  currentStepName: string;  // 現在のステップ名 (例: "全体目的 (Why)")
  currentTurn: number;
  totalTurnsInPhase: number;
  estimatedStepTurns: number;  // Facilitatorの見積もりターン数
  actualStepTurns: number;  // 実際の議論ターン数（Facilitatorを除く）
  isWaitingForPhaseTransition: boolean;
  isWaitingForStepTransition: boolean;
  completedStep: string;
  completedStepName: string;
  isWaitingForUserResponse: boolean;
  currentUserQuestion: string;
  userResponses: UserResponse[];
  userPhaseInstructions: Record<number, string>;
  extensionCount: number;
}

export const AGENT_INFO: Record<AgentRole, { name: string; emoji: string; color: string; role: string }> = {
  facilitator: { name: 'Facilitator', emoji: '⚪', color: 'white', role: '指揮者・進行管理' },
  futurePotentialSeeker: { name: 'FuturePotentialSeeker', emoji: '🔵', color: 'blue', role: '発展可能性の探求者' },
  constraintChecker: { name: 'ConstraintChecker', emoji: '🟠', color: 'orange', role: '制約条件の確認者' },
  logicalConsistencyChecker: { name: 'LogicalConsistencyChecker', emoji: '⚫', color: 'gray', role: '論理整合性の検証者' },
  userValueAdvocate: { name: 'UserValueAdvocate', emoji: '🟢', color: 'green', role: 'ユーザー価値の代弁者' },
  innovationCatalyst: { name: 'InnovationCatalyst', emoji: '🔴', color: 'red', role: '革新性の推進者' },
  constructiveCritic: { name: 'ConstructiveCritic', emoji: '🟡', color: 'yellow', role: '建設的批評家' }
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
