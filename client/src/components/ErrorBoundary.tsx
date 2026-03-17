import { Component, ReactNode } from 'react';

interface Props { children: ReactNode; fallback?: ReactNode; }
interface State { hasError: boolean; error: Error | null; }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="h-full flex items-center justify-center bg-slate-950 text-red-400 p-8">
          <div className="max-w-md text-center">
            <h2 className="text-lg font-bold mb-2">Module Error</h2>
            <p className="text-sm text-slate-500 break-words">{this.state.error?.message}</p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
