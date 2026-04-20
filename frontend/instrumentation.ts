/**
 * Next.js instrumentation hook — server/edge Sentry bootstrap.
 *
 * Next.js 13.4+ calls `register()` once per runtime. Without this file,
 * `sentry.server.config.ts` and `sentry.edge.config.ts` never execute,
 * leaving `Sentry.captureException` / `captureMessage` as silent no-ops
 * in our `serverLogger` (see app/lib/server-logger.ts). That means
 * `logger.error(...)` from route handlers would drop signal in prod.
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

// Next 15+ exposes an `onRequestError` instrumentation hook for nested
// React Server Component errors. On Next 14 + @sentry/nextjs 10.x the
// hook is named `captureRequestError`; re-export it as `onRequestError`
// so Next picks it up if/when we upgrade.
export { captureRequestError as onRequestError } from "@sentry/nextjs";
