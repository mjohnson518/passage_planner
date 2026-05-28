"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Eye, MapPin, Info, Navigation, Wind, Waves } from "lucide-react";
import type { WeatherData, WeatherLayer } from "./types";

export function WeatherSidebar({
  weatherData,
  weatherLayers,
  selectedLayer,
  onSelectLayer,
}: {
  weatherData: WeatherData | null;
  weatherLayers: WeatherLayer[];
  selectedLayer: string;
  onSelectLayer: (id: string) => void;
}) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Current Conditions</CardTitle>
          <CardDescription>Click on map for point forecast</CardDescription>
        </CardHeader>
        <CardContent>
          {weatherData ? (
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Wind</span>
                  <div className="flex items-center gap-1">
                    <Wind className="h-4 w-4" />
                    <span className="font-medium">
                      {Math.round(weatherData.windSpeed)} kts
                    </span>
                    <Navigation
                      className="h-4 w-4"
                      style={{
                        transform: `rotate(${weatherData.windDirection}deg)`,
                      }}
                    />
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Waves</span>
                  <div className="flex items-center gap-1">
                    <Waves className="h-4 w-4" />
                    <span className="font-medium">
                      {weatherData.waveHeight.toFixed(1)} ft @{" "}
                      {Math.round(weatherData.wavePeriod)}s
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Visibility
                  </span>
                  <div className="flex items-center gap-1">
                    <Eye className="h-4 w-4" />
                    <span className="font-medium">
                      {weatherData.visibility.toFixed(1)} nm
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Pressure
                  </span>
                  <span className="font-medium">
                    {Math.round(weatherData.pressure)} mb
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <MapPin className="h-8 w-8 mx-auto mb-2" />
              <p className="text-sm">Click on map for details</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Layer Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Info className="h-4 w-4" />
            Layer Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {weatherLayers.map((layer) => (
              <button
                type="button"
                key={layer.id}
                tabIndex={layer.available ? 0 : -1}
                aria-pressed={selectedLayer === layer.id}
                aria-disabled={!layer.available}
                className={`w-full text-left p-3 rounded-lg border cursor-pointer transition-colors ${
                  selectedLayer === layer.id
                    ? "border-primary bg-primary/5"
                    : "hover:bg-muted"
                } ${!layer.available ? "opacity-50" : ""}`}
                onClick={() => layer.available && onSelectLayer(layer.id)}
              >
                <div className="flex items-center gap-2 font-medium">
                  {layer.icon}
                  {layer.name}
                  {!layer.available && (
                    <Badge variant="secondary" className="text-xs">
                      Coming Soon
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {layer.description}
                </p>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
