export {};

declare global {
  interface Window {
    Sentry?: {
      captureException(
        error: Error,
        opts?: { tags?: Record<string, string>; extra?: unknown },
      ): void;
      captureMessage(
        message: string,
        opts?: { level?: string; extra?: unknown },
      ): void;
    };
    mixpanel?: {
      track(event: string, props?: Record<string, unknown>): void;
      identify(id: string): void;
      people: { set(traits: Record<string, unknown>): void };
    };
    posthog?: {
      capture(event: string, props?: Record<string, unknown>): void;
      identify(id: string, traits?: Record<string, unknown>): void;
    };
    gtag?: (...args: unknown[]) => void;
    MSStream?: unknown;
  }
}
