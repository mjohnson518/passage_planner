/**
 * Error Boundary Component
 * 
 * Catches React errors and displays user-friendly error messages.
 * Prevents entire app crash when component errors occur.
 */

'use client';

import React, { Component, ReactNode } from 'react';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: React.ErrorInfo;
  errorCount: number;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      errorCount: 0,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log error to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('Error Boundary caught error:', error, errorInfo);
    }

    // Call optional error handler
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Update error count
    this.setState(prevState => ({
      errorInfo,
      errorCount: prevState.errorCount + 1,
    }));

    // Log to error tracking service
    this.logErrorToService(error, errorInfo);
  }

  private async logErrorToService(error: Error, errorInfo: React.ErrorInfo) {
    try {
      // Log to Sentry (client-side)
      if (typeof window !== 'undefined' && (window as any).Sentry) {
        (window as any).Sentry.captureException(error, {
          tags: {
            source: 'ErrorBoundary',
            errorCount: this.state.errorCount.toString()
          },
          extra: {
            componentStack: errorInfo.componentStack,
            errorInfo
          }
        });
      }
      
      // Also send to backend error logging endpoint
      await fetch('/api/errors/log', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          error: {
            message: error.message,
            stack: error.stack,
          },
          errorInfo: {
            componentStack: errorInfo.componentStack,
          },
          timestamp: new Date().toISOString(),
          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
          url: typeof window !== 'undefined' ? window.location.href : undefined,
        }),
      });
    } catch (loggingError) {
      console.error('Failed to log error to service:', loggingError);
    }
  }

  private handleReset = () => {
    this.setState({
      hasError: false,
      error: undefined,
      errorInfo: undefined,
    });
  };

  private handleRefresh = () => {
    window.location.reload();
  };

  private handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
          <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-6">
            <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 rounded-full">
              <AlertCircle className="w-6 h-6 text-red-600" />
            </div>

            <h1 className="mt-4 text-xl font-semibold text-gray-900 text-center">
              Something went wrong
            </h1>

            <p className="mt-2 text-sm text-gray-600 text-center">
              We encountered an unexpected error while processing your request.
              Our team has been notified and is working to fix the issue.
            </p>

            {process.env.NODE_ENV === 'development' && this.state.error && (
              <div className="mt-4 p-3 bg-gray-100 rounded border border-gray-200">
                <p className="text-xs font-semibold text-gray-700 mb-1">
                  Error Details (Development Only):
                </p>
                <p className="text-xs text-gray-600 font-mono break-all">
                  {this.state.error.message}
                </p>
                {this.state.errorInfo && (
                  <details className="mt-2">
                    <summary className="text-xs text-gray-500 cursor-pointer">
                      Component Stack
                    </summary>
                    <pre className="text-xs text-gray-600 mt-1 overflow-auto max-h-40">
                      {this.state.errorInfo.componentStack}
                    </pre>
                  </details>
                )}
              </div>
            )}

            {this.state.errorCount > 2 && (
              <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
                <p className="text-xs text-yellow-800">
                  This error has occurred {this.state.errorCount} times.
                  Please refresh the page or contact support if the problem persists.
                </p>
              </div>
            )}

            <div className="mt-6 flex gap-3">
              <button
                onClick={this.handleReset}
                className="flex-1 inline-flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Try Again
              </button>

              <button
                onClick={this.handleGoHome}
                className="flex-1 inline-flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <Home className="w-4 h-4 mr-2" />
                Go Home
              </button>
            </div>

            <button
              onClick={this.handleRefresh}
              className="mt-3 w-full inline-flex items-center justify-center px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
            >
              Or refresh the page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Feature-specific Error Boundary with custom fallback
 */
interface FeatureErrorBoundaryProps {
  children: ReactNode;
  featureName: string;
  onError?: (error: Error) => void;
}

export function FeatureErrorBoundary({
  children,
  featureName,
  onError,
}: FeatureErrorBoundaryProps) {
  const fallback = (
    <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
      <div className="flex items-start">
        <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 mr-3 flex-shrink-0" />
        <div>
          <h3 className="text-sm font-semibold text-red-900">
            Error loading {featureName}
          </h3>
          <p className="mt-1 text-sm text-red-700">
            This feature is temporarily unavailable. Please try refreshing the page.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
          >
            Refresh Page
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <ErrorBoundary
      fallback={fallback}
      onError={(error, errorInfo) => {
        console.error(`Error in ${featureName}:`, error, errorInfo);
        onError?.(error);
      }}
    >
      {children}
    </ErrorBoundary>
  );
}

