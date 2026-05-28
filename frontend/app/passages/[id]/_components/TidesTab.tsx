"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card";
import { MapPin, Waves, AlertTriangle, Anchor } from "lucide-react";
import type { Passage } from "@/types/shared";
import { degreesToCompass, formatTime } from "./format";

interface TidesTabProps {
  passage: Passage;
}

export function TidesTab({ passage }: TidesTabProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Anchor className="h-5 w-5" />
          Tidal Information
        </CardTitle>
        <CardDescription>
          Tide times and current predictions along the route
        </CardDescription>
      </CardHeader>
      <CardContent>
        {passage.tides && passage.tides.length > 0 ? (
          <div className="space-y-6">
            {/* Group tides by location */}
            {(
              Array.from(
                new Set(passage.tides.map((t: any) => t.location)),
              ) as string[]
            ).map((location) => (
              <div key={location} className="space-y-3">
                <h4 className="font-semibold flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  {location}
                </h4>
                <div className="grid gap-3">
                  {passage.tides
                    .filter((t: any) => t.location === location)
                    .sort(
                      (a: any, b: any) =>
                        new Date(a.time).getTime() - new Date(b.time).getTime(),
                    )
                    .map((tide: any) => (
                      <div
                        key={`${tide.time}-${tide.type}`}
                        className={`p-3 rounded-lg border flex items-center justify-between ${
                          tide.type === "high"
                            ? "bg-primary/5 border-primary/20"
                            : "bg-muted/50 border-border"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`p-2 rounded-full ${
                              tide.type === "high"
                                ? "bg-primary/10"
                                : "bg-muted"
                            }`}
                          >
                            {tide.type === "high" ? (
                              <Waves className="h-4 w-4 text-primary" />
                            ) : (
                              <Anchor className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium capitalize">
                              {tide.type} Tide
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {formatTime(tide.time)} -{" "}
                              {new Date(tide.time).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">
                            {tide.height.toFixed(1)}m
                          </p>
                          {tide.current && (
                            <p className="text-sm text-muted-foreground">
                              Current: {tide.current.speed.toFixed(1)} kts{" "}
                              {degreesToCompass(tide.current.direction)}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            ))}

            {/* Tidal current warning */}
            {passage.tides.some(
              (t: any) => t.current && t.current.speed > 1.5,
            ) && (
              <div className="p-3 bg-warning/5 border border-warning/20 rounded-lg flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 text-warning mt-0.5" />
                <div>
                  <p className="font-medium text-warning">
                    Strong Tidal Currents
                  </p>
                  <p className="text-sm text-warning/80">
                    Some locations have currents exceeding 1.5 knots. Plan your
                    departure time to use favorable currents and avoid opposing
                    strong flows.
                  </p>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8">
            <Anchor className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No tidal data available</p>
            <p className="text-sm text-muted-foreground mt-1">
              Tide predictions will be fetched when the passage is planned
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
