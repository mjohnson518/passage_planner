/**
 * StripeService webhook handler tests.
 *
 * REVENUE-CRITICAL: these paths decide whether a paid customer's
 * subscription actually activates. A silent regression here means the
 * user pays Stripe but never gets entitled in our DB.
 *
 * Scope:
 *   - signature verification failure → throws "Invalid webhook signature"
 *   - checkout.session.completed → subscription payload (incl. founding)
 *   - checkout.session.completed → top_up payload (one-time payment mode)
 *   - checkout.session.completed with no userId → undefined
 *   - customer.subscription.updated → tier/status/period payload
 *   - price-ID → tier mapping (premium/pro/free fallback)
 *   - customer.subscription.deleted → canceled payload
 *   - invoice.payment_failed → past_due payload
 *   - invoice.payment_succeeded → invoice_paid payload
 *   - unhandled event type → undefined (forward compat)
 *
 * Strategy: we don't mock the `stripe` module — we instantiate
 * StripeService with a dummy key (the Stripe SDK accepts any string at
 * construction time) and then overwrite the private `stripe` field
 * with a stub that exposes just the `webhooks.constructEvent` spy
 * `handleWebhook` needs. This sidesteps `resetMocks`/`restoreMocks`
 * interactions with `jest.mock` module factories.
 */

import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import pino from "pino";

// Price IDs must be set before `new StripeService()` — they are
// captured in a `readonly` field at construction time.
process.env.STRIPE_SECRET_KEY = "sk_test_fake";
process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_fake";
process.env.STRIPE_PREMIUM_MONTHLY_PRICE_ID = "price_premium_m";
process.env.STRIPE_PREMIUM_YEARLY_PRICE_ID = "price_premium_y";
process.env.STRIPE_PRO_MONTHLY_PRICE_ID = "price_pro_m";
process.env.STRIPE_PRO_YEARLY_PRICE_ID = "price_pro_y";

import { StripeService } from "../StripeService";

