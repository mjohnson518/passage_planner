import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Loader2, CheckCircle2 } from "lucide-react";

interface AgentStatusEntry {
  name: string;
  status: string;
  message?: string;
}

interface AgentStatusCardProps {
  connected: boolean;
  agentStatuses: Record<string, AgentStatusEntry>;
}

export function AgentStatusCard({
  connected,
  agentStatuses,
}: AgentStatusCardProps) {
  return (
    <Card
      data-testid="planner-loading"
      className="mb-6 border-primary/20 bg-primary/5"
    >
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Loader2 className="h-5 w-5 animate-spin" />
          Planning in Progress
        </CardTitle>
        <CardDescription>
          WebSocket: {connected ? "🟢 Connected" : "🔴 Disconnected"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {Object.entries(agentStatuses).map(([agentName, status]) => (
            <div key={agentName} className="flex items-center gap-2 text-sm">
              {status.status === "active" ? (
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
              ) : (
                <CheckCircle2 className="h-4 w-4 text-success" />
              )}
              <span className="font-medium capitalize">{agentName}:</span>
              <span className="text-muted-foreground">{status.message}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
