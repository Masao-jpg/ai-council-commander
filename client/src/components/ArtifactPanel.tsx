import { FileText } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface ArtifactPanelProps {
  plan: string;
}

export default function ArtifactPanel({ plan }: ArtifactPanelProps) {
  return (
    <div className="flex flex-col h-full bg-gray-900">
      <div className="border-b border-gray-700 px-6 py-3 flex items-center gap-2">
        <FileText className="w-5 h-5 text-yellow-400" />
        <h2 className="text-lg font-semibold">The Artifact</h2>
        <span className="text-xs text-gray-500 ml-auto">current_plan.md</span>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="markdown-preview">
          <ReactMarkdown>{plan}</ReactMarkdown>
        </div>
      </div>
    </div>
  );
}
