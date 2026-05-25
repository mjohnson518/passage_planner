/**
 * OpenMeteoWeatherService — global marine weather provider.
 *
 * Open-Meteo (https://open-meteo.com) aggregates GFS, ICON, ECMWF and others
 * into a free, no-API-key, globally-available forecast. We use it as the
 * primary provider for any waypoint outside NOAA's marine zone coverage,
 * and as a fallback when NOAA returns errors.
 *
 * SAFETY:
 * - Returns the same `MarineWeatherForecast` shape as NOAAWeatherService so
 *   callers can swap providers without re-handling each response.
 * - All times come back from the API in ISO-8601 with a `timezone=auto`
 *   resolution; we re-cast them to Date so downstream freshness checks
 *   ([WEATHER_CACHE_TTL_S]/[MAX_WEATHER_AGE_MS]) still fire.
 * - Wind speeds are requested in knots and gusts directly (not 1.5x est).
 * - Wave height is reported in metres per Open-Meteo defaults.
 * - If the API call fails, the error propagates — the caller decides whether
 *   to try yet another provider or surface degradation to the user. We do
 *   not return a silent fallback shape from this layer.
 */

import { Logger } from "pino";
import axios, { AxiosInstance } from "axios";
import CircuitBreaker from "opossum";
import { CacheManager } from "./CacheManager";
import {
  MarineWeatherForecast,
  WeatherPeriod,
  WaveData,
  WindData,
  VisibilityData,
} from "./NOAAWeatherService";
import { CircuitBreakerFactory } from "./resilience/circuit-breaker";
import { WEATHER_CACHE_TTL_S } from "../constants/safety-thresholds";

const WEATHER_API = "https://api.open-meteo.com/v1/forecast";
const MARINE_API = "https://marine-api.open-meteo.com/v1/marine";

// Models Open-Meteo exposes that we surface in the multi-model comparison
// view (R1). Keeping the list short and curated — three is a useful number
// for sailor cognitive load; more would surface noise.
export const MULTI_MODEL_DEFAULT: ReadonlyArray<string> = [
  "gfs_seamless",
  "ecmwf_ifs025",
  "icon_seamless",
];

export interface ModelTimeseries {
  model: string;
  /** Hourly timestamps as ISO strings (parallel arrays below). */
  time: string[];
  windSpeedKt: number[];
  windGustKt: number[];
  windDirectionDeg: number[];
  temperatureF: number[];
  /** Wave height in metres, parallel to weather-model time array (best-effort
   *  resampled where a wave-supporting model exists; empty otherwise). */
  waveHeightM?: number[];
}

export interface MultiModelMarineForecast {
  location: { latitude: number; longitude: number };
  issuedAt: Date;
  models: ModelTimeseries[];
  /** Models that the marine wave endpoint returned data for. Wave coverage
   *  is sparser than weather coverage — coastal and open-ocean usually OK,
   *  inland and high-latitude often missing. */
  modelsWithWaves: string[];
}

export class OpenMeteoWeatherService {
  private cache: CacheManager;
  private logger: Logger;
  private http: AxiosInstance;
  /**
   * Circuit breaker guarding the Open-Meteo weather endpoint. If
   * Open-Meteo returns 50%+ errors in a 10s rolling window we trip the
   * circuit for 60s so downstream callers fall back to cached forecasts
   * or NOAA rather than piling up retries against a known-failing host.
   */
  private weatherBreaker: CircuitBreaker;
  private marineBreaker: CircuitBreaker;

  constructor(cache: CacheManager, logger: Logger) {
    this.cache = cache;
    this.logger = logger;
    this.http = axios.create({
      timeout: 15000,
      headers: { "User-Agent": "Helmwise/1.0 (https://helmwise.co)" },
    });
    this.weatherBreaker = CircuitBreakerFactory.create(
      "openmeteo:weather",
      (params: Record<string, unknown>) =>
        this.http.get(WEATHER_API, { params }).then((r) => r.data),
      { timeout: 15000 },
    );
    this.marineBreaker = CircuitBreakerFactory.create(
      "openmeteo:marine",
      (params: Record<string, unknown>) =>
        this.http.get(MARINE_API, { params }).then((r) => r.data),
      { timeout: 15000 },
    );
  }

  async getMarineForecast(
    latitude: number,
    longitude: number,
    forecastDays = 7,
  ): Promise<MarineWeatherForecast> {
    const cacheKey = `openmeteo:marine:${latitude.toFixed(3)}:${longitude.toFixed(3)}:${forecastDays}`;
    const cached = await this.cache.get<MarineWeatherForecast>(cacheKey);
    if (cached) {
      return {
        ...cached,
        issuedAt: new Date(cached.issuedAt),
      };
    }

    const [weather, marine] = await Promise.all([
      this.fetchWeather(latitude, longitude, forecastDays),
      this.fetchMarine(latitude, longitude, forecastDays).catch((err) => {
        // Marine endpoint can return 400 for inland or polar coords; log but
        // continue with weather-only data so we still produce a forecast.
        this.logger.warn(
          { err, latitude, longitude },
          "Open-Meteo marine endpoint failed; returning wind/weather only",
        );
        return null;
      }),
    ]);

    const forecast = this.buildForecast(latitude, longitude, weather, marine);

    await this.cache.set(cacheKey, forecast, WEATHER_CACHE_TTL_S);
    return forecast;
  }

