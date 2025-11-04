/**
 * Error boundary component (Phase 4, Session 6)
 *
 * React error boundary with fallback UI for catalog pages.
 */

"use client";

import { Component, ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

/**
 * Error boundary component
 */
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Error boundary caught error:", error, errorInfo);

    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return <DefaultErrorFallback error={this.state.error} />;
    }

    return this.props.children;
  }
}

/**
 * Default error fallback UI
 */
function DefaultErrorFallback({ error }: { error?: Error }) {
  return (
    <div className="max-w-4xl mx-auto px-6 py-16">
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-red-900 mb-2">
          Something went wrong
        </h2>
        <p className="text-sm text-red-700 mb-4">
          {error?.message || "An unexpected error occurred"}
        </p>
        <div className="flex gap-4">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            Reload page
          </button>
          <a
            href="/catalog"
            className="px-4 py-2 bg-white text-red-900 border border-red-200 rounded-md text-sm font-medium hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            Back to catalog
          </a>
        </div>
      </div>
    </div>
  );
}

/**
 * Catalog-specific error fallback with preview preservation
 */
export function CatalogErrorFallback({
  error,
  resetErrorBoundary,
}: {
  error: Error;
  resetErrorBoundary?: () => void;
}) {
  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-red-900 mb-2">
          Failed to load catalog data
        </h2>
        <p className="text-sm text-red-700 mb-4">
          {error.message || "An error occurred while loading the catalog"}
        </p>
        <div className="flex gap-4">
          {resetErrorBoundary && (
            <button
              type="button"
              onClick={resetErrorBoundary}
              className="px-4 py-2 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              Try again
            </button>
          )}
          <a
            href="/"
            className="px-4 py-2 bg-white text-red-900 border border-red-200 rounded-md text-sm font-medium hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            Back to home
          </a>
        </div>
      </div>
    </div>
  );
}

/**
 * Pack detail error fallback
 */
export function PackDetailErrorFallback({
  packSlug,
  error,
}: {
  packSlug: string;
  error: Error;
}) {
  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-red-900 mb-2">
          Failed to load pack: {packSlug}
        </h2>
        <p className="text-sm text-red-700 mb-4">
          {error.message || "The pack data could not be loaded"}
        </p>
        <div className="flex gap-4">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            Reload page
          </button>
          <a
            href="/catalog"
            className="px-4 py-2 bg-white text-red-900 border border-red-200 rounded-md text-sm font-medium hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            Back to catalog
          </a>
        </div>
      </div>
    </div>
  );
}
