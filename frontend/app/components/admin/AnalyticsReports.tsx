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
import { Button } from "../ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { DatePickerWithRange } from "../ui/date-picker";
import { DateRange } from "react-day-picker";
import dynamic from "next/dynamic";
import { Download, FileText } from "lucide-react";
import { toast } from "sonner";
import { format, addDays } from "date-fns";
import { logger } from "../../lib/logger";
import { AnalyticsKpiCards } from "./_components/AnalyticsKpiCards";
import { PopularRoutesTable } from "./_components/PopularRoutesTable";
import { UserEngagementCard } from "./_components/UserEngagementCard";

const UserActivityChart = dynamic(
  () => import("./_components/UserActivityChart"),
  { ssr: false },
);
const WeatherConditionsChart = dynamic(
  () => import("./_components/WeatherConditionsChart"),
  { ssr: false },
);
const FeatureUsageChart = dynamic(
  () => import("./_components/FeatureUsageChart"),
  { ssr: false },
);
const PerformanceRadarChart = dynamic(
  () => import("./_components/PerformanceRadarChart"),
  { ssr: false },
);

interface AnalyticsData {
  passageStats: {
    total: number;
    completed: number;
    inProgress: number;
    planned: number;
    averageDistance: number;
    averageDuration: number;
  };
  userActivity: {
    dailyActiveUsers: Array<{ date: string; count: number }>;
    weeklyActiveUsers: Array<{ week: string; count: number }>;
    monthlyActiveUsers: Array<{ month: string; count: number }>;
  };
  popularRoutes: Array<{
    from: string;
    to: string;
    count: number;
    avgDistance: number;
    avgDuration: number;
  }>;
  weatherConditions: Array<{
    condition: string;
    count: number;
    percentage: number;
  }>;
  userEngagement: {
    avgSessionDuration: number;
    bounceRate: number;
    pagesPerSession: number;
    conversionRate: number;
  };
  featureUsage: Array<{
    feature: string;
    usage: number;
    tier: "free" | "pro" | "enterprise";
  }>;
  performanceMetrics: {
    avgPlanningTime: number;
    avgResponseTime: number;
    successRate: number;
    errorRate: number;
  };
}

export function AnalyticsReports() {
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: addDays(new Date(), -30),
    to: new Date(),
  });
  const [reportType, setReportType] = useState("overview");

  const { data, isLoading } = useQuery<AnalyticsData>({
    queryKey: [
      "admin-analytics",
      dateRange?.from?.toISOString(),
      dateRange?.to?.toISOString(),
      reportType,
    ],
    queryFn: async () => {
      try {
        const response = await fetch(
          `/api/admin/analytics?from=${dateRange?.from?.toISOString()}&to=${dateRange?.to?.toISOString()}&type=${reportType}`,
        );
        if (!response.ok) throw new Error("Failed to fetch analytics data");
        return await response.json();
      } catch (error) {
        logger.error("Failed to load analytics", {
          error: String(error),
          reportType,
        });
        toast.error("Failed to load analytics data");
        throw error;
      }
    },
  });

  const exportReport = async (exportFormat: "csv" | "pdf") => {
    try {
      const response = await fetch(
        `/api/admin/analytics/export?format=${exportFormat}&from=${dateRange?.from?.toISOString()}&to=${dateRange?.to?.toISOString()}&type=${reportType}`,
      );
      if (!response.ok) throw new Error("Failed to export report");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `analytics-report-${dateRange?.from ? format(dateRange.from, "yyyy-MM-dd") : "start"}-${dateRange?.to ? format(dateRange.to, "yyyy-MM-dd") : "end"}.${exportFormat}`;
      a.click();

      toast.success(`Report exported as ${exportFormat.toUpperCase()}`);
    } catch (error) {
      toast.error("Failed to export report");
    }
  };

  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-64 bg-muted rounded animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold">Analytics Reports</h2>
        <div className="flex items-center gap-4">
          <DatePickerWithRange date={dateRange} onDateChange={setDateRange} />
          <Select value={reportType} onValueChange={setReportType}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="overview">Overview</SelectItem>
              <SelectItem value="passages">Passages</SelectItem>
              <SelectItem value="users">Users</SelectItem>
              <SelectItem value="performance">Performance</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => exportReport("csv")} variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          <Button onClick={() => exportReport("pdf")}>
            <FileText className="h-4 w-4 mr-2" />
            Export PDF
          </Button>
        </div>
      </div>

      <AnalyticsKpiCards
        passageStats={data.passageStats}
        successRate={data.performanceMetrics.successRate}
      />

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>User Activity Trends</CardTitle>
            <CardDescription>Daily active users over time</CardDescription>
          </CardHeader>
          <CardContent>
            <UserActivityChart data={data.userActivity.dailyActiveUsers} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Weather Conditions</CardTitle>
            <CardDescription>Passages by weather conditions</CardDescription>
          </CardHeader>
          <CardContent>
            <WeatherConditionsChart data={data.weatherConditions} />
          </CardContent>
        </Card>
      </div>

      <PopularRoutesTable routes={data.popularRoutes} />

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Feature Usage</CardTitle>
            <CardDescription>
              Usage by feature and subscription tier
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FeatureUsageChart data={data.featureUsage} />
          </CardContent>
        </Card>

        <UserEngagementCard
          avgSessionDuration={data.userEngagement.avgSessionDuration}
          bounceRate={data.userEngagement.bounceRate}
          pagesPerSession={data.userEngagement.pagesPerSession}
          conversionRate={data.userEngagement.conversionRate}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Performance Metrics</CardTitle>
          <CardDescription>System performance overview</CardDescription>
        </CardHeader>
        <CardContent>
          <PerformanceRadarChart
            data={[
              {
                metric: "Planning Speed",
                value: 100 - data.performanceMetrics.avgPlanningTime,
              },
              {
                metric: "Response Time",
                value: 100 - data.performanceMetrics.avgResponseTime / 10,
              },
              {
                metric: "Success Rate",
                value: data.performanceMetrics.successRate,
              },
              {
                metric: "Reliability",
                value: 100 - data.performanceMetrics.errorRate,
              },
              { metric: "User Satisfaction", value: 85 }, // Placeholder
            ]}
          />
        </CardContent>
      </Card>
    </div>
  );
}
