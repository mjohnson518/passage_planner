"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card";
import { Badge } from "../../../components/ui/badge";
import type { Passage } from "@/types/shared";

interface RouteTabProps {
  passage: Passage;
}

export function RouteTab({ passage }: RouteTabProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Route Details</CardTitle>
        <CardDescription>Waypoints and navigation information</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Departure */}
          <div className="flex items-start gap-3 p-3 rounded-lg bg-success/10">
            <div className="w-8 h-8 rounded-full bg-success flex items-center justify-center text-white font-bold text-sm">
              D
            </div>
            <div className="flex-1">
              <h4 className="font-medium">{passage.departure.name}</h4>
              <p className="text-sm text-muted-foreground">
                {passage.departure.coordinates.lat.toFixed(4)}°N,
                {Math.abs(passage.departure.coordinates.lng).toFixed(4)}°W
              </p>
              <p className="text-sm mt-1">
                Departure: {new Date(passage.departureTime).toLocaleString()}
              </p>
            </div>
          </div>

          {/* Waypoints */}
          {passage.waypoints.map((waypoint: any, index: number) => (
            <div
              key={waypoint.id}
              className="flex items-start gap-3 p-3 rounded-lg bg-muted/30"
            >
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center font-bold text-sm">
                {index + 1}
              </div>
              <div className="flex-1">
                <h4 className="font-medium">{waypoint.name}</h4>
                <p className="text-sm text-muted-foreground">
                  {waypoint.coordinates.lat.toFixed(4)}°N,
                  {Math.abs(waypoint.coordinates.lng).toFixed(4)}°W
                </p>
                {waypoint.type && (
                  <Badge variant="outline" className="mt-1">
                    {waypoint.type}
                  </Badge>
                )}
              </div>
              <div className="text-right">
                <p className="text-sm font-medium">
                  {passage.route[index]?.distance.toFixed(1)} nm
                </p>
                <p className="text-xs text-muted-foreground">
                  {passage.route[index]?.bearing.toFixed(0)}° True
                </p>
              </div>
            </div>
          ))}

          {/* Destination */}
          <div className="flex items-start gap-3 p-3 rounded-lg bg-primary/5">
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm">
              A
            </div>
            <div className="flex-1">
              <h4 className="font-medium">{passage.destination.name}</h4>
              <p className="text-sm text-muted-foreground">
                {passage.destination.coordinates.lat.toFixed(4)}°N,
                {Math.abs(passage.destination.coordinates.lng).toFixed(4)}
                °W
              </p>
              <p className="text-sm mt-1">
                ETA: {new Date(passage.estimatedArrivalTime).toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
