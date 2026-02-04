import { ChevronRight } from 'lucide-react';

interface StepInstructionBoxProps {
  completedStep: string;
  completedStepName: string;
  onContinue: () => void;
}

// ステップごとの成果物定義
const STEP_DELIVERABLES: Record<string, string> = {
  // Phase 1: 情報収集
  '1-0': '✅ 基本的な背景・目的が確認できました',
  '1-1': '✅ 全体目的が明確になり、取り組む意義が共有できました',
  '1-2': '✅ 今回の議論で作成する成果物が定義できました',
  '1-3': '✅ 必要な客観的情報（制約条件、現状など）が収集できました',
  '1-4': '✅ 関係者の想いや価値観が明確になりました',
  '1-5': '✅ 制約条件が整理され、実現可能な範囲が明確になりました',

  // Phase 2: 発散
  '2-1': '✅ アイデアが十分に出揃いました',
  '2-2': '✅ 新しい視点や気づきが得られました',
  '2-3': '✅ 有望なアイデアが具体化できました',

  // Phase 3: 構造化
  '3-1': '✅ 選択のための判断軸が明確になりました',
  '3-2': '✅ 最終的な方針が決定できました',
  '3-3': '✅ 成果物の構造が設計できました',

  // Phase 4: 生成
  '4-1': '✅ 本文が一通り執筆できました',
  '4-2': '✅ 説得力のある内容になりました',

  // Phase 5: 洗練
  '5-1': '✅ 品質チェックと修正が完了しました',
  '5-2': '✅ 完成品が仕上がりました',
};

export default function StepInstructionBox({ completedStep, completedStepName, onContinue }: StepInstructionBoxProps) {
  const deliverable = STEP_DELIVERABLES[completedStep] || '✅ このステップが完了しました';

  return (
    <div className="mt-6 md:mt-8 p-4 md:p-8 bg-green-900 bg-opacity-50 border-4 border-green-400 rounded-xl shadow-2xl">
      <div className="flex items-center gap-3 md:gap-4 mb-4 md:mb-6">
        <span className="text-4xl md:text-5xl">🎉</span>
        <div className="flex-1">
          <h3 className="text-xl md:text-2xl font-bold text-green-200">
            ステップ {completedStep} 完了！
          </h3>
          <p className="text-base md:text-sm text-green-100 mt-1">
            {completedStepName}
          </p>
        </div>
      </div>

      {/* 成果物の説明 */}
      <div className="mb-6 p-4 bg-green-800 bg-opacity-40 rounded-lg border border-green-600">
        <p className="text-base md:text-sm text-green-100 font-semibold">
          {deliverable}
        </p>
      </div>

      {/* 次のステップへ進むボタン */}
      <button
        onClick={onContinue}
        className="w-full py-5 md:py-4 bg-green-500 hover:bg-green-600 text-white rounded-lg font-bold text-lg md:text-base flex items-center justify-center gap-3 transition-all hover:scale-105 shadow-lg"
      >
        <ChevronRight className="w-7 h-7 md:w-6 md:h-6" />
        次のステップへ進む
      </button>
    </div>
  );
}
