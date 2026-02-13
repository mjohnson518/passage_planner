'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Check, X, Zap, Ship, Anchor, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import { config } from '@/config'

interface PricingTier {
  name: string
  monthlyPrice: number
  yearlyPrice: number
  description: string
  features: string[]
  notIncluded?: string[]
  cta: string
  popular?: boolean
  priceId: {
    monthly: string
    yearly: string
  }
}

const tiers: PricingTier[] = [
  {
    name: 'Free',
    monthlyPrice: 0,
    yearlyPrice: 0,
    description: 'Perfect for casual sailors planning occasional trips',
    features: [
      '2 passages per month',
      '3-day weather forecast',
      'Basic route planning',
      'Tide predictions',
      'Community support',
      'Mobile web access',
    ],
    notIncluded: [
      'GPX/KML export',
      'Advanced weather routing',
      'API access',
      'Priority support',
    ],
    cta: 'Get Started',
    priceId: {
      monthly: '',
      yearly: '',
    },
  },
  {
    name: 'Premium',
    monthlyPrice: 19,
    yearlyPrice: 190,
    description: 'For serious cruisers who need advanced planning tools',
    features: [
      'Unlimited passages',
      '7-day weather forecast',
      'All AI agents access',
      'GPX/KML export',
      'Weather routing',
      'Offline charts',
      'Email support',
      'Mobile app (coming soon)',
    ],
    notIncluded: [
      'API access',
      'Fleet management',
      'Custom agents',
    ],
    cta: 'Start Free Trial',
    popular: true,
    priceId: {
      monthly: process.env.NEXT_PUBLIC_STRIPE_PREMIUM_MONTHLY!,
      yearly: process.env.NEXT_PUBLIC_STRIPE_PREMIUM_YEARLY!,
    },
  },
  {
    name: 'Pro',
    monthlyPrice: 49,
    yearlyPrice: 490,
    description: 'For professionals managing multiple vessels',
    features: [
      'Everything in Premium',
      'API access (1000 calls/day)',
      'Fleet management',
      'Custom AI agents',
      '10-day weather forecast',
      'Priority support',
      'Advanced analytics',
      'White-label options',
      'Dedicated account manager',
    ],
    cta: 'Start Free Trial',
    priceId: {
      monthly: process.env.NEXT_PUBLIC_STRIPE_PRO_MONTHLY!,
      yearly: process.env.NEXT_PUBLIC_STRIPE_PRO_YEARLY!,
    },
  },
]

export default function PricingPage() {
  const [isYearly, setIsYearly] = useState(false)
  const [loading, setLoading] = useState<string | null>(null)
  const { user } = useAuth()
  const router = useRouter()

  const handleSubscribe = async (tier: PricingTier, period: 'monthly' | 'yearly') => {
    if (!user) {
      router.push('/signup')
      return
    }

    if (tier.name === 'Free') {
      router.push('/dashboard')
      return
    }

    setLoading(tier.name)

    try {
      // Get auth token from localStorage
      const authToken = localStorage.getItem('auth_token')
      
      if (!authToken) {
        console.error('No auth token found')
        router.push('/login')
        return
      }

      const response = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          tier: tier.name.toLowerCase(),
          period,
          successUrl: `${window.location.origin}/dashboard?payment=success`,
          cancelUrl: `${window.location.origin}/pricing?payment=cancelled`
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        console.error('Checkout session creation failed:', errorData)
        throw new Error(errorData.error || 'Failed to create checkout session')
      }

      const { url } = await response.json()
      
      if (!url) {
        throw new Error('No checkout URL received')
      }
      
      // Redirect to Stripe checkout
      window.location.href = url
    } catch (error) {
      console.error('Subscription error:', error)
      // Show error to user (could use toast here)
      alert(error instanceof Error ? error.message : 'Failed to start checkout process')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20">
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
            <span className={cn(
              'font-medium transition-colors',
              !isYearly ? 'text-primary' : 'text-muted-foreground'
            )}>
              Monthly
            </span>
            <Switch
              checked={isYearly}
              onCheckedChange={setIsYearly}
              className="data-[state=checked]:bg-primary"
            />
            <span className={cn(
              'font-medium transition-colors',
              isYearly ? 'text-primary' : 'text-muted-foreground'
            )}>
              Yearly
              <span className="ml-2 text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                Save 20%
              </span>
            </span>
          </div>
        </div>
      </div>

      {/* Pricing Cards */}
      <div className="container mx-auto px-4 pb-20">
        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {tiers.map((tier) => {
            const price = isYearly ? tier.yearlyPrice : tier.monthlyPrice
            const period = isYearly ? 'yearly' : 'monthly'
            const displayPrice = tier.name === 'Free' ? 0 : price

            return (
              <div
                key={tier.name}
                className={cn(
                  'relative rounded-lg border bg-card p-8 shadow-sm transition-all hover:shadow-lg',
                  tier.popular && 'border-primary shadow-lg scale-105 mt-4'
                )}
              >
                {tier.popular && (
                  <div className="absolute -top-4 left-0 right-0 flex justify-center">
                    <span className="bg-primary text-primary-foreground text-sm font-medium px-3 py-1 rounded-full">
                      Most Popular
                    </span>
                  </div>
                )}

                <div className="mb-6">
                  <h3 className="text-2xl font-bold mb-2">{tier.name}</h3>
                  <p className="text-muted-foreground text-sm mb-4">
                    {tier.description}
                  </p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold">${displayPrice}</span>
                    {tier.name !== 'Free' && (
                      <span className="text-muted-foreground">
                        /{isYearly ? 'year' : 'month'}
                      </span>
                    )}
                  </div>
                  {isYearly && tier.name !== 'Free' && (
                    <p className="text-sm text-green-600 mt-1">
                      ${tier.monthlyPrice * 12 - tier.yearlyPrice} saved annually
                    </p>
                  )}
                </div>

                <Button
                  fullWidth
                  variant={tier.popular ? 'default' : 'outline'}
                  onClick={() => handleSubscribe(tier, period)}
                  disabled={loading === tier.name}
                  className={tier.popular ? 'btn-primary' : ''}
                >
                  {loading === tier.name ? (
                    <span className="flex items-center">
                      <span className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full mr-2" />
                      Processing...
                    </span>
                  ) : (
                    tier.cta
                  )}
                </Button>

                <div className="mt-6 space-y-3">
                  {tier.features.map((feature) => (
                    <div key={feature} className="flex items-start gap-3">
                      <Check className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <span className="text-sm">{feature}</span>
                    </div>
                  ))}
                  {tier.notIncluded?.map((feature) => (
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

      {/* FAQ Section */}
      <div className="container mx-auto px-4 py-20 border-t">
        <h2 className="text-3xl font-bold text-center mb-12">
          Frequently Asked Questions
        </h2>
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
        <Info className={cn(
          'h-5 w-5 transition-transform',
          isOpen && 'rotate-180'
        )} />
      </button>
      {isOpen && (
        <p className="mt-4 text-muted-foreground">{answer}</p>
      )}
    </div>
  )
} 