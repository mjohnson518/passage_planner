"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../../components/ui/tabs";

const ExportDialog = dynamic(
  () =>
    import("../../components/export/ExportDialog").then((m) => ({
      default: m.ExportDialog,
    })),
  { ssr: false },
);
import {
  MapPin,
  Navigation,
  Download,
  Share2,
  AlertTriangle,
} from "lucide-react";
import type { Passage } from "@/types/shared";
import { logger } from "../../lib/logger";
import { RouteTab } from "./_components/RouteTab";
import { WeatherTab } from "./_components/WeatherTab";
import { TidesTab } from "./_components/TidesTab";

// Mock data for demonstration
const mockPassage: Passage = {
  id: "1",
  userId: "user1",
  boatId: "boat1",
  name: "Boston to Portland Summer Cruise",
  departure: {
    name: "Boston Harbor",
    coordinates: { lat: 42.3601, lng: -71.0589 },
    facilities: ["fuel", "water", "provisions"],
    vhfChannel: 16,
  },
  destination: {
    name: "Portland Harbor",
    coordinates: { lat: 43.6591, lng: -70.2568 },
    facilities: ["fuel", "water", "customs"],
    vhfChannel: 16,
  },
  waypoints: [
    {
      id: "1",
      name: "Gloucester",
      coordinates: { lat: 42.6159, lng: -70.662 },
      type: "marina",
    },
    {
      id: "2",
      name: "Isles of Shoals",
      coordinates: { lat: 42.9869, lng: -70.6231 },
      type: "anchorage",
    },
  ],
  departureTime: new Date("2024-07-15T08:00:00"),
  estimatedArrivalTime: new Date("2024-07-16T00:00:00"),
  distance: 98,
  estimatedDuration: 16,
  weather: [
    {
      startTime: new Date("2024-07-15T08:00:00"),
      endTime: new Date("2024-07-15T14:00:00"),
      location: { lat: 42.45, lng: -70.85 },
      wind: { direction: 225, speed: 12, gusts: 18 },
      waves: { height: 1.2, period: 6, direction: 200 },
      visibility: 10,
      precipitation: 0,
      pressure: 1018,
      temperature: 22,
    },
    {
      startTime: new Date("2024-07-15T14:00:00"),
      endTime: new Date("2024-07-15T20:00:00"),
      location: { lat: 42.8, lng: -70.65 },
      wind: { direction: 240, speed: 15, gusts: 22 },
      waves: { height: 1.5, period: 7, direction: 210 },
      visibility: 8,
      precipitation: 0,
      pressure: 1016,
      temperature: 24,
    },
    {
      startTime: new Date("2024-07-15T20:00:00"),
      endTime: new Date("2024-07-16T00:00:00"),
      location: { lat: 43.3, lng: -70.45 },
      wind: { direction: 250, speed: 10, gusts: 15 },
      waves: { height: 1.0, period: 5, direction: 220 },
      visibility: 12,
      precipitation: 0,
      pressure: 1017,
      temperature: 20,
    },
  ],
  tides: [
    {
      location: "Boston Harbor",
      coordinates: { lat: 42.3601, lng: -71.0589 },
      type: "high",
      time: new Date("2024-07-15T06:30:00"),
      height: 3.2,
      current: { speed: 0.5, direction: 45 },
    },
    {
      location: "Boston Harbor",
      coordinates: { lat: 42.3601, lng: -71.0589 },
      type: "low",
      time: new Date("2024-07-15T12:45:00"),
      height: 0.3,
      current: { speed: 1.2, direction: 225 },
    },
    {
      location: "Portsmouth Harbor",
      coordinates: { lat: 43.0718, lng: -70.7626 },
      type: "high",
      time: new Date("2024-07-15T07:15:00"),
      height: 2.9,
      current: { speed: 0.8, direction: 60 },
    },
    {
      location: "Portsmouth Harbor",
      coordinates: { lat: 43.0718, lng: -70.7626 },
      type: "low",
      time: new Date("2024-07-15T13:30:00"),
      height: 0.4,
      current: { speed: 1.5, direction: 240 },
    },
    {
      location: "Portland Harbor",
      coordinates: { lat: 43.6591, lng: -70.2568 },
      type: "high",
      time: new Date("2024-07-15T07:45:00"),
      height: 3.0,
      current: { speed: 0.6, direction: 50 },
    },
    {
      location: "Portland Harbor",
      coordinates: { lat: 43.6591, lng: -70.2568 },
      type: "low",
      time: new Date("2024-07-15T14:00:00"),
      height: 0.2,
      current: { speed: 1.0, direction: 230 },
    },
  ],
  route: [
    {
      from: { lat: 42.3601, lng: -71.0589 },
      to: { lat: 42.6159, lng: -70.662 },
      bearing: 45,
      distance: 26,
      estimatedSpeed: 6,
      estimatedTime: 4.3,
    },
    {
      from: { lat: 42.6159, lng: -70.662 },
      to: { lat: 42.9869, lng: -70.6231 },
      bearing: 15,
      distance: 25,
      estimatedSpeed: 6,
      estimatedTime: 4.2,
    },
    {
      from: { lat: 42.9869, lng: -70.6231 },
      to: { lat: 43.6591, lng: -70.2568 },
      bearing: 5,
      distance: 47,
      estimatedSpeed: 6,
      estimatedTime: 7.8,
    },
  ],
  safety: {
    vhfChannels: [16, 9, 13],
    emergencyContacts: [],
    nearestSafeHarbors: [],
    navigationWarnings: ["Lobster pots near Isles of Shoals"],
  },
  preferences: {
    maxWindSpeed: 25,
    maxWaveHeight: 2,
    avoidNight: true,
    preferMotoring: false,
    comfortLevel: "cruising",
  },
  status: "planned",
  createdAt: new Date(),
  updatedAt: new Date(),
};

