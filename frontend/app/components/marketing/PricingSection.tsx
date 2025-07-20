import Link from 'next/link'
import { Button } from '../ui/button'
import { Check } from 'lucide-react'

const plans = [
  {
    name: 'Free',
    price: '$0',
    description: 'Perfect for casual sailors',
    features: [
      '2 passages per month',
      '3-day weather forecast',
      'Basic route planning',
      'Community support',
    ],
    cta: 'Get Started',
    href: '/signup',
  },
  {
    name: 'Premium',
    price: '$19',
    period: '/month',
    description: 'For serious cruisers',
    features: [
      'Unlimited passages',
      '7-day weather forecast',
      'All AI agents',
      'GPX/KML export',
      'Email support',
      'Mobile app access',
    ],
    cta: 'Start Free Trial',
    href: '/signup?plan=premium',
    popular: true,
  },
  {
    name: 'Pro',
    price: '$49',
    period: '/month',
    description: 'For professionals',
    features: [
      'Everything in Premium',
      'API access',
      'Fleet management',
      'Custom agents',
      'Priority support',
      'Advanced analytics',
    ],
    cta: 'Start Free Trial',
    href: '/signup?plan=pro',
  },
]

export function PricingSection() {
  return (
    <section className="py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Simple, transparent pricing
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Choose the perfect plan for your sailing needs
          </p>
        </div>

        <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`rounded-lg border ${
                plan.popular ? 'border-primary shadow-lg' : 'border-border'
              } bg-card p-8`}
            >
              {plan.popular && (
                <span className="mb-4 inline-block rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">
                  Most Popular
                </span>
              )}
              
              <h3 className="text-2xl font-bold">{plan.name}</h3>
              <p className="mt-2 text-muted-foreground">{plan.description}</p>
              
              <div className="mt-4">
                <span className="text-4xl font-bold">{plan.price}</span>
                {plan.period && (
                  <span className="text-muted-foreground">{plan.period}</span>
                )}
              </div>

              <ul className="mt-8 space-y-3">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start">
                    <Check className="mr-2 h-5 w-5 flex-shrink-0 text-primary" />
                    <span className="text-sm">{feature}</span>
                  </li>
                ))}
              </ul>

              <Button
                className="mt-8 w-full"
                variant={plan.popular ? 'default' : 'outline'}
                asChild
              >
                <Link href={plan.href}>{plan.cta}</Link>
              </Button>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
} 