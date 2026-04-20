/**
 * Sentry Server-Side Configuration
 *
 * Captures errors that occur during server-side rendering and API routes
 */

import * as Sentry from "@sentry/nextjs";

const SENTRY_DSN = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,

    // Adjust sample rate for production
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

    // Release tracking
    release: process.env.APP_VERSION || process.env.npm_package_version,
    environment: process.env.NODE_ENV,

    // Don't send in development
    enabled: process.env.NODE_ENV !== "development",

    beforeSend(event, hint) {
      // Log what would be sent in development
      if (process.env.NODE_ENV === "development") {
        console.error("Sentry would send:", event);
        return null;
      }
      return event;
    },
  });

  // Boot-time canary — fires once per process, goes to container stdout
  // (not user devtools), intentional ops signal for post-deploy validation.
  // eslint-disable-next-line no-console
  console.log("✅ Sentry server initialized");
} else {
  // Boot-time canary — see note above; worth surfacing in prod stdout so
  // "why aren't errors reported?" is answerable from the deploy logs alone.
  // eslint-disable-next-line no-console
  console.warn(
    "⚠️  Sentry DSN not configured - server error tracking disabled",
  );
}
