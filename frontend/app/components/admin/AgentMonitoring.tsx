"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import { AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { logger } from "../../lib/logger";
import type { Agent, AgentHistory } from "./_components/agent-monitoring-types";
import { AgentSummaryCards } from "./_components/AgentSummaryCards";
import { AgentStatusList } from "./_components/AgentStatusList";
import { AgentCapabilities } from "./_components/AgentCapabilities";

const AgentPerformanceChart = dynamic(
  () => import("./_components/AgentPerformanceChart"),
  { ssr: false },
);

export function AgentMonitoring() {
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [autoRefresh] = useState(true);

  const {
    data: agents = [],
    isLoading: loading,
    refetch: refetchAgents,
  } = useQuery<Agent[]>({
    queryKey: ["admin-agents-health"],
    queryFn: async () => {
      try {
        const response = await fetch("/api/agents/health");
        if (!response.ok) throw new Error("Failed to fetch agents");
        const data = await response.json();
        return data.agents;
      } catch (error) {
        logger.error("Failed to load agents", { error: String(error) });
        toast.error("Failed to load agent status");
        throw error;
      }
    },
    refetchInterval: autoRefresh ? 10000 : false, // Refresh every 10 seconds
  });

  const { data: agentHistory = [] } = useQuery<AgentHistory[]>({
    queryKey: ["admin-agent-history", selectedAgent],
    enabled: Boolean(selectedAgent),
    queryFn: async () => {
      try {
        const response = await fetch(`/api/agents/${selectedAgent}/history`);
        if (!response.ok) throw new Error("Failed to fetch agent history");
        const data = await response.json();
        return data.history;
      } catch (error) {
        logger.error("Failed to load agent history", {
          error: String(error),
          agentId: selectedAgent,
        });
        throw error;
      }
    },
  });

  const handleAgentAction = async (
    agentId: string,
    action: "start" | "stop" | "restart",
  ) => {
    try {
      const response = await fetch(`/api/agents/${agentId}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) throw new Error(`Failed to ${action} agent`);

      toast.success(`Agent ${action} initiated`);
      refetchAgents();
    } catch (error) {
      toast.error(`Failed to ${action} agent`);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-32 bg-muted rounded animate-pulse" />
        ))}
      </div>
    );
  }

  const hasErrors = agents.some((a) => a.status === "error");

  return (
    <div className="space-y-6">
      {hasErrors && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Agent Errors Detected</AlertTitle>
          <AlertDescription>
            One or more agents are experiencing errors. Check the details below.
          </AlertDescription>
        </Alert>
      )}

      <AgentSummaryCards agents={agents} />

      <div className="grid gap-6 md:grid-cols-2">
        <AgentStatusList
          agents={agents}
          selectedAgent={selectedAgent}
          onSelectAgent={setSelectedAgent}
          onAction={handleAgentAction}
        />

        <Card>
          <CardHeader>
            <CardTitle>Agent Performance</CardTitle>
            <CardDescription>
              {selectedAgent
                ? `Performance metrics for ${agents.find((a) => a.id === selectedAgent)?.name}`
                : "Select an agent to view performance metrics"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {selectedAgent && agentHistory.length > 0 ? (
              <AgentPerformanceChart data={agentHistory} />
            ) : (
              <div className="flex items-center justify-center h-[400px] text-muted-foreground">
                Select an agent to view performance history
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <AgentCapabilities agents={agents} />
    </div>
  );
}
