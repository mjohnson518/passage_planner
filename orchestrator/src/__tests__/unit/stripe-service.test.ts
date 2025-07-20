import { StripeService } from '../../services/StripeService'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

jest.mock('stripe')
jest.mock('@supabase/supabase-js')

describe('StripeService', () => {
  let stripeService: StripeService
  let mockStripe: any
  let mockSupabase: any

  beforeEach(() => {
    mockStripe = {
      customers: {
        create: jest.fn(),
        retrieve: jest.fn(),
        update: jest.fn(),
      },
      prices: {
        list: jest.fn(),
      },
      checkout: {
        sessions: {
          create: jest.fn(),
          retrieve: jest.fn(),
        },
      },
      billingPortal: {
        sessions: {
          create: jest.fn(),
        },
      },
      subscriptions: {
        retrieve: jest.fn(),
        update: jest.fn(),
        cancel: jest.fn(),
      },
      webhooks: {
        constructEvent: jest.fn(),
      },
    }

    mockSupabase = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn(),
      update: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
    }

    ;(Stripe as any).mockReturnValue(mockStripe)
    ;(createClient as jest.Mock).mockReturnValue(mockSupabase)

    stripeService = new StripeService()
  })

  describe('createOrGetCustomer', () => {
    it('should return existing customer if found', async () => {
      const userId = 'user_123'
      const email = 'test@example.com'
      const existingCustomer = {
        stripe_customer_id: 'cus_existing',
      }

      mockSupabase.single.mockResolvedValueOnce({
        data: existingCustomer,
        error: null,
      })

      const result = await stripeService.createOrGetCustomer(userId, email)

      expect(result).toBe('cus_existing')
      expect(mockStripe.customers.create).not.toHaveBeenCalled()
    })

    it('should create new customer if not found', async () => {
      const userId = 'user_123'
      const email = 'test@example.com'

      mockSupabase.single.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116' },
      })

      mockStripe.customers.create.mockResolvedValueOnce({
        id: 'cus_new',
      })

      const result = await stripeService.createOrGetCustomer(userId, email)

      expect(result).toBe('cus_new')
      expect(mockStripe.customers.create).toHaveBeenCalledWith({
        email,
        metadata: { userId },
      })
      expect(mockSupabase.update).toHaveBeenCalledWith({
        stripe_customer_id: 'cus_new',
      })
    })

    it('should throw error on database failure', async () => {
      const userId = 'user_123'
      const email = 'test@example.com'

      mockSupabase.single.mockRejectedValueOnce(new Error('Database error'))

      await expect(stripeService.createOrGetCustomer(userId, email))
        .rejects.toThrow('Database error')
    })
  })

  describe('createCheckoutSession', () => {
    it('should create checkout session for premium tier', async () => {
      const userId = 'user_123'
      const email = 'test@example.com'
      const tier = 'premium'

      mockSupabase.single.mockResolvedValueOnce({
        data: { stripe_customer_id: 'cus_123' },
        error: null,
      })

      mockStripe.checkout.sessions.create.mockResolvedValueOnce({
        id: 'cs_test_123',
        url: 'https://checkout.stripe.com/session',
      })

      const result = await stripeService.createCheckoutSession(userId, email, tier)

      expect(result).toEqual({
        sessionId: 'cs_test_123',
        url: 'https://checkout.stripe.com/session',
      })

      expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith({
        customer: 'cus_123',
        payment_method_types: ['card'],
        line_items: [{
          price: process.env.STRIPE_PREMIUM_PRICE_ID,
          quantity: 1,
        }],
        mode: 'subscription',
        success_url: expect.stringContaining('/dashboard?success=true'),
        cancel_url: expect.stringContaining('/pricing'),
        metadata: { userId },
      })
    })

    it('should throw error for invalid tier', async () => {
      const userId = 'user_123'
      const email = 'test@example.com'
      const tier = 'invalid' as any

      await expect(stripeService.createCheckoutSession(userId, email, tier))
        .rejects.toThrow('Invalid subscription tier')
    })
  })

  describe('createPortalSession', () => {
    it('should create billing portal session', async () => {
      const userId = 'user_123'

      mockSupabase.single.mockResolvedValueOnce({
        data: { stripe_customer_id: 'cus_123' },
        error: null,
      })

      mockStripe.billingPortal.sessions.create.mockResolvedValueOnce({
        url: 'https://billing.stripe.com/session',
      })

      const result = await stripeService.createPortalSession(userId)

      expect(result).toBe('https://billing.stripe.com/session')
      expect(mockStripe.billingPortal.sessions.create).toHaveBeenCalledWith({
        customer: 'cus_123',
        return_url: expect.stringContaining('/dashboard'),
      })
    })

    it('should throw error if no customer found', async () => {
      const userId = 'user_123'

      mockSupabase.single.mockResolvedValueOnce({
        data: null,
        error: null,
      })

      await expect(stripeService.createPortalSession(userId))
        .rejects.toThrow('No Stripe customer found')
    })
  })

  describe('cancelSubscription', () => {
    it('should cancel subscription at period end', async () => {
      const userId = 'user_123'

      mockSupabase.single.mockResolvedValueOnce({
        data: { stripe_subscription_id: 'sub_123' },
        error: null,
      })

      mockStripe.subscriptions.update.mockResolvedValueOnce({
        id: 'sub_123',
        cancel_at_period_end: true,
      })

      await stripeService.cancelSubscription(userId)

      expect(mockStripe.subscriptions.update).toHaveBeenCalledWith('sub_123', {
        cancel_at_period_end: true,
      })
      expect(mockSupabase.update).toHaveBeenCalledWith({
        cancel_at_period_end: true,
      })
    })

    it('should throw error if no subscription found', async () => {
      const userId = 'user_123'

      mockSupabase.single.mockResolvedValueOnce({
        data: { stripe_subscription_id: null },
        error: null,
      })

      await expect(stripeService.cancelSubscription(userId))
        .rejects.toThrow('No active subscription found')
    })
  })

  describe('resumeSubscription', () => {
    it('should resume cancelled subscription', async () => {
      const userId = 'user_123'

      mockSupabase.single.mockResolvedValueOnce({
        data: { stripe_subscription_id: 'sub_123' },
        error: null,
      })

      mockStripe.subscriptions.update.mockResolvedValueOnce({
        id: 'sub_123',
        cancel_at_period_end: false,
      })

      await stripeService.resumeSubscription(userId)

      expect(mockStripe.subscriptions.update).toHaveBeenCalledWith('sub_123', {
        cancel_at_period_end: false,
      })
      expect(mockSupabase.update).toHaveBeenCalledWith({
        cancel_at_period_end: false,
      })
    })
  })

  describe('getSubscriptionTier', () => {
    it('should return premium for premium price ID', () => {
      process.env.STRIPE_PREMIUM_PRICE_ID = 'price_premium'
      const result = stripeService['getSubscriptionTier']('price_premium')
      expect(result).toBe('premium')
    })

    it('should return pro for pro price ID', () => {
      process.env.STRIPE_PRO_PRICE_ID = 'price_pro'
      const result = stripeService['getSubscriptionTier']('price_pro')
      expect(result).toBe('pro')
    })

    it('should return free for unknown price ID', () => {
      const result = stripeService['getSubscriptionTier']('price_unknown')
      expect(result).toBe('free')
    })
  })
}) 