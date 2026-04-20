"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, X, Ship, Anchor, Info, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { PLANS, TOP_UP_PACKS, FOUNDING_MEMBER } from "@/lib/plans";
import { Header } from "../components/layout/Header";

// Annual savings percentage derived from PLANS (not hardcoded)
const ANNUAL_SAVE_PERCENT = Math.round(
  ((PLANS.premium.price.monthly * 12 - PLANS.premium.price.annual!) /
    (PLANS.premium.price.monthly * 12)) *
    100,
);

const TIER_DESCRIPTIONS: Record<string, string> = {
  free: "Perfect for casual sailors planning occasional trips",
  premium: "For serious cruisers who need advanced planning tools",
  pro: "For professionals managing multiple vessels",
  enterprise: "Custom solutions for marinas and large fleets",
};

const TIER_FEATURE_LABELS: Record<string, string[]> = {
  free: [
    `${PLANS.free.limits.passagesPerMonth} passages per month`,
    `${PLANS.free.limits.forecastDays}-day weather forecast`,
    "Basic route planning",
    "Tide predictions",
    `${PLANS.free.features.support} support`,
    "Mobile web access",
  ],
  premium: [
    "Unlimited passages",
    `${PLANS.premium.limits.forecastDays}-day weather forecast`,
    "All AI agents access",
    "GPX/KML/PDF export",
    "Weather routing",
    "Offline charts",
    `${PLANS.premium.features.support} support`,
    "Mobile app (coming soon)",
  ],
  pro: [
    "Everything in Premium",
    `API access (${PLANS.pro.limits.apiCallsPerDay} calls/day)`,
    "Fleet management",
    "Custom AI agents",
    `${PLANS.pro.limits.forecastDays}-day weather forecast`,
    `${PLANS.pro.features.support} support`,
    "Advanced analytics",
    "Dedicated account manager",
  ],
};

const TIER_NOT_INCLUDED: Record<string, string[]> = {
  free: [
    "GPX/KML export",
    "Advanced weather routing",
    "API access",
    "Priority support",
  ],
  premium: ["API access", "Fleet management", "Custom agents"],
  pro: [],
};

