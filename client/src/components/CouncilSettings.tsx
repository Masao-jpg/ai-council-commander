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
    <div className="p-4 bg-gray-800">
      <div className="flex items-center gap-2 mb-3">
        <Settings className="w-4 h-4 text-blue-400" />
        <h2 className="text-base font-semibold">Council Settings</h2>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Theme Input */}
        <div>
          <label className="block text-xs font-medium mb-1 text-gray-300">
            議題 (Theme)
          </label>
          <textarea
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            placeholder="例: 和食レストランの新しいコースメニューを企画する"
            className="w-full px-2 py-1.5 bg-gray-700 border border-gray-600 rounded text-sm focus:outline-none focus:border-blue-500 text-white placeholder-gray-400 resize-none"
            rows={2}
            disabled={isDebating}
          />
        </div>

        {/* Output Mode Selection */}
        <div>
          <label className="block text-xs font-medium mb-1 text-gray-300">
            出力モード
          </label>
          <div className="space-y-1">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                value="implementation"
                checked={outputMode === 'implementation'}
                onChange={(e) => setOutputMode(e.target.value as any)}
                className="text-blue-500"
                disabled={isDebating}
              />
              <span className="text-xs">
                <span className="font-semibold text-blue-400">Implementation</span>
              </span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                value="documentation"
                checked={outputMode === 'documentation'}
                onChange={(e) => setOutputMode(e.target.value as any)}
                className="text-blue-500"
                disabled={isDebating}
              />
              <span className="text-xs">
                <span className="font-semibold text-green-400">Documentation</span>
              </span>
            </label>
          </div>
        </div>

        {/* Council Members - Collapsed */}
        <div>
          <label className="block text-xs font-medium mb-1 text-gray-300">
            評議員: 🔵 Visionary / ⚪ Analyst / 🟠 Realist / 🔴 Guardian / 🟢 Moderator
          </label>
        </div>

        {/* Start Button */}
        <button
          type="submit"
          disabled={!theme.trim() || isDebating}
          className="w-full py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
        >
          <PlayCircle className="w-4 h-4" />
          {isDebating ? '議論中...' : '評議会を開始'}
        </button>
      </form>
    </div>
  );
}