describe("StripeService.handleWebhook", () => {
  let service: StripeService;
  let constructEvent: jest.Mock;
  const logger = pino({ level: "silent" });
  const signature = "t=1,v1=fakesig";
  const payload = Buffer.from('{"id":"evt_test"}');

  beforeEach(() => {
    service = new StripeService(logger);
    constructEvent = jest.fn();
    // Replace the real SDK with a minimal stub. handleWebhook only
    // touches `stripe.webhooks.constructEvent`; everything else stays
    // on the real (unused) SDK instance.
    (service as any).stripe = {
      webhooks: { constructEvent },
    };
  });

  it('throws "Invalid webhook signature" when signature verification fails', async () => {
    constructEvent.mockImplementation(() => {
      throw new Error("No signatures found matching the expected signature");
    });

    await expect(service.handleWebhook(signature, payload)).rejects.toThrow(
      "Invalid webhook signature",
    );
  });

  it("dispatches checkout.session.completed (subscription mode) to subscription payload", async () => {
    constructEvent.mockReturnValue({
      id: "evt_1",
      type: "checkout.session.completed",
      data: {
        object: {
          mode: "subscription",
          customer: "cus_123",
          subscription: "sub_123",
          metadata: { userId: "user_abc", founding: "true" },
        },
      },
    });

    const result = await service.handleWebhook(signature, payload);

    expect(result).toEqual({
      type: "subscription",
      userId: "user_abc",
      stripeCustomerId: "cus_123",
      stripeSubscriptionId: "sub_123",
      status: "active",
      founding: true,
    });
  });

  it("dispatches checkout.session.completed (payment mode) to top_up payload", async () => {
    constructEvent.mockReturnValue({
      id: "evt_2",
      type: "checkout.session.completed",
      data: {
        object: {
          mode: "payment",
          metadata: { userId: "user_abc", type: "top_up", pack: "large" },
        },
      },
    });

    const result = await service.handleWebhook(signature, payload);

    expect(result).toEqual({
      type: "top_up",
      userId: "user_abc",
      pack: "large",
    });
  });

  it("returns undefined for checkout.session.completed with no userId (nothing to credit)", async () => {
    constructEvent.mockReturnValue({
      id: "evt_3",
      type: "checkout.session.completed",
      data: {
        object: {
          mode: "subscription",
          customer: "cus_456",
          subscription: "sub_456",
          metadata: {},
        },
      },
    });

    const result = await service.handleWebhook(signature, payload);
    expect(result).toBeUndefined();
  });

  it("maps customer.subscription.updated to tier/status/period payload", async () => {
    const now = Math.floor(Date.now() / 1000);
    constructEvent.mockReturnValue({
      id: "evt_4",
      type: "customer.subscription.updated",
      data: {
        object: {
          metadata: { userId: "user_abc" },
          status: "active",
          current_period_start: now,
          current_period_end: now + 2592000,
          cancel_at_period_end: false,
          items: { data: [{ price: { id: "price_premium_m" } }] },
        },
      },
    });

    const result = (await service.handleWebhook(signature, payload)) as any;

    expect(result.userId).toBe("user_abc");
    expect(result.tier).toBe("premium");
    expect(result.status).toBe("active");
    expect(result.cancelAtPeriodEnd).toBe(false);
    expect(result.currentPeriodStart).toBeInstanceOf(Date);
    expect(result.currentPeriodEnd).toBeInstanceOf(Date);
  });

  it("maps pro price IDs to the pro tier", async () => {
    constructEvent.mockReturnValue({
      id: "evt_5",
      type: "customer.subscription.updated",
      data: {
        object: {
          metadata: { userId: "user_abc" },
          status: "active",
          items: { data: [{ price: { id: "price_pro_y" } }] },
        },
      },
    });

    const result = (await service.handleWebhook(signature, payload)) as any;
    expect(result.tier).toBe("pro");
  });

  it("falls back to the free tier on unknown price IDs (guards against dashboard drift)", async () => {
    constructEvent.mockReturnValue({
      id: "evt_6",
      type: "customer.subscription.updated",
      data: {
        object: {
          metadata: { userId: "user_abc" },
          status: "active",
          items: { data: [{ price: { id: "price_renamed_in_dashboard" } }] },
        },
      },
    });

    const result = (await service.handleWebhook(signature, payload)) as any;
    expect(result.tier).toBe("free");
  });

  it("maps customer.subscription.deleted to canceled payload", async () => {
    constructEvent.mockReturnValue({
      id: "evt_7",
      type: "customer.subscription.deleted",
      data: {
        object: {
          metadata: { userId: "user_abc" },
          status: "canceled",
        },
      },
    });

    const result = (await service.handleWebhook(signature, payload)) as any;

    expect(result.userId).toBe("user_abc");
    expect(result.status).toBe("canceled");
    expect(result.canceledAt).toBeInstanceOf(Date);
  });

  it("maps invoice.payment_failed to past_due payload with userId from subscription metadata", async () => {
    constructEvent.mockReturnValue({
      id: "evt_8",
      type: "invoice.payment_failed",
      data: {
        object: {
          customer: "cus_123",
          subscription: "sub_123",
          subscription_details: { metadata: { userId: "user_abc" } },
        },
      },
    });

    const result = (await service.handleWebhook(signature, payload)) as any;

    expect(result.type).toBe("payment_failed");
    expect(result.status).toBe("past_due");
    expect(result.userId).toBe("user_abc");
    expect(result.customerId).toBe("cus_123");
  });

  it("maps invoice.payment_succeeded to invoice_paid payload", async () => {
    constructEvent.mockReturnValue({
      id: "evt_9",
      type: "invoice.payment_succeeded",
      data: {
        object: {
          subscription_details: { metadata: { userId: "user_abc" } },
        },
      },
    });

    const result = await service.handleWebhook(signature, payload);
    expect(result).toEqual({ type: "invoice_paid", userId: "user_abc" });
  });

  it("returns undefined for unhandled event types (forward compat)", async () => {
    constructEvent.mockReturnValue({
      id: "evt_10",
      type: "customer.updated", // not in the dispatch switch
      data: { object: {} },
    });

    const result = await service.handleWebhook(signature, payload);
    expect(result).toBeUndefined();
  });
});
