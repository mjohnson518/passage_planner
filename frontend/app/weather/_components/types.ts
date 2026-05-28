import type React from "react";

export interface WeatherLayer {
  id: string;
  name: string;
  icon: React.ReactNode;
  description: string;
  available: boolean;
}

export interface WeatherData {
  windSpeed: number;
  windDirection: number;
  waveHeight: number;
  wavePeriod: number;
  precipitation: number;
  temperature: number;
  pressure: number;
  visibility: number;
}

export interface Region {
  value: string;
  label: string;
}
