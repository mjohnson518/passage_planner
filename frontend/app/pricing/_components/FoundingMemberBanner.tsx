import { Star } from "lucide-react";
import { PLANS, FOUNDING_MEMBER } from "@/lib/plans";

interface FoundingMemberBannerProps {
  foundingSpots: number;
  onClaim: () => void;
}

export function FoundingMemberBanner({
  foundingSpots,
  onClaim,
}: FoundingMemberBannerProps) {
  return (
    <div className="bg-warning text-warning-foreground text-center py-3 px-4">
      <span className="font-bold">
        <Star className="inline h-4 w-4 mr-1" />
        Founding Member Special: Only {foundingSpots} of{" "}
        {FOUNDING_MEMBER.totalSpots} spots left!
      </span>{" "}
      Premium annual at{" "}
      <span className="line-through opacity-75">
        ${PLANS.premium.price.annual}/yr
      </span>{" "}
      <span className="font-bold">${FOUNDING_MEMBER.discountedPrice}/yr</span>{" "}
      for the first year.{" "}
      <button
        type="button"
        onClick={onClaim}
        className="underline font-bold hover:no-underline"
      >
        Claim your spot →
      </button>
    </div>
  );
}
