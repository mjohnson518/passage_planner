/**
 * OpenMeteoTidalService — global tide-height fallback.
 *
 * NOAA CO-OPS covers US waters and a handful of overseas military bases.
 * For everyone else we use Open-Meteo's marine endpoint which exposes
 * `sea_level_height_msl` — the modelled global tide height above mean sea
 * level, derived from FES2014 + dynamical models. It is less accurate than
 * a local harmonic station but lets us produce non-null tide curves for
 * Mediterranean, UK, AU/NZ, SE Asia and Pacific passages.
 *
 * SAFETY:
 * - Returns peaks/troughs as `TidePrediction[]` matching NOAATidalService.
 * - Marks the source as `OpenMeteo (modelled)` so the planner UI can flag
 *   it visually — modelled tides are not a substitute for an Admiralty
 *   tide table in shoal water.
 * - Caches with [TIDAL_CACHE_TTL_S] — once per day per coord; freshness is
 *   still enforced by the orchestrator.
 */

import { Logger } from "pino";
import axios, { AxiosInstance } from "axios";
import CircuitBreaker from "opossum";
import { CacheManager } from "./CacheManager";
import { CircuitBreakerFactory } from "./resilience/circuit-breaker";
import { TIDAL_CACHE_TTL_S } from "../constants/safety-thresholds";

const MARINE_API = "https://marine-api.open-meteo.com/v1/marine";

export interface ModelledTidePrediction {
  t: Date;
  v: number; // height above MSL, metres
  type: "H" | "L"; // High or Low water
}

export interface ModelledTideForecast {
  latitude: number;
  longitude: number;
  predictions: ModelledTidePrediction[];
  source: "OpenMeteo (modelled)";
  fetchedAt: Date;
  /** Modelled tides are global but lower accuracy than local stations. */
  modelled: true;
  /** Free-text caveat for the UI. */
  caveat: string;
}

export class OpenMeteoTidalService {
  private cache: CacheManager;
  private logger: Logger;
  private http: AxiosInstance;
  /**
   * Shares its host (marine-api.open-meteo.com) with the wave/wind marine
   * endpoint in OpenMeteoWeatherService — opossum dedupes by breaker name
   * so we use a distinct one here. A trip-out of the marine API affects
   * both wave data and modelled tides; that's correct behaviour.
   */
  private tideBreaker: CircuitBreaker;

  constructor(cache: CacheManager, logger: Logger) {
    this.cache = cache;
    this.logger = logger;
    this.http = axios.create({
      timeout: 15000,
      headers: { "User-Agent": "Helmwise/1.0 (https://helmwise.co)" },
    });
    this.tideBreaker = CircuitBreakerFactory.create(
      "openmeteo:tide",
      (params: Record<string, unknown>) =>
        this.http.get(MARINE_API, { params }).then((r) => r.data),
      { timeout: 15000 },
    );
  }

  async getTideForecast(
    latitude: number,
    longitude: number,
    forecastDays = 7,
  ): Promise<ModelledTideForecast> {
    const cacheKey = `openmeteo:tide:${latitude.toFixed(3)}:${longitude.toFixed(3)}:${forecastDays}`;
    const cached = await this.cache.get<ModelledTideForecast>(cacheKey);
    if (cached) {
      return {
        ...cached,
        fetchedAt: new Date(cached.fetchedAt),
        predictions: cached.predictions.map((p) => ({
          ...p,
          t: new Date(p.t),
        })),
      };
    }

    const data = (await this.tideBreaker.fire({
      latitude,
      longitude,
      hourly: "sea_level_height_msl",
      timezone: "auto",
      forecast_days: forecastDays,
    })) as {
      hourly?: { time?: string[]; sea_level_height_msl?: (number | null)[] };
    };

    const times: string[] = data?.hourly?.time ?? [];
    const heights: (number | null)[] = data?.hourly?.sea_level_height_msl ?? [];

    const predictions = this.extractHighsAndLows(times, heights);

    const forecast: ModelledTideForecast = {
      latitude,
      longitude,
      predictions,
      source: "OpenMeteo (modelled)",
      fetchedAt: new Date(),
      modelled: true,
      caveat:
        "Modelled global tide — within ±0.2m of measured for most open coast. " +
        "For shoal-water passages or harbour entry, cross-check a local tide table.",
    };

    await this.cache.set(cacheKey, forecast, TIDAL_CACHE_TTL_S);
    return forecast;
  }

  /**
   * Walk the hourly height series and emit a high-water mark at each local
   * maximum and a low-water mark at each local minimum. We require the
   * extremum to differ from the surrounding 3-hour window by ≥0.05m to
   * suppress noise from the modelled signal.
   */
  private extractHighsAndLows(
    times: string[],
    heights: (number | null)[],
  ): ModelledTidePrediction[] {
    const result: ModelledTidePrediction[] = [];
    const threshold = 0.05; // metres

    for (let i = 1; i < heights.length - 1; i++) {
      const h = heights[i];
      const prev = heights[i - 1];
      const next = heights[i + 1];
      if (h == null || prev == null || next == null) continue;

      // Local maximum
      if (h > prev + threshold && h > next + threshold) {
        result.push({ t: new Date(times[i]), v: h, type: "H" });
        continue;
      }
      // Local minimum
      if (h < prev - threshold && h < next - threshold) {
        result.push({ t: new Date(times[i]), v: h, type: "L" });
      }
    }

    return result;
  }
}
