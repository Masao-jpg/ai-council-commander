import { useState } from 'react';
import { Send } from 'lucide-react';
import ImageUpload from './ImageUpload';

interface UserInputBoxProps {
  question: string;
  onSubmit: (answer: string, imageUrl?: string) => void;
  placeholder?: string;
}

export default function UserInputBox({ question, onSubmit, placeholder }: UserInputBoxProps) {
  const [answer, setAnswer] = useState('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (answer.trim()) {
      onSubmit(answer, imageUrl || undefined);
      setAnswer('');
      setImageUrl(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Ctrl+Enter or Shift+Enter to submit
    if (e.key === 'Enter' && (e.ctrlKey || e.shiftKey)) {
      e.preventDefault();
      if (answer.trim()) {
        onSubmit(answer, imageUrl || undefined);
        setAnswer('');
        setImageUrl(null);
      }
    }
    // Plain Enter just adds a new line (default behavior)
  };

  return (
    <div className="p-4 md:p-6 bg-blue-900 border-4 border-blue-400 rounded-xl shadow-2xl animate-pulse">
      <div className="mb-3 md:mb-4">
        <h3 className="text-xl md:text-lg font-bold text-blue-200 mb-2">💬 AIからの質問</h3>
        <div className="text-base md:text-sm text-white bg-blue-800 p-4 rounded-lg whitespace-pre-wrap">
          {question}
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <textarea
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder || "回答を入力してください..."}
          className="w-full px-4 py-3 md:px-3 md:py-2 bg-gray-700 border border-gray-600 rounded-lg text-base md:text-sm text-white placeholder-gray-400 focus:outline-none focus:border-blue-400 resize-none"
          rows={3}
          autoFocus
        />
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between mt-3 md:mt-2 gap-3 md:gap-0">
          <div className="flex items-center gap-3 justify-center md:justify-start">
            <ImageUpload onImageUploaded={setImageUrl} />
            <span className="text-sm md:text-xs text-blue-300">
              💡 Ctrl+Enter または Shift+Enter で送信
            </span>
          </div>
          <button
            type="submit"
            disabled={!answer.trim()}
            className="w-full md:w-auto px-8 py-4 md:px-6 md:py-3 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg text-lg md:text-base font-semibold flex items-center justify-center gap-2 transition-colors shadow-lg"
          >
            <Send className="w-6 h-6 md:w-5 md:h-5" />
            送信
          </button>
        </div>
      </form>
    </div>
  );
}
