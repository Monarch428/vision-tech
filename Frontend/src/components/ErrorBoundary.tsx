import { Component, type ErrorInfo, type ReactNode } from "react";
import { useLocation } from "react-router-dom";

interface Props {
  children: ReactNode;
  // Changing this value clears a caught error (e.g. the route path, so
  // navigating away from a broken page renders the new page normally).
  resetKey?: unknown;
  // "page" keeps the surrounding layout; "app" fills the whole screen.
  variant?: "page" | "app";
}

interface State {
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Page crashed:", error, info.componentStack);
  }

  componentDidUpdate(prevProps: Props) {
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  private reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const fullScreen = this.props.variant === "app";
    return (
      <div className={`flex items-center justify-center p-6 ${fullScreen ? "min-h-screen bg-gray-50" : "min-h-[60vh]"}`}>
        <div className="max-w-md w-full bg-white border border-gray-200 rounded-2xl shadow-sm p-8 text-center">
          <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-red-50 flex items-center justify-center">
            <svg width="22" height="22" fill="none" stroke="#dc2626" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M12 9v4M12 17h.01" />
              <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-gray-900">Something went wrong</h2>
          <p className="mt-2 text-sm text-gray-600">
            This page ran into an unexpected problem. You can try again, or go back and continue using the app.
          </p>
          {import.meta.env.DEV && (
            <pre className="mt-4 max-h-40 overflow-auto rounded-lg bg-gray-50 p-3 text-left text-xs text-red-700 whitespace-pre-wrap">
              {error.message}
            </pre>
          )}
          <div className="mt-6 flex justify-center gap-3">
            <button
              onClick={this.reset}
              className="px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 transition-colors"
            >
              Try again
            </button>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
            >
              Reload page
            </button>
          </div>
        </div>
      </div>
    );
  }
}

// Boundary that resets itself whenever the route changes.
export function RouteErrorBoundary({ children, variant = "page" }: { children: ReactNode; variant?: "page" | "app" }) {
  const { pathname } = useLocation();
  return (
    <ErrorBoundary resetKey={pathname} variant={variant}>
      {children}
    </ErrorBoundary>
  );
}
