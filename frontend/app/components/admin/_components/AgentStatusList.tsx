"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../ui/card";
import { Button } from "../../ui/button";
import { Badge } from "../../ui/badge";
import { Alert, AlertDescription } from "../../ui/alert";
import {
  Bot,
  RefreshCw,
  PauseCircle,
  PlayCircle,
  AlertCircle,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import type { Agent } from "./agent-monitoring-types";

interface AgentStatusListProps {
  agents: Agent[];
  selectedAgent: string | null;
  onSelectAgent: (agentId: string) => void;
  onAction: (agentId: string, action: "start" | "stop" | "restart") => void;
}

function getStatusIcon(status: string) {
  switch (status) {
    case "running":
      return <CheckCircle2 className="h-4 w-4 text-success" />;
    case "stopped":
      return <PauseCircle className="h-4 w-4 text-muted-foreground" />;
    case "error":
      return <XCircle className="h-4 w-4 text-destructive" />;
    case "starting":
      return <RefreshCw className="h-4 w-4 text-warning animate-spin" />;
    default:
      return null;
  }
}

function getStatusColor(status: string) {
  switch (status) {
    case "running":
      return "default";
    case "stopped":
      return "secondary";
    case "error":
      return "destructive";
    case "starting":
      return "outline";
    default:
      return "secondary";
  }
}

function formatUptime(seconds: number) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);

  return parts.join(" ") || "0m";
}

function getAgentIcon(type: string) {
  const icons: Record<string, JSX.Element> = {
    weather: <Bot className="h-5 w-5 text-primary" />,
    tidal: <Bot className="h-5 w-5 text-cyan-500" />,
    port: <Bot className="h-5 w-5 text-success" />,
    routing: <Bot className="h-5 w-5 text-purple-500" />,
    safety: <Bot className="h-5 w-5 text-accent" />,
    meta: <Bot className="h-5 w-5 text-pink-500" />,
  };
  return icons[type] || <Bot className="h-5 w-5" />;
}

export function AgentStatusList({
  agents,
  selectedAgent,
  onSelectAgent,
  onAction,
}: AgentStatusListProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Agent Status</CardTitle>
        <CardDescription>
          Current status and control of all agents
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {agents.map((agent) => (
            // Row contains nested action buttons, so it can't be a <button>;
            // role="button" + keyboard handler is the correct accessible pattern.
            // oxlint-disable-next-line react-doctor/prefer-tag-over-role
            <div
              role="button"
              key={agent.id}
              tabIndex={0}
              className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                selectedAgent === agent.id ? "border-primary bg-primary/5" : ""
              }`}
              onClick={() => onSelectAgent(agent.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelectAgent(agent.id);
                }
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {getAgentIcon(agent.type)}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{agent.name}</span>
                      {getStatusIcon(agent.status)}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Uptime: {formatUptime(agent.uptime)}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Badge variant={getStatusColor(agent.status)}>
                    {agent.status.toUpperCase()}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      onAction(
                        agent.id,
                        agent.status === "running" ? "stop" : "start",
                      );
                    }}
                  >
                    {agent.status === "running" ? (
                      <PauseCircle className="h-4 w-4" />
                    ) : (
                      <PlayCircle className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      onAction(agent.id, "restart");
                    }}
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-4 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">CPU:</span>
                  <span className="ml-1 font-medium">
                    {agent.metrics.cpuUsage}%
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Memory:</span>
                  <span className="ml-1 font-medium">
                    {agent.metrics.memoryUsage}%
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Requests:</span>
                  <span className="ml-1 font-medium">
                    {agent.metrics.requestsProcessed}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Errors:</span>
                  <span className="ml-1 font-medium">
                    {agent.metrics.errorRate}%
                  </span>
                </div>
              </div>

              {agent.lastError && (
                <Alert variant="destructive" className="mt-3">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    {agent.lastError}
                  </AlertDescription>
                </Alert>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
