/**
 * Frontend structured logger.
 *
 * SECURITY: Raw console.* calls leak to production devtools, can be
 * scraped by page-injected scripts, and (per audit) were being used to
 * log request bodies / auth errors. This shim:
 *   - silences `debug` and `log` in production
 *   - forwards `warn` / `error` to Sentry when available (via window.Sentry
 *     installed by the bootstrap script) so we don't lose error signal
 *   - keeps the browser console output in development for DX
 *
 * Do NOT log tokens, passwords, cookies, or full request/response bodies —
 * even through this logger. Log an identifier + a category + a short message.
 */

type LogPayload = Record<string, unknown> | undefined;

const isProd = typeof process !== 'undefined' && process.env.NODE_ENV === 'production';

function sendToSentry(level: 'warn' | 'error', message: string, context?: LogPayload) {
  if (typeof window === 'undefined') return;
  const sentry = (window as any).Sentry;
  if (!sentry) return;
  try {
    if (level === 'error') {
      sentry.captureException(new Error(message), { extra: context });
    } else {
      sentry.captureMessage(message, { level: 'warning', extra: context });
    }
  } catch {
    // never let telemetry crash the app
  }
}

export const logger = {
  debug(message: string, context?: LogPayload) {
    if (isProd) return;
    // eslint-disable-next-line no-console
    console.debug(`[debug] ${message}`, context ?? '');
  },
  info(message: string, context?: LogPayload) {
    if (isProd) return;
    // eslint-disable-next-line no-console
    console.info(`[info] ${message}`, context ?? '');
  },
  warn(message: string, context?: LogPayload) {
    if (isProd) {
      sendToSentry('warn', message, context);
      return;
    }
    // eslint-disable-next-line no-console
    console.warn(`[warn] ${message}`, context ?? '');
  },
  error(message: string, context?: LogPayload) {
    if (isProd) {
      sendToSentry('error', message, context);
      return;
    }
    // eslint-disable-next-line no-console
    console.error(`[error] ${message}`, context ?? '');
  },
};
