import Link from 'next/link'
import { Button } from '../ui/button'
import { Check, Sparkles, Zap, Crown } from 'lucide-react'
import { cn } from '../../lib/utils'

const plans = [
  {
    name: 'Explorer',
    price: '$0',
    description: 'Perfect for weekend sailors',
    icon: Sparkles,
    features: [
      '2 passages per month',
      '3-day weather forecast',
      'Basic route planning',
      'Community support',
    ],
    cta: 'Get Started',
    href: '/signup',
    accent: 'muted',
  },
  {
    name: 'Voyager',
    price: '$19',
    period: '/month',
    description: 'For serious cruisers',
    icon: Zap,
    features: [
      'Unlimited passages',
      '7-day weather forecast',
      'All 6 AI agents',
      'GPX/KML export',
      'Email support',
      'Mobile app access',
    ],
    cta: 'Start Free Trial',
    href: '/signup?plan=premium',
    popular: true,
    accent: 'seafoam',
  },
  {
    name: 'Captain',
    price: '$49',
    period: '/month',
    description: 'For professionals & fleets',
    icon: Crown,
    features: [
      'Everything in Voyager',
      'API access',
      'Fleet management',
      'Custom agents',
      'Priority support',
      'Advanced analytics',
    ],
    cta: 'Start Free Trial',
    href: '/signup?plan=pro',
    accent: 'amber',
  },
]

export function PricingSection() {
  return (
    <section
      className="relative px-4 py-20 sm:px-6 lg:px-8 lg:py-28 overflow-hidden"
      style={{
        background: 'linear-gradient(180deg, hsl(var(--night)) 0%, hsl(222 40% 10%) 100%)',
      }}
    >
      {/* Subtle chart grid */}
      <div className="absolute inset-0 chart-grid opacity-[0.07]" />

      {/* Ambient glow blobs */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(0,242,195,0.05) 0%, transparent 70%)',
        }}
      />

      <div className="relative mx-auto max-w-7xl">
        {/* Header */}
        <div className="text-center mb-16">
          <span className="eyebrow-night mb-5 block">Pricing</span>
          <h2 className="font-display mt-2 text-white">
            Simple, Transparent Pricing
          </h2>
          <p className="mt-4 text-lg max-w-2xl mx-auto" style={{ color: 'rgba(255,255,255,0.45)' }}>
            Choose the perfect plan for your sailing adventures. All plans include a 14-day free trial.
          </p>
        </div>

        {/* Pricing cards */}
        <div className="grid gap-6 lg:grid-cols-3 max-w-5xl mx-auto items-stretch">
          {plans.map((plan) => {
            const IconComponent = plan.icon
            const isPopular = plan.popular
            const isAmber = plan.accent === 'amber'

            return (
              <div
                key={plan.name}
                className={cn(
                  'relative flex flex-col h-full p-8 transition-all duration-300',
                  isPopular ? 'card-night-featured scale-[1.03]' : 'card-night'
                )}
              >
                {/* Popular badge */}
                {isPopular && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 z-10">
                    <span
                      className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide whitespace-nowrap"
                      style={{ background: 'hsl(var(--seafoam))', color: 'hsl(var(--night))' }}
                    >
                      Most Popular
                    </span>
                  </div>
                )}

                {/* Plan icon + name */}
                <div className="mb-6 pt-2">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
                    style={{
                      background: isPopular
                        ? 'rgba(0,242,195,0.1)'
                        : isAmber
                          ? 'rgba(226,179,110,0.1)'
                          : 'rgba(255,255,255,0.06)',
                      border: `1px solid ${isPopular ? 'rgba(0,242,195,0.22)' : isAmber ? 'rgba(226,179,110,0.22)' : 'rgba(255,255,255,0.08)'}`,
                      color: isPopular
                        ? 'hsl(var(--seafoam))'
                        : isAmber
                          ? 'hsl(var(--amber-sail))'
                          : 'rgba(255,255,255,0.45)',
                    }}
                  >
                    <IconComponent className="h-6 w-6" />
                  </div>
                  <h3 className="font-display text-2xl font-bold text-white">{plan.name}</h3>
                  <p className="mt-1 text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>{plan.description}</p>
                </div>

                {/* Price */}
                <div className="mb-7">
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-display font-bold text-white">{plan.price}</span>
                    {plan.period && (
                      <span className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>{plan.period}</span>
                    )}
                  </div>
                </div>

                {/* Features */}
                <ul className="space-y-3 mb-8 flex-grow">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3">
                      <div
                        className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                        style={{
                          background: isPopular
                            ? 'rgba(0,242,195,0.15)'
                            : isAmber
                              ? 'rgba(226,179,110,0.15)'
                              : 'rgba(255,255,255,0.07)',
                          color: isPopular
                            ? 'hsl(var(--seafoam))'
                            : isAmber
                              ? 'hsl(var(--amber-sail))'
                              : 'rgba(255,255,255,0.45)',
                        }}
                      >
                        <Check className="h-2.5 w-2.5" />
                      </div>
                      <span className="text-sm" style={{ color: 'rgba(255,255,255,0.65)' }}>{feature}</span>
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                <Button
                  className={cn(
                    'w-full h-12',
                    isPopular ? 'btn-seafoam' : isAmber ? 'btn-brass' : 'btn-night-outline'
                  )}
                  asChild
                >
                  <Link href={plan.href}>{plan.cta}</Link>
                </Button>
              </div>
            )
          })}
        </div>

        {/* Additional info */}
        <div className="mt-16 text-center">
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.28)' }}>
            All plans include SSL encryption and GDPR compliance.
          </p>
          <p className="mt-2 text-sm" style={{ color: 'rgba(255,255,255,0.28)' }}>
            Need a custom plan for your marina or sailing school?{' '}
            <Link
              href="/contact"
              className="hover:underline transition-colors"
              style={{ color: 'hsl(var(--seafoam))' }}
            >
              Contact sales
            </Link>
          </p>
        </div>
      </div>
    </section>
  )
}
