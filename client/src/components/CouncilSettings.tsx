import { useState, useEffect } from 'react';
import { PlayCircle, Settings, ChevronDown, ChevronUp } from 'lucide-react';
import type { CouncilMode } from '../types';
import { MODE_INFO } from '../types';

interface CouncilSettingsProps {
  onStartDebate: (theme: string, mode: CouncilMode, outputMode: 'implementation' | 'documentation', startPhase: number) => void;
  isDebating: boolean;
}

export default function CouncilSettings({ onStartDebate, isDebating }: CouncilSettingsProps) {
  const [theme, setTheme] = useState('');
  const [mode, setMode] = useState<CouncilMode>('free');
  const [outputMode, setOutputMode] = useState<'implementation' | 'documentation'>('implementation');
  const [startPhase, setStartPhase] = useState<number>(1);
  const [isExpanded, setIsExpanded] = useState(true);

  // Auto-collapse on mobile when debate starts
  useEffect(() => {
    if (isDebating && window.innerWidth < 768) {
      setIsExpanded(false);
    }
  }, [isDebating]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (theme.trim()) {
      // Free mode always starts from phase 1
      const actualStartPhase = mode === 'free' ? 1 : startPhase;
      onStartDebate(theme, mode, outputMode, actualStartPhase);
    }
  };

  return (
    <div className="p-3 md:p-4 bg-gray-800">
      {/* Header - Collapsible on Mobile */}
      <div
        className="flex items-center justify-between cursor-pointer md:cursor-default"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Settings className="w-5 h-5 md:w-4 md:h-4 text-blue-400" />
            <h2 className="text-lg md:text-base font-semibold">議題設定</h2>
          </div>
          {/* Collapsed preview - Mobile only */}
          {!isExpanded && theme && (
            <div className="md:hidden text-xs text-gray-400 mt-1">
              <div className="truncate">{MODE_INFO[mode].nameJa} • {theme}</div>
            </div>
          )}
        </div>
        {/* Toggle button - Mobile only */}
        <button
          type="button"
          className="md:hidden text-gray-400 ml-2"
          onClick={(e) => {
            e.stopPropagation();
            setIsExpanded(!isExpanded);
          }}
        >
          {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </button>
      </div>

      {/* Form - Collapsible on Mobile */}
      <form
        onSubmit={handleSubmit}
        className={`space-y-3 md:space-y-3 transition-all duration-300 overflow-hidden ${
          isExpanded ? 'max-h-[2000px] opacity-100 mt-3' : 'max-h-0 opacity-0 mt-0 md:max-h-[2000px] md:opacity-100 md:mt-3'
        }`}
      >
        {/* Mode Selection - Mobile Optimized */}
        <div>
          <label className="block text-base md:text-xs font-medium mb-2 text-gray-300">
            モード選択
          </label>
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(MODE_INFO) as CouncilMode[]).map((m) => (
              <label
                key={m}
                className={`flex flex-col p-2 border-2 rounded-lg cursor-pointer transition-all ${
                  mode === m
                    ? 'border-blue-500 bg-blue-500 bg-opacity-20'
                    : 'border-gray-600 hover:border-gray-500'
                } ${isDebating ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <input
                  type="radio"
                  value={m}
                  checked={mode === m}
                  onChange={(e) => setMode(e.target.value as CouncilMode)}
                  className="hidden"
                  disabled={isDebating}
                />
                <span className="text-sm md:text-xs font-semibold mb-1 truncate">{MODE_INFO[m].nameJa}</span>
                <span className="text-xs text-gray-400 line-clamp-2">{MODE_INFO[m].description}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Phase Selection - Only for non-free modes */}
        {mode !== 'free' && (
          <div>
            <label className="block text-base md:text-xs font-medium mb-2 text-gray-300">
              開始フェーズ
            </label>
            <div className="grid grid-cols-5 gap-1.5 md:gap-2">
              {[1, 2, 3, 4, 5].map((phase) => {
                const phaseNames = ['情報収集', '発散', '構造化', '生成', '洗練'];
                return (
                  <label
                    key={phase}
                    className={`flex flex-col items-center p-2 md:p-1.5 border-2 rounded-lg cursor-pointer transition-all ${
                      startPhase === phase
                        ? 'border-green-500 bg-green-500 bg-opacity-20'
                        : 'border-gray-600 hover:border-gray-500'
                    } ${isDebating ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <input
                      type="radio"
                      value={phase}
                      checked={startPhase === phase}
                      onChange={(e) => setStartPhase(Number(e.target.value))}
                      className="hidden"
                      disabled={isDebating}
                    />
                    <span className="text-lg md:text-base font-bold">P{phase}</span>
                    <span className="text-xs text-gray-400 hidden md:block">{phaseNames[phase - 1]}</span>
                  </label>
                );
              })}
            </div>
          </div>
        )}

        {/* Theme Input - Compact on mobile */}
        <div>
          <label className="block text-base md:text-xs font-medium mb-2 text-gray-300">
            議題
          </label>
          <textarea
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            placeholder="例: 月70万円の支出を65万円に削減する方法"
            className="w-full px-3 py-2 md:px-2 md:py-1.5 bg-gray-700 border border-gray-600 rounded-lg text-sm focus:outline-none focus:border-blue-500 text-white placeholder-gray-400 resize-none"
            rows={2}
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

        {/* Start Button - Compact on mobile */}
        <button
          type="submit"
          disabled={!theme.trim() || isDebating}
          className="w-full py-3 md:py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg text-base md:text-sm font-semibold flex items-center justify-center gap-2 transition-colors shadow-lg"
        >
          <PlayCircle className="w-5 h-5 md:w-4 md:h-4" />
          {isDebating ? '議論中...' : '評議会を開始'}
        </button>
      </form>
    </div>
  );
}
