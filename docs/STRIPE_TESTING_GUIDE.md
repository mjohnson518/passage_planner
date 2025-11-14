# Stripe Integration Testing Guide

## Overview

This guide walks through testing the complete Stripe billing integration for Helmwise.

## Prerequisites

1. **Stripe Account**
   - Sign up at https://stripe.com
   - Use test mode for development

2. **Test API Keys**
   - Navigate to: https://dashboard.stripe.com/test/apikeys
   - Copy Publishable key (starts with `pk_test_`)
   - Copy Secret key (starts with `sk_test_`)

3. **Create Test Products**

### Creating Products in Stripe Dashboard

1. Go to: https://dashboard.stripe.com/test/products
2. Click "Add product"

**Premium Tier:**
- Name: "Helmwise Premium"
- Description: "Advanced passage planning tools"
- Pricing:
  - Monthly: $19/month (recurring)
  - Yearly: $190/year (recurring)
- Copy the Price IDs (start with `price_`)

**Pro Tier:**
- Name: "Helmwise Pro"
- Description: "Professional fleet management"
- Pricing:
  - Monthly: $49/month (recurring)
  - Yearly: $490/year (recurring)
- Copy the Price IDs

## Environment Variable Configuration

Add to `.env.local` (frontend):

```bash
# Stripe Public Keys (safe to expose in frontend)
NEXT_PUBLIC_STRIPE_PREMIUM_MONTHLY=price_xxxxx
NEXT_PUBLIC_STRIPE_PREMIUM_YEARLY=price_xxxxx
NEXT_PUBLIC_STRIPE_PRO_MONTHLY=price_xxxxx
NEXT_PUBLIC_STRIPE_PRO_YEARLY=price_xxxxx

# App URLs
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_ORCHESTRATOR_URL=http://localhost:8080
```

Add to `.env` or orchestrator `.env.local` (backend/orchestrator):

```bash
# Stripe Secret Keys (NEVER expose in frontend)
STRIPE_SECRET_KEY=sk_test_xxxxx
STRIPE_PUBLISHABLE_KEY=pk_test_xxxxx

# Price IDs (backend needs these to validate/create sessions)
STRIPE_PREMIUM_MONTHLY_PRICE_ID=price_xxxxx
STRIPE_PREMIUM_YEARLY_PRICE_ID=price_xxxxx
STRIPE_PRO_MONTHLY_PRICE_ID=price_xxxxx
STRIPE_PRO_YEARLY_PRICE_ID=price_xxxxx

# Webhook configuration
STRIPE_WEBHOOK_SECRET=whsec_xxxxx
```

## Testing the Checkout Flow

### Step 1: Start the Development Servers

```bash
# Terminal 1: Start orchestrator
cd orchestrator
npm run dev

# Terminal 2: Start frontend
cd frontend
npm run dev
```

### Step 2: Navigate to Pricing Page

1. Open: http://localhost:3000/pricing
2. Ensure you're logged in (if not, sign up/login first)
3. Toggle between Monthly/Yearly to see pricing changes

### Step 3: Initiate Checkout

1. Click "Start Free Trial" or "Subscribe" on Premium or Pro tier
2. Verify:
   - Loading spinner appears
   - Page redirects to Stripe checkout (stripe.com domain)
   - Stripe checkout page shows correct product and price

### Step 4: Complete Test Payment

Use Stripe test card numbers:

**Successful Payment:**
- Card: `4242 4242 4242 4242`
- Expiry: Any future date (e.g., 12/34)
- CVC: Any 3 digits (e.g., 123)
- ZIP: Any 5 digits (e.g., 12345)

**Other Test Cards:**
- Decline: `4000 0000 0000 0002`
- Insufficient funds: `4000 0000 0000 9995`
- 3D Secure required: `4000 0025 0000 3155`

### Step 5: Verify Redirect

After successful payment:
- Should redirect to: `http://localhost:3000/dashboard?payment=success`
- Check browser console for any errors
- Verify subscription status in database

### Step 6: Test Cancellation

1. Start checkout again
2. Click browser back button or Stripe's cancel link
3. Should redirect to: `http://localhost:3000/pricing?payment=cancelled`

## Testing the Customer Portal

### Setup

Customer Portal requires a customer with an active subscription.

1. Complete a test checkout first (creates Stripe customer)
2. Navigate to profile/settings page
3. Click "Manage Subscription" or "Billing"

### Expected Behavior

- Redirects to Stripe Customer Portal
- User can:
  - Update payment method
  - Cancel subscription
  - View billing history
  - Download invoices

**Note:** Backend endpoint may need implementation. Check if `/api/subscription/customer-portal` exists in orchestrator.

## Webhook Testing

Webhooks are critical for subscription updates (renewals, cancellations, payment failures).

