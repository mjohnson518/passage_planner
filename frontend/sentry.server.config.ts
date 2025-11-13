/**
 * Sentry Server-Side Configuration
 * 
 * Captures errors that occur during server-side rendering and API routes
 */

import * as Sentry from '@sentry/nextjs';

const SENTRY_DSN = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    
    // Adjust sample rate for production
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    
    // Release tracking
    release: process.env.APP_VERSION || process.env.npm_package_version,
    environment: process.env.NODE_ENV,
    
    // Don't send in development
    enabled: process.env.NODE_ENV !== 'development',
    
    beforeSend(event, hint) {
      // Log what would be sent in development
      if (process.env.NODE_ENV === 'development') {
        console.error('Sentry would send:', event);
        return null;
      }
      return event;
    },
  });
  
  console.log('✅ Sentry server initialized');
} else {
  console.warn('⚠️  Sentry DSN not configured - server error tracking disabled');
}

