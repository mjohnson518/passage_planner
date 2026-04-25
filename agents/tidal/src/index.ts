import {
  BaseAgent,
  NOAATidalService,
  CacheManager,
  loggerRedactOptions,
} from "@passage-planner/shared";
import { Logger } from "pino";
import pino from "pino";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

/**
 * SAFETY-CRITICAL: Hard ceiling on how old cached tidal data may be before we
 * refuse to use it. CLAUDE.md mandates rejecting tides >1 day old — predictions
 * can be superseded when NOAA recalibrates a station, and a tidal error that
 * says "high water 14:00" when it's actually 12:30 can ground a boat.
 */
export const MAX_TIDAL_AGE_MS = 24 * 60 * 60 * 1000;

export class StaleTidalError extends Error {
  constructor(
    public readonly ageHours: number,
    public readonly fetchedAt: Date,
  ) {
    super(
      `Tidal data is ${ageHours.toFixed(1)} hours old (max 24). Refusing to return — ` +
        `stale predictions cannot safely drive depth or window decisions. Refresh from NOAA.`,
    );
    this.name = "StaleTidalError";
  }
}

export function assertTidalFresh(
  fetchedAt: Date | string | number,
  now: number = Date.now(),
): void {
  const fetched = fetchedAt instanceof Date ? fetchedAt : new Date(fetchedAt);
  const ageMs = now - fetched.getTime();
  if (Number.isNaN(ageMs) || ageMs > MAX_TIDAL_AGE_MS) {
    const ageHours = Number.isNaN(ageMs) ? Infinity : ageMs / (60 * 60 * 1000);
    throw new StaleTidalError(ageHours, fetched);
  }
}

export class TidalAgent extends BaseAgent {
  private tidalService: NOAATidalService;
  private cache: CacheManager;

  constructor() {
    const logger = pino({
      level: process.env.LOG_LEVEL || "info",
      transport: {
        target: "pino-pretty",
        options: { colorize: true },
      },
      ...loggerRedactOptions,
    });

    super(
      {
        name: "Tidal Analysis Agent",
        version: "2.0.0",
        description:
          "Provides real-time tidal predictions and navigation windows using NOAA data",
        healthCheckInterval: 30000,
      },
      logger,
    );

    this.cache = new CacheManager(logger);
    this.tidalService = new NOAATidalService(this.cache, logger);

    this.setupTools();
  }

  protected getAgentSpecificHealth(): any {
    return {
      tidalServiceActive: true,
      cacheStatus: "active",
      lastPredictionTime: new Date(),
    };
  }

