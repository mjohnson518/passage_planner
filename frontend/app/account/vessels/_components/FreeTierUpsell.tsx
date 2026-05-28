import Link from "next/link";
import { Ship, Sparkles } from "lucide-react";
import { Header } from "../../../components/layout/Header";
import { Button } from "../../../components/ui/button";
import { Card, CardContent } from "../../../components/ui/card";

export function FreeTierUpsell() {
  return (
    <>
      <Header />
      <div className="min-h-screen px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl">
          <Card>
            <CardContent className="p-8 text-center space-y-4">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Ship className="h-8 w-8" />
              </div>
              <h1 className="font-display text-3xl">Vessel maintenance</h1>
              <p className="text-muted-foreground">
                Track engine hours, watermaker hours, rigging inspections, and
                other service intervals per vessel. Helmwise reminds you when an
                item is overdue, once a week, never spammy.
              </p>
              <div className="rounded-md border border-border bg-muted/40 p-4 text-left">
                <p className="text-sm font-medium flex items-center gap-2 mb-1">
                  <Sparkles className="h-4 w-4 text-primary" />A Premium feature
                </p>
                <p className="text-sm text-muted-foreground">
                  Maintenance tracking is part of Premium. Free users can plan
                  passages and use safety scoring without it.
                </p>
              </div>
              <div className="flex justify-center gap-2 pt-2">
                <Link href="/account">
                  <Button variant="outline">Back to account</Button>
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
