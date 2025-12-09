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
    accent: 'primary',
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
    accent: 'brass',
  },
]

export function PricingSection() {
  return (
    <section className="section-alt px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="text-center mb-16">
          <span className="badge-primary mb-4">Pricing</span>
          <h2 className="font-display mt-4">
            Simple, Transparent Pricing
          </h2>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
            Choose the perfect plan for your sailing adventures. All plans include a 14-day free trial.
          </p>
        </div>

        {/* Pricing cards */}
        <div className="grid gap-8 lg:grid-cols-3 max-w-5xl mx-auto">
          {plans.map((plan) => {
            const IconComponent = plan.icon
            return (
              <div
                key={plan.name}
                className={cn(
                  'relative card p-8 flex flex-col h-full transition-all duration-300',
                  plan.popular && 'ring-2 ring-primary shadow-maritime-lg scale-[1.02]'
                )}
              >
                {/* Popular badge */}
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <span className="badge-brass px-4 py-1.5 shadow-brass">
                      Most Popular
                    </span>
                  </div>
                )}

                {/* Plan header */}
                <div className="mb-6">
                  <div className={cn(
                    'w-12 h-12 rounded-xl flex items-center justify-center mb-4',
                    plan.accent === 'primary' && 'bg-primary/10 text-primary',
                    plan.accent === 'brass' && 'bg-brass-50 dark:bg-brass-900/20 text-brass-600 dark:text-brass-400',
                    plan.accent === 'muted' && 'bg-muted text-muted-foreground'
                  )}>
                    <IconComponent className="h-6 w-6" />
                  </div>
                  <h3 className="font-display text-2xl font-bold">{plan.name}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{plan.description}</p>
                </div>

                {/* Price */}
                <div className="mb-6">
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-display font-bold">{plan.price}</span>
                    {plan.period && (
                      <span className="text-muted-foreground text-sm">{plan.period}</span>
                    )}
                  </div>
                </div>

                {/* Features */}
                <ul className="space-y-3 mb-8 flex-grow">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3">
                      <div className={cn(
                        'w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5',
                        plan.accent === 'primary' && 'bg-primary/10 text-primary',
                        plan.accent === 'brass' && 'bg-brass-100 dark:bg-brass-900/20 text-brass-600 dark:text-brass-400',
                        plan.accent === 'muted' && 'bg-muted text-muted-foreground'
                      )}>
                        <Check className="h-3 w-3" />
                      </div>
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                <Button
                  className={cn(
                    'w-full h-12',
                    plan.popular ? 'btn-primary' : plan.accent === 'brass' ? 'btn-brass' : 'btn-secondary'
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
          <p className="text-sm text-muted-foreground">
            All plans include SSL encryption, GDPR compliance, and 99.9% uptime SLA.
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Need a custom plan for your marina or sailing school?{' '}
            <Link href="/contact" className="text-primary hover:underline">
              Contact sales
            </Link>
          </p>
        </div>
      </div>
    </section>
  )
}
