import { useState } from 'react';
import { Play, Download, CheckCircle, AlertCircle, FileText, FileSpreadsheet } from 'lucide-react';
import { getApiUrl } from '../config';

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

  const handleExport = async () => {
    if (isDebating) {
      setResult({ type: 'error', message: '議論が終了するまでお待ちください' });
      return;
    }

    setIsExecuting(true);
    setResult(null);

    try {
      const response = await fetch('/api/action/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan, theme, format: 'md' }),
      });

      const data = await response.json();

      if (data.success) {
        setResult({
          type: 'success',
          message: `ドキュメントを保存しました: ${data.filename}`,
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

  const handleExportMemo = async () => {
    if (isDebating) {
      setResult({ type: 'error', message: '議論が終了するまでお待ちください' });
      return;
    }

    setIsExecuting(true);
    setResult(null);

    try {
      const response = await fetch('/api/action/export-memo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memo, theme, format: 'md' }),
      });

      const data = await response.json();

      if (data.success) {
        setResult({
          type: 'success',
          message: `議事メモを保存しました: ${data.filename}`,
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

  const handleExportToGoogleDocs = async () => {
    if (isDebating) {
      setResult({ type: 'error', message: '議論が終了するまでお待ちください' });
      return;
    }

    setIsExecuting(true);
    setResult(null);

    try {
      // Ensure title is short and appropriate
      const docTitle = theme || 'AI Council Commander - 議論結果';

      // Debug log
      console.log('Sending to Google Docs:', {
        contentLength: plan.length,
        title: docTitle,
        titleLength: docTitle.length
      });

      const response = await fetch(getApiUrl('/api/action/export-to-google-docs'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: plan,
          title: docTitle
        }),
      });

      const data = await response.json();

      if (data.success) {
        setResult({
          type: 'success',
          message: `Google Docsを作成しました！`,
        });
        // Open the document in a new tab
        window.open(data.url, '_blank');
      } else {
        if (data.setupInstructions) {
          setResult({
            type: 'error',
            message: 'Google Docs未設定。コンソールで設定手順を確認してください。'
          });
          console.error('Google Docs Setup Required:', data.setupInstructions);
        } else {
          setResult({ type: 'error', message: data.error || 'エラーが発生しました' });
        }
      }
    } catch (error) {
      setResult({ type: 'error', message: '通信エラーが発生しました' });
    } finally {
      setIsExecuting(false);
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
            onClick={handleExport}
            disabled={isDebating || isExecuting}
            className="flex-1 md:flex-none px-3 py-2 md:px-6 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
          >
            <Download className="w-4 h-4" />
            <span className="hidden md:inline">Export Doc</span>
            <span className="md:hidden">Doc</span>
          </button>

          <button
            onClick={handleExportMemo}
            disabled={isDebating || isExecuting}
            className="flex-1 md:flex-none px-3 py-2 md:px-6 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
          >
            <FileText className="w-4 h-4" />
            <span className="hidden md:inline">Export Memo</span>
            <span className="md:hidden">Memo</span>
          </button>

          <button
            onClick={handleExportToGoogleDocs}
            disabled={isDebating || isExecuting}
            className="flex-1 md:flex-none px-3 py-2 md:px-6 bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span className="hidden md:inline">Google Docs</span>
            <span className="md:hidden">GDocs</span>
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
