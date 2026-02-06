import { useState } from 'react';
import { Play, Download, CheckCircle, AlertCircle, FileText } from 'lucide-react';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';

interface ActionBarProps {
  plan: string;
  memo: string;
  theme: string;
  outputMode: 'implementation' | 'documentation';
  isDebating: boolean;
}

export default function ActionBar({ plan, memo, theme, outputMode, isDebating }: ActionBarProps) {
  const [isExecuting, setIsExecuting] = useState(false);
  const [result, setResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleRunClaude = async () => {
    if (isDebating) {
      setResult({ type: 'error', message: '議論が終了するまでお待ちください' });
      return;
    }

    setIsExecuting(true);
    setResult(null);

    try {
      const response = await fetch('/api/action/run-claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan, theme }),
      });

      const data = await response.json();

      if (data.success) {
        setResult({
          type: 'success',
          message: `計画を保存しました: ${data.planFile}\nターミナルで Claude Code を実行してください。`,
        });
      } else {
        setResult({ type: 'error', message: data.error || 'エラーが発生しました' });
      }
    } catch (error) {
      setResult({ type: 'error', message: '通信エラーが発生しました' });
    } finally {
      setIsExecuting(false);
    }
  };

  const handleDownloadPlan = async () => {
    try {
      console.log('Download plan started', { planLength: plan.length, theme, platform: Capacitor.getPlatform() });

      const timestamp = new Date().toISOString().split('T')[0];
      // Ensure theme is short and safe for filename (max 30 chars)
      const safeTheme = (theme || 'AI-Council')
        .substring(0, 30)
        .replace(/[^a-zA-Z0-9\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');
      const filename = `${safeTheme}_Plan_${timestamp}.txt`;

      // Check if running on native platform (Android/iOS)
      if (Capacitor.isNativePlatform()) {
        console.log('Using Capacitor Filesystem for native platform');

        // Save file using Capacitor Filesystem
        await Filesystem.writeFile({
          path: filename,
          data: plan,
          directory: Directory.Documents,
          encoding: Encoding.UTF8
        });

        setResult({
          type: 'success',
          message: `保存完了: Documents/${filename}`
        });
      } else {
        console.log('Using Blob download for web');

        // Create a blob from the plan content (for web browsers)
        const blob = new Blob([plan], { type: 'text/plain;charset=utf-8' });
        console.log('Blob created', { size: blob.size });

        // Create download link
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;

        console.log('Triggering download', { filename });

        // Trigger download
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        setResult({
          type: 'success',
          message: `ダウンロード完了: ${filename}`
        });
      }
    } catch (error: any) {
      console.error('Download error:', error);
      setResult({
        type: 'error',
        message: `エラー: ${error.message || 'ダウンロードに失敗しました'}`
      });
    }
  };

  const handleDownloadMemo = async () => {
    try {
      console.log('Download memo started', { memoLength: memo.length, theme, platform: Capacitor.getPlatform() });

      const timestamp = new Date().toISOString().split('T')[0];
      // Ensure theme is short and safe for filename (max 30 chars)
      const safeTheme = (theme || 'AI-Council')
        .substring(0, 30)
        .replace(/[^a-zA-Z0-9\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');
      const filename = `${safeTheme}_Memo_${timestamp}.txt`;

      // Check if running on native platform (Android/iOS)
      if (Capacitor.isNativePlatform()) {
        console.log('Using Capacitor Filesystem for native platform');

        // Save file using Capacitor Filesystem
        await Filesystem.writeFile({
          path: filename,
          data: memo,
          directory: Directory.Documents,
          encoding: Encoding.UTF8
        });

        setResult({
          type: 'success',
          message: `保存完了: Documents/${filename}`
        });
      } else {
        console.log('Using Blob download for web');

        // Create a blob from the memo content (for web browsers)
        const blob = new Blob([memo], { type: 'text/plain;charset=utf-8' });
        console.log('Blob created', { size: blob.size });

        // Create download link
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;

        console.log('Triggering download', { filename });

        // Trigger download
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        setResult({
          type: 'success',
          message: `ダウンロード完了: ${filename}`
        });
      }
    } catch (error: any) {
      console.error('Download error:', error);
      setResult({
        type: 'error',
        message: `エラー: ${error.message || 'ダウンロードに失敗しました'}`
      });
    }
  };

  return (
    <div className="bg-gray-800 border-t border-gray-700 px-3 py-3 md:px-6 md:py-4">
      <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4">
        {/* Action Buttons */}
        <div className="flex gap-2 md:gap-3 flex-wrap">
          {outputMode === 'implementation' && (
            <button
              onClick={handleRunClaude}
              disabled={isDebating || isExecuting}
              className="flex-1 md:flex-none px-3 py-2 md:px-6 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
            >
              <Play className="w-4 h-4" />
              <span className="hidden md:inline">Run Claude</span>
              <span className="md:hidden">Run</span>
            </button>
          )}

          <button
            onClick={handleDownloadPlan}
            disabled={isExecuting}
            className="flex-1 md:flex-none px-3 py-2 md:px-6 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
          >
            <Download className="w-4 h-4" />
            <span className="hidden md:inline">計画DL (.txt)</span>
            <span className="md:hidden">計画</span>
          </button>

          <button
            onClick={handleDownloadMemo}
            disabled={isExecuting}
            className="flex-1 md:flex-none px-3 py-2 md:px-6 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
          >
            <FileText className="w-4 h-4" />
            <span className="hidden md:inline">メモDL (.txt)</span>
            <span className="md:hidden">メモ</span>
          </button>
        </div>

        {/* Status Message */}
        {result && (
          <div className="flex items-center gap-2 text-sm ml-auto">
            {result.type === 'success' ? (
              <CheckCircle className="w-4 h-4 text-green-400" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-400" />
            )}
            <span className={result.type === 'success' ? 'text-green-400' : 'text-red-400'}>
              {result.message}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