export default function PricingPage() {
  const [isYearly, setIsYearly] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);
  const [foundingSpots, setFoundingSpots] = useState<number | null>(null);
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    fetch("/api/founding-member/spots-remaining")
      .then((r) => r.json())
      .then((d) => setFoundingSpots(d.remaining ?? 0))
      .catch(() => setFoundingSpots(0));
  }, []);

  const handleSubscribe = async (
    tier: string,
    period: "monthly" | "annual",
    founding = false,
  ) => {
    if (!user) {
      router.push("/signup");
      return;
    }
    if (tier === "free") {
      router.push("/dashboard");
      return;
    }

    setLoading(tier);
    try {
      const response = await fetch(
        "/api/subscription/create-checkout-session",
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tier, period, founding }),
        },
      );

      if (!response.ok) {
        const errorData = await response.json();

        if (
          response.status === 409 &&
          errorData.action === "open_customer_portal"
        ) {
          const portalRes = await fetch("/api/stripe/customer-portal", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              returnUrl: `${window.location.origin}/profile`,
            }),
          });
          if (portalRes.ok) {
            const { url } = await portalRes.json();
            window.location.href = url;
            return;
          }
        }

        throw new Error(
          errorData.message ||
            errorData.error ||
            "Failed to create checkout session",
        );
      }

      const { sessionUrl } = await response.json();
      if (!sessionUrl) throw new Error("No checkout URL received");
      window.location.href = sessionUrl;
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Failed to start checkout process",
      );
    } finally {
      setLoading(null);
    }
  };

  const handleTopUp = async (pack: "small" | "large") => {
    if (!user) {
      router.push("/signup");
      return;
    }
    setLoading(`topup_${pack}`);
    try {
      const response = await fetch("/api/subscription/purchase-top-up", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pack }),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to start top-up checkout");
      }
      const { sessionUrl } = await response.json();
      window.location.href = sessionUrl;
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Failed to start checkout process",
      );
    } finally {
      setLoading(null);
    }
  };

  const displayTiers = ["free", "premium", "pro"] as const;

  return (
    <>
      <Header />

      {/* Founding Member Banner */}
      {foundingSpots !== null && foundingSpots > 0 && (
        <div className="bg-warning text-warning-foreground text-center py-3 px-4">
          <span className="font-bold">
            <Star className="inline h-4 w-4 mr-1" />
            Founding Member Special — Only {foundingSpots} of{" "}
            {FOUNDING_MEMBER.totalSpots} spots left!
          </span>{" "}
          Premium annual at{" "}
          <span className="line-through opacity-75">
            ${PLANS.premium.price.annual}/yr
          </span>{" "}
          <span className="font-bold">
            ${FOUNDING_MEMBER.discountedPrice}/yr
          </span>{" "}
          — first year.{" "}
          <button
            onClick={() => handleSubscribe("premium", "annual", true)}
            className="underline font-bold hover:no-underline"
          >
            Claim your spot →
          </button>
        </div>
      )}

      {/* Hero */}
      <section className="section-hero relative px-4 pt-20 pb-12 sm:px-6 lg:px-8">
        <div
          className="absolute inset-0 chart-grid opacity-20 pointer-events-none"
          aria-hidden
        />
        <div className="relative mx-auto max-w-3xl text-center">
          <span className="badge-brass mb-4 inline-block">Pricing</span>
          <h1 className="font-display mt-4 text-balance">
            Simple, Transparent <span className="text-gradient">Pricing</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            Choose the perfect plan for your sailing adventures. Start with our
            free tier and upgrade as you grow.
          </p>

          {/* Billing Toggle */}
          <div className="flex items-center justify-center gap-4 mt-10">
            <span
              className={cn(
                "font-medium transition-colors",
                !isYearly ? "text-primary" : "text-muted-foreground",
              )}
            >
              Monthly
            </span>
            <Switch
              checked={isYearly}
              onCheckedChange={setIsYearly}
              className="data-[state=checked]:bg-primary"
            />
            <span
              className={cn(
                "font-medium transition-colors",
                isYearly ? "text-primary" : "text-muted-foreground",
              )}
            >
              Yearly
              <span className="ml-2 text-xs bg-success/10 text-success px-2 py-1 rounded-full">
                Save {ANNUAL_SAVE_PERCENT}%
              </span>
            </span>
          </div>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="section-alt px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {displayTiers.map((key) => {
              const plan = PLANS[key];
              const isPopular = key === "premium";
              const monthlyPrice = plan.price.monthly ?? 0;
              const annualPrice = plan.price.annual;

              const displayPrice = isYearly ? (annualPrice ?? 0) : monthlyPrice;

              const isFree = key === "free";
              const cta = isFree ? "Get Started" : "Start Free Trial";

              // Show founding member annual price if applicable
              const showFoundingAnnual =
                isYearly &&
                key === FOUNDING_MEMBER.appliesToTier &&
                foundingSpots !== null &&
                foundingSpots > 0;

              return (
                <div
                  key={key}
                  className={cn(
                    "card-nautical relative p-8 transition-all",
                    isPopular &&
                      "border-primary shadow-card-hover md:scale-105 md:mt-4",
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
                    <h3 className="font-display text-2xl font-bold mb-2">
                      {plan.name}
                    </h3>
                    <p className="text-muted-foreground text-sm mb-4">
                      {TIER_DESCRIPTIONS[key]}
                    </p>
                    <div className="flex items-baseline gap-1">
                      <span className="font-display text-4xl font-bold">
                        ${displayPrice}
                      </span>
                      {!isFree && (
                        <span className="text-muted-foreground">
                          /{isYearly ? "year" : "month"}
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
                        Founding member:{" "}
                        <span className="line-through">${annualPrice}/yr</span>{" "}
                        <span className="font-bold">
                          ${FOUNDING_MEMBER.discountedPrice}/yr
                        </span>{" "}
                        first year
                      </p>
                    )}
                  </div>

                  <Button
                    fullWidth
                    variant={isPopular ? "default" : "outline"}
                    onClick={() =>
                      handleSubscribe(
                        key,
                        isYearly ? "annual" : "monthly",
                        showFoundingAnnual,
                      )
                    }
                    disabled={loading === key}
                    className={isPopular ? "btn-brass" : ""}
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
                      <div
                        key={feature}
                        className="flex items-start gap-3 opacity-50"
                      >
                        <X className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                        <span className="text-sm line-through">{feature}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Top-Up Passage Packs (authenticated paid users) */}
      {user && (
        <section className="px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-4xl">
            <div className="text-center mb-10">
              <span className="badge-primary mb-4 inline-block">Top-Ups</span>
              <h2 className="font-display mt-2">Need More Passages?</h2>
              <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
                One-time passage packs for Premium and Pro subscribers. No
                subscription change required.
              </p>
            </div>
            <div className="grid md:grid-cols-2 gap-6 max-w-2xl mx-auto">
              {(
                Object.entries(TOP_UP_PACKS) as [
                  string,
                  { passages: number; price: number },
                ][]
              ).map(([key, pack]) => (
                <div
                  key={key}
                  className="card-nautical p-6 text-center transition-all hover:shadow-card-hover hover:-translate-y-1"
                >
                  <div className="font-display text-3xl font-bold mb-1">
                    {pack.passages} Passages
                  </div>
                  <div className="text-2xl font-semibold text-primary mb-4">
                    ${pack.price}
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">
                    ${(pack.price / pack.passages).toFixed(2)} per passage —
                    never expires
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => handleTopUp(key as "small" | "large")}
                    disabled={loading === `topup_${key}`}
                  >
                    {loading === `topup_${key}` ? "Processing..." : "Buy Now"}
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* FAQ Section */}
      <section className="section-alt px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <div className="text-center mb-12">
            <span className="badge-brass mb-4 inline-block">FAQ</span>
            <h2 className="font-display mt-2">Frequently Asked Questions</h2>
          </div>
          <div className="card-nautical p-8 space-y-2">
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
      </section>

      {/* Enterprise CTA */}
      <section className="section-ocean px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <Ship className="h-12 w-12 text-primary-foreground mx-auto mb-4" />
          <h2 className="font-display text-primary-foreground">
            Need a Custom Solution?
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-primary-foreground/80">
            For marinas, charter companies, or large fleets, we offer custom
            enterprise plans with dedicated support, custom integrations, and
            volume pricing.
          </p>
          <div className="mt-8">
            <Link href="/contact">
              <Button size="lg" className="btn-brass">
                Contact Sales
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-4 py-12 sm:px-6 lg:px-8 border-t border-border">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Anchor className="h-5 w-5 text-primary" />
              <span className="font-display font-bold">Helmwise</span>
            </div>
            <p className="text-sm text-muted-foreground">
              &copy; {new Date().getFullYear()} Helmwise. All rights reserved.
            </p>
            <div className="flex gap-6 text-sm text-muted-foreground">
              <Link
                href="/terms"
                className="hover:text-primary transition-colors"
              >
                Terms
              </Link>
              <Link
                href="/privacy"
                className="hover:text-primary transition-colors"
              >
                Privacy
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}

function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border-b border-border last:border-0 py-4">
      <button
        className="w-full flex items-center justify-between text-left"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="font-medium">{question}</span>
        <Info
          className={cn(
            "h-5 w-5 text-primary transition-transform flex-shrink-0 ml-4",
            isOpen && "rotate-180",
          )}
        />
      </button>
      {isOpen && <p className="mt-4 text-muted-foreground">{answer}</p>}
    </div>
  );
}
