"use client";

import { Card, CardContent, CardHeader, CardTitle } from "../../ui/card";
import { Progress } from "../../ui/progress";
import { Activity, MessageSquare, Clock, AlertCircle } from "lucide-react";
import type { Agent } from "./agent-monitoring-types";

interface AgentSummaryCardsProps {
  agents: Agent[];
}

export function AgentSummaryCards({ agents }: AgentSummaryCardsProps) {
  const runningAgents = agents.filter((a) => a.status === "running").length;
  const totalAgents = agents.length;

  return (
    <div className="grid gap-4 md:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Active Agents</CardTitle>
          <Activity className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {runningAgents} / {totalAgents}
          </div>
          <Progress
            value={(runningAgents / totalAgents) * 100}
            className="mt-2"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Requests</CardTitle>
          <MessageSquare className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {agents
              .reduce((sum, a) => sum + a.metrics.requestsProcessed, 0)
              .toLocaleString()}
          </div>
          <p className="text-xs text-muted-foreground mt-1">Last 24 hours</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Avg Response Time
          </CardTitle>
          <Clock className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {Math.round(
              agents.reduce((sum, a) => sum + a.metrics.avgResponseTime, 0) /
                agents.length,
            )}
            ms
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Across all agents
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Error Rate</CardTitle>
          <AlertCircle className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {(
              agents.reduce((sum, a) => sum + a.metrics.errorRate, 0) /
              agents.length
            ).toFixed(2)}
            %
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Average error rate
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
