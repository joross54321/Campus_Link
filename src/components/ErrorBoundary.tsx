import React from 'react';
import { Link } from 'react-router-dom';

type Props = { children: React.ReactNode };
type State = { error: Error | null };

export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('UI error:', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-[40vh] flex flex-col items-center justify-center p-10 text-center">
          <p className="text-lg font-display font-bold text-brand-blue mb-2">Something went wrong</p>
          <p className="text-sm text-slate-500 max-w-md mb-6">{this.state.error.message}</p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => this.setState({ error: null })}
              className="px-5 py-2.5 rounded-xl bg-brand-blue text-white text-[10px] font-bold uppercase tracking-widest"
            >
              Try again
            </button>
            <Link
              to="/"
              className="px-5 py-2.5 rounded-xl border border-slate-200 text-brand-blue text-[10px] font-bold uppercase tracking-widest"
            >
              Go home
            </Link>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
