import { Pool } from 'pg'
import { Logger } from 'pino'

export interface AnalyticsEvent {
  userId?: string
  event: string
  properties?: Record<string, any>
  timestamp?: Date
  sessionId?: string
  deviceInfo?: {
    userAgent?: string
    platform?: string
    screen?: { width: number; height: number }
  }
}

export interface BusinessMetrics {
  mrr: number
  arr: number
  totalUsers: number
  paidUsers: number
  trialUsers: number
  churnRate: number
  averageRevenuePerUser: number
  monthlyActiveUsers: number
  conversionRate: number
}

export class AnalyticsService {
  private db: Pool
  private logger: Logger
  private mixpanelToken?: string
  private posthogApiKey?: string

  constructor(db: Pool, logger: Logger) {
    this.db = db
    this.logger = logger.child({ service: 'analytics' })
    this.mixpanelToken = process.env.MIXPANEL_TOKEN
    this.posthogApiKey = process.env.POSTHOG_API_KEY
  }

  /**
   * Track a user event
   */
  async trackEvent(event: AnalyticsEvent): Promise<void> {
    try {
      // Store in database
      await this.db.query(
        `INSERT INTO analytics_events 
         (user_id, event_name, properties, session_id, device_info, created_at) 
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          event.userId,
          event.event,
          JSON.stringify(event.properties || {}),
          event.sessionId,
          JSON.stringify(event.deviceInfo || {}),
          event.timestamp || new Date()
        ]
      )

      // Send to external analytics providers
      await Promise.all([
        this.sendToMixpanel(event),
        this.sendToPostHog(event)
      ])
    } catch (error) {
      this.logger.error({ error, event }, 'Failed to track event')
    }
  }

  /**
   * Calculate business metrics
   */
  async getBusinessMetrics(): Promise<BusinessMetrics> {
    try {
      // MRR calculation
      const mrrResult = await this.db.query(`
        SELECT 
          SUM(CASE 
            WHEN subscription_tier = 'premium' THEN 19
            WHEN subscription_tier = 'pro' THEN 49
            ELSE 0
          END) as mrr
        FROM users
        WHERE subscription_status = 'active'
      `)

      const mrr = parseFloat(mrrResult.rows[0]?.mrr || '0')

      // User counts
      const userCountsResult = await this.db.query(`
        SELECT 
          COUNT(*) as total_users,
          COUNT(CASE WHEN subscription_tier != 'free' THEN 1 END) as paid_users,
          COUNT(CASE WHEN subscription_status = 'trialing' THEN 1 END) as trial_users
        FROM users
      `)

      const userCounts = userCountsResult.rows[0]

      // MAU calculation
      const mauResult = await this.db.query(`
        SELECT COUNT(DISTINCT user_id) as mau
        FROM analytics_events
        WHERE created_at >= NOW() - INTERVAL '30 days'
      `)

      const mau = parseInt(mauResult.rows[0]?.mau || '0')

      // Churn rate (last 30 days)
      const churnResult = await this.db.query(`
        SELECT 
          COUNT(CASE WHEN subscription_status = 'canceled' 
                 AND updated_at >= NOW() - INTERVAL '30 days' THEN 1 END) as churned,
          COUNT(CASE WHEN subscription_tier != 'free' 
                 AND created_at <= NOW() - INTERVAL '30 days' THEN 1 END) as eligible
        FROM users
      `)

      const churn = churnResult.rows[0]
      const churnRate = churn.eligible > 0 ? (churn.churned / churn.eligible) * 100 : 0

      // Conversion rate (trial to paid)
      const conversionResult = await this.db.query(`
        SELECT 
          COUNT(CASE WHEN subscription_tier != 'free' THEN 1 END) as converted,
          COUNT(*) as total_trials
        FROM users
        WHERE created_at >= NOW() - INTERVAL '90 days'
          AND (subscription_status = 'trialing' OR subscription_tier != 'free')
      `)

      const conversion = conversionResult.rows[0]
      const conversionRate = conversion.total_trials > 0 
        ? (conversion.converted / conversion.total_trials) * 100 
        : 0

      return {
        mrr,
        arr: mrr * 12,
        totalUsers: parseInt(userCounts.total_users),
        paidUsers: parseInt(userCounts.paid_users),
        trialUsers: parseInt(userCounts.trial_users),
        churnRate,
        averageRevenuePerUser: userCounts.paid_users > 0 
          ? mrr / parseInt(userCounts.paid_users) 
          : 0,
        monthlyActiveUsers: mau,
        conversionRate
      }
    } catch (error) {
      this.logger.error({ error }, 'Failed to calculate business metrics')
      throw error
    }
  }

  /**
   * Get user journey analytics
   */
  async getUserJourney(userId: string): Promise<any[]> {
    const result = await this.db.query(
      `SELECT event_name, properties, created_at
       FROM analytics_events
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 100`,
      [userId]
    )

    return result.rows
  }

  /**
   * Get feature usage statistics
   */
  async getFeatureUsage(days = 30): Promise<Record<string, number>> {
    const result = await this.db.query(
      `SELECT event_name, COUNT(*) as count
       FROM analytics_events
       WHERE created_at >= NOW() - INTERVAL '${days} days'
         AND event_name LIKE 'feature_%'
       GROUP BY event_name
       ORDER BY count DESC`,
      []
    )

    return result.rows.reduce((acc, row) => {
      acc[row.event_name] = parseInt(row.count)
      return acc
    }, {})
  }

  /**
   * Get cohort retention
   */
  async getCohortRetention(cohortMonth: string): Promise<number[]> {
    const retention: number[] = []

    for (let week = 0; week <= 12; week++) {
      const result = await this.db.query(
        `WITH cohort AS (
          SELECT DISTINCT user_id
          FROM users
          WHERE DATE_TRUNC('month', created_at) = $1::date
        )
        SELECT 
          COUNT(DISTINCT e.user_id) as active_users,
          (SELECT COUNT(*) FROM cohort) as cohort_size
        FROM cohort c
        JOIN analytics_events e ON c.user_id = e.user_id
        WHERE e.created_at >= $1::date + INTERVAL '${week} weeks'
          AND e.created_at < $1::date + INTERVAL '${week + 1} weeks'`,
        [cohortMonth]
      )

      const row = result.rows[0]
      const retentionRate = row.cohort_size > 0 
        ? (row.active_users / row.cohort_size) * 100 
        : 0
      
      retention.push(Math.round(retentionRate))
    }

    return retention
  }

  /**
   * Send event to Mixpanel
   */
  private async sendToMixpanel(event: AnalyticsEvent): Promise<void> {
    if (!this.mixpanelToken) return

    try {
      const payload = {
        event: event.event,
        properties: {
          distinct_id: event.userId,
          time: Math.floor((event.timestamp || new Date()).getTime() / 1000),
          ...event.properties,
          $os: event.deviceInfo?.platform,
          $screen_height: event.deviceInfo?.screen?.height,
          $screen_width: event.deviceInfo?.screen?.width,
        }
      }

      await fetch('https://api.mixpanel.com/track', {
        method: 'POST',
        headers: {
          'Accept': 'text/plain',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify([payload])
      })
    } catch (error) {
      this.logger.warn({ error }, 'Failed to send to Mixpanel')
    }
  }

  /**
   * Send event to PostHog
   */
  private async sendToPostHog(event: AnalyticsEvent): Promise<void> {
    if (!this.posthogApiKey) return

    try {
      const payload = {
        api_key: this.posthogApiKey,
        event: event.event,
        properties: event.properties,
        timestamp: event.timestamp?.toISOString(),
        distinct_id: event.userId || 'anonymous',
      }

      await fetch('https://app.posthog.com/capture/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      })
    } catch (error) {
      this.logger.warn({ error }, 'Failed to send to PostHog')
    }
  }
} 