"use client";

import { Card, CardContent, CardHeader, CardTitle } from "../../ui/card";
import { Progress } from "../../ui/progress";
import { Activity, HardDrive, Cpu, MemoryStick } from "lucide-react";
import { formatBytes, formatUptime } from "./system-health-utils";

interface SystemResourceCardsProps {
  cpu: { usage: number; cores: number; load: number[] };
  memory: { used: number; total: number; percentage: number };
  disk: { used: number; total: number; percentage: number };
  api: { uptime: number; requestsPerMinute: number };
}

export function SystemResourceCards({
  cpu,
  memory,
  disk,
  api,
}: SystemResourceCardsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-y-0 pb-2">
          <CardTitle className="text-sm font-medium">CPU Usage</CardTitle>
          <Cpu className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{cpu.usage}%</div>
          <Progress value={cpu.usage} className="mt-2" />
          <p className="text-xs text-muted-foreground mt-2">
            {cpu.cores} cores | Load: {cpu.load.join(", ")}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Memory Usage</CardTitle>
          <MemoryStick className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{memory.percentage}%</div>
          <Progress value={memory.percentage} className="mt-2" />
          <p className="text-xs text-muted-foreground mt-2">
            {formatBytes(memory.used)} / {formatBytes(memory.total)}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Disk Usage</CardTitle>
          <HardDrive className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{disk.percentage}%</div>
          <Progress value={disk.percentage} className="mt-2" />
          <p className="text-xs text-muted-foreground mt-2">
            {formatBytes(disk.used)} / {formatBytes(disk.total)}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-y-0 pb-2">
          <CardTitle className="text-sm font-medium">API Uptime</CardTitle>
          <Activity className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatUptime(api.uptime)}</div>
          <p className="text-xs text-muted-foreground mt-2">
            {api.requestsPerMinute} req/min
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
