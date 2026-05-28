export interface Agent {
  id: string;
  name: string;
  type: "weather" | "tidal" | "port" | "routing" | "safety" | "meta";
  status: "running" | "stopped" | "error" | "starting";
  uptime: number;
  lastHeartbeat: Date;
  metrics: {
    requestsProcessed: number;
    avgResponseTime: number;
    errorRate: number;
    cpuUsage: number;
    memoryUsage: number;
  };
  capabilities: string[];
  lastError?: string;
}

export interface AgentHistory {
  timestamp: string;
  cpuUsage: number;
  memoryUsage: number;
  requestsPerMinute: number;
  avgResponseTime: number;
}
