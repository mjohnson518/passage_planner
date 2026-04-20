/**
 * Error Boundary Component
 *
 * Catches React errors and displays user-friendly error messages.
 * Prevents entire app crash when component errors occur.
 */

"use client";

import React, { Component, ReactNode } from "react";
import { AlertCircle, RefreshCw, Home } from "lucide-react";
import { logger } from "../lib/logger";

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
    if (process.env.NODE_ENV === "development") {
      logger.error("Error Boundary caught error", {
        error: String(error),
        componentStack: errorInfo.componentStack,
      });
    }

    // Call optional error handler
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Update error count
    this.setState((prevState) => ({
      errorInfo,
      errorCount: prevState.errorCount + 1,
    }));

    // Log to error tracking service
    this.logErrorToService(error, errorInfo);
  }

  private async logErrorToService(error: Error, errorInfo: React.ErrorInfo) {
    try {
      // Log to Sentry (client-side)
      if (typeof window !== "undefined" && window.Sentry) {
        window.Sentry.captureException(error, {
          tags: {
            source: "ErrorBoundary",
            errorCount: this.state.errorCount.toString(),
          },
          extra: {
            componentStack: errorInfo.componentStack,
            errorInfo,
          },
        });
      }

      // Also send to backend error logging endpoint
      await fetch("/api/errors/log", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
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
          userAgent:
            typeof navigator !== "undefined" ? navigator.userAgent : undefined,
          url: typeof window !== "undefined" ? window.location.href : undefined,
        }),
      });
    } catch (loggingError) {
      logger.error("Failed to log error to service", {
        error: String(loggingError),
      });
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
    window.location.href = "/";
  };

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <div className="min-h-screen flex items-center justify-center bg-background px-4">
          <div className="max-w-md w-full bg-card shadow-maritime rounded-lg p-6 border border-border">
            <div className="flex items-center justify-center w-12 h-12 mx-auto bg-destructive/10 rounded-full">
              <AlertCircle className="w-6 h-6 text-destructive" />
            </div>

            <h1 className="mt-4 text-xl font-semibold text-foreground text-center">
              Something went wrong
            </h1>

            <p className="mt-2 text-sm text-muted-foreground text-center">
              We encountered an unexpected error while processing your request.
              Our team has been notified and is working to fix the issue.
            </p>

            {process.env.NODE_ENV === "development" && this.state.error && (
              <div className="mt-4 p-3 bg-muted rounded border border-border">
                <p className="text-xs font-semibold text-foreground mb-1">
                  Error Details (Development Only):
                </p>
                <p className="text-xs text-muted-foreground font-mono break-all">
                  {this.state.error.message}
                </p>
                {this.state.errorInfo && (
                  <details className="mt-2">
                    <summary className="text-xs text-muted-foreground cursor-pointer">
                      Component Stack
                    </summary>
                    <pre className="text-xs text-muted-foreground mt-1 overflow-auto max-h-40">
                      {this.state.errorInfo.componentStack}
                    </pre>
                  </details>
                )}
              </div>
            )}

            {this.state.errorCount > 2 && (
              <div className="mt-4 p-3 bg-warning/5 border border-warning/20 rounded">
                <p className="text-xs text-warning">
                  This error has occurred {this.state.errorCount} times. Please
                  refresh the page or contact support if the problem persists.
                </p>
              </div>
            )}

            <div className="mt-6 flex gap-3">
              <button
                onClick={this.handleReset}
                className="flex-1 inline-flex items-center justify-center px-4 py-2 border border-border rounded-md shadow-sm text-sm font-medium text-foreground bg-card hover:bg-muted focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ring"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Try Again
              </button>

              <button
                onClick={this.handleGoHome}
                className="flex-1 inline-flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-primary-foreground bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ring"
              >
                <Home className="w-4 h-4 mr-2" />
                Go Home
              </button>
            </div>

            <button
              onClick={this.handleRefresh}
              className="mt-3 w-full inline-flex items-center justify-center px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
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
    <div className="p-4 bg-destructive/5 border border-destructive/20 rounded-lg">
      <div className="flex items-start">
        <AlertCircle className="w-5 h-5 text-destructive mt-0.5 mr-3 flex-shrink-0" />
        <div>
          <h3 className="text-sm font-semibold text-destructive">
            Error loading {featureName}
          </h3>
          <p className="mt-1 text-sm text-destructive/80">
            This feature is temporarily unavailable. Please try refreshing the
            page.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-2 text-sm text-destructive hover:text-destructive/80 underline"
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
        logger.error(`Error in ${featureName}`, {
          error: String(error),
          componentStack: errorInfo.componentStack,
        });
        onError?.(error);
      }}
    >
      {children}
    </ErrorBoundary>
  );
}
