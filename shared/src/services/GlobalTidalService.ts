/**
 * GlobalTidalService — region-aware tidal-data provider.
 *
 * Wraps NOAATidalService (US, US territories) and OpenMeteoTidalService
 * (everyone else, modelled tide height). Returns predictions in the same
 * `TidalPrediction` shape regardless of source, so the planner can render
 * a single timeline without knowing which provider it came from.
 *
 * SAFETY:
 * - When the modelled (Open-Meteo) source is used, predictions are flagged
 *   so the UI can display a "modelled tide" caveat. Modelled tides are
 *   accurate enough for open-coast passage planning but NOT for shoal-water
 *   entry — the user must cross-check a local tide table.
 * - We never silently degrade to no tide data. If both providers fail we
 *   throw and the orchestrator surfaces a `tidal_data_unavailable` warning.
 */

import { Logger } from "pino";
import { CacheManager } from "./CacheManager";
import {
  NOAATidalService,
  TidalPrediction,
  TidalStation,
} from "./NOAATidalService";
import { OpenMeteoTidalService } from "./OpenMeteoTidalService";
import { isNOAACoverage } from "./GlobalWeatherService";

export interface GlobalTideResult {
  station: TidalStation | null;
  predictions: TidalPrediction[];
  source: "NOAA" | "OpenMeteo (modelled)";
  modelled: boolean;
  caveat?: string;
  fetchedAt: Date;
}

export class GlobalTidalService {
  private noaa: NOAATidalService;
  private openMeteo: OpenMeteoTidalService;
  private logger: Logger;

  constructor(cache: CacheManager, logger: Logger) {
    this.noaa = new NOAATidalService(cache, logger);
    this.openMeteo = new OpenMeteoTidalService(cache, logger);
    this.logger = logger;
  }

  async getTidesNearLocation(
    latitude: number,
    longitude: number,
    days = 3,
  ): Promise<GlobalTideResult> {
    if (isNOAACoverage(latitude, longitude)) {
      try {
        const stations = await this.noaa.findNearestStations(
          latitude,
          longitude,
          100,
        );
        if (stations.length > 0) {
          const station = stations[0];
          const start = new Date();
          const end = new Date(start.getTime() + days * 24 * 60 * 60 * 1000);
          const data = await this.noaa.getTidalPredictions(
            station.id,
            start,
            end,
          );
          if (data.predictions.length > 0) {
            return {
              station: data.station,
              predictions: data.predictions,
              source: "NOAA",
              modelled: false,
              fetchedAt: new Date(),
            };
          }
        }
      } catch (err) {
        this.logger.warn(
          { err, latitude, longitude },
          "NOAA tides failed in coverage; falling back to modelled tides",
        );
      }
    }

    try {
      const modelled = await this.openMeteo.getTideForecast(
        latitude,
        longitude,
        days,
      );
      return {
        station: null,
        predictions: modelled.predictions.map((p) => ({
          time: p.t,
          height: p.v,
          type: p.type,
        })),
        source: "OpenMeteo (modelled)",
        modelled: true,
        caveat: modelled.caveat,
        fetchedAt: modelled.fetchedAt,
      };
    } catch (err) {
      this.logger.error(
        { err, latitude, longitude },
        "Both NOAA and Open-Meteo tide providers failed",
      );
      throw new Error(
        `Unable to retrieve tide data for ${latitude.toFixed(2)},${longitude.toFixed(2)} ` +
          `from any provider. Plan with extra clearance margin and cross-check a local tide table.`,
      );
    }
  }
}