  private async fetchWeather(
    latitude: number,
    longitude: number,
    forecastDays: number,
  ) {
    return this.weatherBreaker.fire({
      latitude,
      longitude,
      hourly: [
        "temperature_2m",
        "precipitation_probability",
        "wind_speed_10m",
        "wind_direction_10m",
        "wind_gusts_10m",
        "visibility",
        "weather_code",
      ].join(","),
      wind_speed_unit: "kn",
      temperature_unit: "fahrenheit",
      timezone: "auto",
      forecast_days: forecastDays,
    });
  }

  private async fetchMarine(
    latitude: number,
    longitude: number,
    forecastDays: number,
  ) {
    return this.marineBreaker.fire({
      latitude,
      longitude,
      hourly: [
        "wave_height",
        "wave_direction",
        "wave_period",
        "wind_wave_height",
        "swell_wave_height",
        "swell_wave_period",
      ].join(","),
      timezone: "auto",
      forecast_days: forecastDays,
    });
  }

  private buildForecast(
    latitude: number,
    longitude: number,
    weather: any,
    marine: any | null,
  ): MarineWeatherForecast {
    const hourly = weather?.hourly;
    const times: string[] = hourly?.time ?? [];

    const periods: WeatherPeriod[] = times.map((t, i) => {
      const wind = hourly.wind_speed_10m?.[i] ?? 0;
      const dir = hourly.wind_direction_10m?.[i];
      const gust = hourly.wind_gusts_10m?.[i] ?? wind * 1.3;
      const temp = hourly.temperature_2m?.[i] ?? NaN;
      const pop = hourly.precipitation_probability?.[i];
      const hour = new Date(t).getUTCHours();
      const isDaytime = hour >= 6 && hour < 18;
      return {
        startTime: new Date(t),
        endTime: new Date(new Date(t).getTime() + 60 * 60 * 1000),
        temperature: Math.round(temp),
        temperatureUnit: "F",
        windSpeed: `${Math.round(wind)} kt`,
        windDirection: this.bearingToCardinal(dir),
        shortForecast: this.weatherCodeToText(hourly.weather_code?.[i]),
        detailedForecast: `Wind ${Math.round(wind)}kt gusts ${Math.round(gust)}kt from ${this.bearingToCardinal(dir)}. ${this.weatherCodeToText(hourly.weather_code?.[i])}.`,
        precipitationChance: pop ?? null,
        isDaytime,
      };
    });

    const windData: WindData[] = times.map((t, i) => ({
      time: new Date(t),
      speed: hourly.wind_speed_10m?.[i] ?? 0,
      gusts:
        hourly.wind_gusts_10m?.[i] ?? (hourly.wind_speed_10m?.[i] ?? 0) * 1.3,
      direction: hourly.wind_direction_10m?.[i] ?? NaN,
      gustsEstimated: hourly.wind_gusts_10m?.[i] == null,
    }));

    const visibility: VisibilityData[] = times.map((t, i) => {
      const visMeters = hourly.visibility?.[i] ?? 16000;
      return {
        time: new Date(t),
        distance: visMeters / 1852, // m → nm
        conditions:
          visMeters < 1000 ? "fog" : visMeters < 5000 ? "haze" : "clear",
      };
    });

    const waveHeight: WaveData[] = marine?.hourly?.time
      ? marine.hourly.time.map((t: string, i: number) => ({
          time: new Date(t),
          height: marine.hourly.wave_height?.[i] ?? 0,
          period: marine.hourly.wave_period?.[i] ?? 0,
          direction: marine.hourly.wave_direction?.[i] ?? 0,
        }))
      : [];

    const dataWarnings: string[] = [];
    if (!marine) {
      dataWarnings.push(
        "Open-Meteo marine wave data unavailable at this location " +
          "(possibly inland or polar). Wind and weather data still apply.",
      );
    }

    return {
      location: { latitude, longitude },
      issuedAt: new Date(),
      periods,
      warnings: [], // Open-Meteo does not publish marine warnings.
      waveHeight,
      windData,
      visibility,
      dataWarnings,
    };
  }

