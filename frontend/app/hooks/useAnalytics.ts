"use client";

import { useCallback, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { logger } from "../lib/logger";
import { v4 as uuidv4 } from "uuid";

interface TrackEventOptions {
  userId?: string;
  properties?: Record<string, any>;
  timestamp?: Date;
}

// Get or create session ID
const getSessionId = () => {
  if (typeof window === "undefined") return null;

  let sessionId = sessionStorage.getItem("analytics_session_id");
  if (!sessionId) {
    sessionId = uuidv4();
    sessionStorage.setItem("analytics_session_id", sessionId);
  }
  return sessionId;
};

// Get device info
const getDeviceInfo = () => {
  if (typeof window === "undefined") return {};

  return {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    screen: {
      width: window.screen.width,
      height: window.screen.height,
    },
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight,
    },
    language: navigator.language,
  };
};

export function useAnalytics() {
  const { user } = useAuth();

  // Track event
  const track = useCallback(
    async (
      eventName: string,
      properties?: Record<string, any>,
      options?: TrackEventOptions,
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
          deviceInfo: getDeviceInfo(),
        };

        // Send to backend
        await fetch("/api/analytics/track", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(event),
        });

        // Also send to client-side analytics if available
        if (typeof window !== "undefined") {
          // Mixpanel
          if (window.mixpanel) {
            window.mixpanel.track(eventName, {
              ...properties,
              distinct_id: user?.id,
            });
          }

          // PostHog
          if (window.posthog) {
            window.posthog.capture(eventName, properties);
          }

          // Google Analytics
          if (window.gtag) {
            window.gtag("event", eventName, properties);
          }
        }
      } catch (error) {
        logger.error("Analytics tracking error", { error: String(error) });
      }
    },
    [user],
  );

  // Identify user
  const identify = useCallback(
    (userId: string, traits?: Record<string, any>) => {
      if (typeof window === "undefined") return;

      // Mixpanel
      if (window.mixpanel) {
        window.mixpanel.identify(userId);
        if (traits) {
          window.mixpanel.people.set(traits);
        }
      }

      // PostHog
      if (window.posthog) {
        window.posthog.identify(userId, traits);
      }

      // Track identification event
      track("user_identified", traits);
    },
    [track],
  );

  // Track timing
  const trackTiming = useCallback(
    (category: string, variable: string, value: number, label?: string) => {
      track("timing", {
        category,
        variable,
        value,
        label,
      });
    },
    [track],
  );

  // Track errors
  const trackError = useCallback(
    (error: Error, context?: Record<string, any>) => {
      track("error", {
        message: error.message,
        stack: error.stack,
        ...context,
      });
    },
    [track],
  );

  // Track feature usage
  const trackFeature = useCallback(
    (featureName: string, metadata?: Record<string, any>) => {
      track(`feature_${featureName}`, metadata);
    },
    [track],
  );

  // Track conversion events
  const trackConversion = useCallback(
    (
      conversionType: string,
      value?: number,
      metadata?: Record<string, any>,
    ) => {
      track(`conversion_${conversionType}`, {
        value,
        ...metadata,
      });
    },
    [track],
  );

  // Track page views
  useEffect(() => {
    if (typeof window === "undefined") return;

    const trackPageView = () => {
      track("page_view", {
        path: window.location.pathname,
        search: window.location.search,
        referrer: document.referrer,
      });
    };

    // Track initial page view
    trackPageView();

    // Track route changes for SPAs
    const handleRouteChange = () => trackPageView();
    window.addEventListener("popstate", handleRouteChange);

    return () => {
      window.removeEventListener("popstate", handleRouteChange);
    };
  }, [track]);

  // Track user identification
  useEffect(() => {
    if (user) {
      identify(user.id, {
        email: user.email,
        subscription_tier:
          (user as any)?.subscription_tier ||
          (user as any)?.user_metadata?.subscription_tier,
        created_at: user.created_at,
      });
    }
  }, [user, identify]);

  return {
    track,
    identify,
    trackTiming,
    trackError,
    trackFeature,
    trackConversion,
  };
}
