"use client";

import { Card, CardContent, CardHeader, CardTitle } from "../../ui/card";
import { Badge } from "../../ui/badge";
import { Anchor, MapPin, Calendar, TrendingUp } from "lucide-react";

interface AnalyticsKpiCardsProps {
  passageStats: {
    total: number;
    completed: number;
    inProgress: number;
    averageDistance: number;
    averageDuration: number;
  };
  successRate: number;
}

export function AnalyticsKpiCards({
  passageStats,
  successRate,
}: AnalyticsKpiCardsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Passages</CardTitle>
          <Anchor className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {passageStats.total.toLocaleString()}
          </div>
          <div className="mt-2 flex gap-2">
            <Badge variant="secondary">
              {passageStats.completed} completed
            </Badge>
            <Badge variant="outline">{passageStats.inProgress} active</Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Avg Distance</CardTitle>
          <MapPin className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {passageStats.averageDistance.toFixed(1)} nm
          </div>
          <p className="text-xs text-muted-foreground mt-1">Per passage</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Avg Duration</CardTitle>
          <Calendar className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {(passageStats.averageDuration / 24).toFixed(1)} days
          </div>
          <p className="text-xs text-muted-foreground mt-1">Per passage</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{successRate}%</div>
          <p className="text-xs text-muted-foreground mt-1">Planning success</p>
        </CardContent>
      </Card>
    </div>
  );
}
