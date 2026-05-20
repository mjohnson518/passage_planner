/**
 * GeocodingService — global place-name → lat/lon resolution.
 *
 * Talks to Open-Meteo's geocoding endpoint, which is free, no-API-key, and
 * covers most named places worldwide (it indexes GeoNames). Falls back to
 * OpenStreetMap Nominatim for marine-specific names (anchorages, marinas)
 * that GeoNames misses.
 *
 * SAFETY:
 * - Returns up to N candidates so the UI can disambiguate "Cambridge" (UK)
 *   from "Cambridge" (MA) before the planner commits to a route.
 * - Caches successful lookups for 7 days — port locations change rarely.
 * - Nominatim has a 1 req/sec policy; we serialise through axios and ALSO
 *   send a User-Agent identifying Helmwise as required by their ToS.
 */

import { Logger } from "pino";
import axios, { AxiosInstance } from "axios";
import CircuitBreaker from "opossum";
import { CacheManager } from "./CacheManager";
import { CircuitBreakerFactory } from "./resilience/circuit-breaker";

const OPENMETEO_GEOCODE = "https://geocoding-api.open-meteo.com/v1/search";
const NOMINATIM = "https://nominatim.openstreetmap.org/search";

export interface GeocodeResult {
  name: string;
  latitude: number;
  longitude: number;
  country?: string;
  countryCode?: string;
  admin1?: string; // state / province
  feature?: string; // e.g. "harbour", "port", "marina"
  source: "openmeteo" | "nominatim";
}

const GEOCODE_CACHE_TTL_S = 7 * 24 * 60 * 60;

export class GeocodingService {
  private cache: CacheManager;
  private logger: Logger;
  private http: AxiosInstance;
  /**
   * Separate breakers per provider so an Open-Meteo outage doesn't trip
   * the Nominatim fallback path (and vice-versa). Geocoding is non-safety-
   * critical but it powers the planner form, so a dead provider should
   * fall back silently rather than make the whole input field stop working.
   */
  private openMeteoBreaker: CircuitBreaker;
  private nominatimBreaker: CircuitBreaker;

  constructor(cache: CacheManager, logger: Logger) {
    this.cache = cache;
    this.logger = logger;
    this.http = axios.create({
      timeout: 10000,
      headers: {
        "User-Agent": "Helmwise/1.0 (https://helmwise.co; ops@helmwise.co)",
      },
    });
    this.openMeteoBreaker = CircuitBreakerFactory.create(
      "openmeteo:geocode",
      (params: Record<string, unknown>) =>
        this.http.get(OPENMETEO_GEOCODE, { params }).then((r) => r.data),
      { timeout: 10000 },
    );
    this.nominatimBreaker = CircuitBreakerFactory.create(
      "nominatim:search",
      (config: { url: string; params: Record<string, unknown> }) =>
        this.http
          .get(config.url, { params: config.params })
          .then((r) => r.data),
      { timeout: 10000 },
    );
  }

  async search(query: string, limit = 5): Promise<GeocodeResult[]> {
    const trimmed = query.trim();
    if (trimmed.length < 2) return [];

    const cacheKey = `geocode:${trimmed.toLowerCase()}:${limit}`;
    const cached = await this.cache.get<GeocodeResult[]>(cacheKey);
    if (cached) return cached;

    let results = await this.searchOpenMeteo(trimmed, limit);

    // OpenMeteo (GeoNames) misses many marinas / anchorages.
    // Top up from Nominatim if we got fewer than half the requested results.
    if (results.length < Math.ceil(limit / 2)) {
      const nominatim = await this.searchNominatim(trimmed, limit).catch(
        (err) => {
          this.logger.warn(
            { err, query: trimmed },
            "Nominatim fallback failed",
          );
          return [];
        },
      );
      // De-duplicate by rough coordinate match (within ~1km).
      for (const n of nominatim) {
        const dup = results.some(
          (r) =>
            Math.abs(r.latitude - n.latitude) < 0.01 &&
            Math.abs(r.longitude - n.longitude) < 0.01,
        );
        if (!dup) results.push(n);
        if (results.length >= limit) break;
      }
    }

    await this.cache.set(cacheKey, results, GEOCODE_CACHE_TTL_S);
    return results;
  }

  async reverse(
    latitude: number,
    longitude: number,
  ): Promise<GeocodeResult | null> {
    const cacheKey = `geocode:rev:${latitude.toFixed(3)}:${longitude.toFixed(3)}`;
    const cached = await this.cache.get<GeocodeResult | null>(cacheKey);
    if (cached !== undefined) return cached;

    try {
      const { data } = await this.http.get(
        NOMINATIM.replace("/search", "/reverse"),
        {
          params: { lat: latitude, lon: longitude, format: "json", zoom: 10 },
        },
      );
      const result: GeocodeResult | null = data?.display_name
        ? {
            name: data.display_name,
            latitude,
            longitude,
            country: data.address?.country,
            countryCode: data.address?.country_code?.toUpperCase(),
            admin1: data.address?.state ?? data.address?.region,
            feature: data.type,
            source: "nominatim",
          }
        : null;

      await this.cache.set(cacheKey, result, GEOCODE_CACHE_TTL_S);
      return result;
    } catch (err) {
      this.logger.warn({ err, latitude, longitude }, "Reverse geocode failed");
      return null;
    }
  }

  private async searchOpenMeteo(
    query: string,
    limit: number,
  ): Promise<GeocodeResult[]> {
    try {
      const data = (await this.openMeteoBreaker.fire({
        name: query,
        count: limit,
        language: "en",
        format: "json",
      })) as { results?: any[] };
      const rows: any[] = data?.results ?? [];
      return rows.map((r) => ({
        name:
          r.name +
          (r.admin1 ? `, ${r.admin1}` : "") +
          (r.country ? `, ${r.country}` : ""),
        latitude: r.latitude,
        longitude: r.longitude,
        country: r.country,
        countryCode: r.country_code,
        admin1: r.admin1,
        feature: r.feature_code,
        source: "openmeteo",
      }));
    } catch (err) {
      this.logger.warn({ err, query }, "Open-Meteo geocode failed");
      return [];
    }
  }

  private async searchNominatim(
    query: string,
    limit: number,
  ): Promise<GeocodeResult[]> {
    const data = await this.nominatimBreaker.fire({
      url: NOMINATIM,
      params: { q: query, format: "json", limit, addressdetails: 1 },
    });
    const rows: any[] = Array.isArray(data) ? data : [];
    return rows.map((r) => ({
      name: r.display_name,
      latitude: parseFloat(r.lat),
      longitude: parseFloat(r.lon),
      country: r.address?.country,
      countryCode: r.address?.country_code?.toUpperCase(),
      admin1: r.address?.state ?? r.address?.region,
      feature: r.type,
      source: "nominatim",
    }));
  }
}