  private setupTools() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: "get_tidal_stations",
            description: "Find nearby tidal stations",
            inputSchema: {
              type: "object",
              properties: {
                latitude: { type: "number", minimum: -90, maximum: 90 },
                longitude: { type: "number", minimum: -180, maximum: 180 },
                radius: {
                  type: "number",
                  minimum: 1,
                  maximum: 100,
                  default: 50,
                },
              },
              required: ["latitude", "longitude"],
            },
          },
          {
            name: "get_tides",
            description:
              "Get tidal predictions for a location or specific station",
            inputSchema: {
              type: "object",
              properties: {
                stationId: {
                  type: "string",
                  description: 'Station ID or "nearest" to auto-find',
                },
                latitude: { type: "number", minimum: -90, maximum: 90 },
                longitude: { type: "number", minimum: -180, maximum: 180 },
                startDate: { type: "string", format: "date-time" },
                endDate: { type: "string", format: "date-time" },
              },
              required: ["startDate", "endDate"],
            },
          },
          {
            name: "calculate_tidal_windows",
            description:
              "Calculate safe navigation windows based on draft and clearance",
            inputSchema: {
              type: "object",
              properties: {
                stationId: { type: "string" },
                startDate: { type: "string", format: "date-time" },
                endDate: { type: "string", format: "date-time" },
                requiredDepth: {
                  type: "number",
                  description: "Required water depth in feet",
                },
                bridgeClearance: {
                  type: "number",
                  description: "Required bridge clearance in feet (optional)",
                },
              },
              required: ["stationId", "startDate", "endDate", "requiredDepth"],
            },
          },
        ],
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case "get_tidal_stations":
            return await this.getTidalStations(args);

          case "get_tides":
            return await this.getTides(args);

          case "calculate_tidal_windows":
            return await this.calculateTidalWindows(args);

          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        this.logger.error({ error, tool: name }, "Tool execution failed");
        throw error;
      }
    });
  }

  private async getTidalStations(args: any): Promise<any> {
    const { latitude, longitude, radius = 50 } = args;

    try {
      const stations = await this.tidalService.findNearestStations(
        latitude,
        longitude,
        radius,
      );

      return {
        content: [
          {
            type: "text",
            text: `Found ${stations.length} tidal stations within ${radius}nm of ${latitude.toFixed(2)}°, ${longitude.toFixed(2)}°`,
          },
          {
            type: "data",
            data: stations,
          },
        ],
      };
    } catch (error) {
      this.logger.error({ error, args }, "Failed to get tidal stations");
      return {
        content: [
          {
            type: "text",
            text: `Unable to retrieve tidal stations: ${(error as Error).message}`,
          },
        ],
        isError: true,
      };
    }
  }

  private async getTides(args: any): Promise<any> {
    const { stationId, latitude, longitude, startDate, endDate } = args;

    try {
      // If stationId is 'nearest' or not provided, find nearest station by coordinates
      let resolvedStationId = stationId;
      if (!stationId || stationId === "nearest") {
        if (!latitude || !longitude) {
          return {
            content: [
              {
                type: "text",
                text: "Either stationId or latitude/longitude coordinates are required",
              },
            ],
            isError: true,
          };
        }

        // Find nearest station
        const stations = await this.tidalService.findNearestStations(
          latitude,
          longitude,
          50,
        );
        if (stations.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: `No tidal stations found within 50nm of ${latitude.toFixed(2)}°, ${longitude.toFixed(2)}°`,
              },
            ],
            isError: true,
          };
        }
        resolvedStationId = stations[0].id;
        this.logger.info(
          {
            latitude,
            longitude,
            station: stations[0].name,
          },
          "Found nearest tidal station",
        );
      }

      const predictions = await this.tidalService.getTidalPredictions(
        resolvedStationId,
        new Date(startDate),
        new Date(endDate),
      );

      // SAFETY CRITICAL (CLAUDE.md): hard-reject tidal data older than
      // MAX_TIDAL_AGE_MS (24h). Mirrors the weather-agent contract at
      // agents/weather/src/index.ts. The cache-fallback path can surface a
      // prediction set older than the TTL if the circuit breaker is open and
      // only the 7-day fallback cache hits — in that case, refusing to return
      // stale data is the correct life-safety behavior.
      try {
        assertTidalFresh(predictions.fetchedAt);
      } catch (staleError) {
        this.logger.error(
          {
            err: staleError,
            stationId: resolvedStationId,
            fetchedAt: predictions.fetchedAt,
          },
          "Refusing to return stale tidal predictions",
        );
        return {
          content: [
            {
              type: "text",
              text: `Unable to retrieve tidal predictions: ${(staleError as Error).message}`,
            },
          ],
          isError: true,
        };
      }

      // Validate tidal data freshness and coverage
      const freshnessWarnings = this.validateTidalFreshness(
        predictions,
        new Date(startDate),
        new Date(endDate),
        latitude,
        longitude,
      );

      return {
        content: [
          {
            type: "text",
            text: this.formatTidalSummary(predictions, resolvedStationId),
          },
          {
            type: "data",
            data: {
              ...predictions,
              freshnessWarnings,
            },
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Unable to retrieve tidal predictions: ${(error as Error).message}`,
          },
        ],
        isError: true,
      };
    }
  }

  private async calculateTidalWindows(args: any): Promise<any> {
    const { stationId, startDate, endDate, requiredDepth, bridgeClearance } =
      args;

    try {
      const duration =
        (new Date(endDate).getTime() - new Date(startDate).getTime()) /
        (1000 * 60 * 60);
      const windows = await this.tidalService.calculateTidalWindows(
        stationId,
        new Date(startDate),
        duration,
        {
          minTideHeight: requiredDepth * 0.3048, // Convert feet to meters
          preferRising: true,
        },
      );

      return {
        content: [
          {
            type: "text",
            text:
              windows.length > 0
                ? `Found ${windows.length} safe navigation windows`
                : "No safe navigation windows found for the specified requirements",
          },
          {
            type: "data",
            data: windows,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Unable to calculate tidal windows: ${(error as Error).message}`,
          },
        ],
        isError: true,
      };
    }
  }

  /**
   * Validate tidal data freshness and coverage
   * SAFETY CRITICAL: Incomplete tidal data can lead to groundings
   */
  private validateTidalFreshness(
    predictions: any,
    requestedStart: Date,
    requestedEnd: Date,
    latitude?: number,
    longitude?: number,
  ): string[] {
    const warnings: string[] = [];

    if (!predictions) {
      warnings.push(
        "⚠️ TIDAL DATA UNAVAILABLE - verify tidal conditions from official sources before departure",
      );
      return warnings;
    }

    // Check if prediction time range covers requested range
    if (predictions.extremes && predictions.extremes.length > 0) {
      const predictionStart = new Date(predictions.extremes[0].time);
      const predictionEnd = new Date(
        predictions.extremes[predictions.extremes.length - 1].time,
      );

      if (predictionStart > requestedStart) {
        warnings.push(
          `⚠️ Tidal predictions start at ${predictionStart.toISOString()} but passage starts at ${requestedStart.toISOString()} - early portion not covered`,
        );
      }
      if (predictionEnd < requestedEnd) {
        warnings.push(
          `⚠️ Tidal predictions end at ${predictionEnd.toISOString()} but passage extends to ${requestedEnd.toISOString()} - later portion not covered`,
        );
      }

      // Check for gaps >6 hours in predictions
      for (let i = 1; i < predictions.extremes.length; i++) {
        const prev = new Date(predictions.extremes[i - 1].time);
        const curr = new Date(predictions.extremes[i].time);
        const gapHours = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60);
        if (gapHours > 6) {
          warnings.push(
            `⚠️ Gap of ${Math.round(gapHours)} hours in tidal predictions between ${prev.toISOString()} and ${curr.toISOString()}`,
          );
          break; // Only report the first gap
        }
      }
    } else {
      warnings.push(
        "⚠️ No tidal extremes data available - verify high/low tide times from official sources",
      );
    }

    // Warn if station is distant (lower accuracy)
    if (predictions.station?.distance && predictions.station.distance > 40) {
      warnings.push(
        `⚠️ Nearest tidal station is ${Math.round(predictions.station.distance)}nm away - predictions may have reduced accuracy`,
      );
    }

    return warnings;
  }

  private formatTidalSummary(predictions: any, stationId: string): string {
    const lines = [
      `🌊 Tidal Predictions for Station ${stationId}`,
      `Period: ${predictions.startDate.toLocaleDateString()} - ${predictions.endDate.toLocaleDateString()}`,
      "",
    ];

    if (predictions.extremes && predictions.extremes.length > 0) {
      lines.push("**Tide Times:**");
      predictions.extremes.slice(0, 8).forEach((extreme: any) => {
        const icon = extreme.type === "high" ? "📈" : "📉";
        lines.push(
          `${icon} ${extreme.time.toLocaleString()}: ${extreme.height.toFixed(1)}ft (${extreme.type})`,
        );
      });
    }

    if (predictions.currentHeight !== undefined) {
      lines.push("");
      lines.push(`Current Height: ${predictions.currentHeight.toFixed(1)}ft`);
    }

    return lines.join("\n");
  }

  /**
   * Public method to call tools directly (for orchestrator)
   */
  public async callTool(toolName: string, args: any): Promise<any> {
    switch (toolName) {
      case "get_tidal_stations":
        return await this.getTidalStations(args);
      case "get_tides":
      case "get_tide_predictions": // Alias for compatibility
        return await this.getTides(args);
      case "calculate_tidal_windows":
      case "find_navigation_windows": // Alias for compatibility
        return await this.calculateTidalWindows(args);
      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }
}

// Start the agent if run directly
if (require.main === module) {
  const agent = new TidalAgent();
  agent.start().catch(console.error);
}
