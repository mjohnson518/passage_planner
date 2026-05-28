"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../ui/card";
import { Bot, CheckCircle2 } from "lucide-react";
import type { Agent } from "./agent-monitoring-types";

interface AgentCapabilitiesProps {
  agents: Agent[];
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

export function AgentCapabilities({ agents }: AgentCapabilitiesProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Agent Capabilities</CardTitle>
        <CardDescription>Overview of what each agent can do</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {agents.map((agent) => (
            <div key={agent.id} className="space-y-2">
              <div className="flex items-center gap-2">
                {getAgentIcon(agent.type)}
                <span className="font-medium">{agent.name}</span>
              </div>
              <div className="space-y-1">
                {agent.capabilities.map((capability) => (
                  <div
                    key={`${agent.id}-${capability}`}
                    className="text-sm text-muted-foreground flex items-center gap-1"
                  >
                    <CheckCircle2 className="h-3 w-3 text-success" />
                    {capability}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
