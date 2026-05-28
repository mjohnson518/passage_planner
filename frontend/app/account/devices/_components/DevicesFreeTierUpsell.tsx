import Link from "next/link";
import { Satellite, Sparkles } from "lucide-react";
import { Header } from "../../../components/layout/Header";
import { Button } from "../../../components/ui/button";
import { Card, CardContent } from "../../../components/ui/card";

export function DevicesFreeTierUpsell() {
  return (
    <>
      <Header />
      <div className="min-h-screen px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl">
          <Card>
            <CardContent className="p-8 text-center space-y-4">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Satellite className="h-8 w-8" />
              </div>
              <h1 className="font-display text-3xl">Sat-comm tracking</h1>
              <p className="text-muted-foreground">
                Register satellite trackers (Garmin InReach, IridiumGo, YB
                Tracker, or generic) so Helmwise can ingest position reports and
                alert you if a vessel drifts off the planned route.
              </p>
              <div className="rounded-md border border-border bg-muted/40 p-4 text-left">
                <p className="text-sm font-medium flex items-center gap-2 mb-1">
                  <Sparkles className="h-4 w-4 text-primary" />A Pro feature
                </p>
                <p className="text-sm text-muted-foreground">
                  Sat-comm position reporting is part of the Pro tier, which
                  targets charter and delivery captains who depend on continuous
                  position monitoring.
                </p>
              </div>
              <div className="flex justify-center gap-2 pt-2">
                <Link href="/account">
                  <Button variant="outline">Back to account</Button>
                </Link>
                <Link href="/pricing">
                  <Button>Upgrade to Pro</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
