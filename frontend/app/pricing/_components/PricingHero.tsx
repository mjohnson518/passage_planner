"use client";

import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

interface PricingHeroProps {
  isYearly: boolean;
  onYearlyChange: (value: boolean) => void;
  annualSavePercent: number;
}

export function PricingHero({
  isYearly,
  onYearlyChange,
  annualSavePercent,
}: PricingHeroProps) {
  return (
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
            onCheckedChange={onYearlyChange}
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
              Save {annualSavePercent}%
            </span>
          </span>
        </div>
      </div>
    </section>
  );
}
