/**
 * Error Logging API Route
 * 
 * Receives error reports from the frontend ErrorBoundary and logs them to:
 * 1. Sentry (for error tracking and alerting)
 * 2. Console (for local debugging)
 * 3. Optionally: Database (for analytics)
 * 
 * This is CRITICAL infrastructure - errors might indicate safety issues
 * in weather data, route calculations, or other life-safety features.
 */

export const runtime = 'edge'

import { NextRequest, NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { error, errorInfo, timestamp, userAgent, url, userId } = body
    
    // Validate required fields
    if (!error || !error.message) {
      return NextResponse.json(
        { error: 'Invalid error payload' },
        { status: 400 }
      )
    }
    
    // Log to console for debugging
    console.error('Frontend error received:', {
      message: error.message,
      url,
      timestamp,
      userId: userId || 'anonymous'
    })
    
    // Capture in Sentry with full context
    Sentry.withScope((scope) => {
      // Add tags for filtering
      scope.setTag('source', 'frontend')
      scope.setTag('error_boundary', 'true')
      
      // Add extra context
      scope.setContext('error_details', {
        timestamp,
        url,
        userAgent,
        componentStack: errorInfo?.componentStack,
        stack: error.stack
      })
      
      // Add user context if available
      if (userId) {
        scope.setUser({ id: userId })
      }
      
      // Capture the error
      const sentryError = new Error(error.message)
      if (error.stack) {
        sentryError.stack = error.stack
      }
      
      Sentry.captureException(sentryError)
    })
    
    // Log success
    console.log('✓ Error logged to Sentry:', error.message.substring(0, 100))
    
    return NextResponse.json({ 
      success: true,
      logged: true 
    })
    
  } catch (err) {
    console.error('Failed to log frontend error:', err)
    
    // Still return 200 so the frontend doesn't fail
    // We don't want error logging to cause more errors!
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to log error',
        logged: false 
      },
      { status: 200 }
    )
  }
}

