"use client";

import { useState, useEffect } from "react";
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
import { Badge } from "../ui/badge";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Users,
  CreditCard,
  AlertCircle,
} from "lucide-react";
import { format } from "date-fns";
import { useChartColors } from "@/lib/chart-colors";
import { logger } from "../../lib/logger";

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

export function RevenueMetrics() {
  const chartColors = useChartColors();
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState("30d");
  const [data, setData] = useState<RevenueData | null>(null);

  useEffect(() => {
    fetchRevenueData();
  }, [timeRange]);

  const fetchRevenueData = async () => {
    try {
      const response = await fetch(`/api/admin/revenue?range=${timeRange}`);
      if (!response.ok) throw new Error("Failed to fetch revenue data");
      const data = await response.json();
      setData(data);
    } catch (error) {
      logger.error("Failed to load revenue data", {
        error: String(error),
        timeRange,
      });
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatPercentage = (value: number) => {
    return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
  };

  const COLORS = [
    chartColors.primary,
    chartColors.secondary,
    chartColors.tertiary,
    chartColors.danger,
  ];

  if (loading || !data) {
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

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Monthly Recurring Revenue
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(data.mrr)}</div>
            <p className="text-xs text-muted-foreground">
              <span
                className={
                  data.growth >= 0 ? "text-success" : "text-destructive"
                }
              >
                {formatPercentage(data.growth)}
              </span>{" "}
              from last month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Annual Recurring Revenue
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(data.arr)}</div>
            <p className="text-xs text-muted-foreground">Projected from MRR</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Churn Rate</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.churn.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">Monthly average</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Customer LTV</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(data.ltv)}</div>
            <p className="text-xs text-muted-foreground">
              Average lifetime value
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Revenue Growth</CardTitle>
            <CardDescription>Monthly revenue over time</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={data.revenueByMonth}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(value: any) => formatCurrency(value)} />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke={chartColors.primary}
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
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
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={data.revenueByTier}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ tier, percent }: any) =>
                    `${tier}: ${(percent * 100).toFixed(0)}%`
                  }
                  outerRadius={80}
                  fill={chartColors.primary}
                  dataKey="revenue"
                >
                  {data.revenueByTier.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip formatter={(value: any) => formatCurrency(value)} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Subscription Distribution</CardTitle>
          <CardDescription>Active subscriptions by tier</CardDescription>
        </CardHeader>
        <CardContent>
          {(() => {
            const total =
              data.subscriptions.free +
              data.subscriptions.premium +
              data.subscriptions.pro +
              data.subscriptions.enterprise;
            const tiers = [
              {
                key: "free",
                label: "Free",
                count: data.subscriptions.free,
                color: "bg-muted-foreground",
                variant: "secondary" as const,
              },
              {
                key: "premium",
                label: "Premium",
                count: data.subscriptions.premium,
                color: "bg-warning",
                variant: "default" as const,
              },
              {
                key: "pro",
                label: "Pro",
                count: data.subscriptions.pro,
                color: "bg-primary",
                variant: "default" as const,
              },
              {
                key: "enterprise",
                label: "Enterprise",
                count: data.subscriptions.enterprise,
                color: "bg-destructive",
                variant: "destructive" as const,
              },
            ];
            return (
              <div className="space-y-4">
                {tiers.map((t) => (
                  <div key={t.key}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Badge variant={t.variant}>{t.label}</Badge>
                        <span className="text-sm font-medium">
                          {t.count} users
                        </span>
                        {t.key === "premium" &&
                          data.foundingMembers !== undefined &&
                          data.foundingMembers > 0 && (
                            <span className="text-xs text-warning">
                              ({data.foundingMembers} founding)
                            </span>
                          )}
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {total > 0
                          ? ((t.count / total) * 100).toFixed(1)
                          : "0.0"}
                        %
                      </span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div
                        className={`${t.color} h-2 rounded-full`}
                        style={{
                          width:
                            total > 0 ? `${(t.count / total) * 100}%` : "0%",
                        }}
                      />
                    </div>
                  </div>
                ))}
                {data.topUpRevenue !== undefined && data.topUpRevenue > 0 && (
                  <div className="pt-2 border-t">
                    <span className="text-sm text-muted-foreground">
                      Top-up pack revenue (one-time):{" "}
                      <strong>{formatCurrency(data.topUpRevenue)}</strong>
                    </span>
                  </div>
                )}
              </div>
            );
          })()}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Churn Analysis</CardTitle>
          <CardDescription>
            Monthly churn rate and customer losses
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.churnByMonth}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis
                yAxisId="left"
                orientation="left"
                stroke={chartColors.primary}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                stroke={chartColors.secondary}
              />
              <Tooltip />
              <Legend />
              <Bar
                yAxisId="left"
                dataKey="rate"
                fill={chartColors.primary}
                name="Churn Rate (%)"
              />
              <Bar
                yAxisId="right"
                dataKey="count"
                fill={chartColors.secondary}
                name="Customers Lost"
              />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
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
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
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
