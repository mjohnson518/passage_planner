import type { LoggerOptions } from "pino";

/**
 * SECURITY (SEC-M1): Default Pino redaction paths for runtime loggers across
 * orchestrator + agents. Prevents secrets/tokens/PII from leaking into log
 * aggregators (Loki, Datadog, etc) when objects are accidentally logged whole.
 *
 * Usage:
 *   const logger = pino({ level: 'info', ...loggerRedactOptions });
 *
 * Add new paths here when new sensitive shapes are introduced — never inline
 * an ad-hoc redact list at a call site, or call sites will drift.
 */
export const REDACT_PATHS: readonly string[] = [
  "password",
  "passwordHash",
  "password_hash",
  "token",
  "accessToken",
  "refreshToken",
  "secret",
  "apiKey",
  "api_key",
  "authorization",
  "cookie",
  "set-cookie",
  "headers.authorization",
  "headers.cookie",
  "headers['set-cookie']",
  "req.headers.authorization",
  "req.headers.cookie",
  "*.password",
  "*.password_hash",
  "*.token",
  "*.accessToken",
  "*.refreshToken",
  "*.secret",
  "*.apiKey",
  "*.authorization",
];

export const loggerRedactOptions: Pick<LoggerOptions, "redact"> = {
  redact: {
    paths: [...REDACT_PATHS],
    censor: "[REDACTED]",
    remove: false,
  },
};
