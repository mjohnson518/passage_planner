'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Check, X, Zap, Ship, Anchor, Info, Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import { PLANS, TOP_UP_PACKS, FOUNDING_MEMBER } from '@/lib/plans'

// Annual savings percentage derived from PLANS (not hardcoded)
const ANNUAL_SAVE_PERCENT = Math.round(
  ((PLANS.premium.price.monthly * 12 - PLANS.premium.price.annual!) /
    (PLANS.premium.price.monthly * 12)) *
    100
)

const TIER_DESCRIPTIONS: Record<string, string> = {
  free: 'Perfect for casual sailors planning occasional trips',
  premium: 'For serious cruisers who need advanced planning tools',
  pro: 'For professionals managing multiple vessels',
  enterprise: 'Custom solutions for marinas and large fleets',
}

const TIER_FEATURE_LABELS: Record<string, string[]> = {
  free: [
    `${PLANS.free.limits.passagesPerMonth} passages per month`,
    `${PLANS.free.limits.forecastDays}-day weather forecast`,
    'Basic route planning',
    'Tide predictions',
    `${PLANS.free.features.support} support`,
    'Mobile web access',
  ],
  premium: [
    'Unlimited passages',
    `${PLANS.premium.limits.forecastDays}-day weather forecast`,
    'All AI agents access',
    'GPX/KML/PDF export',
    'Weather routing',
    'Offline charts',
    `${PLANS.premium.features.support} support`,
    'Mobile app (coming soon)',
  ],
  pro: [
    'Everything in Premium',
    `API access (${PLANS.pro.limits.apiCallsPerDay} calls/day)`,
    'Fleet management',
    'Custom AI agents',
    `${PLANS.pro.limits.forecastDays}-day weather forecast`,
    `${PLANS.pro.features.support} support`,
    'Advanced analytics',
    'Dedicated account manager',
  ],
}

const TIER_NOT_INCLUDED: Record<string, string[]> = {
  free: ['GPX/KML export', 'Advanced weather routing', 'API access', 'Priority support'],
  premium: ['API access', 'Fleet management', 'Custom agents'],
  pro: [],
}

