"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card";
import { Badge } from "../../../components/ui/badge";
import { Wind, Waves, AlertTriangle } from "lucide-react";
import type { Passage } from "@/types/shared";
import { degreesToCompass, formatTime } from "./format";

interface WeatherTabProps {
  passage: Passage;
}

export function WeatherTab({ passage }: WeatherTabProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wind className="h-5 w-5" />
          Weather Forecast
        </CardTitle>
        <CardDescription>Weather conditions along the route</CardDescription>
      </CardHeader>
      <CardContent>
        {passage.weather && passage.weather.length > 0 ? (
          <div className="space-y-4">
            {passage.weather.map((segment: any) => (
              <div
                key={segment.startTime}
                className="p-4 rounded-lg border bg-card"
              >
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h4 className="font-semibold">
                      {formatTime(segment.startTime)} -{" "}
                      {formatTime(segment.endTime)}
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      {new Date(segment.startTime).toLocaleDateString()}
                    </p>
                  </div>
                  {segment.temperature && (
                    <Badge variant="secondary">{segment.temperature}°C</Badge>
                  )}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="flex items-center gap-2">
                    <Wind className="h-4 w-4 text-primary" />
                    <div>
                      <p className="text-sm font-medium">Wind</p>
                      <p className="text-sm text-muted-foreground">
                        {segment.wind.speed} kts{" "}
                        {degreesToCompass(segment.wind.direction)}
                        {segment.wind.gusts && ` (G${segment.wind.gusts})`}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Waves className="h-4 w-4 text-secondary-foreground" />
                    <div>
                      <p className="text-sm font-medium">Waves</p>
                      <p className="text-sm text-muted-foreground">
                        {segment.waves.height}m @ {segment.waves.period}s
                      </p>
                    </div>
                  </div>

                  {segment.visibility && (
                    <div>
                      <p className="text-sm font-medium">Visibility</p>
                      <p className="text-sm text-muted-foreground">
                        {segment.visibility} nm
                      </p>
                    </div>
                  )}

                  {segment.pressure && (
                    <div>
                      <p className="text-sm font-medium">Pressure</p>
                      <p className="text-sm text-muted-foreground">
                        {segment.pressure} hPa
                      </p>
                    </div>
                  )}
                </div>

                {/* Wind warning for safety */}
                {segment.wind.speed > 20 && (
                  <div className="mt-3 p-2 bg-warning/5 border border-warning/20 rounded flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-warning" />
                    <span className="text-sm text-warning">
                      Strong winds expected - consider timing or alternate route
                    </span>
                  </div>
                )}
                {segment.waves.height > 2 && (
                  <div className="mt-3 p-2 bg-destructive/5 border border-destructive/20 rounded flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                    <span className="text-sm text-destructive">
                      Significant wave height - may affect comfort and safety
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <Wind className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No weather data available</p>
            <p className="text-sm text-muted-foreground mt-1">
              Weather forecast will be fetched when the passage is planned
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
