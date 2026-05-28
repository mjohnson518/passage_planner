"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { PLANS } from "@/lib/plans";
import { Header } from "../components/layout/Header";
import { FoundingMemberBanner } from "./_components/FoundingMemberBanner";
import { PricingCard } from "./_components/PricingCard";
import { PricingHero } from "./_components/PricingHero";
import { TopUpSection } from "./_components/TopUpSection";
import { PricingFaqSection } from "./_components/PricingFaqSection";
import { EnterpriseCta } from "./_components/EnterpriseCta";
import { PricingFooter } from "./_components/PricingFooter";

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
    "Crew certification tracking",
    "Sat-comm position reporting (InReach / Iridium / YB)",
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
  premium: [
    "API access",
    "Fleet management",
    "Crew certification tracking",
    "Sat-comm position reporting",
  ],
  pro: [],
};

export default function PricingClient() {
  const [isYearly, setIsYearly] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);
  const { user } = useAuth();
  const { push } = useRouter();

  const { data: foundingData, isError: foundingError } = useQuery({
    queryKey: ["founding-member", "spots-remaining"],
    queryFn: async () => {
      const r = await fetch("/api/founding-member/spots-remaining");
      const d = await r.json();
      return { remaining: (d.remaining ?? 0) as number };
    },
  });

  // null until resolved (loading), then a number — preserves original gating semantics
  const foundingSpots: number | null =
    foundingData != null ? foundingData.remaining : foundingError ? 0 : null;

  const handleSubscribe = async (
    tier: string,
    period: "monthly" | "annual",
    founding = false,
  ) => {
    if (!user) {
      push("/signup");
      return;
    }
    if (tier === "free") {
      push("/dashboard");
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
      push("/signup");
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
        <FoundingMemberBanner
          foundingSpots={foundingSpots}
          onClaim={() => handleSubscribe("premium", "annual", true)}
        />
      )}

      {/* Hero */}
      <PricingHero
        isYearly={isYearly}
        onYearlyChange={setIsYearly}
        annualSavePercent={ANNUAL_SAVE_PERCENT}
      />

      {/* Pricing Cards */}
      <section className="section-alt px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {displayTiers.map((key) => (
              <PricingCard
                key={key}
                tierKey={key}
                isYearly={isYearly}
                loading={loading}
                foundingSpots={foundingSpots}
                description={TIER_DESCRIPTIONS[key]}
                features={TIER_FEATURE_LABELS[key] ?? []}
                notIncluded={TIER_NOT_INCLUDED[key] ?? []}
                onSubscribe={handleSubscribe}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Top-Up Passage Packs (authenticated paid users) */}
      {user && <TopUpSection loading={loading} onTopUp={handleTopUp} />}

      {/* FAQ Section */}
      <PricingFaqSection />

      {/* Enterprise CTA */}
      <EnterpriseCta />

      {/* Footer */}
      <PricingFooter />
    </>
  );
}
