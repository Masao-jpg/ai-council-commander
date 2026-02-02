import { useState } from 'react';
import { PlayCircle, Settings } from 'lucide-react';

interface CouncilSettingsProps {
  onStartDebate: (theme: string, outputMode: 'implementation' | 'documentation') => void;
  isDebating: boolean;
}

export default function CouncilSettings({ onStartDebate, isDebating }: CouncilSettingsProps) {
  const [theme, setTheme] = useState('');
  const [outputMode, setOutputMode] = useState<'implementation' | 'documentation'>('implementation');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (theme.trim()) {
      onStartDebate(theme, outputMode);
    }
  };

  return (
    <div className="p-3 md:p-4 bg-gray-800">
      <div className="flex items-center gap-2 mb-3">
        <Settings className="w-5 h-5 md:w-4 md:h-4 text-blue-400" />
        <h2 className="text-lg md:text-base font-semibold">議題設定</h2>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3 md:space-y-3">
        {/* Theme Input - Larger on mobile */}
        <div>
          <label className="block text-sm md:text-xs font-medium mb-2 text-gray-300">
            議題
          </label>
          <textarea
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            placeholder="例: 月70万円の支出を65万円に削減する方法"
            className="w-full px-4 py-3 md:px-2 md:py-1.5 bg-gray-700 border border-gray-600 rounded-lg text-base md:text-sm focus:outline-none focus:border-blue-500 text-white placeholder-gray-400 resize-none"
            rows={3}
            disabled={isDebating}
          />
        </div>

        {/* Output Mode Selection - Larger touch targets */}
        <div className="hidden md:block">
          <label className="block text-xs font-medium mb-1 text-gray-300">
            出力モード
          </label>
          <div className="space-y-2">
            <label className="flex items-center gap-3 cursor-pointer py-2">
              <input
                type="radio"
                value="implementation"
                checked={outputMode === 'implementation'}
                onChange={(e) => setOutputMode(e.target.value as any)}
                className="w-5 h-5 md:w-4 md:h-4"
                disabled={isDebating}
              />
              <span className="text-base md:text-xs">
                <span className="font-semibold text-blue-400">Implementation</span>
              </span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer py-2">
              <input
                type="radio"
                value="documentation"
                checked={outputMode === 'documentation'}
                onChange={(e) => setOutputMode(e.target.value as any)}
                className="w-5 h-5 md:w-4 md:h-4"
                disabled={isDebating}
              />
              <span className="text-base md:text-xs">
                <span className="font-semibold text-green-400">Documentation</span>
              </span>
            </label>
          </div>
        </div>

        {/* Start Button - Larger on mobile */}
        <button
          type="submit"
          disabled={!theme.trim() || isDebating}
          className="w-full py-4 md:py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg text-lg md:text-sm font-semibold flex items-center justify-center gap-2 transition-colors shadow-lg"
        >
          <PlayCircle className="w-6 h-6 md:w-4 md:h-4" />
          {isDebating ? '議論中...' : '評議会を開始'}
        </button>
      </form>
    </div>
  );
}
