"use client";

import { Card, CardContent } from "../../components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { Slider } from "../../components/ui/slider";
import type { Region, WeatherLayer } from "./types";

const formatForecastTime = (hours: number) => {
  const date = new Date(Date.now() + hours * 60 * 60 * 1000);
  if (hours === 0) return "Now";
  if (hours < 24) return `+${hours}h`;
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    hour: "numeric",
  });
};

export function WeatherControls({
  regions,
  region,
  onRegionChange,
  weatherLayers,
  selectedLayer,
  onLayerChange,
  forecastHour,
  onForecastHourChange,
}: {
  regions: Region[];
  region: string;
  onRegionChange: (value: string) => void;
  weatherLayers: WeatherLayer[];
  selectedLayer: string;
  onLayerChange: (value: string) => void;
  forecastHour: number;
  onForecastHourChange: (value: number) => void;
}) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label
              htmlFor="weather-region"
              className="text-sm font-medium mb-2 block"
            >
              Region
            </label>
            <Select value={region} onValueChange={onRegionChange}>
              <SelectTrigger id="weather-region">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {regions.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label
              htmlFor="weather-layer"
              className="text-sm font-medium mb-2 block"
            >
              Weather Layer
            </label>
            <Select value={selectedLayer} onValueChange={onLayerChange}>
              <SelectTrigger id="weather-layer">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {weatherLayers.flatMap((layer) =>
                  layer.available
                    ? [
                        <SelectItem key={layer.id} value={layer.id}>
                          <div className="flex items-center gap-2">
                            {layer.icon}
                            {layer.name}
                          </div>
                        </SelectItem>,
                      ]
                    : [],
                )}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">
              Forecast: {formatForecastTime(forecastHour)}
            </label>
            <Slider
              value={[forecastHour]}
              onValueChange={([value]) => onForecastHourChange(value)}
              min={0}
              max={120}
              step={3}
              className="mt-2"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
