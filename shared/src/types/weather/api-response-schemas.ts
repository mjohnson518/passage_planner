/**
 * Zod schemas for external weather API responses.
 *
 * SAFETY CRITICAL: These schemas validate data at the API boundary before it
 * enters the passage planning pipeline. Malformed external data that passes
 * through unvalidated could silently corrupt safety assessments.
 *
 * On parse failure, callers must:
 *   1. Log the malformed payload via Pino + Sentry
 *   2. Return null (triggers the existing "weather unavailable" safety path)
 *   3. NEVER return partially-valid data
 */
import { z } from 'zod';

// ── NOAA Forecast period ────────────────────────────────────────────────────

export const NOAAForecastPeriodSchema = z.object({
  startTime: z.string(),
  endTime: z.string(),
  temperature: z.number(),
  temperatureUnit: z.string(),
  windSpeed: z.string(),
  windDirection: z.string(),
  shortForecast: z.string(),
  detailedForecast: z.string(),
  probabilityOfPrecipitation: z.object({ value: z.number().nullable() }).nullable().optional(),
  isDaytime: z.boolean(),
  number: z.number().optional(),
  name: z.string().optional(),
});

export const NOAAForecastResponseSchema = z.object({
  generatedAt: z.string(),
  periods: z.array(NOAAForecastPeriodSchema).min(1),
});

export type NOAAForecastResponse = z.infer<typeof NOAAForecastResponseSchema>;

// ── NOAA Alert / Warning ────────────────────────────────────────────────────

export const NOAAAlertSchema = z.object({
  id: z.string(),
  event: z.string(),
  severity: z.string(),
  headline: z.string(),
  description: z.string(),
  instruction: z.string().nullable().optional(),
  onset: z.string(),
  expires: z.string(),
  areaDesc: z.string(),
});

export const NOAAAlertsResponseSchema = z.array(NOAAAlertSchema);

export type NOAAAlert = z.infer<typeof NOAAAlertSchema>;

// ── NDBC Buoy (parsed text rows — checked after parseNDBCData) ─────────────

export const NDBCObservationRowSchema = z.object({
  WVHT: z.string().optional(),  // significant wave height (m)
  DPD: z.string().optional(),   // dominant wave period (s)
  MWD: z.string().optional(),   // mean wave direction (deg)
  WTMP: z.string().optional(),  // water temperature (°C)
  WSPD: z.string().optional(),  // wind speed (m/s)
  WDIR: z.string().optional(),  // wind direction (deg)
  GST: z.string().optional(),   // gust speed (m/s)
  ATMP: z.string().optional(),  // air temperature (°C)
  PRES: z.string().optional(),  // pressure (hPa)
  VIS: z.string().optional(),   // visibility (nm)
}).passthrough();

// ── OpenWeather API ─────────────────────────────────────────────────────────

export const OpenWeatherCurrentSchema = z.object({
  dt: z.number(),
  temp: z.number(),
  feels_like: z.number(),
  humidity: z.number(),
  wind_speed: z.number(),
  wind_deg: z.number(),
  wind_gust: z.number().optional(),
  weather: z.array(z.object({
    id: z.number(),
    main: z.string(),
    description: z.string(),
    icon: z.string(),
  })).min(1),
  visibility: z.number().optional(),
  clouds: z.object({ all: z.number() }).optional(),
}).passthrough();

export const OpenWeatherResponseSchema = z.object({
  lat: z.number(),
  lon: z.number(),
  current: OpenWeatherCurrentSchema,
  hourly: z.array(OpenWeatherCurrentSchema.extend({ pop: z.number().optional() })).optional(),
  daily: z.array(z.object({
    dt: z.number(),
    temp: z.object({ min: z.number(), max: z.number() }).passthrough(),
    weather: z.array(z.object({ description: z.string() })).min(1),
    wind_speed: z.number(),
    wind_gust: z.number().optional(),
  }).passthrough()).optional(),
}).passthrough();

export type OpenWeatherResponse = z.infer<typeof OpenWeatherResponseSchema>;
