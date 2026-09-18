import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RotateCw, RefreshCw, ChevronDown, ChevronUp, Copy, Check } from "lucide-react";

export interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode | ((error: Error, reset: () => void) => ReactNode);
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  showDetails: boolean;
  copied: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public override state: ErrorBoundaryState = {
    hasError: false,
    error: null,
    errorInfo: null,
    showDetails: false,
    copied: false,
  };

  public static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });
    // Useful for telemetry / production monitoring
    console.error("[ErrorBoundary caught an unhandled error]:", error, errorInfo);
  }

  private handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
      copied: false,
    });
    this.props.onReset?.();
  };

  private handleReload = (): void => {
    window.location.reload();
  };

  private handleCopy = (): void => {
    const { error, errorInfo } = this.state;
    const text = `Error: ${error?.message ?? "Unknown"}\n\nStack:\n${error?.stack ?? "No stack"}\n\nComponent Stack:\n${errorInfo?.componentStack ?? "No component stack"}`;
    navigator.clipboard.writeText(text).then(() => {
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2000);
    });
  };

  public override render(): ReactNode {
    if (this.state.hasError) {
      if (typeof this.props.fallback === "function") {
        return this.props.fallback(this.state.error ?? new Error("Unknown error"), this.handleReset);
      }
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const { error, errorInfo, showDetails, copied } = this.state;

      return (
        <div className="flex min-h-[400px] w-full items-center justify-center p-6 sm:p-10">
          <div className="w-full max-w-xl rounded-2xl border border-line bg-surface p-6 sm:p-8 shadow-xl">
            <div className="flex items-start gap-4">
              <div className="grid size-12 shrink-0 place-items-center rounded-xl bg-alert-soft text-alert">
                <AlertTriangle className="size-6" />
              </div>

              <div className="min-w-0 flex-1">
                <h2 className="font-display text-xl font-bold tracking-tight text-ink">
                  Something went wrong
                </h2>
                <p className="mt-1 text-sm text-muted">
                  The application encountered an unexpected interface error.
                </p>
              </div>
            </div>

            {error?.message && (
              <div className="mt-4 rounded-lg bg-raised/70 px-3.5 py-2.5 text-xs font-mono text-ink/90 border border-line/60">
                {error.message}
              </div>
            )}

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={this.handleReload}
                className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2 text-xs font-semibold text-brand-ink transition hover:opacity-90 active:scale-[0.98]"
              >
                <RotateCw className="size-3.5" />
                Reload Application
              </button>

              <button
                type="button"
                onClick={this.handleReset}
                className="inline-flex items-center gap-2 rounded-xl border border-line bg-surface px-4 py-2 text-xs font-medium text-ink transition hover:bg-raised active:scale-[0.98]"
              >
                <RefreshCw className="size-3.5" />
                Try Again
              </button>

              <button
                type="button"
                onClick={() => this.setState((prev) => ({ showDetails: !prev.showDetails }))}
                className="ml-auto inline-flex items-center gap-1.5 text-xs text-muted hover:text-ink transition"
              >
                <span>{showDetails ? "Hide details" : "Show details"}</span>
                {showDetails ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
              </button>
            </div>

            {showDetails && (
              <div className="mt-4 border-t border-line pt-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[0.72rem] font-medium text-faint uppercase tracking-wider">
                    Error Diagnostic Stack
                  </span>
                  <button
                    type="button"
                    onClick={this.handleCopy}
                    className="inline-flex items-center gap-1 text-xs text-muted hover:text-ink transition"
                  >
                    {copied ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
                    <span>{copied ? "Copied" : "Copy details"}</span>
                  </button>
                </div>
                <div className="max-h-56 overflow-auto rounded-lg bg-black/40 p-3 text-[0.72rem] font-mono leading-relaxed text-zinc-300">
                  <p className="font-semibold text-rose-400">{error?.stack || error?.message}</p>
                  {errorInfo?.componentStack && (
                    <pre className="mt-2 text-zinc-400 whitespace-pre-wrap">
                      {errorInfo.componentStack}
                    </pre>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
