/**
 * GlobalWeatherService — region-aware marine weather provider.
 *
 * Helmwise's stated goal is to support sailors anywhere in the world. NOAA
 * marine forecasts are the gold standard inside US waters but they do not
 * cover the Mediterranean, UK, AU/NZ, SE Asia, the Pacific Islands, or
 * the Southern Hemisphere. This wrapper picks the right provider for the
 * coordinates and falls back gracefully when one fails.
 *
 * SAFETY:
 * - Returns the same `MarineWeatherForecast` shape as NOAAWeatherService,
 *   so the caller cannot tell which provider answered. Provider identity
 *   is reflected in `dataWarnings` / location metadata for transparency.
 * - For coordinates inside NOAA coverage, NOAA is tried FIRST. If it fails
 *   we fall through to Open-Meteo so the user is never left without a
 *   forecast (modulo connectivity).
 * - If NEITHER provider responds, we throw — refusing to plan beats
 *   planning on no data.
 */

import { Logger } from "pino";
import { CacheManager } from "./CacheManager";
import {
  NOAAWeatherService,
  MarineWeatherForecast,
} from "./NOAAWeatherService";
import { OpenMeteoWeatherService } from "./OpenMeteoWeatherService";

/**
 * Rough bounding boxes for NOAA NWS marine forecast coverage. Inside these
 * boxes we prefer NOAA; outside we go straight to Open-Meteo. The boxes
 * are intentionally generous — NOAA's gridpoint API will simply 404 for
 * any coord it cannot resolve, which we then handle as a fallback miss.
 */
const NOAA_COVERAGE_BOXES = [
  { name: "CONUS+coastal", minLat: 22, maxLat: 50, minLon: -130, maxLon: -64 },
  { name: "Alaska", minLat: 51, maxLat: 72, minLon: -180, maxLon: -130 },
  { name: "Hawaii", minLat: 18, maxLat: 23, minLon: -161, maxLon: -154 },
  { name: "PuertoRico+VI", minLat: 17, maxLat: 19, minLon: -68, maxLon: -64 },
  { name: "Guam+CNMI", minLat: 12, maxLat: 22, minLon: 144, maxLon: 146 },
  {
    name: "AmericanSamoa",
    minLat: -16,
    maxLat: -10,
    minLon: -171,
    maxLon: -169,
  },
];

export function isNOAACoverage(latitude: number, longitude: number): boolean {
  return NOAA_COVERAGE_BOXES.some(
    (b) =>
      latitude >= b.minLat &&
      latitude <= b.maxLat &&
      longitude >= b.minLon &&
      longitude <= b.maxLon,
  );
}

export class GlobalWeatherService {
  private noaa: NOAAWeatherService;
  private openMeteo: OpenMeteoWeatherService;
  private logger: Logger;

  constructor(cache: CacheManager, logger: Logger) {
    this.noaa = new NOAAWeatherService(cache, logger);
    this.openMeteo = new OpenMeteoWeatherService(cache, logger);
    this.logger = logger;
  }

  async getMarineForecast(
    latitude: number,
    longitude: number,
    days = 7,
  ): Promise<MarineWeatherForecast> {
    const inNOAA = isNOAACoverage(latitude, longitude);

    if (inNOAA) {
      try {
        const noaaForecast = await this.noaa.getMarineForecast(
          latitude,
          longitude,
          days,
        );
        return this.annotate(noaaForecast, "NOAA");
      } catch (err) {
        this.logger.warn(
          { err, latitude, longitude },
          "NOAA forecast failed inside coverage; falling back to Open-Meteo",
        );
        // fall through to Open-Meteo
      }
    }

    try {
      const omForecast = await this.openMeteo.getMarineForecast(
        latitude,
        longitude,
        days,
      );
      return this.annotate(
        omForecast,
        inNOAA ? "OpenMeteo (NOAA fallback)" : "OpenMeteo",
      );
    } catch (err) {
      this.logger.error(
        { err, latitude, longitude, inNOAA },
        "Both NOAA and Open-Meteo failed",
      );
      throw new Error(
        `Unable to retrieve marine forecast for ${latitude.toFixed(2)},${longitude.toFixed(2)} ` +
          `from any provider. Check connectivity and retry; do not depart without forecast.`,
      );
    }
  }

  /**
   * Forward-compat: WeatherAgent.checkWeatherSafety still calls the NOAA
   * service's `checkSafetyConditions`. That logic is provider-independent
   * (it just inspects a MarineWeatherForecast), so we delegate through.
   */
  async checkSafetyConditions(
    forecast: MarineWeatherForecast,
    thresholds: {
      maxWindSpeed?: number;
      maxWaveHeight?: number;
      minVisibility?: number;
    },
  ): Promise<any> {
    return this.noaa.checkSafetyConditions(forecast, {
      maxWindSpeed: thresholds.maxWindSpeed ?? 25,
      maxWaveHeight: thresholds.maxWaveHeight ?? 2,
      minVisibility: thresholds.minVisibility ?? 5,
    });
  }

  private annotate(
    forecast: MarineWeatherForecast,
    provider: string,
  ): MarineWeatherForecast {
    const existing = forecast.dataWarnings ?? [];
    return {
      ...forecast,
      dataWarnings: [...existing, `Source: ${provider}`],
    };
  }
}
