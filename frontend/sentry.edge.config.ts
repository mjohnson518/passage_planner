/**
 * Sentry Edge Runtime Configuration
 *
 * Many of our API routes opt into the edge runtime
 * (`export const runtime = "edge"`). The edge runtime has its own Sentry
 * init entry point — the Node config at `sentry.server.config.ts` won't
 * run there. Without this file, `serverLogger.error(...)` calls from
 * edge routes silently drop in production.
 */

import * as Sentry from "@sentry/nextjs";

const SENTRY_DSN = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
    release: process.env.APP_VERSION || process.env.npm_package_version,
    environment: process.env.NODE_ENV,
    enabled: process.env.NODE_ENV !== "development",
  });
}
