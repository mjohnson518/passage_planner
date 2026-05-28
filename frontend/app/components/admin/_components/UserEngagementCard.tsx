"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../ui/card";
import { Badge } from "../../ui/badge";

interface UserEngagementCardProps {
  avgSessionDuration: number;
  bounceRate: number;
  pagesPerSession: number;
  conversionRate: number;
}

export function UserEngagementCard({
  avgSessionDuration,
  bounceRate,
  pagesPerSession,
  conversionRate,
}: UserEngagementCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>User Engagement</CardTitle>
        <CardDescription>Key engagement metrics</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Avg Session Duration</span>
            <span className="text-sm font-bold">
              {Math.floor(avgSessionDuration / 60)}m {avgSessionDuration % 60}s
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Bounce Rate</span>
            <Badge variant={bounceRate > 50 ? "destructive" : "default"}>
              {bounceRate}%
            </Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Pages per Session</span>
            <span className="text-sm font-bold">
              {pagesPerSession.toFixed(1)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Conversion Rate</span>
            <Badge variant="default">{conversionRate}%</Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
