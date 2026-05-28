"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../ui/card";
import { Badge } from "../../ui/badge";
import { AlertCircle, CheckCircle2, XCircle } from "lucide-react";
import { formatUptime, getStatusColor } from "./system-health-utils";

interface Service {
  name: string;
  status: "healthy" | "degraded" | "down";
  uptime: number;
  lastCheck: Date;
}

interface SystemServiceStatusProps {
  services: Service[];
}

const getStatusIcon = (status: string) => {
  switch (status) {
    case "healthy":
      return <CheckCircle2 className="h-4 w-4 text-success" />;
    case "degraded":
      return <AlertCircle className="h-4 w-4 text-warning" />;
    case "down":
      return <XCircle className="h-4 w-4 text-destructive" />;
    default:
      return null;
  }
};

export function SystemServiceStatus({ services }: SystemServiceStatusProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Service Status</CardTitle>
        <CardDescription>Health status of all system services</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {services.map((service) => (
            <div
              key={service.name}
              className="flex items-center justify-between p-3 rounded-lg border"
            >
              <div className="flex items-center gap-3">
                {getStatusIcon(service.status)}
                <div>
                  <div className="font-medium">{service.name}</div>
                  <div className="text-sm text-muted-foreground">
                    Uptime: {formatUptime(service.uptime)}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <Badge
                  className={getStatusColor(service.status)}
                  variant="outline"
                >
                  {service.status.toUpperCase()}
                </Badge>
                <div className="text-xs text-muted-foreground mt-1">
                  Last check: {new Date(service.lastCheck).toLocaleTimeString()}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
