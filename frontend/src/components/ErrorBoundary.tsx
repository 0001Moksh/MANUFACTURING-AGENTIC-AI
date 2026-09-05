import React from 'react';

type Props = { children: React.ReactNode };
type State = { hasError: boolean; error?: any; info?: any };

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, info: any) {
    // Save info to state and log for developer visibility
    // In production, send to remote logging/telemetry
    // eslint-disable-next-line no-console
    console.error('ErrorBoundary caught:', error, info);
    this.setState({ info });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 bg-amber-900/5 border border-amber-300 rounded text-amber-700">
          <div className="font-semibold">An error occurred while rendering this view.</div>
          <div className="mt-2 text-sm break-words">{String(this.state.error?.message || this.state.error)}</div>
          {this.state.error?.stack && (
            <details className="mt-2 text-xs text-slate-600">
              <summary className="cursor-pointer">View stack</summary>
              <pre className="whitespace-pre-wrap mt-2">{this.state.error.stack}</pre>
            </details>
          )}
          {this.state.info?.componentStack && (
            <details className="mt-2 text-xs text-slate-600">
              <summary className="cursor-pointer">Component stack</summary>
              <pre className="whitespace-pre-wrap mt-2">{this.state.info.componentStack}</pre>
            </details>
          )}
        </div>
      );
    }
    return this.props.children as React.ReactElement;
  }
}
