"use client";

import { Card, CardContent } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Skeleton } from "../../components/ui/skeleton";
import { Cloud, Plus, Minus } from "lucide-react";
import type { WeatherLayer } from "./types";

export function WeatherMap({
  loading,
  weatherLayers,
  selectedLayer,
}: {
  loading: boolean;
  weatherLayers: WeatherLayer[];
  selectedLayer: string;
}) {
  return (
    <Card className="h-[600px]">
      <CardContent className="p-0 h-full">
        {loading ? (
          <div className="h-full flex items-center justify-center">
            <Skeleton className="w-full h-full" />
          </div>
        ) : (
          <div className="h-full relative bg-gradient-to-b from-secondary/30 to-secondary/60">
            {/* Placeholder for actual map */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <Cloud className="h-16 w-16 text-muted-foreground mb-4 mx-auto" />
                <p className="text-lg font-medium">Weather Map Visualization</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Interactive map will be rendered here
                </p>
                <p className="text-xs text-muted-foreground mt-4">
                  Showing:{" "}
                  {weatherLayers.find((l) => l.id === selectedLayer)?.name}{" "}
                  layer
                </p>
              </div>
            </div>

            {/* Map controls overlay */}
            <div className="absolute top-4 right-4 space-y-2">
              <Button size="sm" variant="secondary">
                <Plus className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="secondary">
                <Minus className="h-4 w-4" />
              </Button>
            </div>

            {/* Legend overlay */}
            <div className="absolute bottom-4 left-4 bg-background/90 p-3 rounded-lg">
              <p className="text-xs font-medium mb-2">Legend</p>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-success rounded-sm" />
                  <span className="text-xs">Light (0-10 kts)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-warning rounded-sm" />
                  <span className="text-xs">Moderate (10-20 kts)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-accent rounded-sm" />
                  <span className="text-xs">Strong (20-30 kts)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-destructive rounded-sm" />
                  <span className="text-xs">Gale (30+ kts)</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
