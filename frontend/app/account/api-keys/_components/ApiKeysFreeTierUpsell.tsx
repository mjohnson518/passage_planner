import Link from "next/link";
import { Key, Sparkles } from "lucide-react";
import { Header } from "../../../components/layout/Header";
import { Button } from "../../../components/ui/button";
import { Card, CardContent } from "../../../components/ui/card";

export function ApiKeysFreeTierUpsell() {
  return (
    <>
      <Header />
      <div className="min-h-screen px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl">
          <Card>
            <CardContent className="p-8 text-center space-y-4">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Key className="h-8 w-8" />
              </div>
              <h1 className="font-display text-3xl">API keys</h1>
              <p className="text-muted-foreground">
                Generate API keys to call Helmwise endpoints from your own
                scripts, integrations, or chartplotter apps. Per-key rate
                limits, scoped access, and instant revocation.
              </p>
              <div className="rounded-md border border-border bg-muted/40 p-4 text-left">
                <p className="text-sm font-medium flex items-center gap-2 mb-1">
                  <Sparkles className="h-4 w-4 text-primary" />A Pro feature
                </p>
                <p className="text-sm text-muted-foreground">
                  API access is part of Pro, designed for charter operators and
                  developers integrating Helmwise into their own tools.
                </p>
              </div>
              <div className="flex justify-center gap-2 pt-2">
                <Link href="/api-docs">
                  <Button variant="outline">View API docs</Button>
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
