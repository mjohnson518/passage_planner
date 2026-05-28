"use client";

import { Button } from "@/components/ui/button";
import { TOP_UP_PACKS } from "@/lib/plans";

interface TopUpSectionProps {
  loading: string | null;
  onTopUp: (pack: "small" | "large") => void;
}

export function TopUpSection({ loading, onTopUp }: TopUpSectionProps) {
  return (
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
                ${(pack.price / pack.passages).toFixed(2)} per passage; never
                expires
              </p>
              <Button
                variant="outline"
                onClick={() => onTopUp(key as "small" | "large")}
                disabled={loading === `topup_${key}`}
              >
                {loading === `topup_${key}` ? "Processing..." : "Buy Now"}
              </Button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
