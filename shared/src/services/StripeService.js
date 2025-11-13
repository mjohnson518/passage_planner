"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StripeService = void 0;
const stripe_1 = __importDefault(require("stripe"));
class StripeService {
    stripe;
    logger;
    // Webhook endpoint secret
    webhookSecret;
    // Price IDs from Stripe Dashboard
    PRICE_IDS = {
        premium_monthly: process.env.STRIPE_PREMIUM_MONTHLY_PRICE_ID,
        premium_yearly: process.env.STRIPE_PREMIUM_YEARLY_PRICE_ID,
        pro_monthly: process.env.STRIPE_PRO_MONTHLY_PRICE_ID,
        pro_yearly: process.env.STRIPE_PRO_YEARLY_PRICE_ID,
    };
    constructor(logger) {
        this.stripe = new stripe_1.default(process.env.STRIPE_SECRET_KEY, {
            apiVersion: '2025-08-27.basil',
        });
        this.webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
        this.logger = logger;
    }
    // Create a checkout session for subscription
    async createCheckoutSession(userId, priceId, successUrl, cancelUrl, email) {
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
        }
        catch (error) {
            this.logger.error({ error, userId }, 'Failed to create checkout session');
            throw error;
        }
    }
    // Create customer portal session
    async createPortalSession(customerId, returnUrl) {
        const session = await this.stripe.billingPortal.sessions.create({
            customer: customerId,
            return_url: returnUrl,
        });
        return session;
    }
    // Get or create Stripe customer
    async getOrCreateCustomer(userId, email) {
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
    async handleWebhook(signature, payload) {
        let event;
        try {
            event = this.stripe.webhooks.constructEvent(payload, signature, this.webhookSecret);
        }
        catch (error) {
            throw new Error('Invalid webhook signature');
        }
        this.logger.info({ type: event.type }, 'Processing webhook event');
        switch (event.type) {
            case 'checkout.session.completed':
                return this.handleCheckoutComplete(event.data.object);
            case 'customer.subscription.created':
            case 'customer.subscription.updated':
                return this.handleSubscriptionUpdate(event.data.object);
            case 'customer.subscription.deleted':
                return this.handleSubscriptionCanceled(event.data.object);
            case 'invoice.payment_failed':
                return this.handlePaymentFailed(event.data.object);
            default:
                this.logger.info({ type: event.type }, 'Unhandled webhook event');
        }
    }
    async handleCheckoutComplete(session) {
        const userId = session.metadata?.userId;
        if (!userId)
            return;
        return {
            userId,
            stripeCustomerId: session.customer,
            stripeSubscriptionId: session.subscription,
            status: 'active',
        };
    }
    async handleSubscriptionUpdate(subscription) {
        const userId = subscription.metadata?.userId;
        if (!userId)
            return;
        const tier = this.getTierFromPriceId(subscription.items.data[0].price.id);
        return {
            userId,
            tier,
            status: subscription.status,
            currentPeriodStart: subscription.current_period_start ? new Date(subscription.current_period_start * 1000) : new Date(),
            currentPeriodEnd: subscription.current_period_end ? new Date(subscription.current_period_end * 1000) : new Date(),
            cancelAtPeriodEnd: subscription.cancel_at_period_end,
        };
    }
    async handleSubscriptionCanceled(subscription) {
        const userId = subscription.metadata?.userId;
        if (!userId)
            return;
        return {
            userId,
            status: 'canceled',
            canceledAt: new Date(),
        };
    }
    async handlePaymentFailed(invoice) {
        const customerId = invoice.customer;
        const subscription = invoice.subscription;
        return {
            customerId,
            subscriptionId: subscription,
            status: 'past_due',
        };
    }
    getTierFromPriceId(priceId) {
        if (priceId === this.PRICE_IDS.premium_monthly || priceId === this.PRICE_IDS.premium_yearly) {
            return 'premium';
        }
        if (priceId === this.PRICE_IDS.pro_monthly || priceId === this.PRICE_IDS.pro_yearly) {
            return 'pro';
        }
        return 'free';
    }
    // Usage-based billing for API calls
    async reportUsage(subscriptionItemId, quantity, timestamp) {
        await this.stripe.subscriptionItems.createUsageRecord(subscriptionItemId, {
            quantity,
            timestamp,
            action: 'increment',
        });
    }
    // Cancel subscription
    async cancelSubscription(subscriptionId, immediately = false) {
        if (immediately) {
            return await this.stripe.subscriptions.cancel(subscriptionId);
        }
        else {
            return await this.stripe.subscriptions.update(subscriptionId, {
                cancel_at_period_end: true,
            });
        }
    }
    // Reactivate subscription
    async reactivateSubscription(subscriptionId) {
        return await this.stripe.subscriptions.update(subscriptionId, {
            cancel_at_period_end: false,
        });
    }
}
exports.StripeService = StripeService;
//# sourceMappingURL=StripeService.js.map