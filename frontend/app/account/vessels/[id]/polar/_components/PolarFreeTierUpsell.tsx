import Link from "next/link";
import { Sparkles, Wind } from "lucide-react";
import { Header } from "../../../../../components/layout/Header";
import { Button } from "../../../../../components/ui/button";
import { Card, CardContent } from "../../../../../components/ui/card";

interface PolarFreeTierUpsellProps {
  vesselId: string;
}

export function PolarFreeTierUpsell({ vesselId }: PolarFreeTierUpsellProps) {
  return (
    <>
      <Header />
      <div className="min-h-screen px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl">
          <Card>
            <CardContent className="p-8 text-center space-y-4">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Wind className="h-8 w-8" />
              </div>
              <h1 className="font-display text-3xl">Custom polars</h1>
              <p className="text-muted-foreground">
                Upload your boat&apos;s Expedition-format polar CSV. The weather
                router will then use your vessel&apos;s actual performance
                curves instead of a generic cruising estimate.
              </p>
              <div className="rounded-md border border-border bg-muted/40 p-4 text-left">
                <p className="text-sm font-medium flex items-center gap-2 mb-1">
                  <Sparkles className="h-4 w-4 text-primary" />A Premium feature
                </p>
                <p className="text-sm text-muted-foreground">
                  Polar-aware routing is part of Premium. Free users get weather
                  routing with a generic cruising polar.
                </p>
              </div>
              <div className="flex justify-center gap-2 pt-2">
                <Link href={`/account/vessels/${vesselId}/maintenance`}>
                  <Button variant="outline">Back to vessel</Button>
                </Link>
                <Link href="/pricing">
                  <Button>Upgrade to Premium</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
