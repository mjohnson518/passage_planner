"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { Progress } from "../ui/progress";
import { Badge } from "../ui/badge";
import {
  DollarSign,
  Users,
  TrendingUp,
  TrendingDown,
  Activity,
  CreditCard,
  UserCheck,
  UserX,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import dynamic from "next/dynamic";
import { logger } from "../../lib/logger";

const AdminRevenueChart = dynamic(
  () => import("./_components/AdminRevenueChart"),
  { ssr: false },
);
const AdminUserGrowthChart = dynamic(
  () => import("./_components/AdminUserGrowthChart"),
  { ssr: false },
);

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

interface MetricCard {
  title: string;
  value: string | number;
  change: number;
  changeLabel: string;
  icon: any;
  trend: "up" | "down" | "neutral";
}

interface OverviewMetrics {
  revenue: {
    mrr: number;
    arr: number;
    growth: number;
    churn: number;
  };
  users: {
    total: number;
    paid: number;
    trial: number;
    active: number;
    newThisMonth: number;
    churnedThisMonth: number;
  };
  usage: {
    passagesPlanned: number;
    apiCallsToday: number;
    activeAgents: number;
    avgResponseTime: number;
  };
  health: {
    uptime: number;
    errorRate: number;
    queueDepth: number;
  };
}

interface OverviewResponse {
  metrics: OverviewMetrics;
  revenueChart: any[];
  userChart: any[];
}

export function AdminOverview() {
  const { data, isLoading } = useQuery<OverviewResponse>({
    queryKey: ["admin-overview-metrics"],
    queryFn: async () => {
      let response: Response;
      try {
        response = await fetch("/api/admin/metrics/overview", {
          credentials: "include",
        });
      } catch (error) {
        logger.error("Failed to fetch admin metrics", { error: String(error) });
        throw error;
      }
      if (!response.ok) throw new Error("Failed to fetch admin metrics");
      return await response.json();
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const metrics = data?.metrics;
  const revenueChart = data?.revenueChart ?? [];
  const userChart = data?.userChart ?? [];

  if (isLoading || !metrics) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(8)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="animate-pulse">
              <div className="h-4 bg-muted rounded w-1/2 mb-2"></div>
              <div className="h-8 bg-muted rounded w-3/4"></div>
            </CardHeader>
          </Card>
        ))}
      </div>
    );
  }

  const metricCards: MetricCard[] = [
    {
      title: "Monthly Recurring Revenue",
      value: `$${metrics.revenue.mrr.toLocaleString()}`,
      change: metrics.revenue.growth,
      changeLabel: "from last month",
      icon: DollarSign,
      trend: metrics.revenue.growth > 0 ? "up" : "down",
    },
    {
      title: "Total Users",
      value: metrics.users.total.toLocaleString(),
      change:
        ((metrics.users.newThisMonth - metrics.users.churnedThisMonth) /
          metrics.users.total) *
        100,
      changeLabel: "net growth",
      icon: Users,
      trend:
        metrics.users.newThisMonth > metrics.users.churnedThisMonth
          ? "up"
          : "down",
    },
    {
      title: "Paid Users",
      value: metrics.users.paid.toLocaleString(),
      change: (metrics.users.paid / metrics.users.total) * 100,
      changeLabel: "conversion rate",
      icon: CreditCard,
      trend: "neutral",
    },
    {
      title: "Active Users (30d)",
      value: metrics.users.active.toLocaleString(),
      change: (metrics.users.active / metrics.users.total) * 100,
      changeLabel: "engagement rate",
      icon: Activity,
      trend: "neutral",
    },
  ];

  const formatCurrency = (value: number) => {
    return currencyFormatter.format(value);
  };

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {metricCards.map((metric) => {
          const Icon = metric.icon;
          return (
            <Card key={metric.title}>
              <CardHeader className="flex flex-row items-center justify-between gap-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {metric.title}
                </CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metric.value}</div>
                <p className="text-xs text-muted-foreground flex items-center mt-1">
                  {metric.trend === "up" ? (
                    <ArrowUpRight className="h-3 w-3 text-success mr-1" />
                  ) : metric.trend === "down" ? (
                    <ArrowDownRight className="h-3 w-3 text-destructive mr-1" />
                  ) : null}
                  <span
                    className={
                      metric.trend === "up"
                        ? "text-success"
                        : metric.trend === "down"
                          ? "text-destructive"
                          : ""
                    }
                  >
                    {Math.abs(metric.change).toFixed(1)}%
                  </span>
                  <span className="ml-1">{metric.changeLabel}</span>
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Charts Row */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Revenue Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Revenue Trend</CardTitle>
            <CardDescription>
              Monthly recurring revenue over time
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AdminRevenueChart
              data={revenueChart}
              formatCurrency={formatCurrency}
            />
          </CardContent>
        </Card>

        {/* User Growth Chart */}
        <Card>
          <CardHeader>
            <CardTitle>User Growth</CardTitle>
            <CardDescription>New vs churned users by month</CardDescription>
          </CardHeader>
          <CardContent>
            <AdminUserGrowthChart data={userChart} />
          </CardContent>
        </Card>
      </div>

      {/* System Health */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>System Health</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>Uptime</span>
                <span className="font-medium">
                  {metrics.health.uptime.toFixed(2)}%
                </span>
              </div>
              <Progress value={metrics.health.uptime} className="h-2" />
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>Error Rate</span>
                <span className="font-medium">
                  {metrics.health.errorRate.toFixed(2)}%
                </span>
              </div>
              <Progress value={metrics.health.errorRate} className="h-2" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Usage Stats</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm">Passages Today</span>
              <Badge variant="secondary">{metrics.usage.passagesPlanned}</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-sm">API Calls</span>
              <Badge variant="secondary">{metrics.usage.apiCallsToday}</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-sm">Avg Response</span>
              <Badge variant="secondary">
                {metrics.usage.avgResponseTime}ms
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <button
              type="button"
              className="w-full text-left px-3 py-2 rounded hover:bg-muted text-sm"
            >
              View Error Logs
            </button>
            <button
              type="button"
              className="w-full text-left px-3 py-2 rounded hover:bg-muted text-sm"
            >
              Export User Data
            </button>
            <button
              type="button"
              className="w-full text-left px-3 py-2 rounded hover:bg-muted text-sm"
            >
              Send Newsletter
            </button>
            <button
              type="button"
              className="w-full text-left px-3 py-2 rounded hover:bg-muted text-sm"
            >
              System Maintenance
            </button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
