import { Resend } from 'resend'
import { createClient } from '@supabase/supabase-js'
import pino from 'pino'

const resend = new Resend(process.env.RESEND_API_KEY)
const logger = pino({ level: process.env.LOG_LEVEL || 'info' })

export class EmailService {
  private supabase: any
  private from: string
  
  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    )
    this.from = process.env.EMAIL_FROM || 'Passage Planner <noreply@passageplanner.com>'
  }

  async sendWelcomeEmail(userId: string, email: string, userName?: string): Promise<void> {
    try {
      await resend.emails.send({
        from: this.from,
        to: email,
        subject: 'Welcome to Passage Planner!',
        html: this.getWelcomeEmailHtml(userName || 'Captain'),
      })

      // Log email sent
      await this.logEmailSent(userId, 'welcome', email)
    } catch (error) {
      logger.error({ error, userId, email }, 'Failed to send welcome email')
      throw error
    }
  }

  async sendTrialEndingReminders(): Promise<void> {
    try {
      // Get users whose trials are ending in 3 days
      const threeDaysFromNow = new Date()
      threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3)
      
      const { data: users, error } = await this.supabase
        .from('users')
        .select('id, email, created_at')
        .eq('subscription_tier', 'free')
        .lte('created_at', new Date(Date.now() - 11 * 24 * 60 * 60 * 1000).toISOString()) // 11 days ago
        .gte('created_at', new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString()) // 12 days ago

      if (error) throw error

      for (const user of users || []) {
        await resend.emails.send({
          from: this.from,
          to: user.email,
          subject: 'Your Passage Planner trial ends in 3 days',
          html: this.getTrialEndingEmailHtml(3),
        })

        await this.logEmailSent(user.id, 'trial_ending', user.email)
      }
    } catch (error) {
      logger.error({ error }, 'Failed to send trial ending reminders')
      throw error
    }
  }

  async sendMonthlyUsageReports(): Promise<void> {
    try {
      const lastMonth = new Date()
      lastMonth.setMonth(lastMonth.getMonth() - 1)
      const monthName = lastMonth.toLocaleString('en-US', { month: 'long' })
      const year = lastMonth.getFullYear()

      // Get all active users
      const { data: users, error: usersError } = await this.supabase
        .from('users')
        .select('id, email')
        .neq('subscription_status', 'canceled')

      if (usersError) throw usersError

      for (const user of users || []) {
        // Get usage stats for the user
        const stats = await this.getUserMonthlyStats(user.id, lastMonth)

        if (stats.passagesPlanned > 0) {
          await resend.emails.send({
            from: this.from,
            to: user.email,
            subject: `Your ${monthName} ${year} Passage Planner Summary`,
            html: this.getUsageReportEmailHtml(monthName, year, stats),
          })

          await this.logEmailSent(user.id, 'usage_report', user.email)
        }
      }
    } catch (error) {
      logger.error({ error }, 'Failed to send monthly usage reports')
      throw error
    }
  }

  async sendSubscriptionConfirmation(
    userId: string,
    email: string,
    userName: string,
    tier: 'premium' | 'pro'
  ): Promise<void> {
    try {
      await resend.emails.send({
        from: this.from,
        to: email,
        subject: `Welcome to Passage Planner ${tier === 'premium' ? 'Premium' : 'Pro'}!`,
        html: this.getSubscriptionConfirmationHtml(userName, tier),
      })

      await this.logEmailSent(userId, 'subscription_confirmation', email)
    } catch (error) {
      logger.error({ error, userId, tier }, 'Failed to send subscription confirmation')
      throw error
    }
  }

  async sendCancellationConfirmation(
    userId: string,
    email: string,
    userName: string,
    endDate: Date
  ): Promise<void> {
    try {
      await resend.emails.send({
        from: this.from,
        to: email,
        subject: 'Your Passage Planner subscription has been cancelled',
        html: this.getCancellationConfirmationHtml(userName, endDate),
      })

      await this.logEmailSent(userId, 'cancellation_confirmation', email)
    } catch (error) {
      logger.error({ error, userId }, 'Failed to send cancellation confirmation')
      throw error
    }
  }

  private async getUserMonthlyStats(userId: string, month: Date) {
    const startOfMonth = new Date(month.getFullYear(), month.getMonth(), 1)
    const endOfMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0)

    const { data: passages, error } = await this.supabase
      .from('passages')
      .select('*')
      .eq('user_id', userId)
      .gte('created_at', startOfMonth.toISOString())
      .lte('created_at', endOfMonth.toISOString())

    if (error) throw error

    const stats = {
      passagesPlanned: passages?.length || 0,
      totalDistance: passages?.reduce((sum: number, p: any) => sum + (p.distance_nm || 0), 0) || 0,
      portsVisited: new Set(passages?.flatMap((p: any) => [p.start_port, p.end_port]) || []).size,
      hoursAtSea: passages?.reduce((sum: number, p: any) => {
        if (p.departure_time && p.arrival_time) {
          const hours = (new Date(p.arrival_time).getTime() - new Date(p.departure_time).getTime()) / (1000 * 60 * 60)
          return sum + hours
        }
        return sum
      }, 0) || 0,
    }

    return stats
  }

  private async logEmailSent(userId: string, type: string, recipient: string): Promise<void> {
    try {
      await this.supabase.from('email_logs').insert({
        user_id: userId,
        type,
        recipient,
        sent_at: new Date().toISOString(),
      })
    } catch (error) {
      logger.error({ error, userId, type }, 'Failed to log email')
    }
  }

  // Email HTML templates (simplified versions)
  private getWelcomeEmailHtml(userName: string): string {
    return `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #1e293b; font-size: 32px; text-align: center;">Welcome aboard, ${userName}!</h1>
        <p style="color: #64748b; font-size: 16px; line-height: 24px;">
          We're thrilled to have you join Passage Planner. Start planning smarter, safer passages with AI-powered insights.
        </p>
        <div style="text-align: center; margin: 32px 0;">
          <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard" style="display: inline-block; background-color: #0ea5e9; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600;">
            Start Planning Your First Passage
          </a>
        </div>
      </div>
    `
  }

  private getTrialEndingEmailHtml(daysRemaining: number): string {
    return `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #fef3c7; padding: 12px; text-align: center; margin-bottom: 24px;">
          <p style="color: #92400e; font-weight: 600; margin: 0;">⏰ Your trial ends in ${daysRemaining} days</p>
        </div>
        <h1 style="color: #1e293b; font-size: 28px; text-align: center;">Don't lose your passage planning momentum!</h1>
        <p style="color: #64748b; font-size: 16px; line-height: 24px;">
          Upgrade now to keep planning unlimited passages with advanced features.
        </p>
        <div style="text-align: center; margin: 32px 0;">
          <a href="${process.env.NEXT_PUBLIC_APP_URL}/pricing" style="display: inline-block; background-color: #0ea5e9; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600;">
            Upgrade Now & Save 20%
          </a>
        </div>
      </div>
    `
  }

  private getUsageReportEmailHtml(month: string, year: number, stats: any): string {
    return `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #1e293b; font-size: 32px; text-align: center;">Your ${month} sailing summary</h1>
        <div style="background-color: #f8fafc; padding: 32px; margin: 24px 0; text-align: center;">
          <div style="display: inline-block; margin: 0 16px;">
            <p style="color: #0ea5e9; font-size: 36px; font-weight: 700; margin: 0;">${stats.passagesPlanned}</p>
            <p style="color: #64748b; font-size: 14px; text-transform: uppercase;">Passages</p>
          </div>
          <div style="display: inline-block; margin: 0 16px;">
            <p style="color: #0ea5e9; font-size: 36px; font-weight: 700; margin: 0;">${stats.totalDistance.toLocaleString()}</p>
            <p style="color: #64748b; font-size: 14px; text-transform: uppercase;">Nautical Miles</p>
          </div>
        </div>
        <div style="text-align: center;">
          <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard" style="display: inline-block; background-color: #0ea5e9; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600;">
            Plan Your Next Passage
          </a>
        </div>
      </div>
    `
  }

  private getSubscriptionConfirmationHtml(userName: string, tier: 'premium' | 'pro'): string {
    const planName = tier === 'premium' ? 'Premium' : 'Pro'
    return `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #1e293b; font-size: 24px;">Welcome to ${planName}, ${userName}!</h1>
        <p style="color: #64748b; font-size: 16px; line-height: 24px;">
          Your subscription is now active. You can manage it anytime from your account settings.
        </p>
        <div style="text-align: center; margin: 32px 0;">
          <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard" style="display: inline-block; background-color: #0ea5e9; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600;">
            Start Planning
          </a>
        </div>
      </div>
    `
  }

  private getCancellationConfirmationHtml(userName: string, endDate: Date): string {
    const formattedDate = endDate.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
    
    return `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #1e293b; font-size: 24px;">We're sorry to see you go, ${userName}</h1>
        <p style="color: #64748b; font-size: 16px; line-height: 24px;">
          Your subscription has been cancelled. You'll continue to have access until ${formattedDate}.
        </p>
        <div style="text-align: center; margin: 32px 0;">
          <a href="${process.env.NEXT_PUBLIC_APP_URL}/account" style="display: inline-block; background-color: #0ea5e9; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600;">
            Manage Account
          </a>
        </div>
      </div>
    `
  }
}

// Export singleton instance
export const emailService = new EmailService() 