import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RotateCcw, Home, ChevronDown, ChevronUp } from 'lucide-react';
import sanoBillLogo from '../../assets/sano-bill-logo.png';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  showDetails: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    showDetails: false,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('Uncaught error caught by SanoBill ErrorBoundary:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReload = (): void => {
    window.location.reload();
  };

  private handleReset = (): void => {
    window.location.href = '/';
  };

  private toggleDetails = (): void => {
    this.setState((prev) => ({ showDetails: !prev.showDetails }));
  };

  public render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-[#f2f2f2] dark:bg-zinc-950 flex items-center justify-center p-4 font-[Inter,system-ui,sans-serif] text-zinc-900 dark:text-zinc-100 transition-colors">
          <div className="w-full max-w-[440px] bg-[#fcfcfc] dark:bg-zinc-900 rounded-[24px] border border-zinc-200/80 dark:border-zinc-800 shadow-[0_12px_40px_rgba(0,0,0,0.08)] p-6 sm:p-7 text-center">
            {/* Logo */}
            <div className="w-16 h-16 mx-auto rounded-[18px] overflow-hidden flex items-center justify-center shadow-sm bg-white dark:bg-zinc-800 p-1 mb-4 border border-zinc-100 dark:border-zinc-700/60">
              <img 
                src={sanoBillLogo} 
                alt="Sano Bill" 
                className="w-full h-full object-contain"
              />
            </div>

            {/* Error Badge */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900/60 text-red-700 dark:text-red-300 text-[11px] font-semibold mb-3">
              <AlertTriangle className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
              <span>POS Interruption</span>
            </div>

            <h1 className="serif text-[28px] font-medium tracking-tight leading-tight mb-2 text-zinc-900 dark:text-zinc-100">
              Something went wrong
            </h1>
            <p className="text-[13px] text-zinc-500 dark:text-zinc-400 leading-relaxed mb-6">
              The application encountered an unexpected state. Your recorded bills in Supabase remain safe and unaffected.
            </p>

            {/* Action Buttons */}
            <div className="space-y-2.5 mb-5">
              <button
                type="button"
                onClick={this.handleReload}
                className="w-full min-h-[50px] h-[50px] rounded-[16px] bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 font-semibold text-[14px] flex items-center justify-center gap-2 active:scale-[0.98] hover:bg-black dark:hover:bg-zinc-100 transition shadow-sm cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Reload Application</span>
              </button>

              <button
                type="button"
                onClick={this.handleReset}
                className="w-full min-h-[48px] h-[48px] rounded-[16px] bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-medium text-[13px] flex items-center justify-center gap-2 hover:bg-zinc-200 dark:hover:bg-zinc-700 active:scale-[0.98] transition cursor-pointer"
              >
                <Home className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
                <span>Return to POS Home</span>
              </button>
            </div>

            {/* Collapsible Error Diagnostics */}
            {this.state.error && (
              <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 text-left">
                <button
                  type="button"
                  onClick={this.toggleDetails}
                  className="w-full flex items-center justify-between text-[11px] font-medium text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-400 transition cursor-pointer py-1"
                >
                  <span>Technical details</span>
                  {this.state.showDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>

                {this.state.showDetails && (
                  <div className="mt-2 p-3 rounded-[12px] bg-zinc-100 dark:bg-zinc-950/80 border border-zinc-200/60 dark:border-zinc-800 text-[11px] text-zinc-600 dark:text-zinc-400 font-mono overflow-x-auto max-h-40 overflow-y-auto leading-relaxed">
                    <p className="font-semibold text-red-600 dark:text-red-400 mb-1">
                      {this.state.error.name}: {this.state.error.message}
                    </p>
                    {this.state.errorInfo?.componentStack && (
                      <pre className="text-[10px] text-zinc-500 dark:text-zinc-500 whitespace-pre-wrap">
                        {this.state.errorInfo.componentStack}
                      </pre>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
