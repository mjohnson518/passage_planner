import Stripe from 'stripe';
import { Pool } from 'pg';
import { Logger } from 'pino';
import crypto from 'crypto';
import { CreateCheckoutSessionParams, CreatePortalSessionParams } from '@passage-planner/shared';
import { emailService } from './EmailService';

export class StripeService {
  private stripe: Stripe;
  private db: Pool;
  private logger: Logger;
  private webhookSecret: string;

  // Price IDs from Stripe Dashboard
  private readonly PRICE_IDS = {
    premium_monthly: process.env.STRIPE_PREMIUM_MONTHLY_PRICE_ID!,
    premium_yearly: process.env.STRIPE_PREMIUM_YEARLY_PRICE_ID!,
    pro_monthly: process.env.STRIPE_PRO_MONTHLY_PRICE_ID!,
    pro_yearly: process.env.STRIPE_PRO_YEARLY_PRICE_ID!,
  };

  constructor(db: Pool, logger: Logger) {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2025-06-30.basil',
    });
    this.db = db;
    this.logger = logger.child({ service: 'stripe' });
    this.webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;
  }

  // Create or get Stripe customer
  async getOrCreateCustomer(userId: string, email?: string): Promise<Stripe.Customer> {
    // Check if customer already exists
    const result = await this.db.query(
      'SELECT stripe_customer_id FROM subscriptions WHERE user_id = $1',
      [userId]
    );

    if (result.rows[0]?.stripe_customer_id) {
      const customer = await this.stripe.customers.retrieve(result.rows[0].stripe_customer_id);
      return customer as Stripe.Customer;
    }

    // Get user email if not provided
    if (!email) {
      const userResult = await this.db.query(
        'SELECT email FROM users WHERE id = $1',
        [userId]
      );
      email = userResult.rows[0]?.email;
    }

    // Create new customer
    const customer = await this.stripe.customers.create({
      email,
      metadata: {
        userId,
      },
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
  }

  // Create checkout session for subscription
  async createCheckoutSession(params: CreateCheckoutSessionParams): Promise<Stripe.Checkout.Session> {
    try {
      const customer = await this.getOrCreateCustomer(params.userId, params.customerEmail);

      const session = await this.stripe.checkout.sessions.create({
        customer: customer.id,
        payment_method_types: ['card'],
        line_items: [{
          price: params.priceId,
          quantity: 1,
        }],
        mode: 'subscription',
        success_url: params.successUrl,
        cancel_url: params.cancelUrl,
        metadata: {
          userId: params.userId,
        },
        subscription_data: {
          trial_period_days: 14,
          metadata: {
            userId: params.userId,
          },
        },
        allow_promotion_codes: true,
        billing_address_collection: 'auto',
      });

      this.logger.info({ userId: params.userId, sessionId: session.id }, 'Created checkout session');
      return session;
    } catch (error) {
      this.logger.error({ error, userId: params.userId }, 'Failed to create checkout session');
      throw error;
    }
  }

  // Create customer portal session
  async createPortalSession(params: CreatePortalSessionParams): Promise<Stripe.BillingPortal.Session> {
    const session = await this.stripe.billingPortal.sessions.create({
      customer: params.customerId,
      return_url: params.returnUrl,
    });

    return session;
  }

  // Handle webhook events
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

      case 'customer.subscription.trial_will_end':
        await this.handleTrialEnding(event.data.object as Stripe.Subscription);
        break;

      default:
        this.logger.info({ type: event.type }, 'Unhandled webhook event');
    }
  }

  private async handleCheckoutComplete(session: Stripe.Checkout.Session): Promise<void> {
    const userId = session.metadata?.userId;
    if (!userId) {
      this.logger.error({ sessionId: session.id }, 'No userId in checkout session metadata');
      return;
    }

    // Get subscription details
    const subscription = await this.stripe.subscriptions.retrieve(session.subscription as string);
    const priceId = subscription.items.data[0]?.price.id;
    let tier: 'premium' | 'pro' = 'premium';
    
    if (priceId === this.PRICE_IDS.pro_monthly || priceId === this.PRICE_IDS.pro_yearly) {
      tier = 'pro';
    }

    // Update subscription in database
    await this.db.query(
      `UPDATE subscriptions 
       SET stripe_subscription_id = $1, status = 'active' 
       WHERE user_id = $2`,
      [session.subscription, userId]
    );

    // Get user details for email
    const userResult = await this.db.query(
      'SELECT email, name FROM users WHERE id = $1',
      [userId]
    );
    const user = userResult.rows[0];

    // Send subscription confirmation email
    try {
      await emailService.sendSubscriptionConfirmation(
        userId,
        user.email,
        user.name || 'Captain',
        tier
      );
    } catch (error) {
      this.logger.error({ error, userId }, 'Failed to send subscription confirmation email');
    }

    // Track metric
    await this.trackUsageMetric(userId, 'subscription_created', {
      subscription_id: session.subscription,
      amount: session.amount_total,
    });

    this.logger.info({ userId, subscriptionId: session.subscription }, 'Checkout completed');
  }

  private async handleSubscriptionUpdate(subscription: Stripe.Subscription): Promise<void> {
    const userId = subscription.metadata?.userId;
    if (!userId) return;

    // Determine tier from price ID
    const priceId = subscription.items.data[0]?.price.id;
    let tier = 'free';
    
    if (priceId === this.PRICE_IDS.premium_monthly || priceId === this.PRICE_IDS.premium_yearly) {
      tier = 'premium';
    } else if (priceId === this.PRICE_IDS.pro_monthly || priceId === this.PRICE_IDS.pro_yearly) {
      tier = 'pro';
    }

    // Update subscription in database
    await this.db.query(
      `UPDATE subscriptions 
       SET tier = $1, 
           status = $2,
           current_period_start = to_timestamp($3),
           current_period_end = to_timestamp($4),
           cancel_at_period_end = $5
       WHERE user_id = $6`,
      [
        tier,
        subscription.status,
        subscription.current_period_start,
        subscription.current_period_end,
        subscription.cancel_at_period_end,
        userId
      ]
    );

    this.logger.info({ userId, tier, status: subscription.status }, 'Subscription updated');
  }

  private async handleSubscriptionCanceled(subscription: Stripe.Subscription): Promise<void> {
    const userId = subscription.metadata?.userId;
    if (!userId) return;

    // Update subscription status
    await this.db.query(
      `UPDATE subscriptions 
       SET status = 'canceled', tier = 'free' 
       WHERE user_id = $1`,
      [userId]
    );

    // Get user details for email
    const userResult = await this.db.query(
      'SELECT email, name FROM users WHERE id = $1',
      [userId]
    );
    const user = userResult.rows[0];

    // Send cancellation confirmation email
    try {
      const endDate = new Date(subscription.current_period_end * 1000);
      await emailService.sendCancellationConfirmation(
        userId,
        user.email,
        user.name || 'Captain',
        endDate
      );
    } catch (error) {
      this.logger.error({ error, userId }, 'Failed to send cancellation confirmation email');
    }

    // Track churn
    await this.trackUsageMetric(userId, 'subscription_canceled', {
      subscription_id: subscription.id,
      canceled_at: new Date().toISOString(),
    });

    this.logger.info({ userId }, 'Subscription canceled');
  }

  private async handlePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    const customerId = invoice.customer as string;
    
    // Get user ID from customer
    const result = await this.db.query(
      'SELECT user_id FROM subscriptions WHERE stripe_customer_id = $1',
      [customerId]
    );
    
    const userId = result.rows[0]?.user_id;
    if (!userId) return;

    // Update subscription status
    await this.db.query(
      `UPDATE subscriptions SET status = 'past_due' WHERE user_id = $1`,
      [userId]
    );

    this.logger.warn({ userId, invoiceId: invoice.id }, 'Payment failed');
  }

  private async handleTrialEnding(subscription: Stripe.Subscription): Promise<void> {
    const userId = subscription.metadata?.userId;
    if (!userId) return;

    // Get user details for email
    const userResult = await this.db.query(
      'SELECT email, name FROM users WHERE id = $1',
      [userId]
    );
    const user = userResult.rows[0];

    // Calculate days remaining
    const trialEnd = new Date(subscription.trial_end! * 1000);
    const today = new Date();
    const daysRemaining = Math.ceil((trialEnd.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    // Send trial ending email
    try {
      await emailService.sendTrialEndingReminders();
    } catch (error) {
      this.logger.error({ error, userId }, 'Failed to send trial ending email');
    }

    // Track trial ending event
    await this.trackUsageMetric(userId, 'trial_ending', {
      subscription_id: subscription.id,
      trial_end: subscription.trial_end,
    });

    this.logger.info({ userId }, 'Trial ending soon');
  }

  // Track usage metrics
  private async trackUsageMetric(userId: string, action: string, metadata: any): Promise<void> {
    await this.db.query(
      'INSERT INTO usage_metrics (user_id, action, metadata) VALUES ($1, $2, $3)',
      [userId, action, JSON.stringify(metadata)]
    );
  }

  // Generate API key
  generateApiKey(): { key: string; hash: string } {
    const key = `pp_${crypto.randomBytes(32).toString('base64url')}`;
    const hash = crypto.createHash('sha256').update(key).digest('hex');
    return { key, hash };
  }

  // Verify API key
  verifyApiKey(key: string, hash: string): boolean {
    const computedHash = crypto.createHash('sha256').update(key).digest('hex');
    return computedHash === hash;
  }
} 