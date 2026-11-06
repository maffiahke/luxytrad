import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  /** optional reset signal — when this value changes, the boundary clears its error */
  resetKey?: unknown;
}
interface State {
  error: Error | null;
}

/**
 * Last-resort render guard. Previously a single component throwing during render
 * (e.g. ChartCard indexing into an empty candle series before the first server
 * poll resolved) unmounted the entire tree and left a blank white screen with no
 * explanation. This catches those errors, shows a recoverable message, and lets
 * the user retry without a hard reload.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Surface in the console so the real stack is still visible to us.
    console.error("[Luxytrades] render error:", error, info.componentStack);
  }

  componentDidUpdate(prev: Props) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null });
    }
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="mx-auto flex min-h-dvh max-w-[430px] flex-col items-center justify-center gap-3 bg-[#eef1f6] px-6 text-center">
        <div className="text-lg font-bold text-slate-800">Something went wrong</div>
        <p className="text-sm text-slate-500">
          The screen hit an unexpected error. Your account and funds are safe on our servers — just reload to continue.
        </p>
        <button
          onClick={() => this.setState({ error: null })}
          className="mt-1 rounded-full bg-[#109a53] px-5 py-2 text-sm font-semibold text-white active:scale-95"
        >
          Try again
        </button>
      </div>
    );
  }
}
