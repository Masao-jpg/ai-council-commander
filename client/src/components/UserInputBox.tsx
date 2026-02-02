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
    <div className="p-3 md:p-6 bg-blue-900 border-2 md:border-4 border-blue-400 rounded-xl shadow-2xl">
      <div className="mb-2 md:mb-3">
        <h3 className="text-base md:text-lg font-bold text-blue-200 mb-1 md:mb-2">💬 AIからの質問</h3>
        <div className="text-sm md:text-sm text-white bg-blue-800 p-2 md:p-4 rounded-lg whitespace-pre-wrap">
          {question}
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <textarea
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder || "回答を入力してください..."}
          className="w-full px-3 py-2 md:px-3 md:py-2 bg-gray-700 border border-gray-600 rounded-lg text-base md:text-sm text-white placeholder-gray-400 focus:outline-none focus:border-blue-400 resize-none"
          rows={2}
          autoFocus
        />
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between mt-2 gap-2 md:gap-0">
          <div className="flex items-center gap-2 justify-center md:justify-start text-xs md:text-xs">
            <ImageUpload onImageUploaded={setImageUrl} />
            <span className="hidden md:inline text-blue-300">
              💡 Ctrl+Enter で送信
            </span>
          </div>
          <button
            type="submit"
            disabled={!answer.trim()}
            className="w-full md:w-auto px-6 py-3 md:px-6 md:py-3 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg text-base md:text-base font-semibold flex items-center justify-center gap-2 transition-colors shadow-lg"
          >
            <Send className="w-5 h-5 md:w-5 md:h-5" />
            送信
          </button>
        </div>
      </form>
    </div>
  );
}
