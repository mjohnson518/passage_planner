import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PLANS, FOUNDING_MEMBER } from "@/lib/plans";

interface PricingCardProps {
  tierKey: "free" | "premium" | "pro";
  isYearly: boolean;
  loading: string | null;
  foundingSpots: number | null;
  description: string;
  features: string[];
  notIncluded: string[];
  onSubscribe: (
    tier: string,
    period: "monthly" | "annual",
    founding?: boolean,
  ) => void;
}

export function PricingCard({
  tierKey,
  isYearly,
  loading,
  foundingSpots,
  description,
  features,
  notIncluded,
  onSubscribe,
}: PricingCardProps) {
  const plan = PLANS[tierKey];
  const isPopular = tierKey === "premium";
  const monthlyPrice = plan.price.monthly ?? 0;
  const annualPrice = plan.price.annual;

  const displayPrice = isYearly ? (annualPrice ?? 0) : monthlyPrice;

  const isFree = tierKey === "free";
  const cta = isFree ? "Get Started" : "Start Free Trial";

  // Show founding member annual price if applicable
  const showFoundingAnnual =
    isYearly &&
    tierKey === FOUNDING_MEMBER.appliesToTier &&
    foundingSpots !== null &&
    foundingSpots > 0;

  return (
    <div
      className={cn(
        "card-nautical relative p-8 transition-all",
        isPopular && "border-primary shadow-card-hover md:scale-105 md:mt-4",
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
        <h3 className="font-display text-2xl font-bold mb-2">{plan.name}</h3>
        <p className="text-muted-foreground text-sm mb-4">{description}</p>
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
          onSubscribe(
            tierKey,
            isYearly ? "annual" : "monthly",
            showFoundingAnnual,
          )
        }
        disabled={loading === tierKey}
        className={isPopular ? "btn-brass" : ""}
      >
        {loading === tierKey ? (
          <span className="flex items-center">
            <span className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full mr-2" />
            Processing…
          </span>
        ) : (
          cta
        )}
      </Button>

      <div className="mt-6 space-y-3">
        {features.map((feature) => (
          <div key={feature} className="flex items-start gap-3">
            <Check className="h-5 w-5 text-success flex-shrink-0 mt-0.5" />
            <span className="text-sm">{feature}</span>
          </div>
        ))}
        {notIncluded.map((feature) => (
          <div key={feature} className="flex items-start gap-3 opacity-50">
            <X className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
            <span className="text-sm line-through">{feature}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
