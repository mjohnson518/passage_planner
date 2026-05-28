"use client";

import { Clock, Compass, Navigation, TrendingUp } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";

interface DashboardStats {
  totalPassages: number;
  totalDistance: number;
  avgDuration: number;
}

interface StatsOverviewProps {
  stats: DashboardStats;
}

export function StatsOverview({ stats }: StatsOverviewProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
      <Card className="card-nautical">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Navigation className="h-4 w-4" />
            Total Passages
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-display font-bold text-gradient">
            {stats.totalPassages}
          </div>
          <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
            <TrendingUp className="h-3 w-3 text-success" />
            <span className="text-success">+3</span> this month
          </p>
        </CardContent>
      </Card>

      <Card className="card-nautical">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Compass className="h-4 w-4" />
            Distance Sailed
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-display font-bold">
            {stats.totalDistance.toLocaleString()}{" "}
            <span className="text-lg text-muted-foreground">nm</span>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Across all passages
          </p>
        </CardContent>
      </Card>

      <Card className="card-nautical">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Avg Duration
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-display font-bold">
            {stats.avgDuration}
            <span className="text-lg text-muted-foreground">h</span>
          </div>
          <p className="text-xs text-muted-foreground mt-2">Per passage</p>
        </CardContent>
      </Card>
    </div>
  );
}
