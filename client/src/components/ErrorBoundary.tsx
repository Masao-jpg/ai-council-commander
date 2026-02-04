import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('❌ Uncaught error:', error);
    console.error('❌ Error info:', errorInfo);
    this.setState({
      error,
      errorInfo
    });
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="h-screen bg-gray-900 text-white flex items-center justify-center p-4">
          <div className="max-w-2xl w-full bg-red-900 border-2 border-red-500 rounded-lg p-6">
            <h1 className="text-2xl font-bold mb-4 text-red-200">
              🚨 エラーが発生しました
            </h1>
            <div className="bg-gray-800 p-4 rounded mb-4 overflow-auto">
              <p className="text-red-300 font-mono text-sm">
                {this.state.error?.toString()}
              </p>
            </div>
            {this.state.errorInfo && (
              <details className="mb-4">
                <summary className="cursor-pointer text-red-200 mb-2">
                  詳細を表示
                </summary>
                <div className="bg-gray-800 p-4 rounded overflow-auto">
                  <pre className="text-xs text-gray-300 whitespace-pre-wrap">
                    {this.state.errorInfo.componentStack}
                  </pre>
                </div>
              </details>
            )}
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded"
            >
              ページをリロード
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
