import { useState } from 'react';
import { ChevronRight, Edit3, Plus } from 'lucide-react';

interface PhaseInstructionBoxProps {
  currentPhase: number;
  nextPhaseName: string;
  onContinue: (instruction: string) => void;
  onExtend: () => void;
}

export default function PhaseInstructionBox({ currentPhase, nextPhaseName, onContinue, onExtend }: PhaseInstructionBoxProps) {
  const [instruction, setInstruction] = useState('');
  const [showInput, setShowInput] = useState(false);

  const handleContinue = () => {
    onContinue(instruction);
  };

  const handleExtend = () => {
    onExtend();
  };

  return (
    <div className="mt-6 md:mt-8 p-4 md:p-8 bg-yellow-900 border-4 border-yellow-400 rounded-xl shadow-2xl">
      <div className="flex items-center gap-3 md:gap-4 mb-4 md:mb-6">
        <span className="text-4xl md:text-5xl">🎉</span>
        <div>
          <h3 className="text-xl md:text-2xl font-bold text-yellow-200">
            Phase {currentPhase} 完了！
          </h3>
          <p className="text-base md:text-sm text-yellow-100 mt-2">
            次のフェーズに進む前に、追加の指示があれば入力してください（任意）
          </p>
        </div>
      </div>

      {/* 追加指示入力エリア */}
      <div className="mb-4">
        <button
          onClick={() => setShowInput(!showInput)}
          className="flex items-center gap-2 text-yellow-200 hover:text-yellow-100 mb-2 py-2"
        >
          <Edit3 className="w-5 h-5 md:w-4 md:h-4" />
          <span className="text-base md:text-sm font-semibold">
            {showInput ? '入力エリアを隠す' : '追加指示を入力する'}
          </span>
        </button>

        {showInput && (
          <textarea
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            placeholder={`例:\n- より詳細な分析をしてください\n- コスト削減案を追加してください\n- セキュリティ面を重視してください`}
            className="w-full px-4 py-3 md:px-3 md:py-2 bg-gray-800 border border-yellow-600 rounded-lg text-base md:text-sm text-white placeholder-gray-400 resize-none focus:outline-none focus:border-yellow-400"
            rows={4}
          />
        )}
      </div>

      {/* 議論延長ボタン */}
      <button
        onClick={handleExtend}
        className="w-full mb-3 py-4 md:py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-base md:text-sm flex items-center justify-center gap-2 transition-all shadow-md"
      >
        <Plus className="w-5 h-5 md:w-4 md:h-4" />
        議論を延長する（各エージェント1回ずつ追加）
      </button>

      {/* 次へ進むボタン */}
      {currentPhase < 5 ? (
        <button
          onClick={handleContinue}
          className="w-full py-5 md:py-4 bg-yellow-500 hover:bg-yellow-600 text-gray-900 rounded-lg font-bold text-lg md:text-base flex items-center justify-center gap-3 transition-all hover:scale-105 shadow-lg"
        >
          <ChevronRight className="w-7 h-7 md:w-6 md:h-6" />
          Phase {currentPhase + 1} へ進む: {nextPhaseName}
          {instruction && <span className="text-sm md:text-xs">(指示あり)</span>}
        </button>
      ) : (
        <button
          onClick={handleContinue}
          className="w-full py-5 md:py-4 bg-green-500 hover:bg-green-600 text-white rounded-lg font-bold text-lg md:text-base flex items-center justify-center gap-3 transition-all hover:scale-105 shadow-lg"
        >
          <span className="text-3xl md:text-2xl">🏁</span>
          議論を完了する
        </button>
      )}
    </div>
  );
}
