"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../ui/card";
import { Badge } from "../../ui/badge";

interface SubscriptionDistributionProps {
  subscriptions: {
    free: number;
    premium: number;
    pro: number;
    enterprise: number;
  };
  foundingMembers?: number;
  topUpRevenue?: number;
  formatCurrency: (value: number) => string;
}

export function SubscriptionDistribution({
  subscriptions,
  foundingMembers,
  topUpRevenue,
  formatCurrency,
}: SubscriptionDistributionProps) {
  const total =
    subscriptions.free +
    subscriptions.premium +
    subscriptions.pro +
    subscriptions.enterprise;
  const tiers = [
    {
      key: "free",
      label: "Free",
      count: subscriptions.free,
      color: "bg-muted-foreground",
      variant: "secondary" as const,
    },
    {
      key: "premium",
      label: "Premium",
      count: subscriptions.premium,
      color: "bg-warning",
      variant: "default" as const,
    },
    {
      key: "pro",
      label: "Pro",
      count: subscriptions.pro,
      color: "bg-primary",
      variant: "default" as const,
    },
    {
      key: "enterprise",
      label: "Enterprise",
      count: subscriptions.enterprise,
      color: "bg-destructive",
      variant: "destructive" as const,
    },
  ];
  return (
    <Card>
      <CardHeader>
        <CardTitle>Subscription Distribution</CardTitle>
        <CardDescription>Active subscriptions by tier</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {tiers.map((t) => (
            <div key={t.key}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Badge variant={t.variant}>{t.label}</Badge>
                  <span className="text-sm font-medium">{t.count} users</span>
                  {t.key === "premium" &&
                    foundingMembers !== undefined &&
                    foundingMembers > 0 && (
                      <span className="text-xs text-warning">
                        ({foundingMembers} founding)
                      </span>
                    )}
                </div>
                <span className="text-sm text-muted-foreground">
                  {total > 0 ? ((t.count / total) * 100).toFixed(1) : "0.0"}%
                </span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div
                  className={`${t.color} h-2 rounded-full`}
                  style={{
                    width: total > 0 ? `${(t.count / total) * 100}%` : "0%",
                  }}
                />
              </div>
            </div>
          ))}
          {topUpRevenue !== undefined && topUpRevenue > 0 && (
            <div className="pt-2 border-t">
              <span className="text-sm text-muted-foreground">
                Top-up pack revenue (one-time):{" "}
                <strong>{formatCurrency(topUpRevenue)}</strong>
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
