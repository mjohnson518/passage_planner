"use client";

import { useMemo } from "react";
import dynamic from "next/dynamic";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";
import type { FleetAnalytics } from "@/types/shared";

const VesselUtilizationChart = dynamic(
  () => import("./_components/VesselUtilizationChart"),
  { ssr: false },
);
const PopularRoutesChart = dynamic(
  () => import("./_components/PopularRoutesChart"),
  { ssr: false },
);
const FleetDistributionChart = dynamic(
  () => import("./_components/FleetDistributionChart"),
  { ssr: false },
);
const UsageTrendChart = dynamic(() => import("./_components/UsageTrendChart"), {
  ssr: false,
});

interface FleetAnalyticsDashboardProps {
  fleetId: string;
  vessels?: any[];
  members?: any[];
}

export default function FleetAnalyticsDashboard({
  fleetId,
}: FleetAnalyticsDashboardProps) {
  // Mock data for now — derived from fleetId during render
  const analytics = useMemo<FleetAnalytics>(
    () => ({
      fleetId,
      totalVessels: 5,
      activeVessels: 4,
      totalCrew: 12,
      totalPassages: 156,
      totalDistance: 12450,
      averagePassageDistance: 79.8,
      vesselUtilization: [
        {
          vesselId: "1",
          name: "Serenity",
          passagesCount: 45,
          totalDistance: 3200,
          lastUsed: new Date(),
        },
        {
          vesselId: "2",
          name: "Wind Dancer",
          passagesCount: 38,
          totalDistance: 2890,
          lastUsed: new Date(),
        },
        {
          vesselId: "3",
          name: "Blue Horizon",
          passagesCount: 32,
          totalDistance: 2410,
          lastUsed: new Date(),
        },
        {
          vesselId: "4",
          name: "Ocean Spirit",
          passagesCount: 28,
          totalDistance: 2150,
          lastUsed: new Date(),
        },
        {
          vesselId: "5",
          name: "Wave Runner",
          passagesCount: 13,
          totalDistance: 1800,
          lastUsed: new Date(),
        },
      ],
      popularRoutes: [
        { departure: "Boston", destination: "Portland", count: 23 },
        { departure: "Newport", destination: "Block Island", count: 18 },
        { departure: "Annapolis", destination: "Norfolk", count: 15 },
        { departure: "Miami", destination: "Key West", count: 12 },
      ],
    }),
    [fleetId],
  );

  // Prepare chart data
  const utilizationData = analytics.vesselUtilization.map((v: any) => ({
    name: v.name,
    passages: v.passagesCount,
    distance: v.totalDistance,
  }));

  const routeData = analytics.popularRoutes.map((r: any) => ({
    route: `${r.departure} → ${r.destination}`,
    count: r.count,
  }));

  const pieData = analytics.vesselUtilization.map((v: any) => ({
    name: v.name,
    value: v.passagesCount,
  }));

  // Monthly usage trend (mock data)
  const trendData = [
    { month: "Jan", passages: 12 },
    { month: "Feb", passages: 15 },
    { month: "Mar", passages: 18 },
    { month: "Apr", passages: 22 },
    { month: "May", passages: 28 },
    { month: "Jun", passages: 25 },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Vessel Utilization */}
      <Card>
        <CardHeader>
          <CardTitle>Vessel Utilization</CardTitle>
          <CardDescription>Passages per vessel</CardDescription>
        </CardHeader>
        <CardContent>
          <VesselUtilizationChart data={utilizationData} />
        </CardContent>
      </Card>

      {/* Popular Routes */}
      <Card>
        <CardHeader>
          <CardTitle>Popular Routes</CardTitle>
          <CardDescription>Most frequently sailed passages</CardDescription>
        </CardHeader>
        <CardContent>
          <PopularRoutesChart data={routeData} />
        </CardContent>
      </Card>

      {/* Fleet Usage Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>Fleet Distribution</CardTitle>
          <CardDescription>Passage distribution across vessels</CardDescription>
        </CardHeader>
        <CardContent>
          <FleetDistributionChart data={pieData} />
        </CardContent>
      </Card>

      {/* Usage Trend */}
      <Card>
        <CardHeader>
          <CardTitle>Usage Trend</CardTitle>
          <CardDescription>Monthly passage count</CardDescription>
        </CardHeader>
        <CardContent>
          <UsageTrendChart data={trendData} />
        </CardContent>
      </Card>

      {/* Summary Stats */}
      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle>Fleet Summary</CardTitle>
          <CardDescription>Key performance indicators</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-muted/30 rounded-lg">
              <p className="text-2xl font-bold">{analytics.totalPassages}</p>
              <p className="text-sm text-muted-foreground">Total Passages</p>
            </div>
            <div className="text-center p-4 bg-muted/30 rounded-lg">
              <p className="text-2xl font-bold">
                {analytics.totalDistance.toLocaleString()} nm
              </p>
              <p className="text-sm text-muted-foreground">Total Distance</p>
            </div>
            <div className="text-center p-4 bg-muted/30 rounded-lg">
              <p className="text-2xl font-bold">
                {analytics.averagePassageDistance.toFixed(1)} nm
              </p>
              <p className="text-sm text-muted-foreground">Avg Distance</p>
            </div>
            <div className="text-center p-4 bg-muted/30 rounded-lg">
              <p className="text-2xl font-bold">
                {Math.round(
                  (analytics.activeVessels / analytics.totalVessels) * 100,
                )}
                %
              </p>
              <p className="text-sm text-muted-foreground">Fleet Active</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
