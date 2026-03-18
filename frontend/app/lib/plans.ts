// frontend/lib/plans.ts
// Frontend-accessible plan definitions (mirrors shared/src/plans.ts)
// Stripe price IDs use NEXT_PUBLIC env vars for client-side access.

export const PLANS = {
  free: {
    name: 'Free',
    tier: 'free' as const,
    price: { monthly: 0, annual: null as null },
    limits: { passagesPerMonth: 2, apiCallsPerDay: 0, forecastDays: 3, maxFleetMembers: 0 },
    features: {
      exportFormats: ['basic'],
      support: 'community',
      fleetManagement: false,
      customAgents: false,
    },
    topUpEligible: false,
  },
  premium: {
    name: 'Premium',
    tier: 'premium' as const,
    price: { monthly: 19, annual: 190 as number },
    limits: { passagesPerMonth: -1, apiCallsPerDay: 100, forecastDays: 7, maxFleetMembers: 1 },
    features: {
      exportFormats: ['gpx', 'pdf', 'kml'],
      support: 'email',
      fleetManagement: false,
      customAgents: false,
    },
    topUpEligible: true,
  },
  pro: {
    name: 'Pro',
    tier: 'pro' as const,
    price: { monthly: 49, annual: 490 as number },
    limits: { passagesPerMonth: -1, apiCallsPerDay: 1000, forecastDays: 10, maxFleetMembers: 5 },
    features: {
      exportFormats: ['gpx', 'pdf', 'kml', 'api'],
      support: 'priority',
      fleetManagement: true,
      customAgents: true,
    },
    topUpEligible: true,
  },
} as const

export const TOP_UP_PACKS = {
  small: { passages: 5, price: 29 },
  large: { passages: 10, price: 49 },
} as const

export const FOUNDING_MEMBER = {
  totalSpots: 200,
  discountPercent: 40,
  appliesToTier: 'premium' as const,
  billingPeriod: 'annual' as const,
  discountedPrice: 114,
} as const
