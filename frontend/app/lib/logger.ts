/**
 * Frontend structured logger.
 *
 * SECURITY: Raw console.* calls leak to production devtools, can be
 * scraped by page-injected scripts, and (per audit) were being used to
 * log request bodies / auth errors. This shim:
 *   - silences `debug` and `info` in production
 *   - forwards `warn` / `error` to Sentry via the `@sentry/nextjs` SDK
 *     directly (not via `window.Sentry`, which is never populated by the
 *     SDK and was silently dropping signal in prod)
 *   - keeps the browser console output in development for DX
 *
 * Do NOT log tokens, passwords, cookies, or full request/response bodies —
 * even through this logger. Log an identifier + a category + a short message.
 */

import * as Sentry from "@sentry/nextjs";

type LogPayload = Record<string, unknown> | undefined;

const isProd =
  typeof process !== "undefined" && process.env.NODE_ENV === "production";

function sendToSentry(
  level: "warn" | "error",
  message: string,
  context?: LogPayload,
) {
  try {
    if (level === "error") {
      Sentry.captureException(new Error(message), { extra: context });
    } else {
      Sentry.captureMessage(message, { level: "warning", extra: context });
    }
  } catch {
    // never let telemetry crash the app
  }
}

export const logger = {
  debug(message: string, context?: LogPayload) {
    if (isProd) return;
    // eslint-disable-next-line no-console
    console.debug(`[debug] ${message}`, context ?? "");
  },
  info(message: string, context?: LogPayload) {
    if (isProd) return;
    // eslint-disable-next-line no-console
    console.info(`[info] ${message}`, context ?? "");
  },
  warn(message: string, context?: LogPayload) {
    if (isProd) {
      sendToSentry("warn", message, context);
      return;
    }
    // eslint-disable-next-line no-console
    console.warn(`[warn] ${message}`, context ?? "");
  },
  error(message: string, context?: LogPayload) {
    if (isProd) {
      sendToSentry("error", message, context);
      return;
    }
    // eslint-disable-next-line no-console
    console.error(`[error] ${message}`, context ?? "");
  },
};
