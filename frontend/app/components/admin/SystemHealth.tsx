"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { Badge } from "../ui/badge";
import { Progress } from "../ui/progress";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import dynamic from "next/dynamic";
import { Database, AlertCircle } from "lucide-react";
import { logger } from "../../lib/logger";
import { SystemResourceCards } from "./_components/SystemResourceCards";
import { SystemServiceStatus } from "./_components/SystemServiceStatus";
import { formatBytes } from "./_components/system-health-utils";

const SystemPerformanceChart = dynamic(
  () => import("./_components/SystemPerformanceChart"),
  { ssr: false },
);
const SystemApiPerformanceChart = dynamic(
  () => import("./_components/SystemApiPerformanceChart"),
  { ssr: false },
);

interface SystemMetrics {
  cpu: {
    usage: number;
    cores: number;
    load: number[];
  };
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  disk: {
    used: number;
    total: number;
    percentage: number;
  };
  database: {
    connections: number;
    maxConnections: number;
    avgQueryTime: number;
    slowQueries: number;
  };
  redis: {
    connected: boolean;
    memory: number;
    keys: number;
    hitRate: number;
  };
  api: {
    uptime: number;
    requestsPerMinute: number;
    avgResponseTime: number;
    errorRate: number;
  };
  services: Array<{
    name: string;
    status: "healthy" | "degraded" | "down";
    uptime: number;
    lastCheck: Date;
  }>;
  performanceHistory: Array<{
    time: string;
    cpu: number;
    memory: number;
    requests: number;
    responseTime: number;
  }>;
}

export function SystemHealth() {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    fetchSystemMetrics();

    if (autoRefresh) {
      const interval = setInterval(fetchSystemMetrics, 30000); // Refresh every 30 seconds
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  const fetchSystemMetrics = async () => {
    try {
      const response = await fetch("/api/admin/system/health");
      if (!response.ok) throw new Error("Failed to fetch system metrics");
      const data = await response.json();
      setMetrics(data);
    } catch (error) {
      logger.error("Failed to load system metrics", { error: String(error) });
    } finally {
      setLoading(false);
    }
  };

  if (loading || !metrics) {
    return (
      <div className="space-y-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-32 bg-muted rounded animate-pulse" />
        ))}
      </div>
    );
  }

  const overallHealth = metrics.services.every((s) => s.status === "healthy")
    ? "healthy"
    : metrics.services.some((s) => s.status === "down")
      ? "critical"
      : "degraded";

  return (
    <div className="space-y-6">
      {overallHealth !== "healthy" && (
        <Alert
          variant={overallHealth === "critical" ? "destructive" : "default"}
        >
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>System Health Warning</AlertTitle>
          <AlertDescription>
            {overallHealth === "critical"
              ? "Critical services are down. Immediate attention required."
              : "Some services are experiencing degraded performance."}
          </AlertDescription>
        </Alert>
      )}

      <SystemResourceCards
        cpu={metrics.cpu}
        memory={metrics.memory}
        disk={metrics.disk}
        api={metrics.api}
      />

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Performance Metrics</CardTitle>
            <CardDescription>CPU and Memory usage over time</CardDescription>
          </CardHeader>
          <CardContent>
            <SystemPerformanceChart data={metrics.performanceHistory} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>API Performance</CardTitle>
            <CardDescription>Request volume and response times</CardDescription>
          </CardHeader>
          <CardContent>
            <SystemApiPerformanceChart data={metrics.performanceHistory} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Database Health</CardTitle>
            <CardDescription>PostgreSQL performance metrics</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Connections</span>
              </div>
              <div className="text-right">
                <div className="text-sm font-medium">
                  {metrics.database.connections} /{" "}
                  {metrics.database.maxConnections}
                </div>
                <Progress
                  value={
                    (metrics.database.connections /
                      metrics.database.maxConnections) *
                    100
                  }
                  className="w-24 mt-1"
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Avg Query Time</span>
              <Badge
                variant={
                  metrics.database.avgQueryTime > 100
                    ? "destructive"
                    : "default"
                }
              >
                {metrics.database.avgQueryTime}ms
              </Badge>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Slow Queries</span>
              <Badge
                variant={
                  metrics.database.slowQueries > 10
                    ? "destructive"
                    : "secondary"
                }
              >
                {metrics.database.slowQueries}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Redis Cache</CardTitle>
            <CardDescription>Cache performance and usage</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Status</span>
              <Badge
                variant={metrics.redis.connected ? "default" : "destructive"}
              >
                {metrics.redis.connected ? "Connected" : "Disconnected"}
              </Badge>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Memory Usage</span>
              <span className="text-sm">
                {formatBytes(metrics.redis.memory)}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Total Keys</span>
              <span className="text-sm">
                {metrics.redis.keys.toLocaleString()}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Cache Hit Rate</span>
              <Badge
                variant={metrics.redis.hitRate > 90 ? "default" : "destructive"}
              >
                {metrics.redis.hitRate}%
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      <SystemServiceStatus services={metrics.services} />
    </div>
  );
}