export default function PricingPage() {
  const [isYearly, setIsYearly] = useState(false)
  const [loading, setLoading] = useState<string | null>(null)
  const [foundingSpots, setFoundingSpots] = useState<number | null>(null)
  const { user } = useAuth()
  const router = useRouter()

  useEffect(() => {
    fetch('/api/founding-member/spots-remaining')
      .then(r => r.json())
      .then(d => setFoundingSpots(d.remaining ?? 0))
      .catch(() => setFoundingSpots(0))
  }, [])

  const handleSubscribe = async (
    tier: string,
    period: 'monthly' | 'annual',
    founding = false
  ) => {
    if (!user) {
      router.push('/signup')
      return
    }
    if (tier === 'free') {
      router.push('/dashboard')
      return
    }

    setLoading(tier)
    try {
      const response = await fetch('/api/subscription/create-checkout-session', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier, period, founding }),
      })

      if (!response.ok) {
        const errorData = await response.json()

        if (response.status === 409 && errorData.action === 'open_customer_portal') {
          const portalRes = await fetch('/api/stripe/customer-portal', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ returnUrl: `${window.location.origin}/profile` }),
          })
          if (portalRes.ok) {
            const { url } = await portalRes.json()
            window.location.href = url
            return
          }
        }

        throw new Error(errorData.message || errorData.error || 'Failed to create checkout session')
      }

      const { sessionUrl } = await response.json()
      if (!sessionUrl) throw new Error('No checkout URL received')
      window.location.href = sessionUrl
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to start checkout process')
    } finally {
      setLoading(null)
    }
  }

  const handleTopUp = async (pack: 'small' | 'large') => {
    if (!user) { router.push('/signup'); return }
    setLoading(`topup_${pack}`)
    try {
      const response = await fetch('/api/subscription/purchase-top-up', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pack }),
      })
      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || 'Failed to start top-up checkout')
      }
      const { sessionUrl } = await response.json()
      window.location.href = sessionUrl
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to start checkout process')
    } finally {
      setLoading(null)
    }
  }

  const displayTiers = ['free', 'premium', 'pro'] as const

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20">
      {/* Founding Member Banner */}
      {foundingSpots !== null && foundingSpots > 0 && (
        <div className="bg-warning text-warning-foreground text-center py-3 px-4">
          <span className="font-bold">
            <Star className="inline h-4 w-4 mr-1" />
            Founding Member Special — Only {foundingSpots} of {FOUNDING_MEMBER.totalSpots} spots left!
          </span>{' '}
          Premium annual at{' '}
          <span className="line-through opacity-75">${PLANS.premium.price.annual}/yr</span>{' '}
          <span className="font-bold">${FOUNDING_MEMBER.discountedPrice}/yr</span> — first year.{' '}
          <button
            onClick={() => handleSubscribe('premium', 'annual', true)}
            className="underline font-bold hover:no-underline"
          >
            Claim your spot →
          </button>
        </div>
      )}

      {/* Header */}
      <div className="container mx-auto px-4 pt-16 pb-8">
        <div className="text-center max-w-3xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-bold mb-4 text-gradient">
            Simple, Transparent Pricing
          </h1>
          <p className="text-xl text-muted-foreground mb-8">
            Choose the perfect plan for your sailing adventures.
            Start with our free tier and upgrade as you grow.
          </p>

          {/* Billing Toggle */}
          <div className="flex items-center justify-center gap-4 mb-12">
            <span className={cn('font-medium transition-colors', !isYearly ? 'text-primary' : 'text-muted-foreground')}>
              Monthly
            </span>
            <Switch
              checked={isYearly}
              onCheckedChange={setIsYearly}
              className="data-[state=checked]:bg-primary"
            />
            <span className={cn('font-medium transition-colors', isYearly ? 'text-primary' : 'text-muted-foreground')}>
              Yearly
              <span className="ml-2 text-xs bg-success/10 text-success px-2 py-1 rounded-full">
                Save {ANNUAL_SAVE_PERCENT}%
              </span>
            </span>
          </div>
        </div>
      </div>

      {/* Pricing Cards */}
      <div className="container mx-auto px-4 pb-20">
        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {displayTiers.map((key) => {
            const plan = PLANS[key]
            const isPopular = key === 'premium'
            const monthlyPrice = plan.price.monthly ?? 0
            const annualPrice = plan.price.annual

            const displayPrice = isYearly
              ? (annualPrice ?? 0)
              : monthlyPrice

            const isFree = key === 'free'
            const cta = isFree ? 'Get Started' : 'Start Free Trial'

            // Show founding member annual price if applicable
            const showFoundingAnnual =
              isYearly &&
              key === FOUNDING_MEMBER.appliesToTier &&
              foundingSpots !== null &&
              foundingSpots > 0

            return (
              <div
                key={key}
                className={cn(
                  'relative rounded-lg border bg-card p-8 shadow-sm transition-all hover:shadow-lg',
                  isPopular && 'border-primary shadow-lg scale-105 mt-4'
                )}
              >
                {isPopular && (
                  <div className="absolute -top-4 left-0 right-0 flex justify-center">
                    <span className="bg-primary text-primary-foreground text-sm font-medium px-3 py-1 rounded-full">
                      Most Popular
                    </span>
                  </div>
                )}

                <div className="mb-6">
                  <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
                  <p className="text-muted-foreground text-sm mb-4">
                    {TIER_DESCRIPTIONS[key]}
                  </p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold">${displayPrice}</span>
                    {!isFree && (
                      <span className="text-muted-foreground">
                        /{isYearly ? 'year' : 'month'}
                      </span>
                    )}
                  </div>
                  {isYearly && !isFree && annualPrice !== null && (
                    <p className="text-sm text-success mt-1">
                      ${monthlyPrice * 12 - annualPrice} saved annually
                    </p>
                  )}
                  {showFoundingAnnual && (
                    <p className="text-sm text-warning mt-1 font-medium">
                      Founding member: <span className="line-through">${annualPrice}/yr</span>{' '}
                      <span className="font-bold">${FOUNDING_MEMBER.discountedPrice}/yr</span> first year
                    </p>
                  )}
                </div>

                <Button
                  fullWidth
                  variant={isPopular ? 'default' : 'outline'}
                  onClick={() =>
                    handleSubscribe(
                      key,
                      isYearly ? 'annual' : 'monthly',
                      showFoundingAnnual
                    )
                  }
                  disabled={loading === key}
                  className={isPopular ? 'btn-primary' : ''}
                >
                  {loading === key ? (
                    <span className="flex items-center">
                      <span className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full mr-2" />
                      Processing...
                    </span>
                  ) : (
                    cta
                  )}
                </Button>

                <div className="mt-6 space-y-3">
                  {(TIER_FEATURE_LABELS[key] ?? []).map((feature) => (
                    <div key={feature} className="flex items-start gap-3">
                      <Check className="h-5 w-5 text-success flex-shrink-0 mt-0.5" />
                      <span className="text-sm">{feature}</span>
                    </div>
                  ))}
                  {(TIER_NOT_INCLUDED[key] ?? []).map((feature) => (
                    <div key={feature} className="flex items-start gap-3 opacity-50">
                      <X className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                      <span className="text-sm line-through">{feature}</span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Top-Up Passage Packs (authenticated paid users) */}
      {user && (
        <div className="container mx-auto px-4 pb-20">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-2xl font-bold text-center mb-4">Need More Passages?</h2>
            <p className="text-center text-muted-foreground mb-8">
              One-time passage packs for Premium and Pro subscribers. No subscription change required.
            </p>
            <div className="grid md:grid-cols-2 gap-6 max-w-2xl mx-auto">
              {(Object.entries(TOP_UP_PACKS) as [string, { passages: number; price: number }][]).map(
                ([key, pack]) => (
                  <div key={key} className="rounded-lg border bg-card p-6 text-center shadow-sm">
                    <div className="text-3xl font-bold mb-1">{pack.passages} Passages</div>
                    <div className="text-2xl font-semibold text-primary mb-4">${pack.price}</div>
                    <p className="text-sm text-muted-foreground mb-4">
                      ${(pack.price / pack.passages).toFixed(2)} per passage — never expires
                    </p>
                    <Button
                      variant="outline"
                      onClick={() => handleTopUp(key as 'small' | 'large')}
                      disabled={loading === `topup_${key}`}
                    >
                      {loading === `topup_${key}` ? 'Processing...' : 'Buy Now'}
                    </Button>
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      )}

      {/* FAQ Section */}
      <div className="container mx-auto px-4 py-20 border-t">
        <h2 className="text-3xl font-bold text-center mb-12">Frequently Asked Questions</h2>
        <div className="max-w-3xl mx-auto space-y-8">
          <FAQItem
            question="Can I change plans anytime?"
            answer="Yes! You can upgrade or downgrade your plan at any time. Changes take effect at the next billing cycle."
          />
          <FAQItem
            question="Is there a free trial?"
            answer="Yes, both Premium and Pro plans come with a 14-day free trial. No credit card required to start."
          />
          <FAQItem
            question="What payment methods do you accept?"
            answer="We accept all major credit cards, debit cards, and PayPal through our secure payment processor, Stripe."
          />
          <FAQItem
            question="Can I cancel my subscription?"
            answer="Absolutely. You can cancel your subscription at any time from your account settings. You'll continue to have access until the end of your billing period."
          />
          <FAQItem
            question="Do you offer discounts for sailing clubs?"
            answer="Yes! We offer special pricing for sailing clubs, marinas, and educational institutions. Contact us for details."
          />
          <FAQItem
            question="What are passage packs?"
            answer="Passage packs are one-time top-ups that give you extra passages beyond your plan's monthly limit. They never expire and are available to Premium and Pro subscribers."
          />
        </div>
      </div>

      {/* Enterprise CTA */}
      <div className="container mx-auto px-4 py-20">
        <div className="max-w-4xl mx-auto bg-gradient-to-r from-primary/10 to-primary/5 rounded-lg p-8 text-center">
          <Ship className="h-12 w-12 text-primary mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-4">Need a Custom Solution?</h2>
          <p className="text-muted-foreground mb-6">
            For marinas, charter companies, or large fleets, we offer custom enterprise plans
            with dedicated support, custom integrations, and volume pricing.
          </p>
          <Button size="lg" className="btn-primary">
            Contact Sales
          </Button>
        </div>
      </div>
    </div>
  )
}

function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="border rounded-lg p-4">
      <button
        className="w-full flex items-center justify-between text-left"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="font-medium">{question}</span>
        <Info className={cn('h-5 w-5 transition-transform', isOpen && 'rotate-180')} />
      </button>
      {isOpen && <p className="mt-4 text-muted-foreground">{answer}</p>}
    </div>
  )
}
