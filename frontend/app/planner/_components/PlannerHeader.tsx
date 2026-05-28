import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import {
  Banner,
  BannerTitle,
  BannerDescription,
} from "../../components/ui/banner";

export function PlannerHeader() {
  return (
    <>
      {/* Safety disclaimer — persistent, non-dismissible (CLAUDE.md requirement).
          Uses the `safety` Banner variant so the brand brass tint distinguishes
          this from generic error messaging — life-safety copy must stand apart. */}
      <Banner
        variant="safety"
        icon={<ShieldAlert className="h-5 w-5" />}
        className="mb-6"
      >
        <BannerTitle>Navigation aid only</BannerTitle>
        <BannerDescription>
          This tool supports passage planning; it does not replace professional
          seamanship, official nautical charts, current NOTAMs, or your own
          judgment. Always independently verify every data point before
          departure.{" "}
          <Link href="/terms" className="underline hover:no-underline">
            See full Terms of Service.
          </Link>
        </BannerDescription>
      </Banner>

      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight font-display">
          Plan New Passage
        </h1>
        <p className="text-muted-foreground mt-1">
          Enter your route details and we&apos;ll create a comprehensive passage
          plan
        </p>
      </div>
    </>
  );
}