export default function PassageDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [showExportDialog, setShowExportDialog] = useState(false);

  const { data: passage = null, isLoading: loading } = useQuery<Passage>({
    queryKey: ["passage-detail", params.id],
    queryFn: async () => {
      try {
        const apiUrl =
          process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";
        const response = await fetch(`${apiUrl}/api/passages/${params.id}`);

        if (!response.ok) {
          throw new Error("Failed to fetch passage");
        }

        return (await response.json()) as Passage;
      } catch (error) {
        logger.error("Failed to fetch passage detail", {
          error: String(error),
          passageId: String(params.id),
        });
        // Fallback to mock data for now
        return mockPassage;
      }
    },
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Navigation className="h-12 w-12 text-muted-foreground mx-auto mb-4 animate-pulse" />
          <p className="text-muted-foreground">Loading passage…</p>
        </div>
      </div>
    );
  }

  if (!passage) {
    return (
      <div className="container mx-auto px-4 py-8">
        <p>Passage not found</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-6xl">
      {/* Header */}
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold">{passage.name}</h1>
            <div className="flex items-center gap-2 mt-2 text-muted-foreground">
              <MapPin className="h-4 w-4" />
              <span>
                {passage.departure.name} → {passage.destination.name}
              </span>
              <Badge
                variant={
                  passage.status === "completed" ? "secondary" : "default"
                }
              >
                {passage.status}
              </Badge>
            </div>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" size="sm">
              <Share2 className="h-4 w-4 mr-2" />
              Share
            </Button>
            <Button size="sm" onClick={() => setShowExportDialog(true)}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Distance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{passage.distance} nm</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Duration
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {passage.estimatedDuration}h
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Departure
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-medium">
              {new Date(passage.departureTime).toLocaleDateString()}
            </div>
            <p className="text-xs text-muted-foreground">
              {new Date(passage.departureTime).toLocaleTimeString()}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Waypoints
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {passage.waypoints.length + 2}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Information */}
      <Tabs defaultValue="route" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="route">Route</TabsTrigger>
          <TabsTrigger value="weather">Weather</TabsTrigger>
          <TabsTrigger value="tides">Tides</TabsTrigger>
          <TabsTrigger value="safety">Safety</TabsTrigger>
        </TabsList>

        <TabsContent value="route" className="space-y-4">
          <RouteTab passage={passage} />
        </TabsContent>

        <TabsContent value="weather">
          <WeatherTab passage={passage} />
        </TabsContent>

        <TabsContent value="tides">
          <TidesTab passage={passage} />
        </TabsContent>

        <TabsContent value="safety">
          <Card>
            <CardHeader>
              <CardTitle>Safety Information</CardTitle>
              <CardDescription>
                Emergency contacts and navigation warnings
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">VHF Channels</h4>
                  <div className="flex gap-2">
                    {passage.safety.vhfChannels.map((channel: any) => (
                      <Badge key={channel} variant="outline">
                        CH {channel}
                      </Badge>
                    ))}
                  </div>
                </div>

                {passage.safety.navigationWarnings.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2">Navigation Warnings</h4>
                    <div className="space-y-2">
                      {passage.safety.navigationWarnings.map((warning: any) => (
                        <div key={warning} className="flex items-start gap-2">
                          <AlertTriangle className="h-4 w-4 text-warning mt-0.5" />
                          <p className="text-sm">{warning}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Export Dialog */}
      {passage && (
        <ExportDialog
          open={showExportDialog}
          onOpenChange={setShowExportDialog}
          passage={passage}
        />
      )}
    </div>
  );
}
