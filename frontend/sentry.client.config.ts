/**
 * Sentry Client-Side Configuration
 * 
 * Captures errors that occur in the browser
 */

import * as Sentry from '@sentry/nextjs';

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    
    // Adjust sample rate for production
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    
    // Session replay for debugging
    replaysSessionSampleRate: 0.1, // 10% of sessions
    replaysOnErrorSampleRate: 1.0, // 100% of sessions with errors
    
    integrations: [
      Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],
    
    // Release tracking
    release: process.env.NEXT_PUBLIC_APP_VERSION,
    environment: process.env.NODE_ENV,
    
    // Filter out expected errors
    ignoreErrors: [
      // Browser extensions
      'ResizeObserver loop limit exceeded',
      'Non-Error promise rejection captured',
      // Network errors users can't control
      'NetworkError',
      'Failed to fetch',
    ],
    
    beforeSend(event, hint) {
      // Don't send in development
      if (process.env.NODE_ENV === 'development') {
        console.error('Sentry would send:', event);
        return null;
      }
      return event;
    },
  });
  
  console.log('✅ Sentry client initialized');
} else {
  console.warn('⚠️  Sentry DSN not configured - client error tracking disabled');
}

