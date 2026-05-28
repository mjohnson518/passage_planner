import Link from "next/link";
import { Sparkles, Users } from "lucide-react";
import { Header } from "../../../components/layout/Header";
import { Button } from "../../../components/ui/button";
import { Card, CardContent } from "../../../components/ui/card";

export function CrewFreeTierUpsell() {
  return (
    <>
      <Header />
      <div className="min-h-screen px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl">
          <Card>
            <CardContent className="p-8 text-center space-y-4">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Users className="h-8 w-8" />
              </div>
              <h1 className="font-display text-3xl">Crew certifications</h1>
              <p className="text-muted-foreground">
                Track STCW, USCG license, medical (ENG1 / CG-719K), first aid,
                passport, visa, and other crew certifications. The planner warns
                you before departure if a crew member&apos;s cert is expired or
                expires soon.
              </p>
              <div className="rounded-md border border-border bg-muted/40 p-4 text-left">
                <p className="text-sm font-medium flex items-center gap-2 mb-1">
                  <Sparkles className="h-4 w-4 text-primary" />A Pro feature
                </p>
                <p className="text-sm text-muted-foreground">
                  Built for charter captains, delivery skippers, and fleet
                  operators who need to stay on top of compliance.
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
