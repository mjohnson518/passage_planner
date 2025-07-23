import Stripe from 'stripe';
import { Logger } from 'pino';
import { User, Subscription, SubscriptionTier } from '../types/core';

export class StripeService {
  private stripe: Stripe;
  private logger: Logger;
  
  // Webhook endpoint secret
  private webhookSecret: string;
  
  // Price IDs from Stripe Dashboard
  private readonly PRICE_IDS = {
    premium_monthly: process.env.STRIPE_PREMIUM_MONTHLY_PRICE_ID!,
    premium_yearly: process.env.STRIPE_PREMIUM_YEARLY_PRICE_ID!,
    pro_monthly: process.env.STRIPE_PRO_MONTHLY_PRICE_ID!,
    pro_yearly: process.env.STRIPE_PRO_YEARLY_PRICE_ID!,
  };
  
  constructor(logger: Logger) {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2025-06-30.basil',
    });
    this.webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;
    this.logger = logger;
  }
  
  // Create a checkout session for subscription
  async createCheckoutSession(
    userId: string, 
    priceId: string, 
    successUrl: string, 
    cancelUrl: string,
    email?: string
  ) {
    try {
      // Get or create Stripe customer
      const customer = await this.getOrCreateCustomer(userId, email);
      
      const session = await this.stripe.checkout.sessions.create({
        customer: customer.id,
        payment_method_types: ['card'],
        line_items: [{
          price: priceId,
          quantity: 1,
        }],
        mode: 'subscription',
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: {
          userId,
        },
        subscription_data: {
          trial_period_days: 14, // Free trial
          metadata: {
            userId,
          },
        },
        // Enable customer portal for self-service
        allow_promotion_codes: true,
        billing_address_collection: 'auto',
      });
      
      return session;
    } catch (error) {
      this.logger.error({ error, userId }, 'Failed to create checkout session');
      throw error;
    }
  }
  
  // Create customer portal session
  async createPortalSession(customerId: string, returnUrl: string) {
    const session = await this.stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });
    
    return session;
  }
  
  // Get or create Stripe customer
  private async getOrCreateCustomer(userId: string, email?: string) {
    // Check if customer already exists
    const existingCustomers = await this.stripe.customers.list({
      email: email,
      limit: 1,
    });
    
    if (existingCustomers.data.length > 0) {
      return existingCustomers.data[0];
    }
    
    // Create new customer
    return await this.stripe.customers.create({
      email: email,
      metadata: {
        userId,
      },
    });
  }
  
  // Handle webhook events
  async handleWebhook(signature: string, payload: Buffer) {
    let event: Stripe.Event;
    
    try {
      event = this.stripe.webhooks.constructEvent(
        payload,
        signature,
        this.webhookSecret
      );
    } catch (error) {
      throw new Error('Invalid webhook signature');
    }
    
    this.logger.info({ type: event.type }, 'Processing webhook event');
    
    switch (event.type) {
      case 'checkout.session.completed':
        return this.handleCheckoutComplete(event.data.object as Stripe.Checkout.Session);
        
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        return this.handleSubscriptionUpdate(event.data.object as Stripe.Subscription);
        
      case 'customer.subscription.deleted':
        return this.handleSubscriptionCanceled(event.data.object as Stripe.Subscription);
        
      case 'invoice.payment_failed':
        return this.handlePaymentFailed(event.data.object as Stripe.Invoice);
        
      default:
        this.logger.info({ type: event.type }, 'Unhandled webhook event');
    }
  }
  
  private async handleCheckoutComplete(session: Stripe.Checkout.Session) {
    const userId = session.metadata?.userId;
    if (!userId) return;
    
    return {
      userId,
      stripeCustomerId: session.customer as string,
      stripeSubscriptionId: session.subscription as string,
      status: 'active',
    };
  }
  
  private async handleSubscriptionUpdate(subscription: Stripe.Subscription) {
    const userId = subscription.metadata?.userId;
    if (!userId) return;
    
    const tier = this.getTierFromPriceId(subscription.items.data[0].price.id);
    
    return {
      userId,
      tier,
      status: subscription.status,
      currentPeriodStart: (subscription as any).current_period_start ? new Date((subscription as any).current_period_start * 1000) : new Date(),
      currentPeriodEnd: (subscription as any).current_period_end ? new Date((subscription as any).current_period_end * 1000) : new Date(),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    };
  }
  
  private async handleSubscriptionCanceled(subscription: Stripe.Subscription) {
    const userId = subscription.metadata?.userId;
    if (!userId) return;
    
    return {
      userId,
      status: 'canceled',
      canceledAt: new Date(),
    };
  }
  
  private async handlePaymentFailed(invoice: Stripe.Invoice) {
    const customerId = invoice.customer as string;
    const subscription = (invoice as any).subscription as string;
    
    return {
      customerId,
      subscriptionId: subscription,
      status: 'past_due',
    };
  }
  
  private getTierFromPriceId(priceId: string): SubscriptionTier {
    if (priceId === this.PRICE_IDS.premium_monthly || priceId === this.PRICE_IDS.premium_yearly) {
      return 'premium';
    }
    if (priceId === this.PRICE_IDS.pro_monthly || priceId === this.PRICE_IDS.pro_yearly) {
      return 'pro';
    }
    return 'free';
  }
  
  // Usage-based billing for API calls
  async reportUsage(subscriptionItemId: string, quantity: number, timestamp: number) {
    await (this.stripe.subscriptionItems as any).createUsageRecord(
      subscriptionItemId,
      {
        quantity,
        timestamp,
        action: 'increment',
      }
    );
  }
  
  // Cancel subscription
  async cancelSubscription(subscriptionId: string, immediately: boolean = false) {
    if (immediately) {
      return await this.stripe.subscriptions.cancel(subscriptionId);
    } else {
      return await this.stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: true,
      });
    }
  }
  
  // Reactivate subscription
  async reactivateSubscription(subscriptionId: string) {
    return await this.stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: false,
    });
  }
} 