### Local Webhook Testing with Stripe CLI

1. Install Stripe CLI:
   ```bash
   brew install stripe/stripe-cli/stripe
   ```

2. Login to Stripe:
   ```bash
   stripe login
   ```

3. Forward webhooks to local orchestrator:
   ```bash
   stripe listen --forward-to http://localhost:8080/api/webhooks/stripe
   ```

4. Copy the webhook signing secret (starts with `whsec_`)
5. Add to orchestrator `.env`:
   ```bash
   STRIPE_WEBHOOK_SECRET=whsec_xxxxx
   ```

### Critical Webhook Events to Test

**Test these events:**

1. `checkout.session.completed`
   - User completes payment
   - Subscription should activate in database
   - User gains access to premium features

2. `customer.subscription.updated`
   - Subscription plan changed
   - Payment method updated
   - Billing cycle changed

3. `customer.subscription.deleted`
   - Subscription cancelled
   - User downgraded to free tier
   - Access restrictions applied

4. `invoice.payment_succeeded`
   - Recurring payment processed
   - Subscription renewed

5. `invoice.payment_failed`
   - Payment method declined
   - Send notification to user
   - Retry logic triggered

### Triggering Test Events

```bash
# Simulate successful payment
stripe trigger checkout.session.completed

# Simulate failed payment
stripe trigger invoice.payment_failed

# Simulate subscription cancellation
stripe trigger customer.subscription.deleted
```

## Verification Checklist

### Frontend Tests
- [ ] Pricing page loads without errors
- [ ] Monthly/yearly toggle works
- [ ] Subscribe buttons are functional
- [ ] Loading states display correctly
- [ ] Error messages display when API fails
- [ ] Successful redirect to Stripe checkout
- [ ] Cancel redirect works correctly
- [ ] Success redirect works correctly

### Backend Tests
- [ ] Orchestrator `/api/subscription/create-checkout-session` endpoint responds
- [ ] Endpoint validates tier and period
- [ ] Endpoint requires authentication
- [ ] Stripe session is created successfully
- [ ] Session URL is returned
- [ ] Webhook endpoint receives events
- [ ] Webhook signature is validated
- [ ] Database updates on subscription events

### Database Verification
- [ ] User record updated with `stripe_customer_id`
- [ ] Subscription record created in database
- [ ] Subscription tier and status are correct
- [ ] Billing period is recorded
- [ ] Timestamps are accurate

### Security Tests
- [ ] Unauthenticated requests are rejected
- [ ] Invalid tier values are rejected
- [ ] Invalid period values are rejected
- [ ] Webhook signatures are validated
- [ ] Stripe secret keys are never exposed to frontend
- [ ] HTTPS required in production

## Common Issues & Solutions

### Issue: "No checkout URL received"
**Cause:** Orchestrator endpoint may not be running or returning correct format
**Solution:** Check orchestrator logs, verify Stripe keys are configured

### Issue: "Unauthorized" error
**Cause:** Auth token not present or expired
**Solution:** Check localStorage for `auth_token`, re-login if needed

### Issue: Webhook events not received
**Cause:** Stripe CLI not forwarding or wrong endpoint
**Solution:** Verify `stripe listen` is running and forwarding to correct URL

### Issue: Subscription not activated after payment
**Cause:** Webhook handler not updating database
**Solution:** Check webhook logs, verify event handler is working

## Production Deployment

### Before Going Live

1. **Switch to Live Mode Keys**
   - Replace all `pk_test_` and `sk_test_` with live keys
   - Replace all `price_test_` IDs with live price IDs

2. **Configure Production Webhook**
   - Go to: https://dashboard.stripe.com/webhooks
   - Add endpoint: `https://api.helmwise.co/api/webhooks/stripe`
   - Select events:
     - `checkout.session.completed`
     - `customer.subscription.created`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `invoice.payment_succeeded`
     - `invoice.payment_failed`
   - Copy webhook signing secret
   - Add to production environment variables

3. **Test Live Mode with $0.50 Test**
   - Create a $0.50 test product
   - Complete full checkout flow
   - Verify webhook delivery
   - Refund the test payment

4. **Monitor First Real Transactions**
   - Watch Stripe dashboard
   - Monitor orchestrator logs
   - Verify database updates
   - Test user access to paid features

## Support Resources

- Stripe Testing Documentation: https://stripe.com/docs/testing
- Stripe Webhook Testing: https://stripe.com/docs/webhooks/test
- Stripe CLI: https://stripe.com/docs/stripe-cli

## Contact

For Stripe integration issues, check:
1. Orchestrator logs: `/var/log/orchestrator.log`
2. Stripe dashboard events log
3. Database subscription tables
4. Frontend browser console

