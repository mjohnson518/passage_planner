// shared/src/plans.ts
// Single source of truth for all Helmwise subscription plan definitions.
// Import from here — never hardcode plan limits elsewhere.

export const PLANS = {
  free: {
    name: 'Free',
    tier: 'free' as const,
    price: { monthly: 0, annual: null },
    limits: {
      passagesPerMonth: 2,
      apiCallsPerDay: 0,
      forecastDays: 3,
      maxFleetMembers: 0,
    },
    features: {
      exportFormats: ['basic'] as string[],
      agents: ['weather', 'tidal', 'basic_route'] as string[] | '*',
      support: 'community' as const,
      fleetManagement: false,
      customAgents: false,
      whiteLabel: false,
    },
    topUpEligible: false,
    stripePriceIds: { monthly: null, annual: null },
  },
  premium: {
    name: 'Premium',
    tier: 'premium' as const,
    price: { monthly: 19, annual: 190 },
    limits: {
      passagesPerMonth: -1, // unlimited
      apiCallsPerDay: 100,
      forecastDays: 7,
      maxFleetMembers: 1,
    },
    features: {
      exportFormats: ['gpx', 'pdf', 'kml'] as string[],
      agents: '*' as string[] | '*',
      support: 'email' as const,
      fleetManagement: false,
      customAgents: false,
      whiteLabel: false,
    },
    topUpEligible: true,
    stripePriceIds: {
      monthly: process.env.STRIPE_PREMIUM_MONTHLY_PRICE_ID || null,
      annual: process.env.STRIPE_PREMIUM_YEARLY_PRICE_ID || null,
    },
  },
  pro: {
    name: 'Pro',
    tier: 'pro' as const,
    price: { monthly: 49, annual: 490 },
    limits: {
      passagesPerMonth: -1,
      apiCallsPerDay: 1000,
      forecastDays: 10,
      maxFleetMembers: 5,
    },
    features: {
      exportFormats: ['gpx', 'pdf', 'kml', 'api'] as string[],
      agents: '*' as string[] | '*',
      support: 'priority' as const,
      fleetManagement: true,
      customAgents: true,
      whiteLabel: false,
    },
    topUpEligible: true,
    stripePriceIds: {
      monthly: process.env.STRIPE_PRO_MONTHLY_PRICE_ID || null,
      annual: process.env.STRIPE_PRO_YEARLY_PRICE_ID || null,
    },
  },
  enterprise: {
    name: 'Enterprise',
    tier: 'enterprise' as const,
    price: { monthly: null, annual: null },
    limits: {
      passagesPerMonth: -1,
      apiCallsPerDay: -1,
      forecastDays: 14,
      maxFleetMembers: -1,
    },
    features: {
      exportFormats: ['*'] as string[],
      agents: '*' as string[] | '*',
      support: 'dedicated' as const,
      fleetManagement: true,
      customAgents: true,
      whiteLabel: true,
    },
    topUpEligible: true,
    stripePriceIds: { monthly: null, annual: null },
  },
} as const;

export const TOP_UP_PACKS = {
  small: {
    passages: 5,
    price: 29,
    stripePriceId: process.env.STRIPE_TOPUP_5_PRICE_ID || 'STRIPE_TOPUP_5_PRICE_ID',
  },
  large: {
    passages: 10,
    price: 49,
    stripePriceId: process.env.STRIPE_TOPUP_10_PRICE_ID || 'STRIPE_TOPUP_10_PRICE_ID',
  },
} as const;

export const FOUNDING_MEMBER = {
  totalSpots: 200,
  discountPercent: 40,
  appliesToTier: 'premium' as const,
  billingPeriod: 'annual' as const,
  discountedPrice: 114, // $190 * 0.6 = $114/yr first year
  stripeCouponId: process.env.STRIPE_FOUNDING_COUPON_ID || 'STRIPE_FOUNDING_COUPON_ID',
} as const;

export type PlanTier = keyof typeof PLANS;

/** Returns the monthly passage limit for a tier (-1 = unlimited). */
export function getPassageLimit(tier: string): number {
  const plan = PLANS[tier as PlanTier];
  return plan ? plan.limits.passagesPerMonth : PLANS.free.limits.passagesPerMonth;
}

/** Returns the fleet seat limit for a tier (-1 = unlimited, 0 = none). */
export function getFleetSeatLimit(tier: string): number {
  const plan = PLANS[tier as PlanTier];
  return plan ? plan.limits.maxFleetMembers : PLANS.free.limits.maxFleetMembers;
}

/**
 * Determines whether a user can create a new passage.
 * - Unlimited tiers (-1): always true
 * - Otherwise: used + bonus must be under limit
 */
export function canCreatePassage(
  tier: string,
  usedThisMonth: number,
  bonusPassages: number = 0
): boolean {
  const limit = getPassageLimit(tier);
  if (limit === -1) return true;
  return usedThisMonth < limit + bonusPassages;
}
