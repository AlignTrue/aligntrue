/**
 * Generic client-side error boundary with a simple refresh affordance.
 * Protects interactive surfaces from breaking when child components throw.
 */
"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { hasError: boolean };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, errorInfo: ErrorInfo) {
    // Surface the error for debugging without crashing the app.
    console.error("ErrorBoundary caught error", error, errorInfo);
  }

  handleRefresh = () => {
    this.setState({ hasError: false });
    // Reload to restore a clean React tree.
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 max-w-4xl mx-auto text-center space-y-3">
          <p className="text-lg font-semibold text-foreground">
            Something went wrong.
          </p>
          <p className="text-sm text-muted-foreground">
            Please refresh the page and try again.
          </p>
          <button
            type="button"
            onClick={this.handleRefresh}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            Refresh page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
