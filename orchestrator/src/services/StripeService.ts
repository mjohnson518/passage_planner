import Stripe from 'stripe';
import { Logger } from '../../../shared/src/services/logger';
import { Pool } from 'pg';

export interface SubscriptionData {
  userId: string;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  tier: 'free' | 'premium' | 'pro' | 'enterprise';
  status: 'active' | 'canceled' | 'past_due' | 'paused';
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
}

export class StripeService {
  private stripe: Stripe;
  private logger: Logger;
  private db: Pool;
  private webhookSecret: string;

  // Price IDs from Stripe Dashboard
  private readonly PRICE_IDS = {
    premium_monthly: process.env.STRIPE_PREMIUM_MONTHLY_PRICE_ID!,
    premium_yearly: process.env.STRIPE_PREMIUM_YEARLY_PRICE_ID!,
    pro_monthly: process.env.STRIPE_PRO_MONTHLY_PRICE_ID!,
    pro_yearly: process.env.STRIPE_PRO_YEARLY_PRICE_ID!,
  };

  constructor(db: Pool) {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2023-10-16',
    });
    this.db = db;
    this.webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;
    this.logger = new Logger('StripeService');
  }

  /**
   * Create or retrieve a Stripe customer
   */
  async getOrCreateCustomer(userId: string, email: string): Promise<Stripe.Customer> {
    try {
      // Check if customer already exists
      const result = await this.db.query(
        'SELECT stripe_customer_id FROM subscriptions WHERE user_id = $1',
        [userId]
      );

      if (result.rows[0]?.stripe_customer_id) {
        const customer = await this.stripe.customers.retrieve(
          result.rows[0].stripe_customer_id
        );
        return customer as Stripe.Customer;
      }

      // Create new customer
      const customer = await this.stripe.customers.create({
        email,
        metadata: { userId },
      });

      // Store customer ID
      await this.db.query(
        `INSERT INTO subscriptions (user_id, stripe_customer_id, tier, status) 
         VALUES ($1, $2, 'free', 'active') 
         ON CONFLICT (user_id) 
         DO UPDATE SET stripe_customer_id = $2`,
        [userId, customer.id]
      );

      return customer;
    } catch (error) {
      this.logger.error({ error, userId }, 'Failed to get or create customer');
      throw error;
    }
  }

  /**
   * Create a checkout session for subscription
   */
  async createCheckoutSession(
    userId: string,
    email: string,
    priceId: string,
    successUrl: string,
    cancelUrl: string
  ): Promise<Stripe.Checkout.Session> {
    try {
      const customer = await this.getOrCreateCustomer(userId, email);

      const session = await this.stripe.checkout.sessions.create({
        customer: customer.id,
        payment_method_types: ['card'],
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        mode: 'subscription',
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: {
          userId,
        },
        subscription_data: {
          trial_period_days: 14,
          metadata: {
            userId,
          },
        },
        allow_promotion_codes: true,
        billing_address_collection: 'auto',
      });

      this.logger.info({ userId, sessionId: session.id }, 'Created checkout session');
      return session;
    } catch (error) {
      this.logger.error({ error, userId }, 'Failed to create checkout session');
      throw error;
    }
  }

  /**
   * Create a customer portal session for subscription management
   */
  async createPortalSession(
    userId: string,
    returnUrl: string
  ): Promise<Stripe.BillingPortal.Session> {
    try {
      const result = await this.db.query(
        'SELECT stripe_customer_id FROM subscriptions WHERE user_id = $1',
        [userId]
      );

      if (!result.rows[0]?.stripe_customer_id) {
        throw new Error('No customer found');
      }

      const session = await this.stripe.billingPortal.sessions.create({
        customer: result.rows[0].stripe_customer_id,
        return_url: returnUrl,
      });

      return session;
    } catch (error) {
      this.logger.error({ error, userId }, 'Failed to create portal session');
      throw error;
    }
  }

  /**
   * Handle webhook events from Stripe
   */
  async handleWebhook(signature: string, payload: Buffer): Promise<void> {
    let event: Stripe.Event;

    try {
      event = this.stripe.webhooks.constructEvent(
        payload,
        signature,
        this.webhookSecret
      );
    } catch (error) {
      this.logger.error({ error }, 'Invalid webhook signature');
      throw new Error('Invalid webhook signature');
    }

    this.logger.info({ type: event.type }, 'Processing webhook event');

    switch (event.type) {
      case 'checkout.session.completed':
        await this.handleCheckoutComplete(event.data.object as Stripe.Checkout.Session);
        break;

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await this.handleSubscriptionUpdate(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.deleted':
        await this.handleSubscriptionCanceled(event.data.object as Stripe.Subscription);
        break;

      case 'invoice.payment_failed':
        await this.handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      case 'invoice.payment_succeeded':
        await this.handlePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;

      default:
        this.logger.info({ type: event.type }, 'Unhandled webhook event');
    }
  }

  /**
   * Handle successful checkout
   */
  private async handleCheckoutComplete(session: Stripe.Checkout.Session): Promise<void> {
    const userId = session.metadata?.userId;
    if (!userId) {
      this.logger.error({ session }, 'No userId in checkout session metadata');
      return;
    }

    await this.updateUserSubscription({
      userId,
      stripeCustomerId: session.customer as string,
      stripeSubscriptionId: session.subscription as string,
      status: 'active',
    });

    // Send welcome email
    await this.sendSubscriptionEmail(userId, 'welcome');
  }

  /**
   * Handle subscription updates
   */
  private async handleSubscriptionUpdate(subscription: Stripe.Subscription): Promise<void> {
    const userId = subscription.metadata?.userId;
    if (!userId) {
      this.logger.error({ subscription }, 'No userId in subscription metadata');
      return;
    }

    const tier = this.getTierFromPriceId(subscription.items.data[0].price.id);
    const status = this.mapStripeStatus(subscription.status);

    await this.updateUserSubscription({
      userId,
      stripeCustomerId: subscription.customer as string,
      stripeSubscriptionId: subscription.id,
      tier,
      status,
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    });
  }

  /**
   * Handle subscription cancellation
   */
  private async handleSubscriptionCanceled(subscription: Stripe.Subscription): Promise<void> {
    const userId = subscription.metadata?.userId;
    if (!userId) return;

    await this.updateUserSubscription({
      userId,
      stripeCustomerId: subscription.customer as string,
      stripeSubscriptionId: subscription.id,
      tier: 'free',
      status: 'canceled',
    });

    // Send cancellation email
    await this.sendSubscriptionEmail(userId, 'canceled');
  }

  /**
   * Handle failed payments
   */
  private async handlePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    const subscription = await this.stripe.subscriptions.retrieve(
      invoice.subscription as string
    );

    const userId = subscription.metadata?.userId;
    if (!userId) return;

    await this.updateUserSubscription({
      userId,
      stripeCustomerId: invoice.customer as string,
      stripeSubscriptionId: invoice.subscription as string,
      status: 'past_due',
    });

    // Send payment failed email
    await this.sendSubscriptionEmail(userId, 'payment_failed');
  }

  /**
   * Handle successful payments
   */
  private async handlePaymentSucceeded(invoice: Stripe.Invoice): Promise<void> {
    if (!invoice.subscription) return;

    const subscription = await this.stripe.subscriptions.retrieve(
      invoice.subscription as string
    );

    const userId = subscription.metadata?.userId;
    if (!userId) return;

    // Log successful payment
    await this.db.query(
      `INSERT INTO payment_history (user_id, stripe_invoice_id, amount, status, created_at)
       VALUES ($1, $2, $3, 'succeeded', NOW())`,
      [userId, invoice.id, invoice.amount_paid / 100]
    );
  }

  /**
   * Update user subscription in database
   */
  private async updateUserSubscription(data: Partial<SubscriptionData>): Promise<void> {
    const { userId, ...updates } = data;

    const setClause = Object.keys(updates)
      .map((key, index) => `${this.camelToSnake(key)} = $${index + 2}`)
      .join(', ');

    const values = [userId, ...Object.values(updates)];

    await this.db.query(
      `UPDATE subscriptions 
       SET ${setClause}, updated_at = NOW() 
       WHERE user_id = $1`,
      values
    );

    this.logger.info({ userId, updates }, 'Updated user subscription');
  }

  /**
   * Get tier from Stripe price ID
   */
  private getTierFromPriceId(priceId: string): 'premium' | 'pro' {
    if (priceId === this.PRICE_IDS.premium_monthly || 
        priceId === this.PRICE_IDS.premium_yearly) {
      return 'premium';
    }
    return 'pro';
  }

  /**
   * Map Stripe status to our status
   */
  private mapStripeStatus(stripeStatus: Stripe.Subscription.Status): SubscriptionData['status'] {
    switch (stripeStatus) {
      case 'active':
      case 'trialing':
        return 'active';
      case 'past_due':
        return 'past_due';
      case 'canceled':
      case 'unpaid':
        return 'canceled';
      case 'paused':
        return 'paused';
      default:
        return 'canceled';
    }
  }

  /**
   * Send subscription-related emails
   */
  private async sendSubscriptionEmail(
    userId: string,
    type: 'welcome' | 'canceled' | 'payment_failed'
  ): Promise<void> {
    // This would integrate with your email service
    this.logger.info({ userId, type }, 'Sending subscription email');
  }

  /**
   * Convert camelCase to snake_case
   */
  private camelToSnake(str: string): string {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }

  /**
   * Report usage for metered billing
   */
  async reportApiUsage(userId: string, quantity: number): Promise<void> {
    try {
      const result = await this.db.query(
        `SELECT s.stripe_subscription_id, si.stripe_item_id 
         FROM subscriptions s
         JOIN subscription_items si ON s.id = si.subscription_id
         WHERE s.user_id = $1 AND si.metered = true`,
        [userId]
      );

      if (result.rows[0]) {
        await this.stripe.subscriptionItems.createUsageRecord(
          result.rows[0].stripe_item_id,
          {
            quantity,
            timestamp: Math.floor(Date.now() / 1000),
            action: 'increment',
          }
        );
      }
    } catch (error) {
      this.logger.error({ error, userId }, 'Failed to report usage');
    }
  }

  /**
   * Get subscription details for a user
   */
  async getSubscription(userId: string): Promise<SubscriptionData | null> {
    try {
      const result = await this.db.query(
        `SELECT * FROM subscriptions WHERE user_id = $1`,
        [userId]
      );

      if (!result.rows[0]) {
        return null;
      }

      const row = result.rows[0];
      return {
        userId: row.user_id,
        stripeCustomerId: row.stripe_customer_id,
        stripeSubscriptionId: row.stripe_subscription_id,
        tier: row.tier,
        status: row.status,
        currentPeriodStart: row.current_period_start,
        currentPeriodEnd: row.current_period_end,
        cancelAtPeriodEnd: row.cancel_at_period_end,
      };
    } catch (error) {
      this.logger.error({ error, userId }, 'Failed to get subscription');
      return null;
    }
  }
} 