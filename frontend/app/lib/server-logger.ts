/**
 * Server-side structured logger for Next.js route handlers.
 *
 * Mirrors the client `logger` shim's public API but routes through the
 * Sentry Node SDK (`@sentry/nextjs`) instead of `window.Sentry`. API
 * routes run on the server, so logging to `console.*` leaks raw errors /
 * auth details into the host's container stdout with no context, no
 * severity, and no structured fields. This shim:
 *   - silences `debug` / `info` in production
 *   - forwards `warn` / `error` to Sentry (server SDK) with context as
 *     `extra`, preserving the signal for the on-call dashboard
 *   - keeps JSON-line output for local development so route handlers
 *     remain debuggable via `npm run dev`
 *
 * Do NOT log tokens, passwords, cookies, or full request/response bodies
 * — log an identifier + a category + a short message.
 */

import * as Sentry from "@sentry/nextjs";

type LogPayload = Record<string, unknown> | undefined;

const isProd = process.env.NODE_ENV === "production";

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
    // never let telemetry crash the handler
  }
}

function emit(level: string, message: string, context?: LogPayload) {
  const line = JSON.stringify({
    level,
    msg: message,
    ...(context ?? {}),
    time: new Date().toISOString(),
  });
  // eslint-disable-next-line no-console
  (level === "error" ? console.error : console.log)(line);
}

export const serverLogger = {
  debug(message: string, context?: LogPayload) {
    if (isProd) return;
    emit("debug", message, context);
  },
  info(message: string, context?: LogPayload) {
    if (isProd) return;
    emit("info", message, context);
  },
  warn(message: string, context?: LogPayload) {
    if (isProd) {
      sendToSentry("warn", message, context);
      return;
    }
    emit("warn", message, context);
  },
  error(message: string, context?: LogPayload) {
    if (isProd) {
      sendToSentry("error", message, context);
      return;
    }
    emit("error", message, context);
  },
};
