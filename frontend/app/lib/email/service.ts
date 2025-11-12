import { Resend } from 'resend'
import { render } from '@react-email/render'
import WelcomeEmail from '../../../emails/welcome'
import TrialEndingEmail from '../../../emails/trial-ending'
import UsageReportEmail from '../../../emails/usage-report'

const resend = new Resend(process.env.RESEND_API_KEY)

export interface EmailOptions {
  to: string | string[]
  subject: string
  from?: string
  replyTo?: string
}

export class EmailService {
  private from: string
  
  constructor() {
    this.from = process.env.EMAIL_FROM || 'Helmwise <noreply@helmwise.co>'
  }

  async sendWelcomeEmail(
    email: string,
    userName?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const html = render(WelcomeEmail({ userName, userEmail: email }))
      
      const { data, error } = await resend.emails.send({
        from: this.from,
        to: email,
        subject: 'Welcome to Helmwise!',
        html,
      })

      if (error) {
        console.error('Failed to send welcome email:', error)
        return { success: false, error: error.message }
      }

      console.log('Welcome email sent:', data)
      return { success: true }
    } catch (error: any) {
      console.error('Error sending welcome email:', error)
      return { success: false, error: error.message }
    }
  }

  async sendTrialEndingEmail(
    email: string,
    userName: string,
    daysRemaining: number
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const html = render(TrialEndingEmail({ userName, daysRemaining }))
      
      const { data, error } = await resend.emails.send({
        from: this.from,
        to: email,
        subject: `Your Helmwise trial ends in ${daysRemaining} days`,
        html,
      })

      if (error) {
        console.error('Failed to send trial ending email:', error)
        return { success: false, error: error.message }
      }

      console.log('Trial ending email sent:', data)
      return { success: true }
    } catch (error: any) {
      console.error('Error sending trial ending email:', error)
      return { success: false, error: error.message }
    }
  }

  async sendUsageReportEmail(
    email: string,
    reportData: {
      userName: string
      month: string
      year: number
      stats: {
        passagesPlanned: number
        totalDistance: number
        portsVisited: number
        hoursAtSea: number
      }
      topPassages: Array<{
        name: string
        distance: number
        date: string
      }>
      subscriptionTier: 'free' | 'premium' | 'pro'
      remainingPassages?: number
    }
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const html = render(UsageReportEmail(reportData))
      
      const { data, error } = await resend.emails.send({
        from: this.from,
        to: email,
        subject: `Your ${reportData.month} ${reportData.year} Helmwise Summary`,
        html,
      })

      if (error) {
        console.error('Failed to send usage report email:', error)
        return { success: false, error: error.message }
      }

      console.log('Usage report email sent:', data)
      return { success: true }
    } catch (error: any) {
      console.error('Error sending usage report email:', error)
      return { success: false, error: error.message }
    }
  }

  async sendPasswordResetEmail(
    email: string,
    resetUrl: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { data, error } = await resend.emails.send({
        from: this.from,
        to: email,
        subject: 'Reset your Helmwise password',
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #1e293b; font-size: 24px; margin-bottom: 16px;">Reset Your Password</h1>
            <p style="color: #64748b; font-size: 16px; line-height: 24px; margin-bottom: 24px;">
              You requested to reset your password. Click the button below to create a new password.
              This link will expire in 1 hour.
            </p>
            <a href="${resetUrl}" style="display: inline-block; background-color: #0ea5e9; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600;">
              Reset Password
            </a>
            <p style="color: #94a3b8; font-size: 14px; margin-top: 24px;">
              If you didn't request this, you can safely ignore this email.
            </p>
          </div>
        `,
      })

      if (error) {
        console.error('Failed to send password reset email:', error)
        return { success: false, error: error.message }
      }

      console.log('Password reset email sent:', data)
      return { success: true }
    } catch (error: any) {
      console.error('Error sending password reset email:', error)
      return { success: false, error: error.message }
    }
  }

  async sendSubscriptionConfirmationEmail(
    email: string,
    userName: string,
    plan: 'premium' | 'pro'
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const planDetails = {
        premium: {
          name: 'Premium',
          price: '$19/month',
          features: ['10 passages per month', '7-day weather forecasts', 'Email support'],
        },
        pro: {
          name: 'Pro',
          price: '$49/month',
          features: ['Unlimited passages', '14-day weather forecasts', 'Priority support', 'API access'],
        },
      }

      const details = planDetails[plan]

      const { data, error } = await resend.emails.send({
        from: this.from,
        to: email,
        subject: `Welcome to Helmwise ${details.name}!`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #1e293b; font-size: 24px; margin-bottom: 16px;">Welcome to ${details.name}, ${userName}!</h1>
            <p style="color: #64748b; font-size: 16px; line-height: 24px; margin-bottom: 24px;">
              Your subscription is now active. Here's what you get with your ${details.name} plan:
            </p>
            <ul style="color: #64748b; font-size: 16px; line-height: 24px; margin-bottom: 24px;">
              ${details.features.map(feature => `<li>${feature}</li>`).join('')}
            </ul>
            <p style="color: #64748b; font-size: 16px; line-height: 24px; margin-bottom: 24px;">
              Your subscription will renew automatically at ${details.price}. You can manage your subscription
              anytime from your account settings.
            </p>
            <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard" style="display: inline-block; background-color: #0ea5e9; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600;">
              Start Planning
            </a>
          </div>
        `,
      })

      if (error) {
        console.error('Failed to send subscription confirmation email:', error)
        return { success: false, error: error.message }
      }

      console.log('Subscription confirmation email sent:', data)
      return { success: true }
    } catch (error: any) {
      console.error('Error sending subscription confirmation email:', error)
      return { success: false, error: error.message }
    }
  }

  async sendCancellationConfirmationEmail(
    email: string,
    userName: string,
    endDate: Date
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const formattedDate = endDate.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })

      const { data, error } = await resend.emails.send({
        from: this.from,
        to: email,
        subject: 'Your Helmwise subscription has been cancelled',
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #1e293b; font-size: 24px; margin-bottom: 16px;">We're sorry to see you go, ${userName}</h1>
            <p style="color: #64748b; font-size: 16px; line-height: 24px; margin-bottom: 24px;">
              Your subscription has been cancelled. You'll continue to have access to your premium features
              until ${formattedDate}.
            </p>
            <p style="color: #64748b; font-size: 16px; line-height: 24px; margin-bottom: 24px;">
              After that date, your account will revert to the free plan with limited features.
              All your saved passages and data will remain accessible.
            </p>
            <p style="color: #64748b; font-size: 16px; line-height: 24px; margin-bottom: 24px;">
              If you change your mind, you can reactivate your subscription anytime from your account settings.
            </p>
            <a href="${process.env.NEXT_PUBLIC_APP_URL}/account" style="display: inline-block; background-color: #0ea5e9; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600;">
              Manage Account
            </a>
            <p style="color: #94a3b8; font-size: 14px; margin-top: 24px;">
              We'd love to hear why you decided to cancel. Reply to this email with any feedback.
            </p>
          </div>
        `,
      })

      if (error) {
        console.error('Failed to send cancellation confirmation email:', error)
        return { success: false, error: error.message }
      }

      console.log('Cancellation confirmation email sent:', data)
      return { success: true }
    } catch (error: any) {
      console.error('Error sending cancellation confirmation email:', error)
      return { success: false, error: error.message }
    }
  }
}

// Export singleton instance
export const emailService = new EmailService() 