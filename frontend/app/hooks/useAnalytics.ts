'use client'

import { useCallback, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { v4 as uuidv4 } from 'uuid'

interface TrackEventOptions {
  userId?: string
  properties?: Record<string, any>
  timestamp?: Date
}

// Get or create session ID
const getSessionId = () => {
  if (typeof window === 'undefined') return null
  
  let sessionId = sessionStorage.getItem('analytics_session_id')
  if (!sessionId) {
    sessionId = uuidv4()
    sessionStorage.setItem('analytics_session_id', sessionId)
  }
  return sessionId
}

// Get device info
const getDeviceInfo = () => {
  if (typeof window === 'undefined') return {}
  
  return {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    screen: {
      width: window.screen.width,
      height: window.screen.height
    },
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight
    },
    language: navigator.language
  }
}

export function useAnalytics() {
  const { user } = useAuth()

  // Track page views
  useEffect(() => {
    if (typeof window === 'undefined') return
    
    const trackPageView = () => {
      track('page_view', {
        path: window.location.pathname,
        search: window.location.search,
        referrer: document.referrer
      })
    }

    // Track initial page view
    trackPageView()

    // Track route changes for SPAs
    const handleRouteChange = () => trackPageView()
    window.addEventListener('popstate', handleRouteChange)

    return () => {
      window.removeEventListener('popstate', handleRouteChange)
    }
  }, [])

  // Track user identification
  useEffect(() => {
    if (user) {
      identify(user.id, {
        email: user.email,
        subscription_tier: (user as any)?.subscription_tier || (user as any)?.user_metadata?.subscription_tier,
        created_at: user.created_at
      })
    }
  }, [user])

  // Track event
  const track = useCallback(async (
    eventName: string, 
    properties?: Record<string, any>,
    options?: TrackEventOptions
  ) => {
    try {
      const event = {
        event: eventName,
        properties: {
          ...properties,
          timestamp: new Date().toISOString(),
          session_id: getSessionId(),
          user_id: options?.userId || user?.id,
        },
        deviceInfo: getDeviceInfo()
      }

      // Send to backend
      await fetch('/api/analytics/track', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(event)
      })

      // Also send to client-side analytics if available
      if (typeof window !== 'undefined') {
        // Mixpanel
        if ((window as any).mixpanel) {
          (window as any).mixpanel.track(eventName, {
            ...properties,
            distinct_id: user?.id
          })
        }

        // PostHog
        if ((window as any).posthog) {
          (window as any).posthog.capture(eventName, properties)
        }

        // Google Analytics
        if ((window as any).gtag) {
          (window as any).gtag('event', eventName, properties)
        }
      }
    } catch (error) {
      console.error('Analytics tracking error:', error)
    }
  }, [user])

  // Identify user
  const identify = useCallback((userId: string, traits?: Record<string, any>) => {
    if (typeof window === 'undefined') return

    // Mixpanel
    if ((window as any).mixpanel) {
      (window as any).mixpanel.identify(userId)
      if (traits) {
        (window as any).mixpanel.people.set(traits)
      }
    }

    // PostHog
    if ((window as any).posthog) {
      (window as any).posthog.identify(userId, traits)
    }

    // Track identification event
    track('user_identified', traits)
  }, [track])

  // Track timing
  const trackTiming = useCallback((
    category: string,
    variable: string,
    value: number,
    label?: string
  ) => {
    track('timing', {
      category,
      variable,
      value,
      label
    })
  }, [track])

  // Track errors
  const trackError = useCallback((
    error: Error,
    context?: Record<string, any>
  ) => {
    track('error', {
      message: error.message,
      stack: error.stack,
      ...context
    })
  }, [track])

  // Track feature usage
  const trackFeature = useCallback((
    featureName: string,
    metadata?: Record<string, any>
  ) => {
    track(`feature_${featureName}`, metadata)
  }, [track])

  // Track conversion events
  const trackConversion = useCallback((
    conversionType: string,
    value?: number,
    metadata?: Record<string, any>
  ) => {
    track(`conversion_${conversionType}`, {
      value,
      ...metadata
    })
  }, [track])

  return {
    track,
    identify,
    trackTiming,
    trackError,
    trackFeature,
    trackConversion
  }
}

// Common event names
export const ANALYTICS_EVENTS = {
  // Authentication
  SIGNUP_STARTED: 'signup_started',
  SIGNUP_COMPLETED: 'signup_completed',
  LOGIN: 'login',
  LOGOUT: 'logout',
  PASSWORD_RESET: 'password_reset',

  // Subscription
  TRIAL_STARTED: 'trial_started',
  SUBSCRIPTION_STARTED: 'subscription_started',
  SUBSCRIPTION_UPGRADED: 'subscription_upgraded',
  SUBSCRIPTION_DOWNGRADED: 'subscription_downgraded',
  SUBSCRIPTION_CANCELLED: 'subscription_cancelled',
  PAYMENT_FAILED: 'payment_failed',

  // Feature usage
  PASSAGE_CREATED: 'passage_created',
  PASSAGE_COMPLETED: 'passage_completed',
  WEATHER_CHECKED: 'weather_checked',
  TIDE_CALCULATED: 'tide_calculated',
  PORT_SEARCHED: 'port_searched',
  ROUTE_OPTIMIZED: 'route_optimized',
  
  // Engagement
  DASHBOARD_VIEWED: 'dashboard_viewed',
  SETTINGS_UPDATED: 'settings_updated',
  SUPPORT_CONTACTED: 'support_contacted',
  DOCS_VIEWED: 'docs_viewed',
  
  // Onboarding
  ONBOARDING_STARTED: 'onboarding_started',
  ONBOARDING_COMPLETED: 'onboarding_completed',
  ONBOARDING_SKIPPED: 'onboarding_skipped',
  BOAT_PROFILE_CREATED: 'boat_profile_created',
} 