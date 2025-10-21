/**
 * Analytics & Event Tracking
 * 
 * Privacy-conscious analytics tracking for understanding user behavior.
 * No PII collected - only aggregate usage data.
 */

import { getSupabase } from './supabase-client';

export interface EventProperties {
  [key: string]: string | number | boolean | null;
}

class Analytics {
  private sessionId: string;
  private isEnabled: boolean;

  constructor() {
    // Generate session ID
    this.sessionId = this.generateSessionId();
    
    // Check if analytics is enabled (respect privacy settings)
    this.isEnabled = this.checkAnalyticsConsent();
  }

  /**
   * Track an event
   */
  async track(eventName: string, properties?: EventProperties): Promise<void> {
    if (!this.isEnabled) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();

      await supabase.from('analytics_events').insert({
        event_name: eventName,
        user_id: user?.id || null,
        session_id: this.sessionId,
        properties: properties || {},
        page_url: typeof window !== 'undefined' ? window.location.href : null,
        referrer: typeof document !== 'undefined' ? document.referrer : null,
        user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
      });
    } catch (error) {
      // Silently fail - don't disrupt user experience
      console.debug('Analytics tracking failed:', error);
    }
  }

  /**
   * Track passage creation
   */
  async trackPassageCreated(properties: {
    distance_nm?: number;
    duration_hours?: number;
    waypoint_count?: number;
    departure_port?: string;
    destination_port?: string;
  }): Promise<void> {
    await this.track('passage_created', properties);
  }

  /**
   * Track route export
   */
  async trackRouteExported(properties: {
    format: 'gpx' | 'kml' | 'csv';
    waypoint_count: number;
    distance_nm?: number;
  }): Promise<void> {
    await this.track('route_exported', properties);
  }

  /**
   * Track safety warning
   */
  async trackSafetyWarning(properties: {
    type: string;
    severity: string;
    overridden?: boolean;
  }): Promise<void> {
    await this.track('safety_warning_generated', properties);
  }

  /**
   * Track weather window check
   */
  async trackWeatherWindow(properties: {
    duration_hours: number;
    windows_found: number;
    location?: string;
  }): Promise<void> {
    await this.track('weather_window_checked', properties);
  }

  /**
   * Track vessel profile creation
   */
  async trackVesselCreated(properties: {
    vessel_type?: string;
    length_feet?: number;
  }): Promise<void> {
    await this.track('vessel_profile_created', properties);
  }

  /**
   * Track checklist completion
   */
  async trackChecklistCompleted(properties: {
    template_name?: string;
    items_total?: number;
    items_completed?: number;
  }): Promise<void> {
    await this.track('checklist_completed', properties);
  }

  /**
   * Track generic feature usage
   */
  async trackFeatureUsed(featureName: string, properties?: EventProperties): Promise<void> {
    await this.track('feature_used', {
      feature_name: featureName,
      ...properties,
    });
  }

  /**
   * Track page view
   */
  async trackPageView(pageName: string): Promise<void> {
    await this.track('page_viewed', { page_name: pageName });
  }

  /**
   * Track subscription events
   */
  async trackSubscription(action: 'upgraded' | 'downgraded' | 'cancelled', tier: string): Promise<void> {
    await this.track('subscription_changed', { action, tier });
  }

  /**
   * Generate session ID
   */
  private generateSessionId(): string {
    if (typeof window !== 'undefined') {
      let sessionId = sessionStorage.getItem('helmwise_session_id');
      if (!sessionId) {
        sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        sessionStorage.setItem('helmwise_session_id', sessionId);
      }
      return sessionId;
    }
    return `session_${Date.now()}`;
  }

  /**
   * Check if user has consented to analytics
   */
  private checkAnalyticsConsent(): boolean {
    if (typeof window === 'undefined') return false;

    // Check localStorage for consent
    const consent = localStorage.getItem('helmwise_analytics_consent');
    
    // Default to enabled (can add GDPR consent banner later)
    return consent !== 'false';
  }

  /**
   * Enable analytics
   */
  enableAnalytics(): void {
    this.isEnabled = true;
    if (typeof window !== 'undefined') {
      localStorage.setItem('helmwise_analytics_consent', 'true');
    }
  }

  /**
   * Disable analytics
   */
  disableAnalytics(): void {
    this.isEnabled = false;
    if (typeof window !== 'undefined') {
      localStorage.setItem('helmwise_analytics_consent', 'false');
    }
  }
}

// Export singleton instance
export const analytics = new Analytics();

// Convenience hook for React components
export function useAnalytics() {
  return {
    track: analytics.track.bind(analytics),
    trackPassageCreated: analytics.trackPassageCreated.bind(analytics),
    trackRouteExported: analytics.trackRouteExported.bind(analytics),
    trackSafetyWarning: analytics.trackSafetyWarning.bind(analytics),
    trackWeatherWindow: analytics.trackWeatherWindow.bind(analytics),
    trackVesselCreated: analytics.trackVesselCreated.bind(analytics),
    trackChecklistCompleted: analytics.trackChecklistCompleted.bind(analytics),
    trackFeatureUsed: analytics.trackFeatureUsed.bind(analytics),
    trackPageView: analytics.trackPageView.bind(analytics),
    trackSubscription: analytics.trackSubscription.bind(analytics),
  };
}

