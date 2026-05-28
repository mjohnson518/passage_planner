"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import dynamic from "next/dynamic";
import { CreditCard, AlertCircle } from "lucide-react";
import { logger } from "../../lib/logger";
import { RevenueKpiCards } from "./_components/RevenueKpiCards";
import { SubscriptionDistribution } from "./_components/SubscriptionDistribution";

const RevenueGrowthChart = dynamic(
  () => import("./_components/RevenueGrowthChart"),
  { ssr: false },
);
const RevenueByTierChart = dynamic(
  () => import("./_components/RevenueByTierChart"),
  { ssr: false },
);
const ChurnAnalysisChart = dynamic(
  () => import("./_components/ChurnAnalysisChart"),
  { ssr: false },
);

interface RevenueData {
  mrr: number;
  arr: number;
  growth: number;
  churn: number;
  ltv: number;
  arpu: number;
  subscriptions: {
    free: number;
    premium: number;
    pro: number;
    enterprise: number;
  };
  foundingMembers?: number;
  topUpRevenue?: number;
  revenueByMonth: Array<{
    month: string;
    revenue: number;
    subscriptions: number;
  }>;
  churnByMonth: Array<{
    month: string;
    rate: number;
    count: number;
  }>;
  revenueByTier: Array<{
    tier: string;
    revenue: number;
    users: number;
  }>;
}

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const formatCurrency = (value: number) => currencyFormatter.format(value);

export function RevenueMetrics() {
  const [timeRange, setTimeRange] = useState("30d");

  const { data, isLoading } = useQuery<RevenueData>({
    queryKey: ["admin-revenue", timeRange],
    queryFn: async () => {
      try {
        const response = await fetch(`/api/admin/revenue?range=${timeRange}`);
        if (!response.ok) throw new Error("Failed to fetch revenue data");
        return await response.json();
      } catch (error) {
        logger.error("Failed to load revenue data", {
          error: String(error),
          timeRange,
        });
        throw error;
      }
    },
  });

  const formatPercentage = (value: number) => {
    return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
  };

  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-32 bg-muted rounded animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold">Revenue Metrics</h2>
        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
            <SelectItem value="90d">Last 90 days</SelectItem>
            <SelectItem value="12m">Last 12 months</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <RevenueKpiCards
        mrr={data.mrr}
        arr={data.arr}
        growth={data.growth}
        churn={data.churn}
        ltv={data.ltv}
        formatCurrency={formatCurrency}
        formatPercentage={formatPercentage}
      />

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Revenue Growth</CardTitle>
            <CardDescription>Monthly revenue over time</CardDescription>
          </CardHeader>
          <CardContent>
            <RevenueGrowthChart
              data={data.revenueByMonth}
              formatCurrency={formatCurrency}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Revenue by Tier</CardTitle>
            <CardDescription>
              Distribution of revenue across subscription tiers
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RevenueByTierChart
              data={data.revenueByTier}
              formatCurrency={formatCurrency}
            />
          </CardContent>
        </Card>
      </div>

      <SubscriptionDistribution
        subscriptions={data.subscriptions}
        foundingMembers={data.foundingMembers}
        topUpRevenue={data.topUpRevenue}
        formatCurrency={formatCurrency}
      />

      <Card>
        <CardHeader>
          <CardTitle>Churn Analysis</CardTitle>
          <CardDescription>
            Monthly churn rate and customer losses
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChurnAnalysisChart data={data.churnByMonth} />
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-y-0">
            <CardTitle className="text-sm font-medium">
              Average Revenue Per User
            </CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(data.arpu)}/mo
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Across all active subscriptions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-y-0">
            <CardTitle className="text-sm font-medium">
              Payment Failures
            </CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">12</div>
            <p className="text-xs text-muted-foreground mt-2">
              In the last 30 days
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