  /**
   * Multi-model forecast (R1) — fetches the same window from several models
   * (default GFS/ECMWF/ICON) and returns each as its own parallel timeseries.
   * Open-Meteo's `models=` parameter returns suffixed columns
   * (e.g. `wind_speed_10m_gfs_seamless`) which we re-shape here.
   *
   * Failure mode: any individual model that returns no data is omitted from
   * the response rather than crashing the call — the disagreement helper
   * downstream tolerates models being absent.
   */
  async getMultiModelMarineForecast(
    latitude: number,
    longitude: number,
    forecastDays = 5,
    models: ReadonlyArray<string> = MULTI_MODEL_DEFAULT,
  ): Promise<MultiModelMarineForecast> {
    const cacheKey = `openmeteo:multi:${latitude.toFixed(3)}:${longitude.toFixed(3)}:${forecastDays}:${models.join(",")}`;
    const cached = await this.cache.get<MultiModelMarineForecast>(cacheKey);
    if (cached) {
      return { ...cached, issuedAt: new Date(cached.issuedAt) };
    }

    const modelsParam = models.join(",");
    const [weather, marine] = await Promise.all([
      this.weatherBreaker.fire({
        latitude,
        longitude,
        hourly: [
          "wind_speed_10m",
          "wind_direction_10m",
          "wind_gusts_10m",
          "temperature_2m",
        ].join(","),
        models: modelsParam,
        wind_speed_unit: "kn",
        temperature_unit: "fahrenheit",
        timezone: "auto",
        forecast_days: forecastDays,
      }),
      this.marineBreaker
        .fire({
          latitude,
          longitude,
          hourly: ["wave_height"].join(","),
          models: modelsParam,
          timezone: "auto",
          forecast_days: forecastDays,
        })
        .catch((err) => {
          this.logger.warn(
            { err, latitude, longitude },
            "Open-Meteo multi-model marine fetch failed; returning weather-only",
          );
          return null;
        }),
    ]);

    const hourly = (weather as { hourly?: Record<string, unknown> } | null)
      ?.hourly;
    const times: string[] = Array.isArray(hourly?.time)
      ? (hourly.time as string[])
      : [];

    const marineHourly = (marine as { hourly?: Record<string, unknown> } | null)
      ?.hourly;
    const modelsWithWaves: string[] = [];

    const out: ModelTimeseries[] = [];
    for (const model of models) {
      const winds = pickArray(hourly, `wind_speed_10m_${model}`);
      const gusts = pickArray(hourly, `wind_gusts_10m_${model}`);
      const dirs = pickArray(hourly, `wind_direction_10m_${model}`);
      const temps = pickArray(hourly, `temperature_2m_${model}`);
      // If a model returned no wind data at all, skip it entirely — Open-Meteo
      // sometimes silently drops models for locations they don't cover well.
      if (winds.length === 0) continue;
      const waves = pickArray(marineHourly, `wave_height_${model}`);
      if (waves.length > 0) modelsWithWaves.push(model);
      out.push({
        model,
        time: times,
        windSpeedKt: winds,
        windGustKt: gusts.length > 0 ? gusts : winds.map((w) => w * 1.3),
        windDirectionDeg: dirs,
        temperatureF: temps,
        waveHeightM: waves.length > 0 ? waves : undefined,
      });
    }

    const forecast: MultiModelMarineForecast = {
      location: { latitude, longitude },
      issuedAt: new Date(),
      models: out,
      modelsWithWaves,
    };

    await this.cache.set(cacheKey, forecast, WEATHER_CACHE_TTL_S);
    return forecast;
  }

  private bearingToCardinal(deg: number | null | undefined): string {
    if (deg == null || Number.isNaN(deg)) return "VAR";
    const dirs = [
      "N",
      "NNE",
      "NE",
      "ENE",
      "E",
      "ESE",
      "SE",
      "SSE",
      "S",
      "SSW",
      "SW",
      "WSW",
      "W",
      "WNW",
      "NW",
      "NNW",
    ];
    return dirs[Math.round((deg % 360) / 22.5) % 16];
  }

  // Defensive number-array accessor used by multi-model parsing — Open-Meteo
  // returns `null` entries for hours a model doesn't cover. We collapse those
  // to NaN so the disagreement calculator can filter them out per-row.

  private weatherCodeToText(code: number | null | undefined): string {
    // WMO weather codes (subset most common at sea).
    if (code == null) return "Clear";
    if (code === 0) return "Clear";
    if (code <= 3) return "Partly cloudy";
    if (code <= 48) return "Fog";
    if (code <= 57) return "Drizzle";
    if (code <= 67) return "Rain";
    if (code <= 77) return "Snow";
    if (code <= 82) return "Rain showers";
    if (code <= 86) return "Snow showers";
    if (code <= 99) return "Thunderstorm";
    return "Unknown";
  }
}

function pickArray(
  hourly: Record<string, unknown> | null | undefined,
  field: string,
): number[] {
  if (!hourly) return [];
  const raw = hourly[field];
  if (!Array.isArray(raw)) return [];
  return raw.map((v) =>
    v === null || v === undefined || v === "" ? NaN : Number(v),
  );
}
