/**
 * Sentry Error Tracking Initialization
 * 
 * Captures and reports errors to Sentry for monitoring and debugging.
 * CRITICAL: This helps identify production issues before they impact maritime safety.
 */

import * as Sentry from '@sentry/node';
import { getOptionalEnv, isProduction, isDevelopment } from '@passage-planner/shared';
import pino from 'pino';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

/**
 * Initialize Sentry error tracking
 * 
 * Call this EARLY in application startup, after environment validation
 */
export function initSentry(): void {
  const dsn = getOptionalEnv('SENTRY_DSN');
  
  if (!dsn) {
    logger.warn('SENTRY_DSN not set - error tracking disabled. Errors will only be logged.');
    return;
  }
  
  try {
    Sentry.init({
      dsn,
      environment: process.env.NODE_ENV || 'development',
      
      // Performance monitoring
      tracesSampleRate: isProduction() ? 0.1 : 1.0, // 10% in production, 100% in dev
      
      // Set release version if available
      release: process.env.APP_VERSION || process.env.npm_package_version,
      
      // Don't send errors in test environment
      enabled: !isTest(),
      
      // Filter out noise
      beforeSend(event, hint) {
        // Don't send errors we expect and handle gracefully
        const error = hint.originalException;
        
        if (error && typeof error === 'object' && 'code' in error) {
          // Redis connection errors (expected during startup)
          if (error.code === 'ECONNREFUSED' && isDevelopment()) {
            return null;
          }
        }
        
        return event;
      },
      
      // Add tags for filtering
      initialScope: {
        tags: {
          service: 'orchestrator',
          deployment: process.env.RAILWAY_DEPLOYMENT_ID || 'local'
        }
      }
    });
    
    logger.info({
      environment: process.env.NODE_ENV || 'development',
      sampleRate: isProduction() ? '10%' : '100%'
    }, 'Sentry initialized');

  } catch (error) {
    logger.error({ error }, 'Failed to initialize Sentry. Continuing without error tracking.');
  }
}

/**
 * Check if running in test mode
 */
function isTest(): boolean {
  return process.env.NODE_ENV === 'test';
}

/**
 * Capture an exception with additional context
 */
export function captureError(
  error: Error, 
  context?: {
    tags?: Record<string, string>;
    extra?: Record<string, any>;
    user?: { id: string; email?: string };
  }
): void {
  logger.error({ error, context }, 'Error captured');

  if (context) {
    Sentry.withScope((scope) => {
      if (context.tags) {
        Object.entries(context.tags).forEach(([key, value]) => {
          scope.setTag(key, value);
        });
      }
      
      if (context.extra) {
        scope.setContext('extra', context.extra);
      }
      
      if (context.user) {
        scope.setUser(context.user);
      }
      
      Sentry.captureException(error);
    });
  } else {
    Sentry.captureException(error);
  }
}

/**
 * Capture a message (non-error event)
 */
export function captureMessage(
  message: string,
  level: 'info' | 'warning' | 'error' = 'info'
): void {
  Sentry.captureMessage(message, level);
}

/**
 * Set user context for all subsequent errors
 */
export function setUserContext(user: { id: string; email?: string; subscription?: string }): void {
  Sentry.setUser(user);
}

/**
 * Clear user context (e.g., on logout)
 */
export function clearUserContext(): void {
  Sentry.setUser(null);
}

