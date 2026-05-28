"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "../components/ui/button";
import {
  Cloud,
  Wind,
  Waves,
  Eye,
  Droplets,
  ThermometerSun,
  RefreshCw,
  Download,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useAnalytics } from "../hooks/useAnalytics";
import { features } from "../lib/features";
import { MarineWarningsCard } from "./_components/MarineWarningsCard";
import type { MarineWarning } from "./_components/MarineWarningsCard";
import { WeatherControls } from "./_components/WeatherControls";
import { WeatherMap } from "./_components/WeatherMap";
import { WeatherSidebar } from "./_components/WeatherSidebar";
import type { Region, WeatherData, WeatherLayer } from "./_components/types";

export default function WeatherPageClient() {
  const { user } = useAuth();
  const { track, trackFeature } = useAnalytics();
  const [selectedLayer, setSelectedLayer] = useState("wind");
  const [region, setRegion] = useState("northeast-atlantic");
  const [forecastHour, setForecastHour] = useState(0);

  const weatherLayers: WeatherLayer[] = [
    {
      id: "wind",
      name: "Wind",
      icon: <Wind className="h-4 w-4" />,
      description: "Wind speed and direction",
      available: true,
    },
    {
      id: "waves",
      name: "Waves",
      icon: <Waves className="h-4 w-4" />,
      description: "Wave height and period",
      available: true,
    },
    {
      id: "precipitation",
      name: "Precipitation",
      icon: <Droplets className="h-4 w-4" />,
      description: "Rain and snow forecast",
      available: true,
    },
    {
      id: "temperature",
      name: "Temperature",
      icon: <ThermometerSun className="h-4 w-4" />,
      description: "Air and sea temperature",
      available: true,
    },
    {
      id: "pressure",
      name: "Pressure",
      icon: <Cloud className="h-4 w-4" />,
      description: "Atmospheric pressure",
      available: true,
    },
    {
      id: "visibility",
      name: "Visibility",
      icon: <Eye className="h-4 w-4" />,
      description: "Visibility conditions",
      available: false,
    },
  ];

  const regions: Region[] = [
    { value: "northeast-atlantic", label: "Northeast Atlantic" },
    { value: "northwest-atlantic", label: "Northwest Atlantic" },
    { value: "caribbean", label: "Caribbean" },
    { value: "mediterranean", label: "Mediterranean" },
    { value: "north-pacific", label: "North Pacific" },
    { value: "south-pacific", label: "South Pacific" },
  ];

  useEffect(() => {
    track("page_view", { page: "weather" });
  }, [track]);

  const {
    data: weatherData = null,
    isFetching: loading,
    refetch: refetchWeather,
    dataUpdatedAt,
  } = useQuery<WeatherData>({
    queryKey: ["weather-map", selectedLayer, region, forecastHour],
    queryFn: async () => {
      // Mock weather data - in production this would call the weather API
      const mockData: WeatherData = {
        windSpeed: 15 + Math.random() * 10,
        windDirection: Math.floor(Math.random() * 360),
        waveHeight: 1.5 + Math.random() * 2,
        wavePeriod: 6 + Math.random() * 4,
        precipitation: Math.random() * 10,
        temperature: 65 + Math.random() * 15,
        pressure: 1010 + Math.random() * 20,
        visibility: 8 + Math.random() * 2,
      };

      trackFeature("weather_layer_viewed", {
        layer: selectedLayer,
        region,
        forecastHour,
      });

      return mockData;
    },
    staleTime: 0,
  });

  const { data: warnings = [] } = useQuery<MarineWarning[]>({
    queryKey: ["marine-warnings"],
    queryFn: async () => {
      // Mock warnings data
      const mockWarnings: MarineWarning[] = [
        {
          id: "1",
          type: "small-craft",
          severity: "warning",
          area: "Cape Cod to Maine",
          description: "Small craft advisory for hazardous seas",
          validFrom: new Date().toISOString(),
          validUntil: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        },
        {
          id: "2",
          type: "gale",
          severity: "watch",
          area: "Georges Bank",
          description: "Gale watch for increasing winds",
          validFrom: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
          validUntil: new Date(Date.now() + 36 * 60 * 60 * 1000).toISOString(),
        },
      ];

      return mockWarnings;
    },
  });

  const lastUpdate = new Date(dataUpdatedAt || Date.now());

  const handleExport = () => {
    trackFeature("weather_map_exported", { layer: selectedLayer, region });
    // TODO: Implement export functionality
  };

  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-display">
            Weather Maps
          </h1>
          <p className="text-muted-foreground">
            Interactive marine weather visualization
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => refetchWeather()}
            disabled={loading}
          >
            <RefreshCw
              className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
          {features.weatherExport && (
            <Button onClick={handleExport}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          )}
        </div>
      </div>

      <MarineWarningsCard warnings={warnings} />

      <WeatherControls
        regions={regions}
        region={region}
        onRegionChange={setRegion}
        weatherLayers={weatherLayers}
        selectedLayer={selectedLayer}
        onLayerChange={setSelectedLayer}
        forecastHour={forecastHour}
        onForecastHourChange={setForecastHour}
      />

      {/* Map Area */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3">
          <WeatherMap
            loading={loading}
            weatherLayers={weatherLayers}
            selectedLayer={selectedLayer}
          />
        </div>

        <WeatherSidebar
          weatherData={weatherData}
          weatherLayers={weatherLayers}
          selectedLayer={selectedLayer}
          onSelectLayer={setSelectedLayer}
        />
      </div>

      {/* Last Update */}
      <div className="text-center text-sm text-muted-foreground">
        Last updated: {lastUpdate.toLocaleString()}
      </div>
    </div>
  );
}
