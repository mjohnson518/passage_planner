import request from 'supertest'
import { createServer } from 'http'
import { HttpServer } from '../../server'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'
import crypto from 'crypto'

jest.mock('@supabase/supabase-js')
jest.mock('stripe')

const mockSupabase = {
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  single: jest.fn(),
  update: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
}

const mockStripe = {
  webhooks: {
    constructEvent: jest.fn(),
  },
  customers: {
    retrieve: jest.fn(),
  },
  subscriptions: {
    retrieve: jest.fn(),
  },
  invoices: {
    retrieve: jest.fn(),
  },
}

describe('Stripe Webhook Integration Tests', () => {
  let httpServer: HttpServer
  let server: any
  
  beforeAll(async () => {
    (createClient as jest.Mock).mockReturnValue(mockSupabase)
    ;(Stripe as any).mockReturnValue(mockStripe)
    
    httpServer = new HttpServer()
    await httpServer.initialize()
    server = createServer(httpServer.app)
  })
  
  afterAll(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve())
    })
  })
  
  beforeEach(() => {
    jest.clearAllMocks()
  })

  const generateWebhookSignature = (payload: string, secret: string): string => {
    const timestamp = Math.floor(Date.now() / 1000)
    const signedPayload = `${timestamp}.${payload}`
    const signature = crypto
      .createHmac('sha256', secret)
      .update(signedPayload)
      .digest('hex')
    return `t=${timestamp},v1=${signature}`
  }

  describe('POST /stripe/webhook', () => {
    it('should reject requests without stripe signature', async () => {
      const response = await request(server)
        .post('/stripe/webhook')
        .send({ type: 'test.event' })
        .expect(400)
      
      expect(response.body).toEqual({
        error: 'No Stripe signature found'
      })
    })

    it('should reject requests with invalid signature', async () => {
      mockStripe.webhooks.constructEvent.mockImplementation(() => {
        throw new Error('Invalid signature')
      })

      const payload = JSON.stringify({ type: 'test.event' })
      const response = await request(server)
        .post('/stripe/webhook')
        .set('stripe-signature', 'invalid-signature')
        .send(payload)
        .expect(400)
      
      expect(response.body.error).toContain('Webhook signature verification failed')
    })

    describe('checkout.session.completed', () => {
      it('should create subscription for new customer', async () => {
        const event = {
          type: 'checkout.session.completed',
          data: {
            object: {
              id: 'cs_test_123',
              customer: 'cus_test_123',
              subscription: 'sub_test_123',
              metadata: {
                userId: 'user_123',
              },
            },
          },
        }

        mockStripe.webhooks.constructEvent.mockReturnValue(event)
        mockStripe.subscriptions.retrieve.mockResolvedValue({
          id: 'sub_test_123',
          status: 'active',
          current_period_end: 1234567890,
          items: {
            data: [{
              price: {
                id: 'price_premium',
                product: 'prod_premium',
              },
            }],
          },
        })

        mockSupabase.single.mockResolvedValueOnce({
          data: null,
          error: { code: 'PGRST116' }, // Not found
        })

        const payload = JSON.stringify(event)
        const signature = generateWebhookSignature(payload, process.env.STRIPE_WEBHOOK_SECRET!)

        const response = await request(server)
          .post('/stripe/webhook')
          .set('stripe-signature', signature)
          .send(payload)
          .expect(200)

        expect(mockSupabase.insert).toHaveBeenCalledWith({
          user_id: 'user_123',
          stripe_customer_id: 'cus_test_123',
          stripe_subscription_id: 'sub_test_123',
          subscription_tier: 'premium',
          subscription_status: 'active',
          current_period_end: expect.any(Date),
        })

        expect(response.body).toEqual({ received: true })
      })

      it('should update existing customer subscription', async () => {
        const event = {
          type: 'checkout.session.completed',
          data: {
            object: {
              id: 'cs_test_123',
              customer: 'cus_test_123',
              subscription: 'sub_test_123',
              metadata: {
                userId: 'user_123',
              },
            },
          },
        }

        mockStripe.webhooks.constructEvent.mockReturnValue(event)
        mockStripe.subscriptions.retrieve.mockResolvedValue({
          id: 'sub_test_123',
          status: 'active',
          current_period_end: 1234567890,
          items: {
            data: [{
              price: {
                id: 'price_pro',
                product: 'prod_pro',
              },
            }],
          },
        })

        mockSupabase.single.mockResolvedValueOnce({
          data: { id: 'existing_user' },
          error: null,
        })

        const payload = JSON.stringify(event)
        const signature = generateWebhookSignature(payload, process.env.STRIPE_WEBHOOK_SECRET!)

        await request(server)
          .post('/stripe/webhook')
          .set('stripe-signature', signature)
          .send(payload)
          .expect(200)

        expect(mockSupabase.update).toHaveBeenCalledWith({
          stripe_subscription_id: 'sub_test_123',
          subscription_tier: 'pro',
          subscription_status: 'active',
          current_period_end: expect.any(Date),
        })
      })
    })

    describe('customer.subscription.updated', () => {
      it('should update subscription status and tier', async () => {
        const event = {
          type: 'customer.subscription.updated',
          data: {
            object: {
              id: 'sub_test_123',
              customer: 'cus_test_123',
              status: 'active',
              current_period_end: 1234567890,
              cancel_at_period_end: false,
              items: {
                data: [{
                  price: {
                    id: 'price_premium',
                    product: 'prod_premium',
                  },
                }],
              },
            },
          },
        }

        mockStripe.webhooks.constructEvent.mockReturnValue(event)

        const payload = JSON.stringify(event)
        const signature = generateWebhookSignature(payload, process.env.STRIPE_WEBHOOK_SECRET!)

        await request(server)
          .post('/stripe/webhook')
          .set('stripe-signature', signature)
          .send(payload)
          .expect(200)

        expect(mockSupabase.update).toHaveBeenCalledWith({
          subscription_status: 'active',
          subscription_tier: 'premium',
          current_period_end: expect.any(Date),
          cancel_at_period_end: false,
        })
      })

      it('should handle subscription cancellation', async () => {
        const event = {
          type: 'customer.subscription.updated',
          data: {
            object: {
              id: 'sub_test_123',
              customer: 'cus_test_123',
              status: 'active',
              current_period_end: 1234567890,
              cancel_at_period_end: true,
              items: {
                data: [{
                  price: {
                    id: 'price_premium',
                    product: 'prod_premium',
                  },
                }],
              },
            },
          },
        }

        mockStripe.webhooks.constructEvent.mockReturnValue(event)

        const payload = JSON.stringify(event)
        const signature = generateWebhookSignature(payload, process.env.STRIPE_WEBHOOK_SECRET!)

        await request(server)
          .post('/stripe/webhook')
          .set('stripe-signature', signature)
          .send(payload)
          .expect(200)

        expect(mockSupabase.update).toHaveBeenCalledWith({
          subscription_status: 'active',
          subscription_tier: 'premium',
          current_period_end: expect.any(Date),
          cancel_at_period_end: true,
        })
      })
    })

    describe('customer.subscription.deleted', () => {
      it('should downgrade to free tier', async () => {
        const event = {
          type: 'customer.subscription.deleted',
          data: {
            object: {
              id: 'sub_test_123',
              customer: 'cus_test_123',
            },
          },
        }

        mockStripe.webhooks.constructEvent.mockReturnValue(event)

        const payload = JSON.stringify(event)
        const signature = generateWebhookSignature(payload, process.env.STRIPE_WEBHOOK_SECRET!)

        await request(server)
          .post('/stripe/webhook')
          .set('stripe-signature', signature)
          .send(payload)
          .expect(200)

        expect(mockSupabase.update).toHaveBeenCalledWith({
          subscription_status: 'canceled',
          subscription_tier: 'free',
          stripe_subscription_id: null,
          current_period_end: null,
          cancel_at_period_end: false,
        })
      })
    })

    describe('invoice.payment_succeeded', () => {
      it('should update subscription after successful payment', async () => {
        const event = {
          type: 'invoice.payment_succeeded',
          data: {
            object: {
              id: 'in_test_123',
              customer: 'cus_test_123',
              subscription: 'sub_test_123',
              amount_paid: 1900,
              currency: 'usd',
            },
          },
        }

        mockStripe.webhooks.constructEvent.mockReturnValue(event)
        mockStripe.subscriptions.retrieve.mockResolvedValue({
          id: 'sub_test_123',
          status: 'active',
          current_period_end: 1234567890,
          items: {
            data: [{
              price: {
                id: 'price_premium',
              },
            }],
          },
        })

        const payload = JSON.stringify(event)
        const signature = generateWebhookSignature(payload, process.env.STRIPE_WEBHOOK_SECRET!)

        await request(server)
          .post('/stripe/webhook')
          .set('stripe-signature', signature)
          .send(payload)
          .expect(200)

        expect(mockSupabase.update).toHaveBeenCalledWith({
          subscription_status: 'active',
          current_period_end: expect.any(Date),
        })
      })
    })

    describe('invoice.payment_failed', () => {
      it('should update subscription status to past_due', async () => {
        const event = {
          type: 'invoice.payment_failed',
          data: {
            object: {
              id: 'in_test_123',
              customer: 'cus_test_123',
              subscription: 'sub_test_123',
            },
          },
        }

        mockStripe.webhooks.constructEvent.mockReturnValue(event)

        const payload = JSON.stringify(event)
        const signature = generateWebhookSignature(payload, process.env.STRIPE_WEBHOOK_SECRET!)

        await request(server)
          .post('/stripe/webhook')
          .set('stripe-signature', signature)
          .send(payload)
          .expect(200)

        expect(mockSupabase.update).toHaveBeenCalledWith({
          subscription_status: 'past_due',
        })
      })
    })

    it('should handle unknown event types gracefully', async () => {
      const event = {
        type: 'unknown.event.type',
        data: {
          object: {
            id: 'test_123',
          },
        },
      }

      mockStripe.webhooks.constructEvent.mockReturnValue(event)

      const payload = JSON.stringify(event)
      const signature = generateWebhookSignature(payload, process.env.STRIPE_WEBHOOK_SECRET!)

      const response = await request(server)
        .post('/stripe/webhook')
        .set('stripe-signature', signature)
        .send(payload)
        .expect(200)

      expect(response.body).toEqual({ received: true })
      expect(mockSupabase.update).not.toHaveBeenCalled()
      expect(mockSupabase.insert).not.toHaveBeenCalled()
    })

    it('should handle database errors gracefully', async () => {
      const event = {
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_test_123',
            customer: 'cus_test_123',
            subscription: 'sub_test_123',
            metadata: {
              userId: 'user_123',
            },
          },
        },
      }

      mockStripe.webhooks.constructEvent.mockReturnValue(event)
      mockSupabase.single.mockRejectedValueOnce(new Error('Database error'))

      const payload = JSON.stringify(event)
      const signature = generateWebhookSignature(payload, process.env.STRIPE_WEBHOOK_SECRET!)

      const response = await request(server)
        .post('/stripe/webhook')
        .set('stripe-signature', signature)
        .send(payload)
        .expect(500)

      expect(response.body.error).toContain('Failed to process webhook')
    })
  })
}) 