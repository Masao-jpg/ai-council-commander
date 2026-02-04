import { ChevronRight } from 'lucide-react';

interface StepInstructionBoxProps {
  completedStep: string;
  completedStepName: string;
  onContinue: () => void;
}

export default function StepInstructionBox({ completedStep, completedStepName, onContinue }: StepInstructionBoxProps) {
  return (
    <div className="mt-6 md:mt-8 p-4 md:p-8 bg-green-900 bg-opacity-50 border-4 border-green-400 rounded-xl shadow-2xl">
      <div className="flex items-center gap-3 md:gap-4 mb-4 md:mb-6">
        <span className="text-4xl md:text-5xl">🎉</span>
        <div>
          <h3 className="text-xl md:text-2xl font-bold text-green-200">
            ステップ {completedStep} 完了！
          </h3>
          <p className="text-base md:text-sm text-green-100 mt-2">
            {completedStepName}
          </p>
        </div>
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
