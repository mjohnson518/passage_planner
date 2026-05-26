// Simplified orchestrator without MCP SDK (HTTP + WebSocket only)
import Redis from "ioredis";
import { Pool } from "pg";
import { WeatherAgent } from "../../agents/weather/src/index";
import { TidalAgent } from "../../agents/tidal/src/index";
import { RouteAgent } from "../../agents/route/src";
import { SafetyAgent } from "../../agents/safety/src/index";
import { PortAgent } from "../../agents/port/src/index";
import { SafetyAuditLogger } from "../../agents/safety/src/utils/audit-logger";
import {
  WeatherAggregator,
  AggregateForecast,
} from "./services/weather-aggregator";
import {
  WeatherRoutingService,
  WeatherRoute,
} from "./services/weather-routing";
import { CronService } from "./services/CronService";
import {
  PushService,
  PUSH_TOPICS,
  type PushTopic,
} from "./services/PushService";
import {
  FloatPlanPdfService,
  type FloatPlanInput,
} from "./services/FloatPlanPdfService";
import {
  ShareService,
  SHARE_DEFAULT_EXPIRY_DAYS,
  SHARE_MAX_EXPIRY_DAYS,
} from "./services/ShareService";
import { SatCommService } from "./services/SatCommService";
import {
  getAdapter,
  KNOWN_VENDORS,
  type Vendor,
} from "./services/satcomm/adapters";
import { PassageDriftMonitor } from "./services/PassageDriftMonitor";
import { MaintenanceMonitor } from "./services/MaintenanceMonitor";
import { LogbookPdfService } from "./services/LogbookPdfService";
import {
  BaseAgent,
  GeocodingService,
  CacheManager,
  StripeService,
  TOP_UP_PACKS,
  getFleetSeatLimit,
  OpenMeteoWeatherService,
  summariseModelDisagreement,
  type ModelComparisonSummary,
  parseExpeditionCsv,
  normalizedToVesselPolar,
  type NormalizedPolar,
  type VesselPolarMap,
} from "@passage-planner/shared";
import { emailService } from "./services/EmailService";
import * as crypto from "crypto";
import { WebSocketServer, WebSocket } from "ws";
import { v4 as uuidv4 } from "uuid";
import express from "express";
import http from "http";
import pino from "pino";
import jwt from "jsonwebtoken";
import { z } from "zod";
import {
  WEATHER_WARN_AGE_MS,
  WEATHER_REJECT_AGE_MS,
  WEATHER_DELAY_FACTOR,
  FUEL_WATER_RESERVE_FACTOR,
  PLAN_STATUS,
  loggerRedactOptions,
  type PlanStatus,
  COVERAGE_GAPS,
  findOutOfCoverage,
  getCoverageRegion,
  FOUNDING_MEMBER,
} from "@passage-planner/shared";

const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  ...loggerRedactOptions,
});

interface AgentRegistry {
  [key: string]: BaseAgent | SafetyAgent;
}

export class SimpleOrchestrator {
  private agents: AgentRegistry = {};
  private redis: Redis | null;
  /**
   * Postgres pool for user-facing reads/writes (profiles, founding-member
   * count, future fleet + subscription queries). Null when DATABASE_URL is
   * unset — endpoints that need it should 503 rather than crash so local
   * development without a DB still serves planning calls.
   */
  private postgres: Pool | null = null;
  private wss: WebSocketServer;
  private httpServer: http.Server;
  private app: express.Application;
  private portAgent: PortAgent;
  private auditLogger: SafetyAuditLogger;
  private weatherAggregator: WeatherAggregator;
  private weatherRouting: WeatherRoutingService;
  /**
   * Geocoding service for global place-name lookups. Backs the
   * `/api/geocode` endpoint the planner uses to translate "Cowes" or
   * "Palma de Mallorca" into coordinates without forcing the user to
   * find them on a chart first.
   */
  private geocodingService: GeocodingService;
  /**
   * Stripe wrapper backing /api/subscription/* and the webhook handler.
   * Handles signature verification, checkout-session creation, customer
   * portal sessions, and subscription/top-up event dispatch. Webhook
   * idempotency is enforced via the `subscription_events` table.
   */
  private stripeService: StripeService;
  /**
   * Cron scheduler: trial-end reminders (daily 09:00 PT), monthly usage
   * reports (1st of month 10:00 PT), email-log cleanup (Sunday 02:00 PT),
   * external-API health checks (hourly), and NGA ASAM piracy ingest
   * (nightly 03:00 PT). Started in `start()` after HTTP comes up so the
   * server can serve traffic even if Resend or NGA are unreachable.
   */
  private cronService: CronService | null = null;
  /**
   * Web Push fanout (S3). Initialised when both DATABASE_URL and VAPID keys
   * are present. Null when either is missing — push endpoints then 503 so
   * local dev without VAPID keys doesn't surface confusing 500s.
   */
  private pushService: PushService | null = null;
  /**
   * Float plan PDF generator (S1). Stateless — instantiated once and reused
   * for every send. Backed by pdfkit; no native deps.
   */
  private floatPlanPdf: FloatPlanPdfService = new FloatPlanPdfService();
  /**
   * Public-share token service (S4). Wired once Redis is up; null otherwise
   * so share endpoints can 503 cleanly without crashing.
   */
  private shareService: ShareService | null = null;
  /**
   * Sat-comm device + position-report ingestion (S2). Initialised when
   * Postgres is up; works with or without Redis/Push (off-route detection
   * and alerts are best-effort).
   */
  private satCommService: SatCommService | null = null;
  /**
   * Multi-model weather provider (R1) — Premium feature that fetches the
   * same forecast from several models (GFS / ECMWF / ICON) so the planner
   * can surface where they agree and where they don't.
   */
  private multiModelWeather: OpenMeteoWeatherService;
  /**
   * Weather-drift monitor (R4). Wired when Redis is up so the cron service
   * can periodically re-score saved passages and dispatch push+email alerts
   * when the forecast has worsened materially. Null when Redis is down.
   */
  private driftMonitor: PassageDriftMonitor | null = null;
  /**
   * Vessel maintenance monitor (V2). Daily scan of vessel_maintenance rows
   * joined to user_vessels; dispatches overdue alerts via push + email with
   * a 7-day per-item dedup window. Null when Postgres is unavailable.
   */
  private maintenanceMonitor: MaintenanceMonitor | null = null;
  /**
   * Logbook PDF generator (V3). Stateless — instantiated once and reused
   * for every export. Backed by pdfkit; no native deps.
   */
  private logbookPdf: LogbookPdfService = new LogbookPdfService();

  constructor() {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      logger.warn(
        "REDIS_URL not set — running without Redis (no caching/rate limiting)",
      );
      this.redis = null;
    } else {
      // SAFETY/RELIABILITY: A single network blip must not take the orchestrator
      // offline. Exponential backoff (50ms → 2s cap) gives the cluster time to
      // recover; keeping maxRetriesPerRequest small so a persistent outage
      // surfaces fast to callers (who fall back to direct API calls rather than
      // hanging on cached reads).
      this.redis = new Redis(redisUrl, {
        maxRetriesPerRequest: 3,
        retryStrategy: (times: number) =>
          Math.min(50 * Math.pow(2, times - 1), 2000),
        reconnectOnError: (err: Error) => {
          const targetErrors = ["READONLY", "ECONNRESET", "ETIMEDOUT"];
          return targetErrors.some((e) => err.message.includes(e));
        },
        enableOfflineQueue: true,
        connectTimeout: 10000,
      });
      this.redis.on("error", (err) => {
        logger.warn(
          { err: err.message },
          "Redis connection error — continuing with degraded cache",
        );
      });
      this.redis.on("reconnecting", (delay: number) => {
        logger.info({ delayMs: delay }, "Redis reconnecting");
      });
      this.redis.on("ready", () => {
        logger.info("Redis connection ready");
      });
      this.shareService = new ShareService(this.redis, logger);
    }

    const dbUrl = process.env.DATABASE_URL;
    if (dbUrl) {
      this.postgres = new Pool({
        connectionString: dbUrl,
        // Conservative defaults — Supabase/Postgres pooler enforces its own
        // ceiling, and an orchestrator process serving HTTP doesn't need a
        // huge pool. The /health endpoint exercises the pool with a ping
        // so a misconfigured connection string surfaces fast.
        max: 10,
        idleTimeoutMillis: 30_000,
        connectionTimeoutMillis: 10_000,
      });
      this.postgres.on("error", (err) => {
        logger.error({ err: err.message }, "Postgres pool error");
      });
      this.pushService = new PushService(this.postgres, logger);
      this.satCommService = new SatCommService(
        this.postgres,
        this.redis,
        this.pushService,
        logger,
      );
    } else {
      logger.warn("DATABASE_URL not set — profile/billing endpoints will 503");
    }

    this.app = express();
    this.httpServer = http.createServer(this.app);
    this.wss = new WebSocketServer({ server: this.httpServer });
    this.portAgent = new PortAgent();
    this.auditLogger = new SafetyAuditLogger(logger);
    this.weatherAggregator = new WeatherAggregator(logger);
    this.weatherRouting = new WeatherRoutingService(logger);
    this.geocodingService = new GeocodingService(
      new CacheManager(logger),
      logger,
    );
    this.multiModelWeather = new OpenMeteoWeatherService(
      new CacheManager(logger),
      logger,
    );
    this.stripeService = new StripeService(logger);

    this.initializeAgents();
    this.setupWebSocket();
    // CRITICAL: register the Stripe webhook BEFORE setupHttpServer() so it
    // sits ahead of the global express.json() middleware. Stripe signature
    // verification requires the raw Buffer body, not a parsed object.
    this.registerStripeWebhookEarly();
    // Sat-comm webhook (S2) — same pattern as Stripe: HMAC signature
    // verification needs the raw Buffer body so global json() must not run
    // first. Registered here so it sits ahead of express.json().
    this.registerSatCommWebhookEarly();
    this.setupHttpServer();
  }

  private async initializeAgents() {
    logger.info("Initializing agents...");

    // Initialize all four agents - including CRITICAL SafetyAgent
    this.agents["weather"] = new WeatherAgent();
    logger.info("Weather agent initialized");

    this.agents["tidal"] = new TidalAgent();
    logger.info("Tidal agent initialized");

    // RouteAgent now working with geolib (no more Turf.js ESM issues)
    this.agents["route"] = new RouteAgent();
    logger.info("Route agent initialized");

    // CRITICAL: SafetyAgent for hazard detection, depth checks, and safety warnings
    // This is life-safety infrastructure - never skip safety checks
    this.agents["safety"] = new SafetyAgent();
    await (this.agents["safety"] as SafetyAgent).initialize();
    logger.info("Safety agent initialized - CRITICAL for mariner safety");

    // PortAgent for port/marina information and emergency harbors
    await this.portAgent.initialize();
    logger.info("Port agent initialized");

    logger.info("All agents initialized");
  }

  private async planPassage(request: any): Promise<any> {
    const planningId = uuidv4();
    const startTime = Date.now();

    // Broadcast planning start
    this.broadcastUpdate({
      type: "planning_started",
      planningId,
      request,
    });

    logger.info(
      { planningId, request },
      "Starting passage planning with PARALLEL execution",
    );

    try {
      // PARALLEL EXECUTION - All agents at once for <3 second response!
      logger.info({ planningId }, "Executing all agents in parallel");

      // Prepare all agent calls with timeout protection
      const agentTimeout = 30000; // 30 second timeout

      const routePromise = Promise.race([
        this.agents["route"].callTool("calculate_route", {
          startLat: request.departure.latitude,
          startLon: request.departure.longitude,
          endLat: request.destination.latitude,
          endLon: request.destination.longitude,
          speed: request.vessel?.cruiseSpeed || 5,
        }),
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error("Route calculation timeout")),
            agentTimeout,
          ),
        ),
      ]).catch((error) => {
        logger.error({ error }, "Route agent error");
        // Fallback to simple calculation
        const distance = this.calculateSimpleDistance(
          request.departure.latitude,
          request.departure.longitude,
          request.destination.latitude,
          request.destination.longitude,
        );
        return {
          waypoints: [request.departure, request.destination],
          totalDistance: distance,
          estimatedDuration: distance / (request.vessel?.cruiseSpeed || 5),
        };
      });

      const weatherDeparturePromise = Promise.race([
        this.agents["weather"].callTool("get_marine_weather", {
          latitude: request.departure.latitude,
          longitude: request.departure.longitude,
          days: 3,
        }),
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error("Weather fetch timeout")),
            agentTimeout,
          ),
        ),
      ]).catch((error) => {
        logger.error({ error }, "Weather departure error");
        return null;
      });

      const weatherArrivalPromise = Promise.race([
        this.agents["weather"].callTool("get_marine_weather", {
          latitude: request.destination.latitude,
          longitude: request.destination.longitude,
          days: 3,
        }),
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error("Weather fetch timeout")),
            agentTimeout,
          ),
        ),
      ]).catch((error) => {
        logger.error({ error }, "Weather arrival error");
        return null;
      });

      const tidalDeparturePromise = Promise.race([
        this.agents["tidal"].callTool("get_tides", {
          latitude: request.departure.latitude,
          longitude: request.departure.longitude,
          startDate: request.departure.time || new Date().toISOString(),
          endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        }),
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error("Tidal fetch timeout")),
            agentTimeout,
          ),
        ),
      ]).catch((error) => {
        logger.error({ error }, "Tidal departure error");
        return null;
      });

      const tidalArrivalPromise = Promise.race([
        this.agents["tidal"].callTool("get_tides", {
          latitude: request.destination.latitude,
          longitude: request.destination.longitude,
          startDate: request.departure.time || new Date().toISOString(),
          endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        }),
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error("Tidal fetch timeout")),
            agentTimeout,
          ),
        ),
      ]).catch((error) => {
        logger.error({ error }, "Tidal arrival error");
        return null;
      });

      // CRITICAL: Safety Agent checks - LIFE SAFETY INFRASTRUCTURE
      // These checks detect hazards, verify depths, and provide safety warnings
      const routeWaypoints = [
        {
          latitude: request.departure.latitude,
          longitude: request.departure.longitude,
        },
        {
          latitude: request.destination.latitude,
          longitude: request.destination.longitude,
        },
      ];

      const safetyRoutePromise = Promise.race([
        this.agents["safety"].callTool("check_route_safety", {
          route: routeWaypoints,
          departure_time: request.departure.time || new Date().toISOString(),
          vessel_draft: request.vessel?.draft || 6,
        }),
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error("Safety check timeout")),
            agentTimeout,
          ),
        ),
      ]).catch((error) => {
        logger.error({ error }, "Safety route check error - CRITICAL");
        // CRITICAL: Log safety system failure to audit trail
        this.auditLogger.logWarningGenerated(
          planningId,
          undefined,
          "system_failure",
          "critical",
          undefined,
          `SafetyAgent failed: ${error.message || "Unknown error"}`,
        );
        // Return enriched fallback — populate warnings so they surface to the mariner
        return {
          warnings: [
            {
              id: "sf-1",
              type: "system_failure",
              severity: "critical",
              description:
                "DO NOT depart without completing manual safety verification",
            },
            {
              id: "sf-2",
              type: "system_failure",
              severity: "critical",
              description:
                "Consult official nautical charts for the entire route",
            },
            {
              id: "sf-3",
              type: "manual_check",
              severity: "critical",
              description:
                "Check NOAA marine weather warnings for your route area",
            },
            {
              id: "sf-4",
              type: "manual_check",
              severity: "critical",
              description:
                "Verify water depths against official nautical charts (NOAA/UKHO)",
            },
            {
              id: "sf-5",
              type: "manual_check",
              severity: "critical",
              description:
                "Check for restricted areas and active NOTAMs along route",
            },
            {
              id: "sf-6",
              type: "manual_check",
              severity: "critical",
              description:
                "Verify tidal heights are safe for vessel draft at all waypoints",
            },
            {
              id: "sf-7",
              type: "manual_check",
              severity: "critical",
              description: "File a float plan with a trusted shore contact",
            },
            {
              id: "sf-8",
              type: "manual_check",
              severity: "critical",
              description: "Monitor VHF Channel 16 continuously during passage",
            },
          ],
          hazards: [],
          recommendations: ["Safety check failed - exercise extreme caution"],
          safetyCheckFailed: true,
          failureDetails: {
            reason: error.message || "Safety system unavailable",
            timestamp: new Date().toISOString(),
          },
        };
      });

      const safetyBriefPromise = Promise.race([
        this.agents["safety"].callTool("generate_safety_brief", {
          departure_port: request.departure.name || "Unknown",
          destination_port: request.destination.name || "Unknown",
          route_distance: 0, // Will be updated after route calculation
          estimated_duration: "0h",
          crew_size: request.crew?.size || 2,
          vessel_type: request.vessel?.type || "sailboat",
        }),
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error("Safety brief timeout")),
            agentTimeout,
          ),
        ),
      ]).catch((error) => {
        logger.error({ error }, "Safety brief generation error");
        return null;
      });

      // Fetch real-time buoy wave data along route
      const buoyDataPromise = Promise.race([
        this.agents["weather"].callTool("get_buoy_wave_data", {
          waypoints: routeWaypoints,
          radius_nm: 50,
        }),
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error("Buoy data fetch timeout")),
            agentTimeout,
          ),
        ),
      ]).catch((error) => {
        logger.warn(
          { error },
          "Buoy data fetch failed - using forecast-only wave estimates",
        );
        return null;
      });

      // Gridded wind field for weather routing
      const windFieldPromise = Promise.race([
        this.agents["weather"].callTool("get_route_wind_field", {
          waypoints: routeWaypoints,
          forecastHours: [0, 6, 12, 18, 24, 36, 48, 72, 96, 120],
        }),
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error("Wind field fetch timeout")),
            agentTimeout,
          ),
        ),
      ]).catch((error) => {
        logger.warn(
          { error },
          "Wind field fetch failed - weather routing unavailable",
        );
        return null;
      });

      // Port information for departure and arrival
      const departurePortPromise = Promise.race([
        this.portAgent.handleToolCall("search_ports", {
          latitude: request.departure.latitude,
          longitude: request.departure.longitude,
          radius: 25,
          draft: request.vessel?.draft,
        }),
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error("Port search timeout")),
            agentTimeout,
          ),
        ),
      ]).catch((error) => {
        logger.warn({ error }, "Departure port search failed");
        return null;
      });

      const arrivalPortPromise = Promise.race([
        this.portAgent.handleToolCall("search_ports", {
          latitude: request.destination.latitude,
          longitude: request.destination.longitude,
          radius: 25,
          draft: request.vessel?.draft,
        }),
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error("Port search timeout")),
            agentTimeout,
          ),
        ),
      ]).catch((error) => {
        logger.warn({ error }, "Arrival port search failed");
        return null;
      });

      // Emergency harbors at 25%, 50%, and 75% along the route (SAFETY CRITICAL)
      // Search at multiple points so mariners have refuge options throughout the passage
      const depLat = request.departure.latitude;
      const depLon = request.departure.longitude;
      const destLat = request.destination.latitude;
      const destLon = request.destination.longitude;
      const quarterPoints = [0.25, 0.5, 0.75].map((f) => ({
        latitude: depLat + (destLat - depLat) * f,
        longitude: depLon + (destLon - depLon) * f,
      }));

      const emergencyHarborsPromise = Promise.race([
        Promise.all(
          quarterPoints.map((pt) =>
            this.portAgent
              .handleToolCall("find_emergency_harbors", {
                latitude: pt.latitude,
                longitude: pt.longitude,
                maxDistance: 100,
                draft: request.vessel?.draft,
              })
              .catch(() => null),
          ),
        ).then((results) => {
          // Merge and deduplicate harbors from all three search points
          const seen = new Set<string>();
          const harbors: any[] = [];
          for (const result of results) {
            if (!result) continue;
            const content =
              result?.content?.find((c: any) => c.type === "data")?.data
                ?.harbors || [];
            for (const h of content) {
              const key = h.id || h.name;
              if (key && !seen.has(key)) {
                seen.add(key);
                harbors.push(h);
              }
            }
          }
          // Return in same MCP content format as a single call
          return { content: [{ type: "data", data: { harbors } }] };
        }),
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error("Emergency harbor search timeout")),
            agentTimeout,
          ),
        ),
      ]).catch((error) => {
        logger.warn({ error }, "Emergency harbor search failed");
        return null;
      });

      // EXECUTE ALL IN PARALLEL - THIS IS THE KEY!
      // Including CRITICAL safety checks in parallel execution
      const parallelStart = Date.now();
      const [
        route,
        weatherDeparture,
        weatherArrival,
        tidalDeparture,
        tidalArrival,
        safetyRoute,
        safetyBrief,
        buoyData,
        windFieldResult,
        departurePort,
        arrivalPort,
        emergencyHarbors,
      ] = await Promise.all([
        routePromise,
        weatherDeparturePromise,
        weatherArrivalPromise,
        tidalDeparturePromise,
        tidalArrivalPromise,
        safetyRoutePromise,
        safetyBriefPromise,
        buoyDataPromise,
        windFieldPromise,
        departurePortPromise,
        arrivalPortPromise,
        emergencyHarborsPromise,
      ]);

      const parallelTime = Date.now() - parallelStart;
      logger.info(
        { parallelTime, planningId },
        "All agents completed in parallel execution (including safety)",
      );

      // Two-pass safety: if route agent produced intermediate waypoints, re-run safety
      // with the full waypoint list (initial safety check only had departure + destination)
      let finalSafetyRoute = safetyRoute;
      const routeWaypointsFull: any[] = (route as any)?.waypoints;
      if (Array.isArray(routeWaypointsFull) && routeWaypointsFull.length > 2) {
        logger.info(
          { waypointCount: routeWaypointsFull.length, planningId },
          "Running two-pass safety check with full route waypoints",
        );
        try {
          const fullSafetyResult = await Promise.race([
            this.agents["safety"].callTool("check_route_safety", {
              route: routeWaypointsFull,
              departure_time:
                request.departure.time || new Date().toISOString(),
              vessel_draft: request.vessel?.draft || 6,
            }),
            new Promise((_, reject) =>
              setTimeout(
                () => reject(new Error("Full-route safety check timeout")),
                agentTimeout,
              ),
            ),
          ]);
          finalSafetyRoute = fullSafetyResult;
          logger.info(
            { planningId },
            "Two-pass safety check complete — using full-route result",
          );
        } catch (error) {
          logger.warn(
            { error, planningId },
            "Full-route safety check failed — using initial result",
          );
        }
      }

      // Extract safety warnings from safety route check
      const safetyWarnings = this.extractSafetyWarnings(finalSafetyRoute);

      // Step 2: Validate weather data freshness (SAFETY CRITICAL - reject stale data)
      const freshnessWarnings: string[] = [];
      freshnessWarnings.push(
        ...this.validateWeatherFreshness(
          weatherDeparture,
          request.departure.name || "departure",
        ),
      );
      freshnessWarnings.push(
        ...this.validateWeatherFreshness(
          weatherArrival,
          request.destination.name || "arrival",
        ),
      );

      // Step 3: Extract tidal freshness warnings from agent responses
      const tidalWarnings = this.extractTidalWarnings(
        tidalDeparture,
        tidalArrival,
      );

      // Step 3b: Multi-source weather aggregation for consensus and confidence
      // SAFETY: CLAUDE.md requires "always present worst-case scenario when forecasts disagree"
      const weatherAggregation = this.aggregateWeatherSources(
        weatherDeparture,
        weatherArrival,
        request,
      );

      // Step 4: Detect if safety system failed and build appropriate disclaimer
      const safetySystemFailed = !!(finalSafetyRoute as any)?.safetyCheckFailed;
      const safetyDisclaimer = safetySystemFailed
        ? "WARNING: Automated safety checks failed. Manual verification is REQUIRED before departure. Skipper retains ultimate responsibility for vessel safety."
        : "This safety analysis is advisory only. Skipper retains ultimate responsibility for vessel safety.";

      // Step 5: Generate weather warnings using worst-case values
      const weatherWarnings = this.generateWarnings([
        weatherDeparture,
        weatherArrival,
      ]);

      // Step 6: Adjust route ETA for tidal currents (SAFETY CRITICAL)
      const vesselSpeed = request.vessel?.cruiseSpeed || 5;
      const currentAdjustment = this.adjustRouteForCurrents(
        route,
        tidalDeparture,
        tidalArrival,
        vesselSpeed,
      );

      // Step 7: Extract buoy wave warnings if available
      const buoyWarnings: string[] = [];
      if (buoyData?.content) {
        const buoyContent = buoyData.content.find(
          (c: any) => c.type === "data",
        );
        if (buoyContent?.data) {
          const { overallHazard, coverage, worstConditions } = buoyContent.data;
          if (overallHazard === "dangerous") {
            buoyWarnings.push(
              `DANGEROUS WAVE CONDITIONS: NDBC buoys report ${worstConditions?.significantWaveHeight?.toFixed(1) || ">3.0"}m waves along route`,
            );
          } else if (overallHazard === "elevated") {
            buoyWarnings.push(
              `Elevated wave conditions: NDBC buoys report ${worstConditions?.significantWaveHeight?.toFixed(1) || ">1.8"}m waves along route`,
            );
          }
          if (coverage === "none") {
            buoyWarnings.push(
              "No real-time buoy data available along route - wave estimates are forecast-based only",
            );
          }
        }
      }

      // Step 8: Weather routing (isochrone algorithm) if wind field data available
      let weatherRoute: WeatherRoute | null = null;
      let usedPolarMeta: { name: string; source: string } | null = null;
      try {
        const windFieldData = windFieldResult?.content?.find(
          (c: any) => c.type === "data",
        )?.data;
        if (windFieldData && windFieldData.source !== "unavailable") {
          // V1 — when `usePolars` is set on the request AND the user supplied
          // a vessel_id whose active polar is loadable, pass that polar to
          // the isochrone engine. Otherwise the engine falls back to its
          // default cruising polar (existing behavior). The user-id is
          // attached upstream to the request as `userId`.
          let userPolar: VesselPolarMap | undefined;
          if (request.usePolars && request.vesselId && request.userId) {
            const loaded = await this.loadActivePolar(
              request.userId,
              request.vesselId,
            );
            if (loaded) {
              userPolar = loaded.polar;
              usedPolarMeta = { name: loaded.name, source: loaded.source };
            }
          }
          weatherRoute = this.weatherRouting.calculateOptimalRoute(
            {
              latitude: request.departure.latitude,
              longitude: request.departure.longitude,
            },
            {
              latitude: request.destination.latitude,
              longitude: request.destination.longitude,
            },
            new Date(request.departure.time || Date.now()),
            windFieldData,
            vesselSpeed,
            userPolar,
          );
          if (weatherRoute && usedPolarMeta) {
            (weatherRoute as any).usedPolar = usedPolarMeta;
          }
          logger.info(
            {
              planningId,
              directDistance: weatherRoute.comparison.directRouteDistance,
              routeDistance: weatherRoute.totalDistance,
              timeSaved: weatherRoute.comparison.timeSaved,
              usedPolar: usedPolarMeta,
            },
            "Weather routing calculated",
          );
        }
      } catch (error) {
        logger.warn(
          { error },
          "Weather routing calculation failed - using direct route",
        );
      }

      // Generate watch schedule
      const crewSize = request.crew?.size || request.vessel?.crewSize || 2;
      const departureTimeForWatch = new Date(
        request.departure.time || Date.now(),
      );

      // SAFETY CRITICAL: Enforce 30% fuel/water reserves (CLAUDE.md non-negotiable)
      const reserveWarnings: string[] = [];
      const vessel = request.vessel;
      if (vessel) {
        const routeDistanceNm: number = (route as any)?.totalDistance || 0;
        const durationHours: number = (route as any)?.estimatedDuration || 0;

        if (
          vessel.fuelCapacity &&
          vessel.fuelRatePerHour &&
          durationHours > 0
        ) {
          const estimatedFuelUse = vessel.fuelRatePerHour * durationHours;
          const requiredFuel = estimatedFuelUse * FUEL_WATER_RESERVE_FACTOR;
          if (vessel.fuelCapacity < requiredFuel) {
            reserveWarnings.push(
              `🔴 CRITICAL: Insufficient fuel for this passage with required 30% reserve. ` +
                `Estimated use: ${estimatedFuelUse.toFixed(0)}L, Required with reserve: ${requiredFuel.toFixed(0)}L, ` +
                `Vessel capacity: ${vessel.fuelCapacity}L. DO NOT depart without additional fuel.`,
            );
          }
        }

        if (
          vessel.waterCapacity &&
          vessel.waterRatePerDay &&
          durationHours > 0
        ) {
          const estimatedWaterUse =
            vessel.waterRatePerDay * (durationHours / 24);
          const requiredWater = estimatedWaterUse * FUEL_WATER_RESERVE_FACTOR;
          if (vessel.waterCapacity < requiredWater) {
            reserveWarnings.push(
              `🔴 CRITICAL: Insufficient water for this passage with required 30% reserve. ` +
                `Estimated use: ${estimatedWaterUse.toFixed(0)}L, Required with reserve: ${requiredWater.toFixed(0)}L, ` +
                `Vessel capacity: ${vessel.waterCapacity}L. DO NOT depart without additional water.`,
            );
          }
        }
      }

      // Apply 20% weather delay buffer to ALL routes (CLAUDE.md non-negotiable margin)
      // Weather routing (isochrone) already accounts for conditions internally.
      // For direct route we explicitly apply the buffer here.
      const usingWeatherRoute = !!weatherRoute;
      const tidalAdjustedDuration = currentAdjustment.adjustedDuration;
      const bufferedDuration = usingWeatherRoute
        ? tidalAdjustedDuration // weather routing service handles buffer internally
        : Math.ceil(tidalAdjustedDuration * WEATHER_DELAY_FACTOR * 10) / 10;

      const watchSchedule = this.generateWatchSchedule(
        crewSize,
        bufferedDuration,
        departureTimeForWatch,
      );

      // SAFETY/HONESTY: Helmwise's data sources (NOAA, hardcoded port DB, US-only
      // restricted areas) are accurate only inside specific bounding boxes. If the
      // departure, destination, or any waypoint is outside coverage, mariners must
      // see an explicit disclaimer rather than an over-confident green plan.
      const coveragePoints = [
        {
          lat: request.departure.latitude,
          lon: request.departure.longitude,
          label: request.departure.name || "departure",
        },
        {
          lat: request.destination.latitude,
          lon: request.destination.longitude,
          label: request.destination.name || "destination",
        },
        ...((route as any)?.waypoints || [])
          .map((wp: any) => ({
            lat: wp.latitude ?? wp.lat,
            lon: wp.longitude ?? wp.lon,
            label: wp.name || "waypoint",
          }))
          .filter((p: any) => Number.isFinite(p.lat) && Number.isFinite(p.lon)),
      ];
      const outOfCoveragePoint = findOutOfCoverage(coveragePoints);
      const isCoverageLimited = outOfCoveragePoint !== null;
      const departureRegion = getCoverageRegion(
        request.departure.latitude,
        request.departure.longitude,
      );
      const destinationRegion = getCoverageRegion(
        request.destination.latitude,
        request.destination.longitude,
      );

      // Determine plan status based on safety findings
      // Precedence (highest first):
      //   SAFETY_UNVERIFIED  — safety agent failed to run (cannot trust the plan)
      //   SAFETY_WARNING     — critical/severe hazards detected
      //   COVERAGE_LIMITED   — request falls outside Helmwise's validated data region
      //   OK                 — no critical issues found
      // Coverage ranks below safety findings because a route with an active hazard
      // is more urgent than one merely outside our preferred data region.
      const hasCriticalHazards =
        (finalSafetyRoute as any)?.hazards?.some(
          (h: any) => h.severity === "critical" || h.severity === "severe",
        ) ||
        (finalSafetyRoute as any)?.warnings?.some(
          (w: any) => w.severity === "critical",
        );
      const planStatus: PlanStatus = safetySystemFailed
        ? PLAN_STATUS.SAFETY_UNVERIFIED
        : hasCriticalHazards
          ? PLAN_STATUS.SAFETY_WARNING
          : isCoverageLimited
            ? PLAN_STATUS.COVERAGE_LIMITED
            : PLAN_STATUS.OK;

      const coverageDisclaimer = isCoverageLimited
        ? {
            outOfCoveragePoint,
            departureRegion: departureRegion?.name || null,
            destinationRegion: destinationRegion?.name || null,
            gaps: [...COVERAGE_GAPS],
            message:
              "This passage extends outside Helmwise's validated coverage region. " +
              "Tidal accuracy, hazard detection, and routing fidelity are degraded. " +
              "Treat this plan as advisory and verify with official sources before departure.",
          }
        : null;

      // Compile comprehensive passage plan
      const passagePlan = {
        id: planningId,
        timestamp: new Date().toISOString(),
        status: planStatus,
        request,
        route,
        weather: {
          departure: weatherDeparture,
          arrival: weatherArrival,
          aggregation: weatherAggregation.summary,
          confidence: weatherAggregation.overallConfidence,
          discrepancies: weatherAggregation.discrepancies,
        },
        tides: {
          departure: tidalDeparture,
          arrival: tidalArrival,
          currentEffect: currentAdjustment.currentEffect,
          adjustedDuration: currentAdjustment.adjustedDuration,
        },
        // Real-time buoy observations (when available)
        buoyData:
          buoyData?.content?.find((c: any) => c.type === "data")?.data || null,
        // Watch schedule for crew management
        watchSchedule,
        // Weather-optimized route (isochrone algorithm)
        weatherRoute: weatherRoute
          ? {
              waypoints: weatherRoute.waypoints,
              totalDistance: weatherRoute.totalDistance,
              estimatedDuration: weatherRoute.estimatedDuration,
              adjustedDuration: weatherRoute.adjustedDuration,
              averageSpeed: weatherRoute.averageSpeed,
              comparison: weatherRoute.comparison,
              safetyWarnings: weatherRoute.safetyWarnings,
            }
          : null,
        // Port information for departure/arrival and emergency options
        ports: {
          departure: this.extractPortData(departurePort),
          arrival: this.extractPortData(arrivalPort),
          emergencyHarbors: this.extractEmergencyHarbors(emergencyHarbors),
        },
        // CRITICAL: Safety data for mariner awareness
        safety: {
          routeAnalysis: finalSafetyRoute,
          brief: safetyBrief,
          warnings: safetyWarnings,
          systemFailure: safetySystemFailed,
          disclaimer: safetyDisclaimer,
        },
        // Honest scoping: surfaced when route exits validated coverage regions
        coverageDisclaimer,
        summary: {
          totalDistance: route.totalDistance,
          estimatedDuration: bufferedDuration,
          baseDuration: route.estimatedDuration,
          durationNote: usingWeatherRoute
            ? "Duration accounts for forecast wind/current conditions"
            : "Duration includes 20% weather delay buffer",
          departureTime: request.departure.time,
          estimatedArrival: new Date(
            new Date(request.departure.time || Date.now()).getTime() +
              bufferedDuration * 60 * 60 * 1000,
          ),
          // Combine ALL warnings: reserve checks first (most critical), then weather/safety
          warnings: [
            ...reserveWarnings, // fuel/water reserve violations (CRITICAL)
            ...(coverageDisclaimer
              ? [`⚠️ COVERAGE LIMITED: ${coverageDisclaimer.message}`]
              : []),
            ...freshnessWarnings,
            ...weatherWarnings,
            ...weatherAggregation.warnings,
            ...tidalWarnings,
            ...currentAdjustment.currentWarnings,
            ...buoyWarnings,
            ...(weatherRoute?.safetyWarnings || []),
            ...safetyWarnings,
          ],
          recommendations: this.generateRecommendations(
            [weatherDeparture, weatherArrival],
            route,
          ),
        },
        performance: {
          totalTime: Date.now() - startTime,
          parallelTime,
          agentsUsed: [
            "weather",
            "tidal",
            "route",
            "safety",
            "ndbc-buoy",
            "port",
          ],
        },
      };

      // R2 — composite risk score. Computed after the plan is assembled so
      // the score has access to every other safety signal. The safety agent
      // never throws here (it returns null on internal failure) so a scoring
      // bug cannot block the plan response from reaching the user.
      try {
        const riskInput = this.buildRiskInput(passagePlan, request);
        const riskScore = (
          this.agents["safety"] as SafetyAgent
        ).computeRiskScore(riskInput);
        if (riskScore) {
          (passagePlan as any).riskScore = riskScore;
        }
      } catch (err) {
        logger.warn({ err }, "Risk score wiring failed; omitting from plan");
      }

      logger.info(
        {
          planningId,
          totalTime: passagePlan.performance.totalTime,
          under3Seconds: passagePlan.performance.totalTime < 3000,
        },
        "Passage plan complete",
      );

      // Step 1: Audit logging - log the final safety decision for incident investigation
      try {
        const routeWaypointsForAudit = (route.waypoints || []).map(
          (wp: any) => ({
            latitude: wp.latitude || wp.lat,
            longitude: wp.longitude || wp.lon,
            name: wp.name,
          }),
        );

        this.auditLogger.logRouteAnalysis(
          planningId,
          undefined,
          routeWaypointsForAudit,
          safetyWarnings.filter((w: string) => w.includes("HAZARD")).length,
          passagePlan.summary.warnings.length,
          safetySystemFailed ? "degraded" : "normal",
          ["weather-agent", "tidal-agent", "route-agent", "safety-agent"],
          safetySystemFailed ? "low" : "high",
        );

        if (isCoverageLimited && outOfCoveragePoint) {
          this.auditLogger.logOutOfCoverage(
            planningId,
            undefined,
            {
              latitude: request.departure.latitude,
              longitude: request.departure.longitude,
              name: request.departure.name,
            },
            {
              latitude: request.destination.latitude,
              longitude: request.destination.longitude,
              name: request.destination.name,
            },
            outOfCoveragePoint,
            departureRegion?.name || null,
            destinationRegion?.name || null,
          );
        }

        // Log data sources for traceability
        this.auditLogger.logDataSource(
          planningId,
          "weather",
          weatherDeparture ? "weather-agent" : "unavailable",
          weatherDeparture ? "medium" : "unknown",
        );
        this.auditLogger.logDataSource(
          planningId,
          "tidal",
          tidalDeparture ? "tidal-agent" : "unavailable",
          tidalDeparture ? "medium" : "unknown",
        );

        // Log each warning shown to user for audit trail
        for (const warning of passagePlan.summary.warnings) {
          const severity =
            warning.includes("CRITICAL") || warning.includes("REJECTED")
              ? "critical"
              : warning.includes("HAZARD")
                ? "urgent"
                : "warning";
          this.auditLogger.logWarningGenerated(
            planningId,
            undefined,
            "passage_plan",
            severity,
            undefined,
            warning,
          );
        }
      } catch (auditError) {
        // Audit logging must never break passage planning
        logger.error(
          { auditError, planningId },
          "Audit logging failed - non-blocking",
        );
      }

      // Broadcast completion
      this.broadcastUpdate({
        type: "planning_completed",
        planningId,
        plan: passagePlan,
      });

      return passagePlan;
    } catch (error: any) {
      logger.error({ error, planningId }, "Planning error");
      this.broadcastUpdate({
        type: "planning_error",
        planningId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Validate weather data freshness per CLAUDE.md requirements:
   * - Reject stale data (weather >1hr)
   * - Warn on approaching staleness
   * SAFETY CRITICAL: Stale weather data is life-threatening for mariners
   *
   * Agent response is MCP format: { content: [{ type: 'data', data: forecast }] }
   * We extract issuedAt from the inner forecast object.
   */
  private validateWeatherFreshness(
    weatherData: any,
    location: string,
  ): string[] {
    const warnings: string[] = [];

    if (!weatherData) {
      warnings.push(
        `⚠️ WEATHER UNAVAILABLE for ${location} - verify weather independently before departure`,
      );
      return warnings;
    }

    // Extract forecast from MCP content format: { content: [{ type: 'data', data: forecast }] }
    let forecast: any = weatherData;
    if (weatherData?.content && Array.isArray(weatherData.content)) {
      const dataContent = weatherData.content.find(
        (c: any) => c.type === "data",
      );
      if (dataContent?.data) forecast = dataContent.data;
    }

    // Check issuedAt from the forecast object
    const issuedAt = forecast?.issuedAt
      ? new Date(forecast.issuedAt)
      : forecast?.metadata?.issuedAt
        ? new Date(forecast.metadata.issuedAt)
        : null;

    if (issuedAt && !isNaN(issuedAt.getTime())) {
      const ageMs = Date.now() - issuedAt.getTime();
      const ageMinutes = ageMs / (60 * 1000);
      const rejectAgeMinutes = WEATHER_REJECT_AGE_MS / (60 * 1000); // 60 min
      const warnAgeMinutes = WEATHER_WARN_AGE_MS / (60 * 1000); // 30 min

      if (ageMs > WEATHER_REJECT_AGE_MS) {
        // CLAUDE.md: "Reject stale data (weather >1hr)"
        warnings.push(
          `🔴 CRITICAL: Weather data for ${location} is ${Math.round(ageMinutes)} minutes old - DATA REJECTED as stale. Verify weather independently before departure.`,
        );
      } else if (ageMs > WEATHER_WARN_AGE_MS) {
        warnings.push(
          `⚠️ Weather data for ${location} is ${Math.round(ageMinutes)} minutes old and approaching staleness. Consider refreshing before departure.`,
        );
      }
    } else {
      // No issuedAt timestamp — cannot verify freshness
      warnings.push(
        `⚠️ Weather freshness for ${location} could not be verified - data age unknown. Verify independently before departure.`,
      );
    }

    // Check for confidence level
    const confidence =
      forecast?.confidence || weatherData?.metadata?.confidence;
    if (confidence === "low") {
      warnings.push(
        `⚠️ Weather data for ${location} has LOW confidence - verify weather independently before departure`,
      );
    } else if (confidence === "medium") {
      warnings.push(
        `⚠️ Weather data for ${location} has moderate confidence - consider verifying independently`,
      );
    }

    return warnings;
  }

  /**
   * Extract tidal freshness warnings from tidal agent responses
   */
  private extractTidalWarnings(
    tidalDeparture: any,
    tidalArrival: any,
  ): string[] {
    const warnings: string[] = [];

    const extractFromResponse = (response: any, location: string) => {
      if (!response) {
        warnings.push(
          `⚠️ TIDAL DATA UNAVAILABLE for ${location} - verify tidal conditions from official sources`,
        );
        return;
      }

      // Check content array for warnings from the tidal agent
      if (response.content && Array.isArray(response.content)) {
        for (const item of response.content) {
          if (item.type === "data" && item.data?.freshnessWarnings) {
            warnings.push(...item.data.freshnessWarnings);
          }
        }
      }

      // Check for direct freshnessWarnings property
      if (
        response.freshnessWarnings &&
        Array.isArray(response.freshnessWarnings)
      ) {
        warnings.push(...response.freshnessWarnings);
      }
    };

    extractFromResponse(tidalDeparture, "departure");
    extractFromResponse(tidalArrival, "arrival");

    return warnings;
  }

  /**
   * Aggregate weather data from multiple sources using WeatherAggregator
   * SAFETY CRITICAL: Identifies forecast disagreements and worst-case scenarios
   * Per CLAUDE.md: "always present worst-case scenario when forecasts disagree"
   */
  private aggregateWeatherSources(
    weatherDeparture: any,
    weatherArrival: any,
    request: any,
  ): {
    summary: any;
    overallConfidence: "high" | "medium" | "low";
    discrepancies: string[];
    warnings: string[];
  } {
    const warnings: string[] = [];
    const allDiscrepancies: string[] = [];

    try {
      // Extract NOAA forecast periods from agent responses
      const extractPeriods = (weatherData: any): any[] | null => {
        if (!weatherData) return null;
        if (weatherData.content && Array.isArray(weatherData.content)) {
          const dataContent = weatherData.content.find(
            (c: any) => c.type === "data",
          );
          if (dataContent?.data?.periods) return dataContent.data.periods;
          if (dataContent?.data) return [dataContent.data];
        }
        if (weatherData.periods) return weatherData.periods;
        return null;
      };

      const departurePeriods = extractPeriods(weatherDeparture);
      const arrivalPeriods = extractPeriods(weatherArrival);

      // Run aggregation for departure location
      const departureAgg = departurePeriods
        ? this.weatherAggregator.aggregateForecasts(
            departurePeriods,
            null, // UKMO data not yet available - infrastructure ready for future integration
            {
              latitude: request.departure.latitude,
              longitude: request.departure.longitude,
            },
          )
        : [];

      // Run aggregation for arrival location
      const arrivalAgg = arrivalPeriods
        ? this.weatherAggregator.aggregateForecasts(arrivalPeriods, null, {
            latitude: request.destination.latitude,
            longitude: request.destination.longitude,
          })
        : [];

      // Determine overall confidence from all aggregated periods
      const allForecasts = [...departureAgg, ...arrivalAgg];
      let overallConfidence: "high" | "medium" | "low" = "medium";

      if (allForecasts.length > 0) {
        const lowCount = allForecasts.filter(
          (f) => f.confidence === "low",
        ).length;
        const highCount = allForecasts.filter(
          (f) => f.confidence === "high",
        ).length;

        if (lowCount > allForecasts.length * 0.3) {
          overallConfidence = "low";
        } else if (highCount > allForecasts.length * 0.7) {
          overallConfidence = "high";
        }
      } else {
        overallConfidence = "low";
      }

      // Collect discrepancies from all periods
      for (const forecast of allForecasts) {
        if (forecast.discrepancies) {
          allDiscrepancies.push(...forecast.discrepancies);
        }
      }

      // Generate warnings based on aggregation results
      if (overallConfidence === "low") {
        warnings.push(
          "⚠️ Weather forecast confidence is LOW - verify weather independently before departure",
        );
      }

      if (allDiscrepancies.length > 0) {
        // CLAUDE.md: "always present worst-case scenario when forecasts disagree"
        const uniqueDiscrepancies = [...new Set(allDiscrepancies)];
        warnings.push(
          `⚠️ Weather source disagreement detected: ${uniqueDiscrepancies.slice(0, 3).join("; ")}. Plan for worst-case conditions.`,
        );
      }

      // Extract worst-case wind/wave from aggregated data for safety
      const maxAggWind = Math.max(
        ...allForecasts.map((f) => f.windSpeed?.max || 0),
        0,
      );
      const maxAggWave = Math.max(
        ...allForecasts.map((f) => f.waveHeight?.max || 0),
        0,
      );

      if (maxAggWind > 0 && maxAggWave > 0) {
        // Only add worst-case summary if we have meaningful data
        const worstCaseSummary = {
          maxWindSpeed: maxAggWind,
          maxWaveHeight: maxAggWave,
          maxWindGust: Math.max(
            ...allForecasts.map((f) => f.windGust?.max || 0),
            0,
          ),
        };

        return {
          summary: {
            departure: {
              periods: departureAgg.length,
              sources: departureAgg[0]?.sources || ["noaa"],
            },
            arrival: {
              periods: arrivalAgg.length,
              sources: arrivalAgg[0]?.sources || ["noaa"],
            },
            worstCase: worstCaseSummary,
            sourcesAvailable: ["noaa"],
            sourcesUnavailable: ["ukmo", "openweather"],
          },
          overallConfidence,
          discrepancies: [...new Set(allDiscrepancies)],
          warnings,
        };
      }

      return {
        summary: {
          departure: { periods: departureAgg.length, sources: ["noaa"] },
          arrival: { periods: arrivalAgg.length, sources: ["noaa"] },
          worstCase: null,
          sourcesAvailable: ["noaa"],
          sourcesUnavailable: ["ukmo", "openweather"],
        },
        overallConfidence,
        discrepancies: [...new Set(allDiscrepancies)],
        warnings,
      };
    } catch (error) {
      logger.warn(
        { error },
        "Weather aggregation failed - using raw forecasts",
      );
      return {
        summary: { error: "Aggregation unavailable" },
        overallConfidence: "low",
        discrepancies: [],
        warnings: [
          "⚠️ Multi-source weather comparison unavailable - using single source only",
        ],
      };
    }
  }

  private generateWarnings(weather: any[]): string[] {
    const warnings: string[] = [];

    if (weather && weather.length > 0) {
      const validWeather = weather.filter((w) => w);
      if (validWeather.length === 0) {
        warnings.push(
          "⚠️ No weather data available - verify weather independently before departure",
        );
        return warnings;
      }

      try {
        // SAFETY: Use Math.max (worst-case) for all safety-critical metrics
        const maxWindSpeed = Math.max(
          ...validWeather.flatMap((w: any) => {
            if (Array.isArray(w))
              return w.map((f: any) => f.windSpeed || f.windGust || 0);
            return [w.windSpeed || w.windGust || 0];
          }),
        );

        if (maxWindSpeed > 33) {
          warnings.push(
            "🔴 GALE WARNING: Wind speeds exceeding 33 knots forecast - delay departure strongly recommended",
          );
        } else if (maxWindSpeed > 25) {
          warnings.push(
            "⚠️ Strong winds expected (>25kt) - consider delaying departure",
          );
        } else if (maxWindSpeed > 20) {
          warnings.push(
            "⚠️ Moderate to strong winds expected (>20kt) - ensure vessel and crew are prepared",
          );
        }

        const maxWaveHeight = Math.max(
          ...validWeather.flatMap((w: any) => {
            if (Array.isArray(w))
              return w.map(
                (f: any) => f.waveHeight || f.significantWaveHeight || 0,
              );
            return [w.waveHeight || w.significantWaveHeight || 0];
          }),
        );

        if (maxWaveHeight > 4) {
          warnings.push(
            "🔴 ROUGH SEAS WARNING: Wave heights exceeding 4m forecast - delay departure strongly recommended",
          );
        } else if (maxWaveHeight > 3) {
          warnings.push(
            "⚠️ Rough seas anticipated (>3m waves) - ensure crew is prepared",
          );
        }

        // Step 5: Single-source confidence warning
        if (validWeather.length === 1) {
          warnings.push(
            "⚠️ Weather forecast from single source only - no consensus verification possible. Verify weather independently before departure.",
          );
        }
      } catch (error) {
        logger.error({ error }, "Error generating warnings");
        warnings.push(
          "⚠️ Error processing weather data - verify weather independently before departure",
        );
      }
    }

    return warnings;
  }

  private generateRecommendations(weather: any[], route: any): string[] {
    const recommendations: string[] = [];

    if (route.totalDistance > 200) {
      recommendations.push(
        "Long passage - ensure adequate provisions and fuel",
      );
    }

    if (route.estimatedDuration > 24) {
      recommendations.push(
        "Multi-day passage - plan watch schedule and rest periods",
      );
    }

    recommendations.push(
      "File a float plan with a trusted contact before departure",
    );
    recommendations.push(
      "Check all safety equipment is accessible and functional",
    );

    return recommendations;
  }

  /**
   * Generate a watch schedule based on crew size and passage duration
   * Standard watch rotations for safe offshore passages
   */
  private generateWatchSchedule(
    crewSize: number,
    durationHours: number,
    departureTime: Date,
  ): { schedule: any[]; system: string; recommendations: string[] } {
    const recommendations: string[] = [];

    if (crewSize < 2) {
      return {
        schedule: [],
        system: "single-handed",
        recommendations: [
          "Single-handed passage - no formal watch schedule possible",
          "Use timer alarms every 20 minutes to check surroundings",
          "Set AIS alarm for approaching vessels",
          "Consider limiting passage length to daylight hours",
        ],
      };
    }

    // Determine watch system based on crew size
    let watchHours: number;
    let system: string;

    if (crewSize === 2) {
      watchHours = 4; // 4 on / 4 off
      system = "4 on / 4 off (Swedish watch)";
      recommendations.push(
        "With 2 crew, each person gets 4 hours on watch and 4 hours off",
      );
      recommendations.push(
        "Consider adjusting to 3 on / 3 off for shorter passages to stay alert",
      );
    } else if (crewSize === 3) {
      watchHours = 4; // 4 on / 8 off
      system = "4 on / 8 off (3-person rotation)";
      recommendations.push(
        "3-person rotation allows 8 hours rest between watches",
      );
    } else {
      watchHours = 4; // Standard 4-hour watches
      system = `4-hour watches (${crewSize}-person rotation)`;
      recommendations.push(
        `${crewSize}-person rotation with ${((24 / crewSize) * (crewSize - 1)).toFixed(0)} hours rest between watches`,
      );
    }

    // Generate schedule entries
    const schedule = [];
    let currentTime = new Date(departureTime);
    let watchNumber = 0;
    const crewNames = Array.from(
      { length: crewSize },
      (_, i) => `Crew ${i + 1}`,
    );

    const totalWatches = Math.ceil(durationHours / watchHours);

    for (let i = 0; i < totalWatches; i++) {
      const watchStart = new Date(currentTime);
      const watchEnd = new Date(currentTime.getTime() + watchHours * 3600000);

      // Don't extend past arrival
      const arrivalTime = new Date(
        departureTime.getTime() + durationHours * 3600000,
      );
      const effectiveEnd = watchEnd > arrivalTime ? arrivalTime : watchEnd;

      schedule.push({
        watch: i + 1,
        crew: crewNames[watchNumber % crewSize],
        start: watchStart.toISOString(),
        end: effectiveEnd.toISOString(),
        startFormatted: watchStart.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
        endFormatted: effectiveEnd.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
        isNight: watchStart.getHours() >= 20 || watchStart.getHours() < 6,
      });

      currentTime = watchEnd;
      watchNumber++;

      if (currentTime >= arrivalTime) break;
    }

    if (durationHours > 12) {
      recommendations.push("Prepare meals and hot drinks before watch changes");
    }
    if (durationHours > 24) {
      recommendations.push(
        "Ensure each crew member gets at least 6 hours of uninterrupted sleep per 24 hours",
      );
    }

    return { schedule, system, recommendations };
  }

  /**
   * Calculate current-adjusted ETA based on tidal current predictions
   * SAFETY CRITICAL: Tidal currents can significantly affect passage timing
   * A 2-knot adverse current reduces a 5-knot vessel to 3-knot ground speed
   */
  private adjustRouteForCurrents(
    route: any,
    tidalDeparture: any,
    tidalArrival: any,
    vesselSpeed: number,
  ): {
    adjustedDuration: number;
    currentEffect: string;
    currentWarnings: string[];
  } {
    const warnings: string[] = [];
    let adjustedDuration = route.estimatedDuration;

    try {
      // Extract current predictions from tidal data
      const extractCurrents = (
        tidalData: any,
      ): Array<{ velocity: number; direction: number; type?: string }> => {
        if (!tidalData) return [];
        // Check MCP content format
        if (tidalData.content && Array.isArray(tidalData.content)) {
          const dataContent = tidalData.content.find(
            (c: any) => c.type === "data",
          );
          if (dataContent?.data?.currents) return dataContent.data.currents;
        }
        if (tidalData.currents) return tidalData.currents;
        return [];
      };

      const departureCurr = extractCurrents(tidalDeparture);
      const arrivalCurr = extractCurrents(tidalArrival);

      if (departureCurr.length === 0 && arrivalCurr.length === 0) {
        return {
          adjustedDuration,
          currentEffect:
            "No tidal current data available - ETA based on vessel speed only",
          currentWarnings: [],
        };
      }

      // Calculate worst-case current effect using max velocities
      const allCurrents = [...departureCurr, ...arrivalCurr];
      const maxCurrentVelocity = Math.max(
        ...allCurrents.map((c) => Math.abs(c.velocity || 0)),
        0,
      );

      if (maxCurrentVelocity > 0.5) {
        // Conservative: assume worst-case (adverse current) for safety
        // Effective speed = vessel speed - current velocity (worst case: head-on)
        const worstCaseSpeed = Math.max(vesselSpeed - maxCurrentVelocity, 1); // Never below 1 knot
        const currentAdjustedDuration = route.totalDistance / worstCaseSpeed;

        // Use the worse of the two durations (safety-first)
        if (currentAdjustedDuration > adjustedDuration) {
          const delayHours = currentAdjustedDuration - adjustedDuration;
          adjustedDuration = currentAdjustedDuration;

          if (maxCurrentVelocity >= 3) {
            warnings.push(
              `🔴 STRONG TIDAL CURRENTS: Up to ${maxCurrentVelocity.toFixed(1)} knots detected. ETA extended by ${delayHours.toFixed(1)} hours (worst case)`,
            );
          } else if (maxCurrentVelocity >= 1.5) {
            warnings.push(
              `⚠️ Moderate tidal currents up to ${maxCurrentVelocity.toFixed(1)} knots. ETA may be extended by ${delayHours.toFixed(1)} hours`,
            );
          }
        }
      }

      // Check for slack water windows
      const slackPeriods = allCurrents.filter((c) => c.type === "slack");
      if (slackPeriods.length > 0 && maxCurrentVelocity > 1.5) {
        warnings.push(
          `Consider timing departure for slack water to minimize current effects (${slackPeriods.length} slack periods found)`,
        );
      }

      return {
        adjustedDuration,
        currentEffect:
          maxCurrentVelocity > 0.5
            ? `Tidal currents up to ${maxCurrentVelocity.toFixed(1)} knots detected. Duration adjusted from ${route.estimatedDuration.toFixed(1)}h to ${adjustedDuration.toFixed(1)}h (worst-case)`
            : "Minimal tidal current effect on passage timing",
        currentWarnings: warnings,
      };
    } catch (error) {
      logger.warn({ error }, "Error calculating current-adjusted ETA");
      return {
        adjustedDuration,
        currentEffect:
          "Unable to calculate current effects - ETA based on vessel speed only",
        currentWarnings: [],
      };
    }
  }

  /**
   * Extract safety warnings from SafetyAgent route analysis
   * Formats warnings for display to the user
   */
  private extractSafetyWarnings(safetyRoute: any): string[] {
    const warnings: string[] = [];

    if (!safetyRoute) {
      warnings.push("⚠️ SAFETY CHECK UNAVAILABLE - Exercise extreme caution");
      return warnings;
    }

    // Extract warnings from content array if present (MCP format)
    let safetyData = safetyRoute;
    if (safetyRoute.content && Array.isArray(safetyRoute.content)) {
      try {
        const textContent = safetyRoute.content.find(
          (c: any) => c.type === "text",
        );
        if (textContent?.text) {
          safetyData = JSON.parse(textContent.text);
        }
      } catch (e) {
        // Use safetyRoute as-is
      }
    }

    // Extract warnings array
    if (safetyData.warnings && Array.isArray(safetyData.warnings)) {
      for (const warning of safetyData.warnings) {
        if (typeof warning === "string") {
          warnings.push(warning);
        } else if (warning.description) {
          const severity = warning.severity === "urgent" ? "🔴" : "⚠️";
          warnings.push(`${severity} ${warning.description}`);
        }
      }
    }

    // Extract hazards
    if (safetyData.hazards && Array.isArray(safetyData.hazards)) {
      for (const hazard of safetyData.hazards) {
        const severity = hazard.severity === "high" ? "🔴" : "⚠️";
        warnings.push(
          `${severity} HAZARD: ${hazard.description || hazard.type}`,
        );
      }
    }

    // Extract recommendations
    if (
      safetyData.recommendations &&
      Array.isArray(safetyData.recommendations)
    ) {
      for (const rec of safetyData.recommendations) {
        if (typeof rec === "string" && !warnings.includes(rec)) {
          warnings.push(`📋 ${rec}`);
        }
      }
    }

    return warnings;
  }

  /**
   * V1 — load the active polar for a user's vessel and convert to the
   * Map-shaped VesselPolar the isochrone engine consumes. Returns null when
   * no active polar exists (caller falls back to the engine's default).
   */
  private async loadActivePolar(
    userId: string,
    vesselId: string,
  ): Promise<{ polar: VesselPolarMap; name: string; source: string } | null> {
    if (!this.postgres) return null;
    try {
      const result = await this.postgres.query(
        `SELECT p.name, p.source, p.polar_data, p.max_wind_kt, p.max_wave_m
           FROM vessel_polars p
           JOIN user_vessels v ON v.id = p.vessel_id
           WHERE p.user_id = $1
             AND p.vessel_id = $2
             AND v.user_id = $1
             AND p.is_active = TRUE
           LIMIT 1`,
        [userId, vesselId],
      );
      const row = result.rows[0];
      if (!row) return null;
      const normalized = row.polar_data as NormalizedPolar;
      if (
        !normalized ||
        !Array.isArray(normalized.tws) ||
        !Array.isArray(normalized.twa) ||
        !Array.isArray(normalized.speeds)
      ) {
        logger.warn(
          { userId, vesselId, polarName: row.name },
          "Stored polar has invalid shape; skipping",
        );
        return null;
      }
      // Sensible defaults — if the polar didn't ship with safety limits,
      // use the conservative defaults the engine would have used anyway.
      const maxWind =
        typeof row.max_wind_kt === "number" ? row.max_wind_kt : 30;
      const maxWave = typeof row.max_wave_m === "number" ? row.max_wave_m : 3;
      const polar = normalizedToVesselPolar(normalized, maxWind, maxWave);
      return {
        polar,
        name: row.name,
        source: row.source,
      };
    } catch (err) {
      logger.warn({ err, userId, vesselId }, "loadActivePolar failed");
      return null;
    }
  }

  /**
   * V3 — auto-seed a `departure` logbook entry on passage save.
   *
   * Best-effort: caller awaits the redis write before responding to the
   * user, but the logbook write is fire-and-forget so a logbook DB issue
   * cannot prevent the passage itself from saving.
   */
  private async autoSeedLogbookDeparture(
    userId: string,
    passageId: string,
    plan: unknown,
  ): Promise<void> {
    if (!this.postgres) return;
    const p = (plan ?? {}) as Record<string, any>;
    const summary = (p.summary ?? {}) as Record<string, any>;
    const request = (p.request ?? {}) as Record<string, any>;
    const departure = (request.departure ?? {}) as Record<string, any>;
    const destination = (request.destination ?? {}) as Record<string, any>;
    const vessel = (request.vessel ?? {}) as Record<string, any>;
    const route = (p.route ?? {}) as Record<string, any>;

    const occurredAt =
      summary.departureTime ?? departure.time ?? new Date().toISOString();

    const lat =
      typeof departure.latitude === "number" ? departure.latitude : null;
    const lon =
      typeof departure.longitude === "number" ? departure.longitude : null;

    const conditions: Record<string, unknown> = {};
    if (vessel.name) conditions.vessel = vessel.name;
    if (destination.name) {
      conditions.destination = destination.name;
    }
    if (summary.estimatedArrival) conditions.eta = summary.estimatedArrival;
    if (typeof route.totalDistance === "number") {
      conditions.distance_nm = route.totalDistance;
    }

    await this.postgres.query(
      `INSERT INTO logbook_entries
         (user_id, passage_id, entry_type, occurred_at,
          position_lat, position_lon, conditions, notes)
       VALUES ($1, $2, 'departure', $3, $4, $5, $6::jsonb, $7)`,
      [
        userId,
        passageId,
        occurredAt,
        lat,
        lon,
        JSON.stringify(conditions),
        departure.name
          ? `Departure from ${departure.name}.`
          : "Departure (passage saved).",
      ],
    );
  }

  /**
   * Choose the "best window" among R3 candidates. Ranking:
   *   1. Status priority: GO > CAUTION > NO-GO. A GO always beats a CAUTION.
   *   2. Within the same status, higher aggregate risk score wins.
   *   3. Tiebreak by earliest ETA so sailors aren't told to wait pointlessly.
   *
   * Returns null when every candidate errored so the UI can show a clear
   * "no comparison possible" state.
   */
  private buildCompareSummary(
    candidates: Array<
      | {
          departureTime: string;
          status: "ok";
          plan: {
            riskScore?: { status: string; score: number };
            summary?: { estimatedArrival?: unknown };
          };
        }
      | { departureTime: string; status: "error"; error: string }
    >,
  ): { bestIndex: number | null; notes: string[] } {
    const notes: string[] = [];
    const ok = candidates
      .map((c, i) => ({ c, i }))
      .filter(
        (
          x,
        ): x is {
          c: Extract<(typeof candidates)[number], { status: "ok" }>;
          i: number;
        } => x.c.status === "ok",
      );
    if (ok.length === 0) {
      notes.push("All candidate plans failed — try again or refine inputs.");
      return { bestIndex: null, notes };
    }
    const statusRank: Record<string, number> = {
      GO: 3,
      CAUTION: 2,
      "NO-GO": 1,
    };
    const scored = ok.map(({ c, i }) => {
      const risk = c.plan.riskScore;
      const eta = c.plan.summary?.estimatedArrival
        ? new Date(c.plan.summary.estimatedArrival as string).getTime()
        : Number.POSITIVE_INFINITY;
      return {
        i,
        rank: risk ? (statusRank[risk.status] ?? 0) : 0,
        score: risk?.score ?? 0,
        eta,
      };
    });
    scored.sort(
      (a, b) => b.rank - a.rank || b.score - a.score || a.eta - b.eta,
    );
    const bestIndex = scored[0].i;
    const best = candidates[bestIndex];
    if (best.status === "ok" && best.plan.riskScore?.status === "NO-GO") {
      notes.push(
        "Every candidate is NO-GO. Reconsider the passage or wait for a better window.",
      );
    } else if (
      best.status === "ok" &&
      best.plan.riskScore?.status === "CAUTION"
    ) {
      notes.push(
        "Best window is CAUTION — proceed only after reviewing the breakdown.",
      );
    }
    return { bestIndex, notes };
  }

  /**
   * Build a RiskInput from an assembled passage plan + the original request.
   * Defensive throughout — the plan shape is loose `any`, so every read is
   * guarded and missing fields downgrade scoring rather than throw.
   *
   * `modelDisagreement` is the R1 → R2 link: when multi-model is on and
   * forecasts diverge, the score widens its safety bounds. Pass undefined
   * (or omit) when multi-model data isn't available.
   */
  private buildRiskInput(
    plan: any,
    request: any,
    modelDisagreement?: {
      windStatus?: "agree" | "mild" | "divergent";
      waveStatus?: "agree" | "mild" | "divergent";
    },
  ): import("../../agents/safety/src/risk-score").RiskInput {
    const vesselReq = (request?.vessel ?? {}) as Record<string, any>;
    const crewReq = (request?.vessel ?? request ?? {}) as Record<string, any>;
    const summary = (plan?.summary ?? {}) as Record<string, any>;
    const weatherDep = (plan?.weather?.departure ?? {}) as Record<string, any>;
    const weatherArr = (plan?.weather?.destination ?? {}) as Record<
      string,
      any
    >;
    const tidalDep = (plan?.tidal?.departure ?? {}) as Record<string, any>;

    // Worst-case across departure + arrival per safety doctrine.
    const maxWind = Math.max(
      numOr(weatherDep.windSpeed, 0),
      numOr(weatherDep.windDescription, 0),
      numOr(weatherArr.windSpeed, 0),
      numOr(weatherArr.windDescription, 0),
    );
    const maxGust = Math.max(
      numOr(weatherDep.windGust, 0),
      numOr(weatherArr.windGust, 0),
      maxWind * 1.3, // estimated if unavailable
    );
    const maxWave = Math.max(
      numOr(weatherDep.waveHeight, 0),
      numOr(weatherArr.waveHeight, 0),
    );
    const minVis = Math.min(
      numOr(weatherDep.visibility, 99),
      numOr(weatherArr.visibility, 99),
    );

    const duration =
      numOr(summary.estimatedDuration, 0) ||
      numOr(summary.baseDuration, 0) ||
      numOr(plan?.route?.estimatedDuration, 0);

    // Hazard detection — peer into the safety route block.
    const hazards = (plan?.safety?.routeAnalysis?.hazards ?? []) as any[];
    const piracyOnRoute = hazards.some(
      (h: any) =>
        /piracy|anti-?shipping/i.test(h.type ?? "") ||
        /piracy/i.test(h.description ?? ""),
    );
    const restrictedCount = hazards.filter((h: any) =>
      /restricted|prohibited/i.test(h.type ?? ""),
    ).length;
    const iceCount = hazards.filter((h: any) =>
      /ice/i.test(h.type ?? ""),
    ).length;
    const navCount = (plan?.safety?.warnings ?? []).length;

    return {
      vessel: {
        name: vesselReq.name,
        lengthOverallFt: numOr(vesselReq.lengthFt ?? vesselReq.length_ft, NaN),
        cruiseSpeedKt: numOr(vesselReq.cruiseSpeed, NaN),
        draftFt: numOr(vesselReq.draft, 5),
        maxWindKt: numOr(vesselReq.maxWindKt ?? vesselReq.max_wind_kt, NaN),
        maxWaveFt: numOr(vesselReq.maxWaveFt ?? vesselReq.max_wave_ft, NaN),
      },
      crew: {
        size: numOr(crewReq.crewSize ?? crewReq.crew_size, NaN),
        experience: (crewReq.crewExperience ?? "intermediate") as
          | "novice"
          | "intermediate"
          | "advanced"
          | "professional",
      },
      passage: {
        distanceNm:
          numOr(summary.totalDistance, NaN) ||
          numOr(plan?.route?.totalDistance, NaN),
        durationHr: duration,
      },
      weather: {
        maxWindKt:
          Number.isFinite(maxWind) && maxWind > 0 ? maxWind : undefined,
        maxGustKt:
          Number.isFinite(maxGust) && maxGust > 0 ? maxGust : undefined,
        maxWaveFt:
          Number.isFinite(maxWave) && maxWave > 0 ? maxWave : undefined,
        minVisibilityNm:
          Number.isFinite(minVis) && minVis < 99 ? minVis : undefined,
        issuedAt: weatherDep.issuedAt,
        available: !!weatherDep.issuedAt || !!weatherArr.issuedAt,
      },
      depth: {
        minClearanceFt: numOr(tidalDep.clearanceFt, NaN) || undefined,
        available: !!tidalDep,
      },
      hazards: {
        activePiracyOnRoute: piracyOnRoute,
        restrictedAreasOnRoute: restrictedCount,
        iceHazardsOnRoute: iceCount,
        navWarningsCount: navCount,
        available: !!plan?.safety,
      },
      reserves: {
        // The fuel/water calculator output (when present) lands at plan.fuelWater
        fuelHoursPlanned: numOr(plan?.fuelWater?.fuelHoursNeeded, NaN),
        fuelHoursAvailable: numOr(plan?.fuelWater?.fuelHoursAvailable, NaN),
        waterDaysPlanned: numOr(plan?.fuelWater?.waterDaysNeeded, NaN),
        waterDaysAvailable: numOr(plan?.fuelWater?.waterDaysAvailable, NaN),
        available: !!plan?.fuelWater,
      },
      modelDisagreement,
    };
  }

  /**
   * Multi-model weather comparison (R1). Fires a single Open-Meteo call with
   * `models=` and reduces the per-model timeseries to a sailor-facing
   * agreement summary. Designed to NEVER throw — a planning request must
   * still succeed even if Open-Meteo is down or the location is poorly
   * covered. Returns null on any failure so callers can omit the section.
   */
  private async maybeFetchModelComparison(
    lat: number,
    lon: number,
    departureTime: Date,
  ): Promise<ModelComparisonSummary | null> {
    try {
      const forecast = await this.multiModelWeather.getMultiModelMarineForecast(
        lat,
        lon,
        5, // 5-day horizon — long enough for any non-trans-ocean passage
      );
      if (forecast.models.length === 0) return null;
      return summariseModelDisagreement(forecast, departureTime);
    } catch (error) {
      logger.warn(
        { error, lat, lon },
        "Multi-model fetch failed; omitting model comparison from plan",
      );
      return null;
    }
  }

  /**
   * Tier helper — returns true if the user is Premium or above. Used by the
   * R1 multi-model gate (soft downgrade: free users get the plan without the
   * comparison rather than a hard 403). Returns false on lookup failure so
   * gated features fail closed.
   */
  private async isPremiumOrAbove(userId: string): Promise<boolean> {
    if (!this.postgres) return false;
    try {
      const result = await this.postgres.query(
        `SELECT subscription_tier FROM profiles WHERE id = $1`,
        [userId],
      );
      const tier = (result.rows[0]?.subscription_tier ?? "free") as string;
      return tier !== "free";
    } catch (error) {
      logger.warn({ error, userId }, "isPremiumOrAbove lookup failed");
      return false;
    }
  }

  /**
   * Build the user-facing share URL for a token. Uses NEXT_PUBLIC_APP_URL
   * when set so the link points to the production domain (helmwise.co)
   * rather than the orchestrator's localhost host.
   */
  private shareUrl(token: string): string {
    const base = (
      process.env.NEXT_PUBLIC_APP_URL ?? "https://helmwise.co"
    ).replace(/\/+$/, "");
    return `${base}/p/${token}`;
  }

  /**
   * Map a Redis-saved passage record + sender + contacts to a FloatPlanInput.
   * The `plan` field is `unknown` at the schema boundary so every read is
   * guarded — missing pieces render as "—" rather than crashing the PDF.
   */
  private buildFloatPlanInput(
    sender: { name: string; email: string; phone: string | null },
    passageRecord: { name?: string; plan: unknown } | null,
    contacts: Array<{
      id: string;
      name: string;
      email: string;
      relationship: string | null;
      phone: string | null;
    }>,
  ): FloatPlanInput {
    const plan = (passageRecord?.plan ?? {}) as Record<string, any>;
    const route = (plan.route ?? {}) as Record<string, any>;
    const summary = (plan.summary ?? {}) as Record<string, any>;
    const ports = (plan.ports ?? {}) as Record<string, any>;
    const vesselSrc = (plan.vessel ?? plan.request?.vessel ?? {}) as Record<
      string,
      any
    >;

    const departureTime =
      summary.departureTime ?? plan.request?.departure?.time ?? undefined;
    const estimatedArrival = summary.estimatedArrival ?? undefined;
    const fmtTime = (t: unknown): string | undefined => {
      if (!t) return undefined;
      try {
        return new Date(t as string).toUTCString();
      } catch {
        return undefined;
      }
    };

    const waypoints: FloatPlanInput["passage"]["waypoints"] = Array.isArray(
      route.waypoints,
    )
      ? route.waypoints.slice(0, 12).map((wp: any) => ({
          name: wp.name ?? wp.label,
          lat: typeof wp.lat === "number" ? wp.lat : wp.latitude,
          lon: typeof wp.lon === "number" ? wp.lon : wp.longitude,
          eta: fmtTime(wp.eta),
        }))
      : undefined;

    const warnings: string[] = Array.isArray(summary.warnings)
      ? summary.warnings.slice(0, 4)
      : [];

    return {
      sender: { name: sender.name, email: sender.email, phone: sender.phone },
      vessel: {
        name: vesselSrc.name ?? "Vessel",
        type: vesselSrc.type,
        length_ft: vesselSrc.length_ft ?? vesselSrc.lengthFt,
        color: vesselSrc.color,
        registration: vesselSrc.registration,
        hailing_port: vesselSrc.hailing_port ?? vesselSrc.hailingPort,
        distinguishing_features:
          vesselSrc.distinguishing_features ?? vesselSrc.distinguishingFeatures,
        mmsi: vesselSrc.mmsi,
        epirb: vesselSrc.epirb,
        inreach_id: vesselSrc.inreach_id ?? vesselSrc.inreachId,
      },
      passage: {
        name: passageRecord?.name,
        departure_port:
          ports.departure?.nearest?.name ??
          plan.request?.departure?.port ??
          plan.request?.departure?.name,
        destination_port:
          ports.arrival?.nearest?.name ??
          plan.request?.destination?.port ??
          plan.request?.destination?.name,
        departure_time: fmtTime(departureTime),
        eta: fmtTime(estimatedArrival),
        distance_nm:
          typeof route.totalDistance === "number"
            ? route.totalDistance
            : typeof summary.totalDistance === "number"
              ? summary.totalDistance
              : undefined,
        waypoints,
        weather_summary: warnings.length > 0 ? warnings.join("\n") : undefined,
      },
      crew: Array.isArray(plan.crew)
        ? plan.crew.map((c: any) => ({
            name: c.name ?? "Crew",
            age: c.age,
            role: c.role,
            medical_notes: c.medical_notes ?? c.medicalNotes,
          }))
        : undefined,
      recipients: contacts.map((c) => ({
        name: c.name,
        email: c.email,
        relationship: c.relationship,
        phone: c.phone,
      })),
      generatedAt: new Date(),
    };
  }

  /**
   * Extract port data from PortAgent search response
   */
  private extractPortData(portResponse: any): any {
    if (!portResponse) return null;
    try {
      if (portResponse.content && Array.isArray(portResponse.content)) {
        const textContent = portResponse.content.find(
          (c: any) => c.type === "text",
        );
        if (textContent?.text) {
          const data = JSON.parse(textContent.text);
          return {
            portsFound: data.resultsFound || 0,
            nearest: data.ports?.[0] || null,
            ports: (data.ports || []).slice(0, 5),
          };
        }
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Extract emergency harbor data from PortAgent response
   * SAFETY CRITICAL: Emergency harbors must be identified for every passage
   */
  private extractEmergencyHarbors(response: any): any[] {
    if (!response) return [];
    try {
      if (response.content && Array.isArray(response.content)) {
        const textContent = response.content.find(
          (c: any) => c.type === "text",
        );
        if (textContent?.text) {
          const data = JSON.parse(textContent.text);
          return (data.recommendations || []).map((h: any) => ({
            name: h.name,
            distance: h.distance,
            vhf: h.vhf,
            protection: h.protection,
            reason: h.reason,
          }));
        }
      }
      return [];
    } catch (error) {
      return [];
    }
  }

  // ── Zod schema for passage planning input validation ──
  private static readonly PassageRequestSchema = z.object({
    departure: z.object({
      latitude: z.number().min(-90).max(90),
      longitude: z.number().min(-180).max(180),
      name: z.string().max(200).optional(),
      time: z.string().max(100).optional(),
    }),
    destination: z.object({
      latitude: z.number().min(-90).max(90),
      longitude: z.number().min(-180).max(180),
      name: z.string().max(200).optional(),
    }),
    vessel: z
      .object({
        cruiseSpeed: z.number().min(0.5).max(50).optional(),
        draft: z.number().min(0).max(100).optional(),
        type: z.string().max(100).optional(),
        crewSize: z.number().int().min(1).max(50).optional(),
        crewExperience: z
          .enum(["novice", "intermediate", "advanced", "professional"])
          .optional(),
        // Fuel/water reserve fields (used for 30% reserve enforcement)
        fuelCapacity: z.number().min(0).optional(), // litres
        fuelRatePerHour: z.number().min(0).optional(), // litres/hour
        waterCapacity: z.number().min(0).optional(), // litres
        waterRatePerDay: z.number().min(0).optional(), // litres/day
      })
      .optional(),
    crew: z
      .object({
        size: z.number().int().min(1).max(50).optional(),
      })
      .optional(),
  });

  /**
   * Validate passage planning request body using Zod schema
   */
  private validatePassageRequest(
    body: unknown,
  ): { success: true; data: any } | { success: false; error: string } {
    const result = SimpleOrchestrator.PassageRequestSchema.safeParse(body);
    if (!result.success) {
      const issues = result.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ");
      return { success: false, error: `Invalid request: ${issues}` };
    }
    return { success: true, data: result.data };
  }

  /**
   * JWT auth middleware - verifies Supabase JWTs
   * Dev bypass: skip auth ONLY when NODE_ENV=development && SKIP_AUTH=true && DEV_AUTH_BYPASS_KEY is set
   */
  private async verifyAuth(
    req: express.Request,
    res: express.Response,
  ): Promise<boolean> {
    // Dev bypass — triple check: must NOT be production, must have SKIP_AUTH, must have bypass key
    const isProduction = process.env.NODE_ENV === "production";
    if (
      !isProduction &&
      process.env.SKIP_AUTH === "true" &&
      process.env.DEV_AUTH_BYPASS_KEY
    ) {
      return true;
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({
        success: false,
        error: "Authentication required. Provide a Bearer token.",
      });
      return false;
    }

    const token = authHeader.slice(7);
    const jwtSecret = process.env.SUPABASE_JWT_SECRET;

    if (!jwtSecret) {
      // In production, missing JWT secret is a fatal misconfiguration
      if (process.env.NODE_ENV === "production") {
        logger.error(
          "SUPABASE_JWT_SECRET not set in production — rejecting all requests",
        );
        res
          .status(500)
          .json({ success: false, error: "Authentication not configured" });
        return false;
      }
      // Allow in development with loud warning only
      logger.warn("SUPABASE_JWT_SECRET not set — skipping auth in development");
      return true;
    }

    try {
      jwt.verify(token, jwtSecret, { algorithms: ["HS256"] });
      return true;
    } catch (err: any) {
      logger.warn({ err: err.message }, "JWT verification failed");
      res
        .status(401)
        .json({ success: false, error: "Invalid or expired token" });
      return false;
    }
  }

  /**
   * Same auth check as verifyAuth() but also extracts the user id from the
   * verified JWT so authorised endpoints can scope reads/writes to the
   * caller's data. Returns null and sends the appropriate HTTP error if
   * auth fails. In dev with SKIP_AUTH, returns a stable synthetic id so
   * local testing works without a real Supabase token.
   */
  private async verifyAuthAndGetUserId(
    req: express.Request,
    res: express.Response,
  ): Promise<string | null> {
    const isProduction = process.env.NODE_ENV === "production";
    if (
      !isProduction &&
      process.env.SKIP_AUTH === "true" &&
      process.env.DEV_AUTH_BYPASS_KEY
    ) {
      return "dev-user";
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({
        success: false,
        error: "Authentication required. Provide a Bearer token.",
      });
      return null;
    }

    const token = authHeader.slice(7);
    const jwtSecret = process.env.SUPABASE_JWT_SECRET;

    if (!jwtSecret) {
      if (isProduction) {
        logger.error(
          "SUPABASE_JWT_SECRET not set in production — rejecting request",
        );
        res
          .status(500)
          .json({ success: false, error: "Authentication not configured" });
        return null;
      }
      logger.warn("SUPABASE_JWT_SECRET not set — using synthetic dev user");
      return "dev-user";
    }

    try {
      const decoded = jwt.verify(token, jwtSecret, {
        algorithms: ["HS256"],
      }) as { sub?: string; user_id?: string };
      const userId = decoded.sub ?? decoded.user_id;
      if (!userId) {
        res.status(401).json({
          success: false,
          error: "Token missing user identifier",
        });
        return null;
      }
      return userId;
    } catch (err: any) {
      logger.warn({ err: err.message }, "JWT verification failed");
      res
        .status(401)
        .json({ success: false, error: "Invalid or expired token" });
      return null;
    }
  }

  /**
   * Rate limiting using Redis sliding window
   * Per-endpoint-bucket rate limiting. Default is the legacy `plan` bucket
   * (20 req/min/IP) to preserve existing /api/plan and /api/passage-planning
   * behaviour. Other call sites should pass an explicit bucket so typing in
   * an autocomplete doesn't burn down the planning quota:
   *   - `geocode`  : 60/min/IP — supports debounced typing without hitting
   *                  Nominatim's 1 req/sec policy.
   *   - `passages` : 30/min/IP — saves are infrequent but spiky on edit.
   * Fails open if Redis is down (returns true). Returns false (and writes
   * a 429 response) only when the bucket is over the limit.
   */
  private async checkRateLimit(
    req: express.Request,
    res: express.Response,
    options: { bucket?: string; limit?: number; windowSeconds?: number } = {},
  ): Promise<boolean> {
    try {
      const ip = req.ip || req.socket.remoteAddress || "unknown";
      const bucket = options.bucket ?? "plan";
      const limit = options.limit ?? 20;
      const windowSeconds = options.windowSeconds ?? 60;
      const key = `ratelimit:${bucket}:${ip}`;

      if (!this.redis) return true; // No Redis — skip rate limiting

      const current = await this.redis.incr(key);
      if (current === 1) {
        await this.redis.expire(key, windowSeconds);
      }

      res.setHeader("X-RateLimit-Limit", String(limit));
      res.setHeader(
        "X-RateLimit-Remaining",
        String(Math.max(0, limit - current)),
      );

      if (current > limit) {
        res.status(429).json({
          success: false,
          error: "Rate limit exceeded. Try again shortly.",
        });
        return false;
      }
      return true;
    } catch (err) {
      // Fail open — if Redis is down, allow the request
      logger.warn(
        { err },
        "Rate limit check failed — allowing request (fail-open)",
      );
      return true;
    }
  }

  /**
   * Map internal passage plan to the PassagePlanningResponse shape the frontend expects.
   * SAFETY-CRITICAL: NEVER suppress warnings. All safety data must be surfaced.
   */
  private mapPlanToAnalyzeResponse(plan: any): any {
    // Derive GO/CAUTION/NO-GO from safety data
    const safetyWarnings = plan.safety?.warnings || [];
    const allWarnings = plan.summary?.warnings || [];
    const safetySystemFailed = plan.safety?.systemFailure;

    let goNoGo: "GO" | "CAUTION" | "NO-GO" = "GO";
    let overallRisk: "low" | "moderate" | "high" | "critical" = "low";
    let safetyScore: "Excellent" | "Good" | "Fair" | "Poor" = "Excellent";

    // Conservative safety derivation — any critical warning triggers NO-GO
    const criticalWarnings = allWarnings.filter(
      (w: string) =>
        w.includes("CRITICAL") ||
        w.includes("GALE") ||
        w.includes("ROUGH SEAS") ||
        w.includes("DANGEROUS") ||
        w.includes("REJECTED") ||
        w.includes("NO-GO"),
    );
    const cautionWarnings = allWarnings.filter(
      (w: string) =>
        w.includes("⚠️") || w.includes("HAZARD") || w.includes("CAUTION"),
    );

    if (safetySystemFailed || criticalWarnings.length > 0) {
      goNoGo = "NO-GO";
      overallRisk = "critical";
      safetyScore = "Poor";
    } else if (cautionWarnings.length > 3) {
      goNoGo = "CAUTION";
      overallRisk = "high";
      safetyScore = "Fair";
    } else if (cautionWarnings.length > 0) {
      goNoGo = "CAUTION";
      overallRisk = "moderate";
      safetyScore = "Good";
    }

    // Extract weather data in the flat format frontend expects
    const extractWeatherLocation = (weatherData: any, locationName: string) => {
      if (!weatherData) {
        return {
          forecast: "Unavailable",
          windSpeed: 0,
          windDirection: 0,
          waveHeight: 0,
          temperature: 0,
          conditions: "Unknown",
          warnings: [`Weather data unavailable for ${locationName}`],
          source: "N/A",
          timestamp: new Date().toISOString(),
          windDescription: "N/A",
        };
      }

      // Handle MCP content format
      let data = weatherData;
      if (weatherData.content && Array.isArray(weatherData.content)) {
        const dataContent = weatherData.content.find(
          (c: any) => c.type === "data",
        );
        if (dataContent?.data) data = dataContent.data;
      }

      const periods = data.periods || (Array.isArray(data) ? data : [data]);
      const first = periods[0] || {};

      return {
        forecast:
          first.detailedForecast ||
          first.shortForecast ||
          first.conditions ||
          "See detailed data",
        windSpeed: first.windSpeed || first.wind_speed || 0,
        windDirection: first.windDirection || first.wind_direction || 0,
        waveHeight:
          first.waveHeight ||
          first.significantWaveHeight ||
          first.wave_height ||
          0,
        temperature: first.temperature || first.temp || 0,
        conditions: first.shortForecast || first.conditions || "N/A",
        warnings: first.warnings || [],
        source: data.source || "NOAA",
        timestamp: data.timestamp || new Date().toISOString(),
        windDescription: first.windDescription || `${first.windSpeed || 0} kts`,
      };
    };

    const depWeather = extractWeatherLocation(
      plan.weather?.departure,
      plan.request?.departure?.name || "departure",
    );
    const destWeather = extractWeatherLocation(
      plan.weather?.arrival,
      plan.request?.destination?.name || "destination",
    );
    const maxWindSpeed = Math.max(depWeather.windSpeed, destWeather.windSpeed);

    // Extract tidal data in flat format
    const extractTidal = (tidalData: any, locationName: string) => {
      if (!tidalData) {
        return {
          station: "N/A",
          predictions: [],
          nextTide: null,
          nextTideFormatted: "No tidal data available",
          source: "N/A",
          warning: `Tidal data unavailable for ${locationName}`,
        };
      }

      let data = tidalData;
      if (tidalData.content && Array.isArray(tidalData.content)) {
        const dataContent = tidalData.content.find(
          (c: any) => c.type === "data",
        );
        if (dataContent?.data) data = dataContent.data;
      }

      const predictions = (data.predictions || data.tides || []).map(
        (p: any) => ({
          time: p.time || p.t,
          type: p.type || (p.v > 0 ? "high" : "low"),
          height: p.height || parseFloat(p.v) || 0,
          unit: p.unit || "ft",
        }),
      );

      const nextTide = predictions[0] || null;

      return {
        station:
          data.station?.name ||
          data.stationName ||
          data.station ||
          "Nearest station",
        stationId: data.station?.id || data.stationId,
        distance: data.station?.distance,
        predictions,
        nextTide,
        nextTideFormatted: nextTide
          ? `${nextTide.type === "high" ? "High" : "Low"} tide: ${nextTide.height.toFixed(1)} ${nextTide.unit} at ${new Date(nextTide.time).toLocaleTimeString()}`
          : "No predictions available",
        source: data.source || "NOAA CO-OPS",
      };
    };

    const depTidal = extractTidal(
      plan.tides?.departure,
      plan.request?.departure?.name || "departure",
    );
    const destTidal = extractTidal(
      plan.tides?.arrival,
      plan.request?.destination?.name || "destination",
    );

    // Extract port information
    const mapPort = (portData: any) => {
      if (!portData || !portData.nearest) {
        return { found: false, message: "No port information available" };
      }
      const p = portData.nearest;
      return {
        found: true,
        name: p.name,
        type: p.type || p.portType,
        distance: p.distance ? `${p.distance.toFixed(1)} nm` : "Nearby",
        facilities: p.facilities || {},
        navigation: p.navigation || {},
        contact: p.contact || {},
        customs: p.customs || {},
        recommendations: p.recommendations || [],
        rating: p.rating,
      };
    };

    const emergencyHarbors = (plan.ports?.emergencyHarbors || []).map(
      (h: any) => ({
        name: h.name,
        distance: h.distance ? `${h.distance} nm` : "N/A",
        vhf: h.vhf || "Ch 16",
        protection: h.protection || 0,
        facilities: h.facilities || 0,
      }),
    );

    // Build navigation warnings from safety data
    const navWarnings = safetyWarnings
      .filter(
        (w: string) =>
          w.includes("HAZARD") || w.includes("restricted") || w.includes("📋"),
      )
      .map((w: string, i: number) => ({
        id: `nav-${i}`,
        type: w.includes("HAZARD") ? "hazard" : "notice",
        title: w.substring(0, 80),
        description: w,
        location: null,
        severity: (w.includes("🔴")
          ? "critical"
          : w.includes("⚠️")
            ? "warning"
            : "info") as "critical" | "warning" | "info",
        effectiveDate: new Date().toISOString(),
        source: "Safety Agent",
      }));

    // Route data
    const route = plan.route || {};
    const totalDistance = route.totalDistance || 0;
    const estimatedDuration =
      plan.summary?.estimatedDuration || route.estimatedDuration || 0;
    const durationHours =
      typeof estimatedDuration === "number"
        ? estimatedDuration
        : parseFloat(estimatedDuration) || 0;

    const formatDuration = (hours: number): string => {
      if (hours < 1) return `${Math.round(hours * 60)} minutes`;
      const h = Math.floor(hours);
      const m = Math.round((hours - h) * 60);
      return m > 0 ? `${h}h ${m}m` : `${h}h`;
    };

    return {
      success: true,
      route: {
        distance: totalDistance,
        distanceNm: totalDistance,
        distanceKm: totalDistance * 1.852,
        bearing: route.bearing || 0,
        estimatedDuration: formatDuration(durationHours),
        estimatedDurationHours: durationHours,
        waypoints: (route.waypoints || []).map((wp: any) => ({
          latitude: wp.latitude || wp.lat,
          longitude: wp.longitude || wp.lon || wp.lng,
          name: wp.name,
        })),
        departure: plan.request?.departure?.name || "Origin",
        destination: plan.request?.destination?.name || "Destination",
      },
      weather: {
        departure: depWeather,
        destination: destWeather,
        summary: {
          maxWindSpeed,
          suitable: goNoGo !== "NO-GO",
          warnings: allWarnings.filter(
            (w: string) =>
              w.toLowerCase().includes("weather") ||
              w.toLowerCase().includes("wind") ||
              w.toLowerCase().includes("wave"),
          ),
          overall:
            goNoGo === "GO"
              ? "Conditions suitable for passage"
              : goNoGo === "CAUTION"
                ? "Proceed with caution — review warnings"
                : "Conditions not suitable — delay departure",
        },
      },
      tidal: {
        departure: depTidal,
        destination: destTidal,
        summary: {
          departureStation: depTidal.station,
          destinationStation: destTidal.station,
          tidalDataAvailable:
            depTidal.predictions.length > 0 || destTidal.predictions.length > 0,
          warnings: allWarnings.filter(
            (w: string) =>
              w.toLowerCase().includes("tidal") ||
              w.toLowerCase().includes("current"),
          ),
        },
      },
      navigationWarnings: {
        count: navWarnings.length,
        critical: navWarnings.filter((w: any) => w.severity === "critical")
          .length,
        warnings: navWarnings,
        lastChecked: new Date().toISOString(),
      },
      safety: {
        safetyScore,
        goNoGo,
        overallRisk,
        riskFactors: safetyWarnings.slice(0, 10),
        safetyWarnings,
        recommendations: plan.summary?.recommendations || [],
        hazards: plan.safety?.routeAnalysis?.hazards || [],
        emergencyContacts: {
          emergency: {
            coastGuard: {
              name: "US Coast Guard",
              vhf: "Channel 16",
              phone: "(855) 411-8727",
            },
          },
        },
        watchSchedule: plan.watchSchedule || null,
        timestamp: new Date().toISOString(),
        source: "Helmwise Safety Agent",
        decision: {
          goNoGo,
          overallRisk,
          safetyScore,
          proceedWithPassage: goNoGo === "GO",
          requiresCaution: goNoGo === "CAUTION",
          doNotProceed: goNoGo === "NO-GO",
        },
        analysis: {
          riskFactors: safetyWarnings,
          hazardsDetected: (plan.safety?.routeAnalysis?.hazards || []).length,
          warningsActive: allWarnings.length,
          crewExperienceConsidered: !!plan.request?.vessel?.crewExperience,
          vesselDraftConsidered: !!plan.request?.vessel?.draft,
        },
      },
      port: {
        departure: mapPort(plan.ports?.departure),
        destination: mapPort(plan.ports?.arrival),
        emergencyHarbors,
        summary: {
          departurePortAvailable: !!plan.ports?.departure?.nearest,
          destinationPortAvailable: !!plan.ports?.arrival?.nearest,
          emergencyOptions: emergencyHarbors.length,
          nearestEmergency: emergencyHarbors[0]?.name || "None identified",
        },
      },
      summary: {
        totalDistance: `${totalDistance.toFixed(1)} nm`,
        estimatedTime: formatDuration(durationHours),
        safetyDecision: goNoGo,
        safetyScore,
        overallRisk,
        suitableForPassage: goNoGo !== "NO-GO",
        warnings: allWarnings,
        recommendations: plan.summary?.recommendations || [],
      },
    };
  }

  private setupWebSocket() {
    this.wss.on("connection", (ws: WebSocket) => {
      logger.debug("WebSocket client connected");

      ws.on("close", () => {
        logger.debug("WebSocket client disconnected");
      });

      ws.on("error", (error: any) => {
        logger.error({ error }, "WebSocket error");
      });
    });
  }

  private broadcastUpdate(update: any) {
    const message = JSON.stringify(update);
    this.wss.clients.forEach((client: WebSocket) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  /**
   * Stripe webhook — registered separately so `express.raw({ type:
   * "application/json" })` runs instead of the global JSON parser, and so
   * the route handler sees `req.body` as a Buffer. Stripe signature
   * verification will reject any tampered body, so this is the one
   * endpoint where we deliberately bypass JSON parsing.
   *
   * Called from the constructor BEFORE setupHttpServer() so it sits ahead
   * of the global express.json() in the middleware chain.
   */
  private registerStripeWebhookEarly() {
    this.app.post(
      "/api/stripe/webhook",
      express.raw({ type: "application/json" }),
      async (req, res) => {
        const signature = req.headers["stripe-signature"] as string;
        try {
          // Pre-parse the event id for idempotency before doing full
          // signature verification. If the JSON parse fails (e.g. attacker
          // sending garbage), we skip the cache check and let the signature
          // step reject the request.
          let stripeEventId: string | undefined;
          try {
            stripeEventId = JSON.parse((req.body as Buffer).toString()).id;
          } catch {
            /* non-fatal */
          }

          // Idempotency: if we've already processed this event, ack
          // without re-running side effects. Stripe retries on 5xx and
          // we'd double-credit top-ups otherwise.
          if (stripeEventId && this.postgres) {
            const existing = await this.postgres.query(
              "SELECT id FROM subscription_events WHERE stripe_event_id = $1",
              [stripeEventId],
            );
            if (existing.rows.length > 0) {
              return res.json({ received: true });
            }
          }

          const result = await this.stripeService.handleWebhook(
            signature,
            req.body as Buffer,
          );

          if (!result) {
            return res.json({ received: true });
          }

          const r = result as any;
          if (r.type === "top_up" && this.postgres) {
            // Credit bonus passages to the user from a one-shot top-up.
            const pack = r.pack as "small" | "large";
            const passages = TOP_UP_PACKS[pack]?.passages || 0;
            if (passages > 0) {
              await this.postgres.query(
                "UPDATE profiles SET bonus_passages = bonus_passages + $1 WHERE id = $2",
                [passages, r.userId],
              );
            }
          } else if (r.type === "invoice_paid" && this.postgres) {
            // Reset monthly passage usage at the billing cycle renewal.
            await this.postgres.query(
              `DELETE FROM usage_events
               WHERE user_id = $1 AND action = 'passage_planned'
                 AND created_at < date_trunc('month', CURRENT_DATE)`,
              [r.userId],
            );
          } else if (r.type === "payment_failed" && this.postgres) {
            await this.postgres.query(
              "UPDATE subscriptions SET status = $1 WHERE user_id = $2",
              ["past_due", r.userId],
            );
            if (r.userId) {
              await this.postgres.query(
                "UPDATE profiles SET subscription_status = $1 WHERE id = $2",
                ["past_due", r.userId],
              );
            }
          } else if (r.type === "subscription") {
            await this.updateSubscription(r);
            if (r.founding && r.userId && this.postgres) {
              await this.postgres.query(
                `UPDATE profiles
                 SET is_founding_member = TRUE, founding_member_at = NOW()
                 WHERE id = $1 AND is_founding_member = FALSE`,
                [r.userId],
              );
            }
          } else {
            // Legacy path (subscription update/cancel without `type` field)
            await this.updateSubscription(result);
          }

          if (stripeEventId && this.postgres) {
            await this.postgres.query(
              `INSERT INTO subscription_events (stripe_event_id, event_type, processed_at)
               VALUES ($1, $2, NOW())
               ON CONFLICT (stripe_event_id) DO NOTHING`,
              [stripeEventId, r.type || "unknown"],
            );
          }

          res.json({ received: true });
        } catch (error) {
          logger.error({ error }, "Webhook processing failed");
          res.status(400).json({ error: "Webhook error" });
        }
      },
    );
  }

  /**
   * Sat-comm position webhook (S2).
   *
   * `POST /api/sat-comm/:vendor/webhook?device=<deviceId>`
   *
   * Public endpoint with HMAC signature verification per device. The HMAC is
   * computed against the raw request body so we register with
   * `express.raw({ type: "*\/*" })` instead of the global JSON parser; the
   * vendor adapter parses the body after auth succeeds.
   *
   * Failure modes:
   *   400 — vendor unsupported or malformed payload
   *   401 — signature mismatch or missing device
   *   503 — sat-comm service unavailable (DB down)
   */
  private registerSatCommWebhookEarly() {
    this.app.post(
      "/api/sat-comm/:vendor/webhook",
      express.raw({ type: "*/*" }),
      async (req, res) => {
        if (!this.satCommService) {
          return res.status(503).json({ error: "Sat-comm unavailable" });
        }
        const vendor = req.params.vendor;
        const deviceId = (req.query.device as string | undefined) ?? "";
        if (!KNOWN_VENDORS.includes(vendor as Vendor)) {
          return res.status(400).json({ error: "Unsupported vendor" });
        }
        if (!deviceId) {
          return res.status(400).json({ error: "device query param required" });
        }
        const adapter = getAdapter(vendor);
        if (!adapter) {
          return res.status(400).json({ error: "Unsupported vendor" });
        }
        const device = await this.satCommService.getDeviceByVendorDeviceId(
          vendor,
          deviceId,
        );
        if (!device) {
          // Same 401 as a signature mismatch so attackers can't enumerate
          // valid (vendor, deviceId) pairs.
          return res.status(401).json({ error: "Unauthorized" });
        }
        const ctx = {
          rawBody: req.body as Buffer,
          headers: req.headers as Record<string, string | string[] | undefined>,
          webhookSecret: device.webhook_secret,
          deviceId: device.id,
        };
        if (!adapter.verify(ctx)) {
          logger.warn(
            { vendor, deviceId: device.id },
            "Sat-comm signature mismatch",
          );
          return res.status(401).json({ error: "Unauthorized" });
        }
        try {
          const position = adapter.parse(ctx);
          const result = await this.satCommService.ingestPosition(
            device,
            position,
          );
          res.json({ ok: true, ...result });
        } catch (err) {
          logger.error(
            { err, vendor, deviceId: device.id },
            "Sat-comm ingest failed",
          );
          res.status(400).json({ error: (err as Error).message });
        }
      },
    );
  }

  /**
   * Map a Stripe price tier+period combo to the configured price id. The
   * env vars are required at runtime; if any is missing the checkout
   * route will return 500 (caller sees a clear error and we don't create
   * a half-configured subscription).
   */
  private getPriceId(tier: string, period: string): string | undefined {
    const map: Record<string, string | undefined> = {
      premium_monthly: process.env.STRIPE_PREMIUM_MONTHLY_PRICE_ID,
      premium_yearly: process.env.STRIPE_PREMIUM_YEARLY_PRICE_ID,
      premium_annual: process.env.STRIPE_PREMIUM_YEARLY_PRICE_ID,
      pro_monthly: process.env.STRIPE_PRO_MONTHLY_PRICE_ID,
      pro_yearly: process.env.STRIPE_PRO_YEARLY_PRICE_ID,
      pro_annual: process.env.STRIPE_PRO_YEARLY_PRICE_ID,
    };
    return map[`${tier}_${period}`];
  }

  /**
   * Read a user's current subscription row. Returns undefined if the user
   * has no row in `subscriptions` (i.e. has never subscribed); callers
   * should treat that as "free tier". DB-down returns undefined too —
   * fleet routes downstream interpret missing subscription as "free".
   */
  private async getSubscription(
    userId: string,
  ): Promise<{ tier: string; status: string } | undefined> {
    if (!this.postgres) return undefined;
    try {
      const result = await this.postgres.query(
        "SELECT tier, status FROM subscriptions WHERE user_id = $1",
        [userId],
      );
      return result.rows[0];
    } catch (error) {
      logger.warn({ error, userId }, "getSubscription DB query failed");
      return undefined;
    }
  }

  /**
   * Sync a Stripe subscription event back into the `subscriptions` and
   * `profiles` tables. COALESCE protects unchanged fields when Stripe
   * sends a partial update.
   */
  private async updateSubscription(data: any): Promise<void> {
    if (!this.postgres) return;
    await this.postgres.query(
      `UPDATE subscriptions
       SET tier = COALESCE($2, tier),
           status = COALESCE($3, status),
           current_period_start = COALESCE($4, current_period_start),
           current_period_end = COALESCE($5, current_period_end),
           stripe_customer_id = COALESCE($6, stripe_customer_id),
           stripe_subscription_id = COALESCE($7, stripe_subscription_id),
           updated_at = NOW()
       WHERE user_id = $1`,
      [
        data.userId,
        data.tier ?? null,
        data.status ?? null,
        data.currentPeriodStart ?? null,
        data.currentPeriodEnd ?? null,
        data.stripeCustomerId ?? null,
        data.stripeSubscriptionId ?? null,
      ],
    );
    if (data.tier || data.status) {
      await this.postgres.query(
        `UPDATE profiles
         SET subscription_tier = COALESCE($2, subscription_tier),
             subscription_status = COALESCE($3, subscription_status)
         WHERE id = $1`,
        [data.userId, data.tier ?? null, data.status ?? null],
      );
    }
  }

  private setupHttpServer() {
    this.app.use(express.json({ limit: "1mb" }));

    // Trust proxy in production for correct IP detection behind load balancers
    if (process.env.NODE_ENV === "production") {
      this.app.set("trust proxy", 1);
    }

    // CORS for frontend
    this.app.use((req, res, next) => {
      const allowedOrigins = [
        "http://localhost:3000",
        "http://localhost:3001",
        "https://helmwise.co",
        "https://www.helmwise.co",
        "https://helmwise.pages.dev",
        process.env.NEXT_PUBLIC_APP_URL,
      ].filter(Boolean) as string[];
      const origin = req.headers.origin;
      if (origin && allowedOrigins.includes(origin)) {
        res.setHeader("Access-Control-Allow-Origin", origin);
      }
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      res.setHeader(
        "Access-Control-Allow-Headers",
        "Content-Type, Authorization",
      );
      res.setHeader("Access-Control-Allow-Credentials", "true");

      if (req.method === "OPTIONS") {
        return res.sendStatus(200);
      }
      next();
    });

    // REST endpoint for passage planning (original)
    this.app.post("/api/plan", async (req, res) => {
      // Auth + rate limit. verifyAuthAndGetUserId lets us tier-check the R1
      // multi-model upgrade silently — Free users still get a plan, just
      // without the model comparison card.
      const userId = await this.verifyAuthAndGetUserId(req, res);
      if (!userId) return;
      if (!(await this.checkRateLimit(req, res))) return;

      const validation = this.validatePassageRequest(req.body);
      if (!validation.success) {
        const { error } = validation as { success: false; error: string };
        res.status(400).json({ success: false, error });
        return;
      }

      const wantsMultiModel = req.body?.multiModel === true;
      const eligibleForMultiModel =
        wantsMultiModel && (await this.isPremiumOrAbove(userId));

      // V1 — polar-aware routing plumbing. Premium-gated; Free users keep
      // the existing cruise-speed routing. The user-id is attached to the
      // request so planPassage's polar loader can look up the active polar.
      const wantsPolars = req.body?.usePolars === true;
      const eligibleForPolars =
        wantsPolars && eligibleForMultiModel
          ? true
          : wantsPolars && (await this.isPremiumOrAbove(userId));
      (validation.data as any).userId = userId;
      (validation.data as any).usePolars = !!eligibleForPolars;
      if (typeof req.body?.vesselId === "string") {
        (validation.data as any).vesselId = req.body.vesselId;
      }

      try {
        logger.info(
          {
            departure: req.body.departure?.name,
            destination: req.body.destination?.name,
            multiModelRequested: wantsMultiModel,
            multiModelGranted: eligibleForMultiModel,
          },
          "Received planning request via /api/plan",
        );

        // Fire the plan + model comparison in parallel — comparison must not
        // delay the plan response if Open-Meteo is slow.
        const planPromise = this.planPassage(validation.data);
        const departureLat = validation.data.departure?.latitude ?? 0;
        const departureLon = validation.data.departure?.longitude ?? 0;
        const departureTime = validation.data.departure?.time
          ? new Date(validation.data.departure.time)
          : new Date();
        const comparisonPromise = eligibleForMultiModel
          ? this.maybeFetchModelComparison(
              departureLat,
              departureLon,
              departureTime,
            )
          : Promise.resolve(null);

        const [plan, modelComparison] = await Promise.all([
          planPromise,
          comparisonPromise,
        ]);
        // R1 → R2 link: when multi-model came back, re-score with the
        // disagreement input so divergent forecasts widen the safety bounds.
        let refreshedPlan: any = plan;
        if (modelComparison) {
          try {
            const updated = (
              this.agents["safety"] as SafetyAgent
            ).computeRiskScore(
              this.buildRiskInput(plan, validation.data, {
                windStatus: modelComparison.windSpeed?.status,
                waveStatus: modelComparison.waveHeight?.status,
              }),
            );
            if (updated) refreshedPlan = { ...plan, riskScore: updated };
          } catch (err) {
            logger.warn(
              { err },
              "Risk score refresh with model data failed; keeping baseline",
            );
          }
        }
        const enrichedPlan =
          modelComparison !== null
            ? { ...refreshedPlan, modelComparison }
            : wantsMultiModel && !eligibleForMultiModel
              ? {
                  ...refreshedPlan,
                  modelComparison: null,
                  modelComparisonGated: true,
                }
              : refreshedPlan;
        res.json({ success: true, plan: enrichedPlan });
      } catch (error: any) {
        logger.error({ error }, "Planning failed");
        res.status(500).json({
          success: false,
          error:
            "Passage planning failed. Please try again or contact support.",
        });
      }
    });

    // ------------------------------------------------------------------
    // R3 — Multi-departure-time comparison (Premium, hard-gated).
    //
    // Runs the same passage plan for up to 3 candidate departure times in
    // parallel and returns a comparison summary with a recommended "best
    // window" selection. Promise.allSettled — one candidate's failure must
    // not poison the others. Each candidate's full plan is returned so the
    // frontend can switch the active view without re-querying.
    //
    // Cost note: each candidate is a full plan run (3× external API calls,
    // 3× compute). Cache hits on the 1h weather TTL absorb much of this
    // for clustered candidates. Hard tier gate prevents Free users from
    // running comparisons.
    // ------------------------------------------------------------------
    const compareSchema = z.object({
      candidateDepartures: z.array(z.string().datetime()).min(1).max(3),
    });

    this.app.post("/api/plan/compare", async (req, res) => {
      const userId = await this.verifyAuthAndGetUserId(req, res);
      if (!userId) return;
      if (
        !(await this.checkRateLimit(req, res, {
          bucket: "plan-compare",
          limit: 5,
        }))
      )
        return;

      const isPremium = await this.isPremiumOrAbove(userId);
      if (!isPremium) {
        return res.status(403).json({
          error: "Multi-departure comparison requires a Premium subscription",
          upgradeRequired: true,
        });
      }

      const baseValidation = this.validatePassageRequest(req.body);
      if (!baseValidation.success) {
        const { error } = baseValidation as { success: false; error: string };
        return res.status(400).json({ success: false, error });
      }
      const parsedExtra = compareSchema.safeParse(req.body);
      if (!parsedExtra.success) {
        return res.status(400).json({
          success: false,
          error: "candidateDepartures must be 1-3 ISO datetimes",
          details: parsedExtra.error.issues,
        });
      }

      // Reject past times, dedupe candidates within 1h of each other so the
      // user doesn't accidentally pay 3× for what's effectively one run.
      const now = Date.now();
      const dedupedMs: number[] = [];
      for (const iso of parsedExtra.data.candidateDepartures) {
        const t = new Date(iso).getTime();
        if (!Number.isFinite(t)) {
          return res.status(400).json({ error: `Invalid datetime: ${iso}` });
        }
        if (t < now - 60 * 1000) {
          return res
            .status(400)
            .json({ error: `Departure ${iso} is in the past` });
        }
        if (
          dedupedMs.some((existing) => Math.abs(existing - t) < 60 * 60 * 1000)
        ) {
          continue;
        }
        dedupedMs.push(t);
      }
      if (dedupedMs.length === 0) {
        return res
          .status(400)
          .json({ error: "No usable candidate departures after deduping" });
      }

      const baseData = baseValidation.data;
      logger.info(
        {
          candidateCount: dedupedMs.length,
          departureName: baseData.departure?.name,
        },
        "R3 compare request",
      );

      // Run all candidates in parallel — allSettled so a single failure
      // doesn't drag the whole comparison down.
      const settled = await Promise.allSettled(
        dedupedMs.map(async (timeMs) => {
          const candidateRequest = {
            ...baseData,
            departure: {
              ...baseData.departure,
              time: new Date(timeMs).toISOString(),
            },
          };
          const plan = await this.planPassage(candidateRequest);
          return { departureTime: new Date(timeMs).toISOString(), plan };
        }),
      );

      const candidates = settled.map((s, i) => {
        if (s.status === "fulfilled") {
          return {
            departureTime: new Date(dedupedMs[i]).toISOString(),
            status: "ok" as const,
            plan: s.value.plan,
          };
        }
        return {
          departureTime: new Date(dedupedMs[i]).toISOString(),
          status: "error" as const,
          error:
            (s.reason as Error)?.message ?? "Plan failed for this candidate",
        };
      });

      // Pick the best window: highest GO/CAUTION risk score, ties broken by
      // earliest ETA. NO-GO candidates can still be "best" only if all are
      // NO-GO (degenerate case — the UI should make clear nothing is safe).
      const summary = this.buildCompareSummary(candidates);

      res.json({
        success: true,
        candidates,
        bestIndex: summary.bestIndex,
        summary: summary.notes,
      });
    });

    // Frontend-compatible endpoint — returns PassagePlanningResponse shape
    this.app.post("/api/passage-planning/analyze", async (req, res) => {
      // verifyAuthAndGetUserId so we can do the R1 multi-model tier check.
      const userId = await this.verifyAuthAndGetUserId(req, res);
      if (!userId) return;
      if (!(await this.checkRateLimit(req, res))) return;

      const validation = this.validatePassageRequest(req.body);
      if (!validation.success) {
        const { error } = validation as { success: false; error: string };
        res.status(400).json({ success: false, error });
        return;
      }

      const wantsMultiModel = req.body?.multiModel === true;
      const eligibleForMultiModel =
        wantsMultiModel && (await this.isPremiumOrAbove(userId));

      // V1 — polar-aware routing plumbing. Premium-gated; Free users keep
      // the existing cruise-speed routing. The user-id is attached to the
      // request so planPassage's polar loader can look up the active polar.
      const wantsPolars = req.body?.usePolars === true;
      const eligibleForPolars =
        wantsPolars && eligibleForMultiModel
          ? true
          : wantsPolars && (await this.isPremiumOrAbove(userId));
      (validation.data as any).userId = userId;
      (validation.data as any).usePolars = !!eligibleForPolars;
      if (typeof req.body?.vesselId === "string") {
        (validation.data as any).vesselId = req.body.vesselId;
      }

      try {
        logger.info(
          {
            departure: req.body.departure?.name,
            destination: req.body.destination?.name,
            multiModelRequested: wantsMultiModel,
            multiModelGranted: eligibleForMultiModel,
          },
          "Received planning request via /api/passage-planning/analyze",
        );
        const planPromise = this.planPassage(validation.data);
        const departureLat = validation.data.departure?.latitude ?? 0;
        const departureLon = validation.data.departure?.longitude ?? 0;
        const departureTime = validation.data.departure?.time
          ? new Date(validation.data.departure.time)
          : new Date();
        const comparisonPromise = eligibleForMultiModel
          ? this.maybeFetchModelComparison(
              departureLat,
              departureLon,
              departureTime,
            )
          : Promise.resolve(null);

        const [plan, modelComparison] = await Promise.all([
          planPromise,
          comparisonPromise,
        ]);
        // R1 → R2 link: refresh risk score with multi-model disagreement so
        // divergent forecasts widen the safety bounds in the score.
        let refreshedPlan: any = plan;
        if (modelComparison) {
          try {
            const updated = (
              this.agents["safety"] as SafetyAgent
            ).computeRiskScore(
              this.buildRiskInput(plan, validation.data, {
                windStatus: modelComparison.windSpeed?.status,
                waveStatus: modelComparison.waveHeight?.status,
              }),
            );
            if (updated) refreshedPlan = { ...plan, riskScore: updated };
          } catch (err) {
            logger.warn(
              { err },
              "Risk score refresh with model data failed; keeping baseline",
            );
          }
        }
        const response = this.mapPlanToAnalyzeResponse(refreshedPlan);
        const riskScore = (refreshedPlan as any).riskScore ?? undefined;
        const enriched =
          modelComparison !== null
            ? {
                ...response,
                ...(riskScore ? { riskScore } : {}),
                modelComparison,
              }
            : wantsMultiModel && !eligibleForMultiModel
              ? {
                  ...response,
                  ...(riskScore ? { riskScore } : {}),
                  modelComparison: null,
                  modelComparisonGated: true,
                }
              : { ...response, ...(riskScore ? { riskScore } : {}) };
        res.json(enriched);
      } catch (error: any) {
        logger.error({ error }, "Planning failed");
        res.status(500).json({
          success: false,
          error:
            "Passage planning failed. Please try again or contact support.",
        });
      }
    });

    // Health check endpoint. Reports the actual state of each in-process
    // agent and the Redis/Postgres dependencies. Returns HTTP 503 if a
    // safety-critical agent (safety, weather, tidal, route) is down so
    // ops can wire this to alerting and rolling restarts.
    this.app.get("/health", async (req, res) => {
      const startedAt = Date.now();
      const health: {
        status: "healthy" | "degraded" | "unhealthy";
        timestamp: string;
        agents: Record<
          string,
          { status: string; lastHeartbeat: string | null }
        >;
        dependencies: {
          redis: {
            status: "up" | "down" | "not_configured";
            latencyMs?: number;
            error?: string;
          };
        };
        criticalAgentsDown: string[];
        durationMs?: number;
      } = {
        status: "healthy",
        timestamp: new Date().toISOString(),
        agents: {},
        dependencies: {
          redis: { status: this.redis ? "up" : "not_configured" },
        },
        criticalAgentsDown: [],
      };

      // Agent presence — these are in-process classes, so "present" means
      // the constructor finished and didn't throw. We trust the agent's own
      // `getHealth()` if it exposes one (BaseAgent does) but fall back to
      // a binary up/down based on the registry entry. This replaces the
      // old hardcoded "6 healthy" mock that masked failures.
      const agentNames = Object.keys(this.agents).concat(["port"]); // portAgent is a separate field
      const safetyCritical = new Set(["safety", "weather", "tidal", "route"]);
      for (const name of agentNames) {
        const inst =
          name === "port"
            ? this.portAgent
            : (this.agents[name] as unknown as { getHealth?: () => unknown });
        if (!inst) {
          health.agents[name] = { status: "missing", lastHeartbeat: null };
          if (safetyCritical.has(name)) health.criticalAgentsDown.push(name);
          continue;
        }
        let status = "active";
        try {
          if (
            typeof (inst as { getHealth?: () => unknown }).getHealth ===
            "function"
          ) {
            // Don't await — BaseAgent.getHealth() is sync in the abstract
            // class; we just want to confirm it doesn't throw.
            (inst as { getHealth: () => unknown }).getHealth();
          }
        } catch {
          status = "error";
          if (safetyCritical.has(name)) health.criticalAgentsDown.push(name);
        }
        health.agents[name] = {
          status,
          lastHeartbeat: new Date().toISOString(),
        };
      }

      // Redis ping — actually exercise the connection rather than trust
      // `isReady`. A blocked Redis can cause silent cache misses, which
      // for us means stale safety data falls through to fresh-fetch path.
      // We want to know.
      if (this.redis) {
        const t0 = Date.now();
        try {
          const reply = await this.redis.ping();
          health.dependencies.redis = {
            status: reply === "PONG" ? "up" : "down",
            latencyMs: Date.now() - t0,
          };
          if (reply !== "PONG") {
            health.status = "degraded";
          }
        } catch (err) {
          health.dependencies.redis = {
            status: "down",
            latencyMs: Date.now() - t0,
            error: (err as Error).message,
          };
          // Redis being down is degraded, not fully unhealthy — orchestrator
          // can still plan with stale-resistance turned up.
          health.status = "degraded";
        }
      }

      if (health.criticalAgentsDown.length > 0) {
        health.status = "unhealthy";
      }

      health.durationMs = Date.now() - startedAt;
      res.status(health.status === "unhealthy" ? 503 : 200).json(health);
    });

    // Readiness probe for Kubernetes
    this.app.get("/ready", async (req, res) => {
      res.json({ ready: true });
    });

    // ------------------------------------------------------------------
    // Profile + auth-adjacent endpoints (migrated from the now-deprecated
    // HttpServer in server.ts). The frontend's onboarding flow calls
    // PUT /api/profile to persist the boat profile; without this live the
    // entire signup → planner path is broken in production.
    // ------------------------------------------------------------------

    // Logout — clears the httpOnly auth cookies. No DB call, no auth check
    // (an unauthenticated client clearing cookies is harmless).
    this.app.post("/api/auth/logout", (req, res) => {
      const cookieOpts = {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax" as const,
        path: "/",
      };
      res.clearCookie("auth_token", cookieOpts);
      res.clearCookie("refresh_token", cookieOpts);
      res.json({ success: true });
    });

    // GET profile — returns the caller's profile row keyed by JWT sub.
    // RLS in the profiles table already prevents cross-user reads, but
    // we double-defend by querying with the verified user id.
    this.app.get("/api/profile", async (req, res) => {
      if (
        !(await this.checkRateLimit(req, res, {
          bucket: "profile",
          limit: 60,
        }))
      )
        return;
      const userId = await this.verifyAuthAndGetUserId(req, res);
      if (!userId) return;
      if (!this.postgres) {
        return res
          .status(503)
          .json({ error: "Profile service unavailable (DB not configured)" });
      }
      try {
        const result = await this.postgres.query(
          `SELECT id, email, full_name, company_name, phone,
                  subscription_tier, subscription_status,
                  trial_ends_at, subscription_ends_at,
                  monthly_passage_count, usage_reset_at,
                  metadata, created_at, updated_at
             FROM profiles
             WHERE id = $1`,
          [userId],
        );
        if (!result.rows[0]) {
          return res.status(404).json({ error: "Profile not found" });
        }
        res.json(result.rows[0]);
      } catch (error) {
        logger.error({ error, userId }, "Failed to fetch profile");
        res.status(500).json({ error: "Failed to fetch profile" });
      }
    });

    // PUT profile — partial update via COALESCE so omitted fields keep
    // their current value. Validates with Zod first so a malformed body
    // never reaches the DB.
    this.app.put("/api/profile", async (req, res) => {
      if (
        !(await this.checkRateLimit(req, res, {
          bucket: "profile",
          limit: 30,
        }))
      )
        return;
      const userId = await this.verifyAuthAndGetUserId(req, res);
      if (!userId) return;
      if (!this.postgres) {
        return res
          .status(503)
          .json({ error: "Profile service unavailable (DB not configured)" });
      }
      const schema = z.object({
        full_name: z.string().max(100).optional(),
        company_name: z.string().max(100).optional(),
        phone: z.string().max(20).optional(),
        metadata: z.record(z.string(), z.unknown()).optional(),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: "Validation failed",
          details: parsed.error.issues,
        });
      }
      const { full_name, company_name, phone, metadata } = parsed.data;
      try {
        const result = await this.postgres.query(
          `UPDATE profiles
             SET full_name = COALESCE($2, full_name),
                 company_name = COALESCE($3, company_name),
                 phone = COALESCE($4, phone),
                 metadata = COALESCE($5, metadata),
                 updated_at = NOW()
             WHERE id = $1
             RETURNING id, email, full_name, company_name, phone,
                       subscription_tier, subscription_status,
                       metadata, updated_at`,
          [
            userId,
            full_name ?? null,
            company_name ?? null,
            phone ?? null,
            metadata ? JSON.stringify(metadata) : null,
          ],
        );
        if (!result.rows[0]) {
          return res.status(404).json({ error: "Profile not found" });
        }
        res.json(result.rows[0]);
      } catch (error) {
        logger.error({ error, userId }, "Failed to update profile");
        res.status(500).json({ error: "Failed to update profile" });
      }
    });

    // ------------------------------------------------------------------
    // Stripe checkout + customer portal (migrated from server.ts).
    // The frontend proxies at /frontend/app/api/stripe/* target these
    // /api/subscription/* paths — naming inherited from the prior impl.
    // ------------------------------------------------------------------

    // POST /api/subscription/create-checkout-session — auth'd. Blocks
    // duplicate subscriptions (returns 409 + redirect-to-portal hint) and
    // applies the founding-member discount coupon when eligible.
    this.app.post(
      "/api/subscription/create-checkout-session",
      async (req, res) => {
        if (
          !(await this.checkRateLimit(req, res, {
            bucket: "billing",
            limit: 10,
          }))
        )
          return;
        const userId = await this.verifyAuthAndGetUserId(req, res);
        if (!userId) return;
        if (!this.postgres) {
          return res
            .status(503)
            .json({ error: "Billing unavailable (DB not configured)" });
        }
        const schema = z.object({
          tier: z.enum(["premium", "pro"]),
          period: z.enum(["monthly", "annual", "yearly"]).optional(),
          founding: z.boolean().optional(),
          successUrl: z.string().url().optional(),
          cancelUrl: z.string().url().optional(),
        });
        const parsed = schema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({
            error: "Validation failed",
            details: parsed.error.issues,
          });
        }
        const {
          tier,
          period: rawPeriod = "monthly",
          founding = false,
        } = parsed.data;
        // Frontend uses "yearly" historically; FOUNDING_MEMBER.billingPeriod
        // is "annual"; getPriceId accepts both. Normalize to "annual" so the
        // founding-discount eligibility check matches the shared constant.
        const period: "monthly" | "annual" =
          rawPeriod === "yearly" ? "annual" : rawPeriod;
        const priceId = this.getPriceId(tier, period);
        if (!priceId) {
          logger.error(
            { tier, period },
            "Stripe price id env var missing for tier/period combo",
          );
          return res
            .status(500)
            .json({ error: "Billing misconfigured — contact support" });
        }
        try {
          // Block duplicate subscriptions: if the user already has an active
          // paid subscription, send them to the customer portal instead of
          // creating a second Stripe session (which would charge twice).
          const existing = await this.postgres.query(
            `SELECT tier, status FROM subscriptions
             WHERE user_id = $1
               AND status IN ('active', 'trialing', 'past_due')
             LIMIT 1`,
            [userId],
          );
          if (existing.rows[0] && existing.rows[0].tier !== "free") {
            return res.status(409).json({
              error: "Active subscription exists",
              message:
                "You already have an active subscription. Use the billing portal to change plans.",
              currentTier: existing.rows[0].tier,
              action: "open_customer_portal",
            });
          }

          let foundingDiscount: string | undefined;
          if (
            founding &&
            tier === FOUNDING_MEMBER.appliesToTier &&
            period === FOUNDING_MEMBER.billingPeriod
          ) {
            const spotsResult = await this.postgres.query(
              "SELECT COUNT(*) AS count FROM profiles WHERE is_founding_member = TRUE",
            );
            const claimed =
              parseInt(spotsResult.rows[0]?.count ?? "0", 10) || 0;
            if (claimed < FOUNDING_MEMBER.totalSpots) {
              foundingDiscount = FOUNDING_MEMBER.stripeCouponId;
            }
          }

          // Look up the user's email for the Stripe checkout pre-fill.
          const profileResult = await this.postgres.query(
            "SELECT email FROM profiles WHERE id = $1",
            [userId],
          );
          const userEmail = profileResult.rows[0]?.email;

          const appUrl =
            process.env.NEXT_PUBLIC_APP_URL ?? "https://helmwise.co";
          const session = await this.stripeService.createCheckoutSession(
            userId,
            priceId,
            parsed.data.successUrl ?? `${appUrl}/profile?success=true`,
            parsed.data.cancelUrl ?? `${appUrl}/profile?canceled=true`,
            userEmail,
            foundingDiscount,
          );

          res.json({
            sessionUrl: session.url,
            foundingApplied: !!foundingDiscount,
          });
        } catch (error) {
          logger.error({ error, userId }, "Checkout session creation failed");
          res.status(500).json({ error: "Failed to create checkout session" });
        }
      },
    );

    // POST /api/subscription/customer-portal — auth'd. Returns a Stripe
    // portal URL for the user to manage / cancel their subscription.
    this.app.post("/api/subscription/customer-portal", async (req, res) => {
      if (
        !(await this.checkRateLimit(req, res, {
          bucket: "billing",
          limit: 10,
        }))
      )
        return;
      const userId = await this.verifyAuthAndGetUserId(req, res);
      if (!userId) return;
      if (!this.postgres) {
        return res
          .status(503)
          .json({ error: "Billing unavailable (DB not configured)" });
      }
      try {
        const subscription = await this.postgres.query(
          "SELECT stripe_customer_id FROM subscriptions WHERE user_id = $1",
          [userId],
        );
        if (!subscription.rows[0]?.stripe_customer_id) {
          return res.status(404).json({
            error: "No subscription found",
            message:
              "You need an active subscription to access the customer portal",
          });
        }
        const { returnUrl } = (req.body ?? {}) as { returnUrl?: string };
        const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://helmwise.co";
        const session = await this.stripeService.createPortalSession(
          subscription.rows[0].stripe_customer_id,
          returnUrl ?? `${appUrl}/profile`,
        );
        res.json({ url: session.url, success: true });
      } catch (error) {
        logger.error(
          { error, userId },
          "Failed to create customer portal session",
        );
        res
          .status(500)
          .json({ error: "Failed to create customer portal session" });
      }
    });

    // Founding-member spots — public unauth endpoint hit by the pricing
    // page to render "X of Y founding spots remaining". DB miss falls
    // back to "all spots open" so the pricing page never breaks.
    this.app.get("/api/founding-member/spots-remaining", async (req, res) => {
      if (!this.postgres) {
        return res.json({
          remaining: FOUNDING_MEMBER.totalSpots,
          total: FOUNDING_MEMBER.totalSpots,
        });
      }
      try {
        const result = await this.postgres.query(
          "SELECT COUNT(*) AS count FROM profiles WHERE is_founding_member = TRUE",
        );
        const claimed = parseInt(result.rows[0]?.count ?? "0", 10) || 0;
        res.json({
          remaining: Math.max(0, FOUNDING_MEMBER.totalSpots - claimed),
          total: FOUNDING_MEMBER.totalSpots,
        });
      } catch (error) {
        logger.error({ error }, "Failed to get founding member spots");
        // Don't block the pricing page on a DB hiccup — return optimistic
        // "spots remain" so the UI keeps working.
        res.json({
          remaining: FOUNDING_MEMBER.totalSpots,
          total: FOUNDING_MEMBER.totalSpots,
        });
      }
    });

    // ------------------------------------------------------------------
    // Fleet routes (Pro-tier feature). UI in frontend/app/fleet/page.tsx
    // already wires these — they 404'd in production until this commit.
    // Schema lives in infrastructure/docker/postgres/init.sql:161+
    // (fleets, fleet_members, fleet_vessels, fleet_invitations tables).
    // ------------------------------------------------------------------

    // POST /api/fleet/create — Pro-tier gated. One fleet per owner.
    this.app.post("/api/fleet/create", async (req, res) => {
      if (
        !(await this.checkRateLimit(req, res, { bucket: "fleet", limit: 30 }))
      )
        return;
      const userId = await this.verifyAuthAndGetUserId(req, res);
      if (!userId) return;
      if (!this.postgres) {
        return res
          .status(503)
          .json({ error: "Fleet service unavailable (DB not configured)" });
      }
      const schema = z.object({
        name: z.string().min(1).max(100),
        description: z.string().max(500).optional(),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res
          .status(400)
          .json({ error: "Validation failed", details: parsed.error.issues });
      }
      const { name, description } = parsed.data;
      try {
        const subscription = await this.getSubscription(userId);
        if (!subscription || subscription.tier !== "pro") {
          return res
            .status(403)
            .json({ error: "Fleet management requires Pro subscription" });
        }
        const existing = await this.postgres.query(
          "SELECT id FROM fleets WHERE owner_id = $1",
          [userId],
        );
        if (existing.rows.length > 0) {
          return res.status(400).json({ error: "Fleet already exists" });
        }
        const result = await this.postgres.query(
          `INSERT INTO fleets (owner_id, name, description)
             VALUES ($1, $2, $3)
             RETURNING *`,
          [userId, name, description ?? null],
        );
        await this.postgres.query(
          `INSERT INTO fleet_members (fleet_id, user_id, role)
             VALUES ($1, $2, 'admin')`,
          [result.rows[0].id, userId],
        );
        res.json(result.rows[0]);
      } catch (error) {
        logger.error({ error, userId }, "Failed to create fleet");
        res.status(500).json({ error: "Failed to create fleet" });
      }
    });

    // GET /api/fleet — single fleet for the caller (404 if none).
    this.app.get("/api/fleet", async (req, res) => {
      if (
        !(await this.checkRateLimit(req, res, { bucket: "fleet", limit: 60 }))
      )
        return;
      const userId = await this.verifyAuthAndGetUserId(req, res);
      if (!userId) return;
      if (!this.postgres) {
        return res
          .status(503)
          .json({ error: "Fleet service unavailable (DB not configured)" });
      }
      try {
        const result = await this.postgres.query(
          `SELECT f.*, fm.role
             FROM fleets f
             JOIN fleet_members fm ON f.id = fm.fleet_id
             WHERE fm.user_id = $1
             LIMIT 1`,
          [userId],
        );
        if (result.rows.length === 0) {
          return res.status(404).json({ error: "No fleet found" });
        }
        res.json(result.rows[0]);
      } catch (error) {
        logger.error({ error, userId }, "Failed to get fleet");
        res.status(500).json({ error: "Failed to get fleet" });
      }
    });

    // GET /api/fleet/:fleetId/vessels — list vessels in a fleet.
    this.app.get("/api/fleet/:fleetId/vessels", async (req, res) => {
      if (
        !(await this.checkRateLimit(req, res, { bucket: "fleet", limit: 60 }))
      )
        return;
      const userId = await this.verifyAuthAndGetUserId(req, res);
      if (!userId) return;
      if (!this.postgres) {
        return res
          .status(503)
          .json({ error: "Fleet service unavailable (DB not configured)" });
      }
      const { fleetId } = req.params;
      try {
        const access = await this.postgres.query(
          "SELECT 1 FROM fleet_members WHERE fleet_id = $1 AND user_id = $2",
          [fleetId, userId],
        );
        if (access.rows.length === 0) {
          return res.status(403).json({ error: "Access denied" });
        }
        const result = await this.postgres.query(
          `SELECT * FROM fleet_vessels WHERE fleet_id = $1 ORDER BY created_at ASC`,
          [fleetId],
        );
        res.json(result.rows);
      } catch (error) {
        logger.error({ error, userId, fleetId }, "Failed to list vessels");
        res.status(500).json({ error: "Failed to list vessels" });
      }
    });

    // POST /api/fleet/:fleetId/vessels — admin/captain only.
    this.app.post("/api/fleet/:fleetId/vessels", async (req, res) => {
      if (
        !(await this.checkRateLimit(req, res, { bucket: "fleet", limit: 30 }))
      )
        return;
      const userId = await this.verifyAuthAndGetUserId(req, res);
      if (!userId) return;
      if (!this.postgres) {
        return res
          .status(503)
          .json({ error: "Fleet service unavailable (DB not configured)" });
      }
      const schema = z.object({
        name: z.string().min(1).max(100),
        type: z.string().max(50).optional(),
        length: z.number().optional(),
        beam: z.number().optional(),
        draft: z.number().optional(),
        registration: z.string().max(100).optional(),
        homePort: z.string().max(100).optional(),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res
          .status(400)
          .json({ error: "Validation failed", details: parsed.error.issues });
      }
      const { fleetId } = req.params;
      try {
        const access = await this.postgres.query(
          `SELECT role FROM fleet_members
             WHERE fleet_id = $1 AND user_id = $2 AND role IN ('admin', 'captain')`,
          [fleetId, userId],
        );
        if (access.rows.length === 0) {
          return res.status(403).json({ error: "Access denied" });
        }
        const v = parsed.data;
        const result = await this.postgres.query(
          `INSERT INTO fleet_vessels (fleet_id, name, type, length, beam, draft, registration, home_port)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             RETURNING *`,
          [
            fleetId,
            v.name,
            v.type ?? null,
            v.length ?? null,
            v.beam ?? null,
            v.draft ?? null,
            v.registration ?? null,
            v.homePort ?? null,
          ],
        );
        res.json(result.rows[0]);
      } catch (error) {
        logger.error({ error, userId, fleetId }, "Failed to add vessel");
        res.status(500).json({ error: "Failed to add vessel" });
      }
    });

    // GET /api/fleet/:fleetId/members — list crew members.
    this.app.get("/api/fleet/:fleetId/members", async (req, res) => {
      if (
        !(await this.checkRateLimit(req, res, { bucket: "fleet", limit: 60 }))
      )
        return;
      const userId = await this.verifyAuthAndGetUserId(req, res);
      if (!userId) return;
      if (!this.postgres) {
        return res
          .status(503)
          .json({ error: "Fleet service unavailable (DB not configured)" });
      }
      const { fleetId } = req.params;
      try {
        const access = await this.postgres.query(
          "SELECT 1 FROM fleet_members WHERE fleet_id = $1 AND user_id = $2",
          [fleetId, userId],
        );
        if (access.rows.length === 0) {
          return res.status(403).json({ error: "Access denied" });
        }
        const result = await this.postgres.query(
          `SELECT fm.user_id, fm.role, fm.created_at,
                  p.email, p.full_name
             FROM fleet_members fm
             LEFT JOIN profiles p ON p.id = fm.user_id
             WHERE fm.fleet_id = $1
             ORDER BY fm.created_at ASC`,
          [fleetId],
        );
        res.json(result.rows);
      } catch (error) {
        logger.error({ error, userId, fleetId }, "Failed to list members");
        res.status(500).json({ error: "Failed to list members" });
      }
    });

    // POST /api/fleet/:fleetId/invite — admin only. Sends Resend emails.
    this.app.post("/api/fleet/:fleetId/invite", async (req, res) => {
      if (
        !(await this.checkRateLimit(req, res, { bucket: "fleet", limit: 10 }))
      )
        return;
      const userId = await this.verifyAuthAndGetUserId(req, res);
      if (!userId) return;
      if (!this.postgres) {
        return res
          .status(503)
          .json({ error: "Fleet service unavailable (DB not configured)" });
      }
      const schema = z.object({
        invites: z
          .array(
            z.object({
              email: z.string().email(),
              name: z.string().min(1).max(120).optional(),
              role: z.string().max(40).optional(),
              permissions: z.record(z.string(), z.unknown()).optional(),
            }),
          )
          .min(1)
          .max(10),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res
          .status(400)
          .json({ error: "Validation failed", details: parsed.error.issues });
      }
      const { fleetId } = req.params;
      const { invites } = parsed.data;
      try {
        const access = await this.postgres.query(
          `SELECT role FROM fleet_members
             WHERE fleet_id = $1 AND user_id = $2 AND role = 'admin'`,
          [fleetId, userId],
        );
        if (access.rows.length === 0) {
          return res
            .status(403)
            .json({ error: "Admin access required to invite crew" });
        }

        // Enforce per-tier seat limits.
        const ownerSub = await this.getSubscription(userId);
        const seatLimit = getFleetSeatLimit(ownerSub?.tier ?? "free");
        if (seatLimit !== -1) {
          const memberCountResult = await this.postgres.query(
            "SELECT COUNT(*) AS count FROM fleet_members WHERE fleet_id = $1",
            [fleetId],
          );
          const currentMembers =
            parseInt(memberCountResult.rows[0]?.count ?? "0", 10) || 0;
          if (currentMembers + invites.length > seatLimit) {
            return res.status(403).json({
              error: `Fleet member limit reached (${seatLimit} seats on ${ownerSub?.tier ?? "free"} plan)`,
              upgradeUrl: "/pricing",
            });
          }
        }

        const fleetResult = await this.postgres.query(
          "SELECT name FROM fleets WHERE id = $1",
          [fleetId],
        );
        const fleetName = fleetResult.rows[0]?.name ?? "Fleet";

        const inviterResult = await this.postgres.query(
          "SELECT email, full_name FROM profiles WHERE id = $1",
          [userId],
        );
        const inviterName =
          inviterResult.rows[0]?.full_name ??
          inviterResult.rows[0]?.email ??
          "A fleet admin";

        const results: Array<{
          email: string;
          success: boolean;
          invitationId?: string;
          error?: string;
        }> = [];
        for (const invite of invites) {
          try {
            const token = crypto.randomBytes(32).toString("hex");
            const inviteResult = await this.postgres.query(
              `INSERT INTO fleet_invitations
                 (fleet_id, email, name, role, permissions, invited_by, token, expires_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, NOW() + INTERVAL '7 days')
               ON CONFLICT (fleet_id, email) DO UPDATE SET
                 name = EXCLUDED.name,
                 role = EXCLUDED.role,
                 permissions = EXCLUDED.permissions,
                 invited_by = EXCLUDED.invited_by,
                 token = EXCLUDED.token,
                 expires_at = NOW() + INTERVAL '7 days',
                 created_at = NOW()
               RETURNING id, token`,
              [
                fleetId,
                invite.email,
                invite.name ?? invite.email,
                invite.role ?? "crew",
                JSON.stringify(invite.permissions ?? {}),
                userId,
                token,
              ],
            );
            const invitationToken = inviteResult.rows[0].token;
            try {
              await emailService.sendFleetInvitationEmail(
                invite.email,
                invite.name ?? invite.email,
                fleetName,
                inviterName,
                invite.role ?? "crew",
                invitationToken,
              );
            } catch (emailErr) {
              logger.warn(
                { error: emailErr, email: invite.email },
                "Fleet invite created but email send failed",
              );
            }
            results.push({
              email: invite.email,
              success: true,
              invitationId: inviteResult.rows[0].id,
            });
          } catch (err) {
            logger.error({ err, email: invite.email }, "Invite insert failed");
            results.push({
              email: invite.email,
              success: false,
              error: "Failed to create invitation",
            });
          }
        }
        res.json({
          success: true,
          invitations: results,
          sent: results.filter((r) => r.success).length,
          failed: results.filter((r) => !r.success).length,
        });
      } catch (error) {
        logger.error({ error, userId, fleetId }, "Failed to send invitations");
        res.status(500).json({ error: "Failed to send invitations" });
      }
    });

    // POST /api/fleet/invitations/:token/accept — invited user clicks the
    // emailed link. Verifies the token belongs to the caller's email and
    // adds them to fleet_members.
    this.app.post("/api/fleet/invitations/:token/accept", async (req, res) => {
      if (
        !(await this.checkRateLimit(req, res, { bucket: "fleet", limit: 30 }))
      )
        return;
      const userId = await this.verifyAuthAndGetUserId(req, res);
      if (!userId) return;
      if (!this.postgres) {
        return res
          .status(503)
          .json({ error: "Fleet service unavailable (DB not configured)" });
      }
      const { token } = req.params;
      try {
        const inviteResult = await this.postgres.query(
          `SELECT fi.*, f.name AS fleet_name
             FROM fleet_invitations fi
             JOIN fleets f ON f.id = fi.fleet_id
             WHERE fi.token = $1
               AND fi.expires_at > NOW()
               AND fi.accepted_at IS NULL`,
          [token],
        );
        if (inviteResult.rows.length === 0) {
          return res
            .status(404)
            .json({ error: "Invitation not found or expired" });
        }
        const invite = inviteResult.rows[0];
        const userResult = await this.postgres.query(
          "SELECT email FROM profiles WHERE id = $1",
          [userId],
        );
        if (userResult.rows[0]?.email !== invite.email) {
          return res.status(403).json({
            error: "This invitation was sent to a different email address",
          });
        }
        await this.postgres.query(
          `INSERT INTO fleet_members (fleet_id, user_id, role)
             VALUES ($1, $2, $3)
             ON CONFLICT (fleet_id, user_id) DO UPDATE SET role = EXCLUDED.role`,
          [invite.fleet_id, userId, invite.role],
        );
        await this.postgres.query(
          `UPDATE fleet_invitations SET accepted_at = NOW() WHERE token = $1`,
          [token],
        );
        res.json({
          success: true,
          message: `Successfully joined ${invite.fleet_name}`,
          fleet: {
            id: invite.fleet_id,
            name: invite.fleet_name,
            role: invite.role,
          },
        });
      } catch (error) {
        logger.error({ error, userId, token }, "Failed to accept invitation");
        res.status(500).json({ error: "Failed to accept invitation" });
      }
    });

    // POST /api/fleet/invitations/:token/reject — delete the invitation.
    this.app.post("/api/fleet/invitations/:token/reject", async (req, res) => {
      if (
        !(await this.checkRateLimit(req, res, { bucket: "fleet", limit: 30 }))
      )
        return;
      const userId = await this.verifyAuthAndGetUserId(req, res);
      if (!userId) return;
      if (!this.postgres) {
        return res
          .status(503)
          .json({ error: "Fleet service unavailable (DB not configured)" });
      }
      const { token } = req.params;
      try {
        const inviteResult = await this.postgres.query(
          `SELECT fi.*, f.name AS fleet_name
             FROM fleet_invitations fi
             JOIN fleets f ON f.id = fi.fleet_id
             WHERE fi.token = $1
               AND fi.expires_at > NOW()
               AND fi.accepted_at IS NULL`,
          [token],
        );
        if (inviteResult.rows.length === 0) {
          return res
            .status(404)
            .json({ error: "Invitation not found or expired" });
        }
        const invite = inviteResult.rows[0];
        const userResult = await this.postgres.query(
          "SELECT email FROM profiles WHERE id = $1",
          [userId],
        );
        if (userResult.rows[0]?.email !== invite.email) {
          return res.status(403).json({
            error: "This invitation was sent to a different email address",
          });
        }
        await this.postgres.query(
          "DELETE FROM fleet_invitations WHERE token = $1",
          [token],
        );
        res.json({
          success: true,
          message: `Declined invitation to ${invite.fleet_name}`,
        });
      } catch (error) {
        logger.error({ error, userId, token }, "Failed to reject invitation");
        res.status(500).json({ error: "Failed to reject invitation" });
      }
    });

    // Geocoding — public endpoint, no auth required so the planner form
    // can autocomplete as the user types before they log in. Per-IP rate
    // limit at 60/min protects Nominatim's 1 req/sec ToS and keeps a
    // typing burst from getting our server IP banned upstream. The
    // GeocodingService already caches at 7-day TTL so repeated lookups
    // never touch the upstream at all.
    this.app.get("/api/geocode", async (req, res) => {
      if (
        !(await this.checkRateLimit(req, res, { bucket: "geocode", limit: 60 }))
      )
        return;
      const schema = z.object({
        q: z.string().min(2).max(120),
        limit: z.coerce.number().int().min(1).max(10).optional(),
      });
      const parsed = schema.safeParse(req.query);
      if (!parsed.success) {
        return res
          .status(400)
          .json({ error: "Invalid query", details: parsed.error.issues });
      }
      try {
        const results = await this.geocodingService.search(
          parsed.data.q,
          parsed.data.limit ?? 5,
        );
        res.json({ results });
      } catch (error) {
        logger.error({ error, query: parsed.data.q }, "Geocode failed");
        res.status(503).json({ error: "Geocode service unavailable" });
      }
    });

    // ------------------------------------------------------------------
    // Saved passages — minimal Redis-backed persistence so the planner can
    // surface a "Save Passage" action and the passages history page has
    // something real to render. Production should eventually back this with
    // PostgreSQL (the `saved_passages` migration is documented but pending)
    // — Redis is acceptable for now since saved plans are small JSON blobs
    // and the user-facing UX is unaffected by the storage tier.
    //
    // Auth model: passages are keyed by user id (extracted from JWT in
    // verifyAuth). Calls without a valid token are 401'd at verifyAuth
    // time, so reading "your" passages cannot see anyone else's.
    // ------------------------------------------------------------------
    const passagesKey = (userId: string) => `passages:user:${userId}`;
    const passageDetailKey = (userId: string, passageId: string) =>
      `passages:user:${userId}:${passageId}`;

    this.app.post("/api/passages", async (req, res) => {
      if (
        !(await this.checkRateLimit(req, res, {
          bucket: "passages",
          limit: 30,
        }))
      )
        return;
      const userId = await this.verifyAuthAndGetUserId(req, res);
      if (!userId) return; // 401 already sent

      if (!this.redis) {
        return res.status(503).json({
          error:
            "Persistence layer unavailable. Plan was generated but not saved.",
        });
      }

      const schema = z.object({
        name: z.string().min(1).max(200).optional(),
        plan: z.unknown(),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res
          .status(400)
          .json({ error: "Invalid passage", details: parsed.error.issues });
      }

      const passageId = uuidv4();
      const record = {
        id: passageId,
        userId,
        name: parsed.data.name ?? "Untitled passage",
        plan: parsed.data.plan,
        savedAt: new Date().toISOString(),
      };

      try {
        // Store the detail blob with a 1-year TTL (passages are reference
        // documents, not ephemeral data). Maintain a sorted set indexed by
        // save time so the list endpoint can paginate without scanning.
        await this.redis.set(
          passageDetailKey(userId, passageId),
          JSON.stringify(record),
          "EX",
          365 * 24 * 60 * 60,
        );
        await this.redis.zadd(passagesKey(userId), Date.now(), passageId);
        // Cap the per-user list at 100 to bound storage growth.
        await this.redis.zremrangebyrank(passagesKey(userId), 0, -101);

        // V3 — auto-seed a `departure` logbook entry so the passage's
        // logbook page is never empty. Fire-and-forget so a logbook write
        // failure cannot prevent the passage from saving.
        if (this.postgres) {
          this.autoSeedLogbookDeparture(
            userId,
            passageId,
            parsed.data.plan,
          ).catch((err) =>
            logger.warn(
              { err, userId, passageId },
              "Logbook departure auto-seed failed (passage still saved)",
            ),
          );
        }

        res.json({ success: true, passage: record });
      } catch (err) {
        logger.error({ err, userId }, "Failed to persist passage");
        res.status(500).json({ error: "Failed to save passage" });
      }
    });

    this.app.get("/api/passages", async (req, res) => {
      if (
        !(await this.checkRateLimit(req, res, {
          bucket: "passages",
          limit: 30,
        }))
      )
        return;
      const userId = await this.verifyAuthAndGetUserId(req, res);
      if (!userId) return;

      if (!this.redis) {
        return res.json({ passages: [] });
      }

      try {
        const ids = (await this.redis.zrevrange(
          passagesKey(userId),
          0,
          99,
        )) as string[];
        if (ids.length === 0) {
          return res.json({ passages: [] });
        }
        const keys = ids.map((id) => passageDetailKey(userId, id));
        const blobs = await this.redis.mget(...keys);
        const passages = blobs
          .filter((b): b is string => typeof b === "string")
          .map((b) => JSON.parse(b));
        res.json({ passages });
      } catch (err) {
        logger.error({ err, userId }, "Failed to list passages");
        res.status(500).json({ error: "Failed to list passages" });
      }
    });

    this.app.get("/api/passages/recent", async (req, res) => {
      if (
        !(await this.checkRateLimit(req, res, {
          bucket: "passages",
          limit: 30,
        }))
      )
        return;
      const userId = await this.verifyAuthAndGetUserId(req, res);
      if (!userId) return;
      if (!this.redis) return res.json({ passages: [] });

      const limit = Math.min(
        20,
        Math.max(1, parseInt((req.query.limit as string) || "5", 10) || 5),
      );

      try {
        const ids = (await this.redis.zrevrange(
          passagesKey(userId),
          0,
          limit - 1,
        )) as string[];
        if (ids.length === 0) return res.json({ passages: [] });
        const blobs = await this.redis.mget(
          ...ids.map((id) => passageDetailKey(userId, id)),
        );
        const passages = blobs
          .filter((b): b is string => typeof b === "string")
          .map((b) => JSON.parse(b));
        res.json({ passages });
      } catch (err) {
        logger.error({ err, userId }, "Failed to list recent passages");
        res.status(500).json({ error: "Failed to list recent passages" });
      }
    });

    this.app.delete("/api/passages/:id", async (req, res) => {
      if (
        !(await this.checkRateLimit(req, res, {
          bucket: "passages",
          limit: 30,
        }))
      )
        return;
      const userId = await this.verifyAuthAndGetUserId(req, res);
      if (!userId) return;
      if (!this.redis)
        return res.status(503).json({ error: "Persistence unavailable" });

      const passageId = req.params.id;
      try {
        // Best-effort: revoke any active share link first so its public URL
        // stops resolving immediately. Failure here is logged but does not
        // block the actual passage deletion.
        if (this.shareService) {
          try {
            await this.shareService.revoke(userId, passageId);
          } catch (err) {
            logger.warn(
              { err, userId, passageId },
              "Share revoke during passage delete failed",
            );
          }
        }
        await this.redis.del(passageDetailKey(userId, passageId));
        await this.redis.zrem(passagesKey(userId), passageId);
        res.json({ success: true });
      } catch (err) {
        logger.error({ err, userId, passageId }, "Failed to delete passage");
        res.status(500).json({ error: "Failed to delete passage" });
      }
    });

    // Reverse geocode — for when the user drops a pin on the map and the
    // planner wants to show "Cowes, UK" instead of bare coordinates.
    // Shares the `geocode` rate-limit bucket with forward geocode.
    // ------------------------------------------------------------------
    // Web Push (S3) — subscribe/unsubscribe + per-topic preferences.
    // The Service Worker (`frontend/public/sw.js`) handles the `push`
    // event and shows a notification; these endpoints are the missing
    // backend half: register the (endpoint, p256dh, auth) tuple under
    // the caller's account so future fanouts (R4 weather drift, S1
    // float plan delivery, S2 off-route alerts) can target them.
    // ------------------------------------------------------------------
    const pushSubSchema = z.object({
      endpoint: z.string().url(),
      keys: z.object({ p256dh: z.string().min(1), auth: z.string().min(1) }),
      topics: z.array(z.enum(PUSH_TOPICS)).optional(),
    });

    this.app.post("/api/push/subscribe", async (req, res) => {
      if (!(await this.checkRateLimit(req, res, { bucket: "push", limit: 30 })))
        return;
      const userId = await this.verifyAuthAndGetUserId(req, res);
      if (!userId) return;
      if (!this.pushService || !this.pushService.isEnabled()) {
        return res
          .status(503)
          .json({ error: "Push notifications not configured" });
      }
      const parsed = pushSubSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: "Invalid push subscription",
          details: parsed.error.issues,
        });
      }
      const { endpoint, keys, topics } = parsed.data;
      const requested = (topics ?? [
        "safety_alerts",
        "weather_updates",
        "passage_reminders",
      ]) as PushTopic[];
      try {
        // Zod has already enforced p256dh / auth as non-empty strings; narrow
        // here so the PushService input type stays strict.
        await this.pushService.upsertSubscription(
          userId,
          { endpoint, keys: { p256dh: keys.p256dh!, auth: keys.auth! } },
          requested,
          req.get("user-agent") ?? undefined,
        );
        res.status(201).json({ ok: true });
      } catch (error) {
        logger.error({ error, userId }, "Failed to save push subscription");
        res.status(500).json({ error: "Failed to save subscription" });
      }
    });

    this.app.delete("/api/push/subscribe", async (req, res) => {
      if (!(await this.checkRateLimit(req, res, { bucket: "push", limit: 30 })))
        return;
      const userId = await this.verifyAuthAndGetUserId(req, res);
      if (!userId) return;
      if (!this.pushService) {
        return res
          .status(503)
          .json({ error: "Push notifications not configured" });
      }
      const schema = z.object({ endpoint: z.string().url() });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Endpoint required" });
      }
      try {
        const removed = await this.pushService.deleteSubscription(
          userId,
          parsed.data.endpoint,
        );
        if (!removed) return res.status(404).json({ error: "Not found" });
        res.json({ ok: true });
      } catch (error) {
        logger.error({ error, userId }, "Failed to delete push subscription");
        res.status(500).json({ error: "Failed to delete subscription" });
      }
    });

    this.app.get("/api/push/preferences", async (req, res) => {
      if (!(await this.checkRateLimit(req, res, { bucket: "push", limit: 60 })))
        return;
      const userId = await this.verifyAuthAndGetUserId(req, res);
      if (!userId) return;
      if (!this.pushService) {
        return res.status(503).json({ error: "Push not configured" });
      }
      try {
        const subscriptions = await this.pushService.listSubscriptions(userId);
        res.json({
          enabled: this.pushService.isEnabled(),
          availableTopics: PUSH_TOPICS,
          subscriptions,
        });
      } catch (error) {
        logger.error({ error, userId }, "Failed to list push subscriptions");
        res.status(500).json({ error: "Failed to load preferences" });
      }
    });

    this.app.put("/api/push/preferences", async (req, res) => {
      if (!(await this.checkRateLimit(req, res, { bucket: "push", limit: 30 })))
        return;
      const userId = await this.verifyAuthAndGetUserId(req, res);
      if (!userId) return;
      if (!this.pushService) {
        return res.status(503).json({ error: "Push not configured" });
      }
      const schema = z.object({
        topics: z.array(z.enum(PUSH_TOPICS)).min(1),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res
          .status(400)
          .json({ error: "Invalid topics", details: parsed.error.issues });
      }
      try {
        const updated = await this.pushService.updateUserTopics(
          userId,
          parsed.data.topics,
        );
        res.json({ ok: true, updated });
      } catch (error) {
        logger.error({ error, userId }, "Failed to update push preferences");
        res.status(500).json({ error: "Failed to update preferences" });
      }
    });

    // ------------------------------------------------------------------
    // Float plans (S1) — emergency contact CRUD + PDF-email delivery.
    //
    // Contacts: max 5 per user, DB-enforced via trigger. PII (email/phone)
    // never logged.
    //
    // Send flow: load passage from Redis → render PDF → email each chosen
    // recipient via Resend with the PDF attached → write an append-only
    // float_plans row capturing recipients + delivery status. Per-recipient
    // failures are surfaced; one bad address does not cancel delivery to the
    // other recipients.
    // ------------------------------------------------------------------
    const contactSchema = z.object({
      name: z.string().min(1).max(100),
      email: z.string().email().max(254),
      phone: z.string().max(40).optional(),
      relationship: z.string().max(50).optional(),
      notify_on_overdue: z.boolean().optional(),
    });

    this.app.get("/api/float-plan-contacts", async (req, res) => {
      if (
        !(await this.checkRateLimit(req, res, {
          bucket: "float-plan-contacts",
          limit: 60,
        }))
      )
        return;
      const userId = await this.verifyAuthAndGetUserId(req, res);
      if (!userId) return;
      if (!this.postgres) {
        return res.status(503).json({ error: "DB unavailable" });
      }
      try {
        const result = await this.postgres.query(
          `SELECT id, name, email, phone, relationship, notify_on_overdue,
                  created_at, updated_at
             FROM float_plan_contacts
             WHERE user_id = $1
             ORDER BY created_at ASC`,
          [userId],
        );
        res.json({ contacts: result.rows });
      } catch (error) {
        logger.error({ error, userId }, "Failed to list float plan contacts");
        res.status(500).json({ error: "Failed to list contacts" });
      }
    });

    this.app.post("/api/float-plan-contacts", async (req, res) => {
      if (
        !(await this.checkRateLimit(req, res, {
          bucket: "float-plan-contacts",
          limit: 20,
        }))
      )
        return;
      const userId = await this.verifyAuthAndGetUserId(req, res);
      if (!userId) return;
      if (!this.postgres) {
        return res.status(503).json({ error: "DB unavailable" });
      }
      const parsed = contactSchema.safeParse(req.body);
      if (!parsed.success) {
        return res
          .status(400)
          .json({ error: "Invalid contact", details: parsed.error.issues });
      }
      const { name, email, phone, relationship, notify_on_overdue } =
        parsed.data;
      try {
        const result = await this.postgres.query(
          `INSERT INTO float_plan_contacts
             (user_id, name, email, phone, relationship, notify_on_overdue)
           VALUES ($1, $2, $3, $4, $5, COALESCE($6, TRUE))
           RETURNING id, name, email, phone, relationship, notify_on_overdue,
                     created_at, updated_at`,
          [
            userId,
            name,
            email,
            phone ?? null,
            relationship ?? null,
            notify_on_overdue ?? null,
          ],
        );
        res.status(201).json({ contact: result.rows[0] });
      } catch (error) {
        const msg = (error as Error).message ?? String(error);
        if (msg.includes("Maximum 5 emergency contacts")) {
          return res
            .status(409)
            .json({ error: "Maximum 5 emergency contacts per user" });
        }
        if (msg.includes("float_plan_contacts_email_format")) {
          return res.status(400).json({ error: "Invalid email format" });
        }
        logger.error({ error, userId }, "Failed to create float plan contact");
        res.status(500).json({ error: "Failed to create contact" });
      }
    });

    this.app.put("/api/float-plan-contacts/:id", async (req, res) => {
      if (
        !(await this.checkRateLimit(req, res, {
          bucket: "float-plan-contacts",
          limit: 30,
        }))
      )
        return;
      const userId = await this.verifyAuthAndGetUserId(req, res);
      if (!userId) return;
      if (!this.postgres) {
        return res.status(503).json({ error: "DB unavailable" });
      }
      const parsed = contactSchema.partial().safeParse(req.body);
      if (!parsed.success) {
        return res
          .status(400)
          .json({ error: "Invalid contact", details: parsed.error.issues });
      }
      try {
        const result = await this.postgres.query(
          `UPDATE float_plan_contacts
             SET name = COALESCE($3, name),
                 email = COALESCE($4, email),
                 phone = COALESCE($5, phone),
                 relationship = COALESCE($6, relationship),
                 notify_on_overdue = COALESCE($7, notify_on_overdue),
                 updated_at = NOW()
             WHERE id = $1 AND user_id = $2
             RETURNING id, name, email, phone, relationship, notify_on_overdue,
                       created_at, updated_at`,
          [
            req.params.id,
            userId,
            parsed.data.name ?? null,
            parsed.data.email ?? null,
            parsed.data.phone ?? null,
            parsed.data.relationship ?? null,
            parsed.data.notify_on_overdue ?? null,
          ],
        );
        if (!result.rows[0])
          return res.status(404).json({ error: "Not found" });
        res.json({ contact: result.rows[0] });
      } catch (error) {
        logger.error({ error, userId }, "Failed to update float plan contact");
        res.status(500).json({ error: "Failed to update contact" });
      }
    });

    this.app.delete("/api/float-plan-contacts/:id", async (req, res) => {
      if (
        !(await this.checkRateLimit(req, res, {
          bucket: "float-plan-contacts",
          limit: 30,
        }))
      )
        return;
      const userId = await this.verifyAuthAndGetUserId(req, res);
      if (!userId) return;
      if (!this.postgres) {
        return res.status(503).json({ error: "DB unavailable" });
      }
      try {
        const result = await this.postgres.query(
          `DELETE FROM float_plan_contacts WHERE id = $1 AND user_id = $2`,
          [req.params.id, userId],
        );
        if ((result.rowCount ?? 0) === 0) {
          return res.status(404).json({ error: "Not found" });
        }
        res.json({ ok: true });
      } catch (error) {
        logger.error({ error, userId }, "Failed to delete float plan contact");
        res.status(500).json({ error: "Failed to delete contact" });
      }
    });

    // Send a float plan for a saved passage. Body may specify
    // `recipientIds: string[]` to scope delivery; otherwise every contact is
    // notified. Returns per-recipient outcome so the UI can tell the user that
    // 2/3 succeeded and the third bounced.
    const sendFloatPlanSchema = z.object({
      recipientIds: z.array(z.string().uuid()).optional(),
    });

    this.app.post("/api/passages/:id/float-plan", async (req, res) => {
      if (
        !(await this.checkRateLimit(req, res, {
          bucket: "float-plan-send",
          limit: 10,
        }))
      )
        return;
      const userId = await this.verifyAuthAndGetUserId(req, res);
      if (!userId) return;
      if (!this.postgres || !this.redis) {
        return res
          .status(503)
          .json({ error: "Storage unavailable — cannot send float plan" });
      }
      const parsed = sendFloatPlanSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        return res
          .status(400)
          .json({ error: "Invalid body", details: parsed.error.issues });
      }
      const passageId = req.params.id;

      // 1. Load the saved passage from Redis.
      const passageKey = `passages:user:${userId}:${passageId}`;
      let passageRecord: { name?: string; plan: unknown } | null = null;
      try {
        const blob = await this.redis.get(passageKey);
        if (!blob) {
          return res.status(404).json({ error: "Passage not found" });
        }
        passageRecord = JSON.parse(blob);
      } catch (error) {
        logger.error({ error, userId, passageId }, "Failed to load passage");
        return res.status(500).json({ error: "Failed to load passage" });
      }

      // 2. Load contacts (filtered by recipientIds if supplied).
      let contacts: Array<{
        id: string;
        name: string;
        email: string;
        phone: string | null;
        relationship: string | null;
      }>;
      try {
        const ids = parsed.data.recipientIds;
        if (ids && ids.length > 0) {
          const result = await this.postgres.query(
            `SELECT id, name, email, phone, relationship
               FROM float_plan_contacts
               WHERE user_id = $1 AND id = ANY($2::uuid[])`,
            [userId, ids],
          );
          contacts = result.rows;
        } else {
          const result = await this.postgres.query(
            `SELECT id, name, email, phone, relationship
               FROM float_plan_contacts
               WHERE user_id = $1
               ORDER BY created_at ASC`,
            [userId],
          );
          contacts = result.rows;
        }
      } catch (error) {
        logger.error({ error, userId }, "Failed to load contacts");
        return res.status(500).json({ error: "Failed to load contacts" });
      }
      if (contacts.length === 0) {
        return res.status(400).json({
          error:
            "No emergency contacts on file. Add at least one before sending a float plan.",
        });
      }

      // 3. Load sender profile (name + email for the PDF + email body).
      let sender = {
        name: "Helmwise user",
        email: "",
        phone: null as string | null,
      };
      try {
        const profile = await this.postgres.query(
          `SELECT email, full_name, phone FROM profiles WHERE id = $1`,
          [userId],
        );
        if (profile.rows[0]) {
          sender = {
            name:
              profile.rows[0].full_name ||
              profile.rows[0].email ||
              "Helmwise user",
            email: profile.rows[0].email ?? "",
            phone: profile.rows[0].phone ?? null,
          };
        }
      } catch (error) {
        // Sender profile is optional — fall through with defaults rather than
        // blocking a safety-critical send because of a profile read hiccup.
        logger.warn({ error, userId }, "Sender profile lookup failed");
      }

      // 4. Build the PDF input by introspecting whatever shape the planner
      //    saved into Redis. Defensive: missing fields render as "—" rather
      //    than crashing the PDF.
      const pdfInput = this.buildFloatPlanInput(
        sender,
        passageRecord,
        contacts,
      );
      let pdfBuffer: Buffer;
      try {
        pdfBuffer = await this.floatPlanPdf.render(pdfInput);
      } catch (error) {
        logger.error(
          { error, userId, passageId },
          "Float plan PDF render failed",
        );
        return res.status(500).json({ error: "Failed to generate PDF" });
      }

      // 5. Send per recipient; collect outcomes.
      const deliveryStatus: Record<
        string,
        { ok: boolean; resendId?: string; error?: string }
      > = {};
      await Promise.all(
        contacts.map(async (contact) => {
          try {
            const { id: resendId } = await emailService.sendFloatPlanEmail({
              to: contact.email,
              recipientName: contact.name,
              senderName: sender.name,
              vesselName: pdfInput.vessel.name ?? "Vessel",
              departurePort: pdfInput.passage.departure_port ?? "—",
              destinationPort: pdfInput.passage.destination_port ?? "—",
              eta: pdfInput.passage.eta ?? "—",
              pdfBuffer,
            });
            deliveryStatus[contact.id] = { ok: true, resendId };
          } catch (error) {
            deliveryStatus[contact.id] = {
              ok: false,
              error: (error as Error).message ?? "Send failed",
            };
            logger.error(
              { error, userId, contactId: contact.id },
              "Float plan delivery failed for contact",
            );
          }
        }),
      );

      const anySent = Object.values(deliveryStatus).some((s) => s.ok);
      const sentAt = anySent ? new Date() : null;

      // 6. Append audit row (immutable per RLS — no UPDATE policy).
      try {
        const insert = await this.postgres.query(
          `INSERT INTO float_plans
             (user_id, passage_id, generated_at, sent_at, recipients,
              delivery_status, snapshot)
           VALUES ($1, $2, NOW(), $3, $4::jsonb, $5::jsonb, $6::jsonb)
           RETURNING id, generated_at, sent_at`,
          [
            userId,
            passageId,
            sentAt,
            JSON.stringify(
              contacts.map((c) => ({
                contact_id: c.id,
                name: c.name,
                email: c.email,
                relationship: c.relationship,
              })),
            ),
            JSON.stringify(deliveryStatus),
            JSON.stringify(pdfInput),
          ],
        );
        res.json({
          floatPlanId: insert.rows[0].id,
          generatedAt: insert.rows[0].generated_at,
          sentAt: insert.rows[0].sent_at,
          deliveryStatus,
        });
      } catch (error) {
        logger.error({ error, userId }, "Failed to record float plan");
        // Email may already have gone out — surface partial success.
        res.status(500).json({
          error: "Float plan sent but audit record failed to save",
          deliveryStatus,
        });
      }
    });

    this.app.get("/api/passages/:id/float-plan", async (req, res) => {
      if (
        !(await this.checkRateLimit(req, res, {
          bucket: "float-plan-history",
          limit: 60,
        }))
      )
        return;
      const userId = await this.verifyAuthAndGetUserId(req, res);
      if (!userId) return;
      if (!this.postgres) {
        return res.status(503).json({ error: "DB unavailable" });
      }
      try {
        const result = await this.postgres.query(
          `SELECT id, generated_at, sent_at, recipients, delivery_status
             FROM float_plans
             WHERE user_id = $1 AND passage_id = $2
             ORDER BY generated_at DESC`,
          [userId, req.params.id],
        );
        res.json({ history: result.rows });
      } catch (error) {
        logger.error({ error, userId }, "Failed to list float plan history");
        res.status(500).json({ error: "Failed to load history" });
      }
    });

    // ------------------------------------------------------------------
    // Logbook entries (V3) — append-only per-passage log
    //
    // Insert is Premium-gated. Read + delete are open to all tiers so a
    // downgraded user can still access (and PDF-export) their history.
    // DELETE is only allowed within 5 minutes of recorded_at (typo undo) —
    // maritime tradition is no-edit; corrections are made by appending new
    // entries. UPDATE has no endpoint at all.
    // ------------------------------------------------------------------
    const LOGBOOK_TYPES = [
      "departure",
      "arrival",
      "position",
      "watch_handover",
      "weather",
      "engine",
      "fuel",
      "event",
      "note",
    ] as const;
    const logbookEntrySchema = z.object({
      entry_type: z.enum(LOGBOOK_TYPES),
      occurred_at: z.string().datetime(),
      recorded_by: z.string().max(100).optional(),
      position_lat: z.number().min(-90).max(90).nullable().optional(),
      position_lon: z.number().min(-180).max(180).nullable().optional(),
      conditions: z.record(z.string(), z.unknown()).optional(),
      notes: z.string().max(4000).optional(),
      vessel_id: z.string().uuid().optional(),
    });

    this.app.get("/api/passages/:id/logbook", async (req, res) => {
      if (
        !(await this.checkRateLimit(req, res, {
          bucket: "logbook",
          limit: 60,
        }))
      )
        return;
      const userId = await this.verifyAuthAndGetUserId(req, res);
      if (!userId) return;
      if (!this.postgres)
        return res.status(503).json({ error: "DB unavailable" });
      try {
        const result = await this.postgres.query(
          `SELECT id, passage_id, vessel_id, entry_type, occurred_at,
                  recorded_at, recorded_by, position_lat, position_lon,
                  conditions, notes
             FROM logbook_entries
             WHERE user_id = $1 AND passage_id = $2
             ORDER BY occurred_at ASC, recorded_at ASC`,
          [userId, req.params.id],
        );
        res.json({ entries: result.rows });
      } catch (error) {
        logger.error({ error, userId }, "Failed to list logbook entries");
        res.status(500).json({ error: "Failed to list entries" });
      }
    });

    this.app.post("/api/passages/:id/logbook", async (req, res) => {
      if (
        !(await this.checkRateLimit(req, res, {
          bucket: "logbook",
          limit: 60,
        }))
      )
        return;
      const userId = await this.verifyAuthAndGetUserId(req, res);
      if (!userId) return;
      if (!this.postgres)
        return res.status(503).json({ error: "DB unavailable" });
      if (!(await this.isPremiumOrAbove(userId))) {
        return res.status(403).json({
          error: "Logbook entries require Premium",
          upgradeRequired: true,
        });
      }
      const parsed = logbookEntrySchema.safeParse(req.body);
      if (!parsed.success) {
        return res
          .status(400)
          .json({ error: "Invalid entry", details: parsed.error.issues });
      }
      try {
        const result = await this.postgres.query(
          `INSERT INTO logbook_entries
             (user_id, passage_id, vessel_id, entry_type, occurred_at,
              recorded_by, position_lat, position_lon, conditions, notes)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10)
           RETURNING id, passage_id, vessel_id, entry_type, occurred_at,
                     recorded_at, recorded_by, position_lat, position_lon,
                     conditions, notes`,
          [
            userId,
            req.params.id,
            parsed.data.vessel_id ?? null,
            parsed.data.entry_type,
            parsed.data.occurred_at,
            parsed.data.recorded_by ?? null,
            parsed.data.position_lat ?? null,
            parsed.data.position_lon ?? null,
            JSON.stringify(parsed.data.conditions ?? {}),
            parsed.data.notes ?? null,
          ],
        );
        res.status(201).json({ entry: result.rows[0] });
      } catch (error) {
        logger.error({ error, userId }, "Failed to insert logbook entry");
        res.status(500).json({ error: "Failed to insert entry" });
      }
    });

    this.app.delete("/api/passages/:id/logbook/:entryId", async (req, res) => {
      if (
        !(await this.checkRateLimit(req, res, {
          bucket: "logbook",
          limit: 30,
        }))
      )
        return;
      const userId = await this.verifyAuthAndGetUserId(req, res);
      if (!userId) return;
      if (!this.postgres)
        return res.status(503).json({ error: "DB unavailable" });
      try {
        // Typo-undo window: 5 minutes from recorded_at. Past that, deletes
        // are denied — the logbook is append-only by maritime tradition.
        const result = await this.postgres.query(
          `DELETE FROM logbook_entries
               WHERE id = $1
                 AND user_id = $2
                 AND passage_id = $3
                 AND recorded_at > NOW() - INTERVAL '5 minutes'`,
          [req.params.entryId, userId, req.params.id],
        );
        if ((result.rowCount ?? 0) === 0) {
          return res.status(403).json({
            error:
              "Entry not found or older than 5 minutes (logbook is append-only after that).",
          });
        }
        res.json({ ok: true });
      } catch (error) {
        logger.error({ error, userId }, "Failed to delete logbook entry");
        res.status(500).json({ error: "Failed to delete entry" });
      }
    });

    this.app.get("/api/passages/:id/logbook/pdf", async (req, res) => {
      if (
        !(await this.checkRateLimit(req, res, {
          bucket: "logbook-pdf",
          limit: 20,
        }))
      )
        return;
      const userId = await this.verifyAuthAndGetUserId(req, res);
      if (!userId) return;
      if (!this.postgres || !this.redis) {
        return res
          .status(503)
          .json({ error: "Storage unavailable — cannot render logbook PDF" });
      }
      try {
        const entriesQuery = await this.postgres.query(
          `SELECT id, passage_id, entry_type, occurred_at, recorded_at,
                  recorded_by, position_lat, position_lon, conditions, notes
             FROM logbook_entries
             WHERE user_id = $1 AND passage_id = $2
             ORDER BY occurred_at ASC, recorded_at ASC`,
          [userId, req.params.id],
        );
        const passageBlob = await this.redis.get(
          `passages:user:${userId}:${req.params.id}`,
        );
        const passage = passageBlob
          ? (JSON.parse(passageBlob) as {
              name?: string;
              plan?: { request?: any; route?: any };
            })
          : null;
        const buffer = await this.logbookPdf.render({
          vesselName: passage?.plan?.request?.vessel?.name ?? "Vessel",
          passageName: passage?.name ?? "Passage",
          departurePort: passage?.plan?.request?.departure?.name ?? "—",
          destinationPort: passage?.plan?.request?.destination?.name ?? "—",
          distanceNm:
            typeof passage?.plan?.route?.totalDistance === "number"
              ? passage.plan.route.totalDistance
              : null,
          entries: entriesQuery.rows,
          generatedAt: new Date(),
        });
        res.set("Content-Type", "application/pdf");
        res.set(
          "Content-Disposition",
          `attachment; filename="logbook-${req.params.id}.pdf"`,
        );
        res.send(buffer);
      } catch (error) {
        logger.error({ error, userId }, "Failed to render logbook PDF");
        res.status(500).json({ error: "Failed to render PDF" });
      }
    });

    // ------------------------------------------------------------------
    // Public share links (S4)
    //
    // Premium-only. Three owner-facing endpoints (status/create/revoke) +
    // one PUBLIC read endpoint (no auth). The public endpoint returns a
    // strictly-redacted payload — vessel identifiers (MMSI/EPIRB/InReach),
    // owner email, and crew medical notes are stripped before the response
    // leaves the server. See ShareService#redact for the allow-list.
    // ------------------------------------------------------------------
    const createShareSchema = z.object({
      expiresInDays: z
        .number()
        .int()
        .min(1)
        .max(SHARE_MAX_EXPIRY_DAYS)
        .optional(),
    });

    // Premium tier check — returns the user's tier or sends a 402-style
    // response and returns null. Premium and above can share links; free
    // users hit a paywall prompt.
    const requirePremiumTier = async (
      req: express.Request,
      res: express.Response,
      userId: string,
    ): Promise<string | null> => {
      if (!this.postgres) {
        // If profiles can't be checked, fail closed rather than open — a
        // share link is a security-sensitive resource.
        res.status(503).json({ error: "Tier check unavailable" });
        return null;
      }
      try {
        const result = await this.postgres.query(
          `SELECT subscription_tier FROM profiles WHERE id = $1`,
          [userId],
        );
        const tier = (result.rows[0]?.subscription_tier ?? "free") as string;
        if (tier === "free") {
          res.status(403).json({
            error: "Share links require a Premium subscription",
            upgradeRequired: true,
          });
          return null;
        }
        return tier;
      } catch (error) {
        logger.error({ error, userId }, "Tier check failed");
        res.status(500).json({ error: "Tier check failed" });
        return null;
      }
    };

    this.app.get("/api/passages/:id/share", async (req, res) => {
      if (
        !(await this.checkRateLimit(req, res, { bucket: "share", limit: 60 }))
      )
        return;
      const userId = await this.verifyAuthAndGetUserId(req, res);
      if (!userId) return;
      if (!this.shareService) {
        return res.status(503).json({ error: "Share service unavailable" });
      }
      try {
        const meta = await this.shareService.getStatus(userId, req.params.id);
        if (!meta) return res.json({ share: null });
        res.json({
          share: meta,
          url: this.shareUrl(meta.token),
        });
      } catch (error) {
        logger.error(
          { error, userId, passageId: req.params.id },
          "Failed to load share status",
        );
        res.status(500).json({ error: "Failed to load share status" });
      }
    });

    this.app.post("/api/passages/:id/share", async (req, res) => {
      if (
        !(await this.checkRateLimit(req, res, { bucket: "share", limit: 20 }))
      )
        return;
      const userId = await this.verifyAuthAndGetUserId(req, res);
      if (!userId) return;
      if (!this.shareService) {
        return res.status(503).json({ error: "Share service unavailable" });
      }
      const tier = await requirePremiumTier(req, res, userId);
      if (!tier) return;
      const parsed = createShareSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        return res
          .status(400)
          .json({ error: "Invalid body", details: parsed.error.issues });
      }
      const expiresInDays =
        parsed.data.expiresInDays ?? SHARE_DEFAULT_EXPIRY_DAYS;
      try {
        const meta = await this.shareService.createOrRotate(
          userId,
          req.params.id,
          expiresInDays,
        );
        res.status(201).json({
          share: meta,
          url: this.shareUrl(meta.token),
        });
      } catch (error) {
        const msg = (error as Error).message ?? String(error);
        if (msg === "PASSAGE_NOT_FOUND") {
          return res.status(404).json({ error: "Passage not found" });
        }
        logger.error(
          { error, userId, passageId: req.params.id },
          "Failed to create share link",
        );
        res.status(500).json({ error: "Failed to create share link" });
      }
    });

    this.app.delete("/api/passages/:id/share", async (req, res) => {
      if (
        !(await this.checkRateLimit(req, res, { bucket: "share", limit: 30 }))
      )
        return;
      const userId = await this.verifyAuthAndGetUserId(req, res);
      if (!userId) return;
      if (!this.shareService) {
        return res.status(503).json({ error: "Share service unavailable" });
      }
      try {
        const revoked = await this.shareService.revoke(userId, req.params.id);
        // 200 even when nothing to revoke — the caller's desired state
        // ("no share link active") is achieved either way.
        res.json({ ok: true, revoked });
      } catch (error) {
        logger.error(
          { error, userId, passageId: req.params.id },
          "Failed to revoke share link",
        );
        res.status(500).json({ error: "Failed to revoke share link" });
      }
    });

    // PUBLIC read endpoint — no auth required, IP rate-limited. Returns a
    // redacted payload; 404 for missing/revoked tokens (revoked and never-
    // existed look identical to a guesser by design).
    this.app.get("/api/share/:token", async (req, res) => {
      if (
        !(await this.checkRateLimit(req, res, {
          bucket: "share-public",
          limit: 60,
        }))
      )
        return;
      if (!this.shareService) {
        return res.status(503).json({ error: "Share service unavailable" });
      }
      try {
        const result = await this.shareService.lookupByToken(req.params.token);
        if (!result) {
          return res
            .status(404)
            .json({ error: "Share link not found or expired" });
        }
        // Hint search engines + CDNs not to cache the redacted payload too
        // aggressively — viewCount is updated per-request.
        res.set("Cache-Control", "private, max-age=60");
        res.set("X-Robots-Tag", "noindex, nofollow");
        res.json(result.payload);
      } catch (error) {
        logger.error(
          { error, token: req.params.token },
          "Public share lookup failed",
        );
        res.status(500).json({ error: "Failed to load shared passage" });
      }
    });

    // ------------------------------------------------------------------
    // Sat-comm devices (S2) — Pro tier only.
    //
    // Owner-facing device CRUD + position history + manual position
    // injection. The webhook ingestion endpoint is registered separately
    // (registerSatCommWebhookEarly) so the global JSON parser doesn't
    // touch the body before HMAC verification.
    // ------------------------------------------------------------------
    const requireProTier = async (
      req: express.Request,
      res: express.Response,
      userId: string,
    ): Promise<string | null> => {
      if (!this.postgres) {
        res.status(503).json({ error: "Tier check unavailable" });
        return null;
      }
      try {
        const result = await this.postgres.query(
          `SELECT subscription_tier FROM profiles WHERE id = $1`,
          [userId],
        );
        const tier = (result.rows[0]?.subscription_tier ?? "free") as string;
        if (tier !== "pro" && tier !== "enterprise") {
          res.status(403).json({
            error: "Sat-comm position reporting requires a Pro subscription",
            upgradeRequired: true,
          });
          return null;
        }
        return tier;
      } catch (error) {
        logger.error({ error, userId }, "Tier check failed");
        res.status(500).json({ error: "Tier check failed" });
        return null;
      }
    };

    const deviceCreateSchema = z.object({
      vendor: z.enum(["generic", "garmin_inreach", "iridiumgo", "yb_tracking"]),
      device_id: z.string().min(1).max(200),
      nickname: z.string().max(100).optional(),
    });

    this.app.get("/api/sat-comm/devices", async (req, res) => {
      if (
        !(await this.checkRateLimit(req, res, {
          bucket: "satcomm-devices",
          limit: 60,
        }))
      )
        return;
      const userId = await this.verifyAuthAndGetUserId(req, res);
      if (!userId) return;
      if (!this.satCommService) {
        return res.status(503).json({ error: "Sat-comm unavailable" });
      }
      try {
        const devices = await this.satCommService.listDevices(userId);
        // Strip webhook_secret from the list — it's shown ONCE on create and
        // not exposed thereafter (rotate-by-recreate semantics).
        res.json({
          devices: devices.map((d) => ({
            ...d,
            webhook_secret: undefined,
          })),
        });
      } catch (error) {
        logger.error({ error, userId }, "Failed to list sat-comm devices");
        res.status(500).json({ error: "Failed to list devices" });
      }
    });

    this.app.post("/api/sat-comm/devices", async (req, res) => {
      if (
        !(await this.checkRateLimit(req, res, {
          bucket: "satcomm-devices",
          limit: 10,
        }))
      )
        return;
      const userId = await this.verifyAuthAndGetUserId(req, res);
      if (!userId) return;
      if (!this.satCommService) {
        return res.status(503).json({ error: "Sat-comm unavailable" });
      }
      const tier = await requireProTier(req, res, userId);
      if (!tier) return;
      const parsed = deviceCreateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: "Invalid device",
          details: parsed.error.issues,
        });
      }
      try {
        const device = await this.satCommService.createDevice({
          userId,
          vendor: parsed.data.vendor,
          deviceId: parsed.data.device_id,
          nickname: parsed.data.nickname,
        });
        const base = (
          process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080"
        ).replace(/\/+$/, "");
        // 201 with the secret EXPOSED exactly once — the UI must capture it
        // and instruct the user to store it. Subsequent reads omit it.
        res.status(201).json({
          device,
          webhookUrl: `${base}/api/sat-comm/${device.vendor}/webhook?device=${encodeURIComponent(device.device_id)}`,
        });
      } catch (error) {
        const msg = (error as Error).message ?? String(error);
        if (msg.includes("sat_comm_devices_vendor_device_unique")) {
          return res.status(409).json({
            error: "Device already registered to another account",
          });
        }
        logger.error({ error, userId }, "Failed to create sat-comm device");
        res.status(500).json({ error: "Failed to create device" });
      }
    });

    this.app.delete("/api/sat-comm/devices/:id", async (req, res) => {
      if (
        !(await this.checkRateLimit(req, res, {
          bucket: "satcomm-devices",
          limit: 30,
        }))
      )
        return;
      const userId = await this.verifyAuthAndGetUserId(req, res);
      if (!userId) return;
      if (!this.satCommService) {
        return res.status(503).json({ error: "Sat-comm unavailable" });
      }
      try {
        const ok = await this.satCommService.deleteDevice(
          userId,
          req.params.id,
        );
        if (!ok) return res.status(404).json({ error: "Not found" });
        res.json({ ok: true });
      } catch (error) {
        logger.error({ error, userId }, "Failed to delete sat-comm device");
        res.status(500).json({ error: "Failed to delete device" });
      }
    });

    this.app.get("/api/sat-comm/devices/:id/positions", async (req, res) => {
      if (
        !(await this.checkRateLimit(req, res, {
          bucket: "satcomm-positions",
          limit: 60,
        }))
      )
        return;
      const userId = await this.verifyAuthAndGetUserId(req, res);
      if (!userId) return;
      if (!this.satCommService) {
        return res.status(503).json({ error: "Sat-comm unavailable" });
      }
      const device = await this.satCommService.getDeviceForOwner(
        userId,
        req.params.id,
      );
      if (!device) return res.status(404).json({ error: "Not found" });
      try {
        const positions = await this.satCommService.listLatestPositions(
          device.id,
          100,
        );
        res.json({ positions });
      } catch (error) {
        logger.error({ error, userId }, "Failed to list positions");
        res.status(500).json({ error: "Failed to load positions" });
      }
    });

    this.app.delete("/api/sat-comm/devices/:id/positions", async (req, res) => {
      if (
        !(await this.checkRateLimit(req, res, {
          bucket: "satcomm-positions",
          limit: 10,
        }))
      )
        return;
      const userId = await this.verifyAuthAndGetUserId(req, res);
      if (!userId) return;
      if (!this.satCommService) {
        return res.status(503).json({ error: "Sat-comm unavailable" });
      }
      const device = await this.satCommService.getDeviceForOwner(
        userId,
        req.params.id,
      );
      if (!device) return res.status(404).json({ error: "Not found" });
      try {
        const purged = await this.satCommService.purgePositionReports(
          device.id,
        );
        res.json({ ok: true, purged });
      } catch (error) {
        logger.error({ error, userId }, "Failed to purge positions");
        res.status(500).json({ error: "Failed to purge positions" });
      }
    });

    // Manual position injection — owner-only. Lets users without a supported
    // sat-comm device test the off-route alert pipeline.
    const testPositionSchema = z.object({
      lat: z.number().min(-90).max(90),
      lon: z.number().min(-180).max(180),
      speed_kn: z.number().min(0).max(200).optional(),
      course_deg: z.number().min(0).max(360).optional(),
      battery_pct: z.number().int().min(0).max(100).optional(),
      message_text: z.string().max(1000).optional(),
    });

    this.app.post(
      "/api/sat-comm/devices/:id/test-position",
      async (req, res) => {
        if (
          !(await this.checkRateLimit(req, res, {
            bucket: "satcomm-positions",
            limit: 30,
          }))
        )
          return;
        const userId = await this.verifyAuthAndGetUserId(req, res);
        if (!userId) return;
        if (!this.satCommService) {
          return res.status(503).json({ error: "Sat-comm unavailable" });
        }
        const device = await this.satCommService.getDeviceForOwner(
          userId,
          req.params.id,
        );
        if (!device) return res.status(404).json({ error: "Not found" });
        const parsed = testPositionSchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({
            error: "Invalid position",
            details: parsed.error.issues,
          });
        }
        try {
          const result = await this.satCommService.ingestPosition(device, {
            deviceId: device.id,
            reportedAt: new Date(),
            lat: parsed.data.lat,
            lon: parsed.data.lon,
            speedKn: parsed.data.speed_kn,
            courseDeg: parsed.data.course_deg,
            batteryPct: parsed.data.battery_pct,
            messageText: parsed.data.message_text,
            rawPayload: { source: "manual_test", body: parsed.data },
          });
          res.json({ ok: true, ...result });
        } catch (error) {
          logger.error({ error, userId }, "Test position ingest failed");
          res.status(500).json({ error: "Failed to ingest position" });
        }
      },
    );

    // ------------------------------------------------------------------
    // Vessel maintenance (V2) — Premium tier, hard-gated.
    //
    // Two-table CRUD:
    //   /api/vessels                         (list + create)
    //   /api/vessels/:id                     (update + delete)
    //   /api/vessels/:id/hours               (PUT — captain updates meters)
    //   /api/vessels/:id/maintenance         (list + create item)
    //   /api/vessels/:id/maintenance/:itemId (update + delete + service)
    //
    // Overdue alerts are dispatched daily by the MaintenanceMonitor cron job.
    // ------------------------------------------------------------------
    const vesselSchema = z.object({
      name: z.string().min(1).max(100),
      current_engine_hours: z.number().nonnegative().optional(),
      current_watermaker_hours: z.number().nonnegative().optional(),
    });

    const vesselHoursSchema = z.object({
      current_engine_hours: z.number().nonnegative().optional(),
      current_watermaker_hours: z.number().nonnegative().optional(),
    });

    const maintenanceSchema = z
      .object({
        item: z.string().min(1).max(200),
        category: z
          .enum([
            "engine",
            "watermaker",
            "rigging",
            "safety",
            "sails",
            "hull",
            "electrical",
            "other",
          ])
          .optional(),
        interval_hours: z.number().positive().nullable().optional(),
        interval_days: z.number().int().positive().nullable().optional(),
        hours_meter_source: z
          .enum(["engine", "watermaker"])
          .nullable()
          .optional(),
        last_serviced_at: z.string().datetime().nullable().optional(),
        last_serviced_at_hours: z.number().nonnegative().nullable().optional(),
        notes: z.string().max(2000).optional(),
      })
      .refine(
        (d) => d.interval_hours != null || d.interval_days != null,
        "At least one of interval_hours or interval_days is required.",
      )
      .refine(
        (d) => d.interval_hours == null || d.hours_meter_source != null,
        "hours_meter_source is required when interval_hours is set.",
      );

    this.app.get("/api/vessels", async (req, res) => {
      if (
        !(await this.checkRateLimit(req, res, { bucket: "vessels", limit: 60 }))
      )
        return;
      const userId = await this.verifyAuthAndGetUserId(req, res);
      if (!userId) return;
      if (!this.postgres)
        return res.status(503).json({ error: "DB unavailable" });
      try {
        const result = await this.postgres.query(
          `SELECT id, name, current_engine_hours, current_watermaker_hours,
                  created_at, updated_at
             FROM user_vessels
             WHERE user_id = $1
             ORDER BY created_at ASC`,
          [userId],
        );
        res.json({ vessels: result.rows });
      } catch (error) {
        logger.error({ error, userId }, "Failed to list vessels");
        res.status(500).json({ error: "Failed to list vessels" });
      }
    });

    this.app.post("/api/vessels", async (req, res) => {
      if (
        !(await this.checkRateLimit(req, res, { bucket: "vessels", limit: 10 }))
      )
        return;
      const userId = await this.verifyAuthAndGetUserId(req, res);
      if (!userId) return;
      if (!this.postgres)
        return res.status(503).json({ error: "DB unavailable" });
      if (!(await this.isPremiumOrAbove(userId))) {
        return res.status(403).json({
          error: "Vessel maintenance requires Premium",
          upgradeRequired: true,
        });
      }
      const parsed = vesselSchema.safeParse(req.body);
      if (!parsed.success) {
        return res
          .status(400)
          .json({ error: "Invalid vessel", details: parsed.error.issues });
      }
      try {
        const result = await this.postgres.query(
          `INSERT INTO user_vessels (user_id, name, current_engine_hours, current_watermaker_hours)
           VALUES ($1, $2, COALESCE($3, 0), COALESCE($4, 0))
           RETURNING id, name, current_engine_hours, current_watermaker_hours, created_at, updated_at`,
          [
            userId,
            parsed.data.name,
            parsed.data.current_engine_hours ?? null,
            parsed.data.current_watermaker_hours ?? null,
          ],
        );
        res.status(201).json({ vessel: result.rows[0] });
      } catch (error) {
        logger.error({ error, userId }, "Failed to create vessel");
        res.status(500).json({ error: "Failed to create vessel" });
      }
    });

    this.app.put("/api/vessels/:id/hours", async (req, res) => {
      if (
        !(await this.checkRateLimit(req, res, { bucket: "vessels", limit: 30 }))
      )
        return;
      const userId = await this.verifyAuthAndGetUserId(req, res);
      if (!userId) return;
      if (!this.postgres)
        return res.status(503).json({ error: "DB unavailable" });
      const parsed = vesselHoursSchema.safeParse(req.body);
      if (!parsed.success) {
        return res
          .status(400)
          .json({ error: "Invalid hours", details: parsed.error.issues });
      }
      try {
        const result = await this.postgres.query(
          `UPDATE user_vessels
             SET current_engine_hours = COALESCE($3, current_engine_hours),
                 current_watermaker_hours = COALESCE($4, current_watermaker_hours),
                 updated_at = NOW()
             WHERE id = $1 AND user_id = $2
             RETURNING id, name, current_engine_hours, current_watermaker_hours, updated_at`,
          [
            req.params.id,
            userId,
            parsed.data.current_engine_hours ?? null,
            parsed.data.current_watermaker_hours ?? null,
          ],
        );
        if (!result.rows[0])
          return res.status(404).json({ error: "Not found" });
        res.json({ vessel: result.rows[0] });
      } catch (error) {
        logger.error({ error, userId }, "Failed to update vessel hours");
        res.status(500).json({ error: "Failed to update hours" });
      }
    });

    this.app.delete("/api/vessels/:id", async (req, res) => {
      if (
        !(await this.checkRateLimit(req, res, { bucket: "vessels", limit: 30 }))
      )
        return;
      const userId = await this.verifyAuthAndGetUserId(req, res);
      if (!userId) return;
      if (!this.postgres)
        return res.status(503).json({ error: "DB unavailable" });
      try {
        const result = await this.postgres.query(
          `DELETE FROM user_vessels WHERE id = $1 AND user_id = $2`,
          [req.params.id, userId],
        );
        if ((result.rowCount ?? 0) === 0)
          return res.status(404).json({ error: "Not found" });
        res.json({ ok: true });
      } catch (error) {
        logger.error({ error, userId }, "Failed to delete vessel");
        res.status(500).json({ error: "Failed to delete vessel" });
      }
    });

    this.app.get("/api/vessels/:id/maintenance", async (req, res) => {
      if (
        !(await this.checkRateLimit(req, res, {
          bucket: "maintenance",
          limit: 60,
        }))
      )
        return;
      const userId = await this.verifyAuthAndGetUserId(req, res);
      if (!userId) return;
      if (!this.postgres)
        return res.status(503).json({ error: "DB unavailable" });
      try {
        const result = await this.postgres.query(
          `SELECT m.id, m.item, m.category, m.interval_hours, m.interval_days,
                  m.hours_meter_source, m.last_serviced_at,
                  m.last_serviced_at_hours, m.notes, m.last_alerted_at,
                  m.created_at, m.updated_at
             FROM vessel_maintenance m
             JOIN user_vessels v ON v.id = m.vessel_id
             WHERE m.vessel_id = $1 AND v.user_id = $2
             ORDER BY m.created_at ASC`,
          [req.params.id, userId],
        );
        res.json({ items: result.rows });
      } catch (error) {
        logger.error({ error, userId }, "Failed to list maintenance");
        res.status(500).json({ error: "Failed to list items" });
      }
    });

    this.app.post("/api/vessels/:id/maintenance", async (req, res) => {
      if (
        !(await this.checkRateLimit(req, res, {
          bucket: "maintenance",
          limit: 20,
        }))
      )
        return;
      const userId = await this.verifyAuthAndGetUserId(req, res);
      if (!userId) return;
      if (!this.postgres)
        return res.status(503).json({ error: "DB unavailable" });
      if (!(await this.isPremiumOrAbove(userId))) {
        return res.status(403).json({
          error: "Vessel maintenance requires Premium",
          upgradeRequired: true,
        });
      }
      // Verify vessel ownership before insert (FK + RLS would also block, but
      // we want a clean 404 not a DB error).
      const own = await this.postgres.query(
        `SELECT id FROM user_vessels WHERE id = $1 AND user_id = $2`,
        [req.params.id, userId],
      );
      if (!own.rows[0])
        return res.status(404).json({ error: "Vessel not found" });

      const parsed = maintenanceSchema.safeParse(req.body);
      if (!parsed.success) {
        return res
          .status(400)
          .json({ error: "Invalid item", details: parsed.error.issues });
      }
      try {
        const result = await this.postgres.query(
          `INSERT INTO vessel_maintenance
             (user_id, vessel_id, item, category, interval_hours, interval_days,
              hours_meter_source, last_serviced_at, last_serviced_at_hours, notes)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           RETURNING id, item, category, interval_hours, interval_days,
                     hours_meter_source, last_serviced_at,
                     last_serviced_at_hours, notes, created_at, updated_at`,
          [
            userId,
            req.params.id,
            parsed.data.item,
            parsed.data.category ?? null,
            parsed.data.interval_hours ?? null,
            parsed.data.interval_days ?? null,
            parsed.data.hours_meter_source ?? null,
            parsed.data.last_serviced_at ?? null,
            parsed.data.last_serviced_at_hours ?? null,
            parsed.data.notes ?? null,
          ],
        );
        res.status(201).json({ item: result.rows[0] });
      } catch (error) {
        logger.error({ error, userId }, "Failed to create maintenance item");
        res.status(500).json({ error: "Failed to create item" });
      }
    });

    this.app.put("/api/vessels/:id/maintenance/:itemId", async (req, res) => {
      if (
        !(await this.checkRateLimit(req, res, {
          bucket: "maintenance",
          limit: 30,
        }))
      )
        return;
      const userId = await this.verifyAuthAndGetUserId(req, res);
      if (!userId) return;
      if (!this.postgres)
        return res.status(503).json({ error: "DB unavailable" });
      // Partial update — strip the cross-field refine since update may set
      // only one field at a time and the row already satisfies the
      // CHECK constraints.
      const partialSchema = z.object({
        item: z.string().min(1).max(200).optional(),
        category: z
          .enum([
            "engine",
            "watermaker",
            "rigging",
            "safety",
            "sails",
            "hull",
            "electrical",
            "other",
          ])
          .optional(),
        interval_hours: z.number().positive().nullable().optional(),
        interval_days: z.number().int().positive().nullable().optional(),
        hours_meter_source: z
          .enum(["engine", "watermaker"])
          .nullable()
          .optional(),
        last_serviced_at: z.string().datetime().nullable().optional(),
        last_serviced_at_hours: z.number().nonnegative().nullable().optional(),
        notes: z.string().max(2000).optional(),
      });
      const parsed = partialSchema.safeParse(req.body);
      if (!parsed.success) {
        return res
          .status(400)
          .json({ error: "Invalid update", details: parsed.error.issues });
      }
      try {
        const result = await this.postgres.query(
          `UPDATE vessel_maintenance
               SET item = COALESCE($3, item),
                   category = COALESCE($4, category),
                   interval_hours = COALESCE($5, interval_hours),
                   interval_days = COALESCE($6, interval_days),
                   hours_meter_source = COALESCE($7, hours_meter_source),
                   last_serviced_at = COALESCE($8, last_serviced_at),
                   last_serviced_at_hours = COALESCE($9, last_serviced_at_hours),
                   notes = COALESCE($10, notes),
                   updated_at = NOW()
               WHERE id = $1 AND user_id = $2
               RETURNING id, item, category, interval_hours, interval_days,
                         hours_meter_source, last_serviced_at,
                         last_serviced_at_hours, notes, last_alerted_at,
                         created_at, updated_at`,
          [
            req.params.itemId,
            userId,
            parsed.data.item ?? null,
            parsed.data.category ?? null,
            parsed.data.interval_hours ?? null,
            parsed.data.interval_days ?? null,
            parsed.data.hours_meter_source ?? null,
            parsed.data.last_serviced_at ?? null,
            parsed.data.last_serviced_at_hours ?? null,
            parsed.data.notes ?? null,
          ],
        );
        if (!result.rows[0])
          return res.status(404).json({ error: "Not found" });
        res.json({ item: result.rows[0] });
      } catch (error) {
        logger.error({ error, userId }, "Failed to update maintenance item");
        res.status(500).json({ error: "Failed to update item" });
      }
    });

    this.app.delete(
      "/api/vessels/:id/maintenance/:itemId",
      async (req, res) => {
        if (
          !(await this.checkRateLimit(req, res, {
            bucket: "maintenance",
            limit: 30,
          }))
        )
          return;
        const userId = await this.verifyAuthAndGetUserId(req, res);
        if (!userId) return;
        if (!this.postgres)
          return res.status(503).json({ error: "DB unavailable" });
        try {
          const result = await this.postgres.query(
            `DELETE FROM vessel_maintenance WHERE id = $1 AND user_id = $2`,
            [req.params.itemId, userId],
          );
          if ((result.rowCount ?? 0) === 0)
            return res.status(404).json({ error: "Not found" });
          res.json({ ok: true });
        } catch (error) {
          logger.error({ error, userId }, "Failed to delete maintenance item");
          res.status(500).json({ error: "Failed to delete item" });
        }
      },
    );

    // ------------------------------------------------------------------
    // Vessel polars (V1) — Premium-gated upload + per-vessel polar library
    //
    // Insert validates the CSV against the Expedition parser before storing
    // the canonical JSONB shape. Activation sets is_active=TRUE on the
    // chosen polar AND clears all siblings in a single transaction — the
    // partial unique index `vessel_polars_one_active_per_vessel` enforces
    // the invariant DB-side too.
    // ------------------------------------------------------------------
    const polarUploadSchema = z.object({
      name: z.string().min(1).max(100),
      csv: z.string().min(1).max(2_000_000), // 2 MB cap
      source: z.enum(["upload", "starter", "edited"]).optional(),
      max_wind_kt: z.number().positive().max(100).optional(),
      max_wave_m: z.number().positive().max(30).optional(),
    });

    this.app.get("/api/vessels/:id/polars", async (req, res) => {
      if (
        !(await this.checkRateLimit(req, res, { bucket: "polars", limit: 60 }))
      )
        return;
      const userId = await this.verifyAuthAndGetUserId(req, res);
      if (!userId) return;
      if (!this.postgres)
        return res.status(503).json({ error: "DB unavailable" });
      try {
        // Confirm vessel ownership for a clean 404.
        const own = await this.postgres.query(
          `SELECT id FROM user_vessels WHERE id = $1 AND user_id = $2`,
          [req.params.id, userId],
        );
        if (!own.rows[0])
          return res.status(404).json({ error: "Vessel not found" });
        const result = await this.postgres.query(
          `SELECT id, name, source, polar_data, is_active, max_wind_kt, max_wave_m,
                  uploaded_at, updated_at
             FROM vessel_polars
             WHERE vessel_id = $1
             ORDER BY uploaded_at DESC`,
          [req.params.id],
        );
        res.json({ polars: result.rows });
      } catch (error) {
        logger.error({ error, userId }, "Failed to list polars");
        res.status(500).json({ error: "Failed to list polars" });
      }
    });

    this.app.post("/api/vessels/:id/polars", async (req, res) => {
      if (
        !(await this.checkRateLimit(req, res, { bucket: "polars", limit: 10 }))
      )
        return;
      const userId = await this.verifyAuthAndGetUserId(req, res);
      if (!userId) return;
      if (!this.postgres)
        return res.status(503).json({ error: "DB unavailable" });
      if (!(await this.isPremiumOrAbove(userId))) {
        return res.status(403).json({
          error: "Polar upload requires Premium",
          upgradeRequired: true,
        });
      }
      const parsed = polarUploadSchema.safeParse(req.body);
      if (!parsed.success) {
        return res
          .status(400)
          .json({ error: "Invalid payload", details: parsed.error.issues });
      }
      const parsedPolar = parseExpeditionCsv(parsed.data.csv);
      if (parsedPolar.ok === false) {
        return res
          .status(400)
          .json({ error: `Polar parse failed: ${parsedPolar.error}` });
      }
      // Confirm vessel ownership before insert.
      const own = await this.postgres.query(
        `SELECT id FROM user_vessels WHERE id = $1 AND user_id = $2`,
        [req.params.id, userId],
      );
      if (!own.rows[0])
        return res.status(404).json({ error: "Vessel not found" });

      try {
        // Insert; if it's the user's first polar for this vessel, activate it.
        const existingCount = await this.postgres.query(
          `SELECT COUNT(*)::int AS n FROM vessel_polars WHERE vessel_id = $1`,
          [req.params.id],
        );
        const isFirst = existingCount.rows[0].n === 0;
        const result = await this.postgres.query(
          `INSERT INTO vessel_polars
             (user_id, vessel_id, name, source, polar_data,
              is_active, max_wind_kt, max_wave_m)
           VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8)
           RETURNING id, name, source, polar_data, is_active,
                     max_wind_kt, max_wave_m, uploaded_at, updated_at`,
          [
            userId,
            req.params.id,
            parsed.data.name,
            parsed.data.source ?? "upload",
            JSON.stringify(parsedPolar.polar),
            isFirst,
            parsed.data.max_wind_kt ?? null,
            parsed.data.max_wave_m ?? null,
          ],
        );
        res.status(201).json({ polar: result.rows[0] });
      } catch (error) {
        const msg = (error as Error).message ?? String(error);
        if (msg.includes("vessel_polars_unique_name")) {
          return res
            .status(409)
            .json({
              error: "A polar with that name already exists for this vessel.",
            });
        }
        logger.error({ error, userId }, "Failed to insert polar");
        res.status(500).json({ error: "Failed to save polar" });
      }
    });

    this.app.put(
      "/api/vessels/:id/polars/:polarId/activate",
      async (req, res) => {
        if (
          !(await this.checkRateLimit(req, res, {
            bucket: "polars",
            limit: 30,
          }))
        )
          return;
        const userId = await this.verifyAuthAndGetUserId(req, res);
        if (!userId) return;
        if (!this.postgres)
          return res.status(503).json({ error: "DB unavailable" });
        try {
          // Two-step transaction: clear current active, set new active. The
          // partial unique index enforces "at most one active per vessel"
          // so the order matters — clear before set.
          const client = await this.postgres.connect();
          try {
            await client.query("BEGIN");
            await client.query(
              `UPDATE vessel_polars
                 SET is_active = FALSE, updated_at = NOW()
                 WHERE vessel_id = $1 AND user_id = $2 AND is_active = TRUE`,
              [req.params.id, userId],
            );
            const result = await client.query(
              `UPDATE vessel_polars
                 SET is_active = TRUE, updated_at = NOW()
                 WHERE id = $1 AND vessel_id = $2 AND user_id = $3
                 RETURNING id, name, source, is_active, updated_at`,
              [req.params.polarId, req.params.id, userId],
            );
            if (!result.rows[0]) {
              await client.query("ROLLBACK");
              return res.status(404).json({ error: "Polar not found" });
            }
            await client.query("COMMIT");
            res.json({ polar: result.rows[0] });
          } catch (err) {
            await client.query("ROLLBACK");
            throw err;
          } finally {
            client.release();
          }
        } catch (error) {
          logger.error({ error, userId }, "Failed to activate polar");
          res.status(500).json({ error: "Failed to activate polar" });
        }
      },
    );

    this.app.delete("/api/vessels/:id/polars/:polarId", async (req, res) => {
      if (
        !(await this.checkRateLimit(req, res, { bucket: "polars", limit: 30 }))
      )
        return;
      const userId = await this.verifyAuthAndGetUserId(req, res);
      if (!userId) return;
      if (!this.postgres)
        return res.status(503).json({ error: "DB unavailable" });
      try {
        const result = await this.postgres.query(
          `DELETE FROM vessel_polars
             WHERE id = $1 AND vessel_id = $2 AND user_id = $3`,
          [req.params.polarId, req.params.id, userId],
        );
        if ((result.rowCount ?? 0) === 0)
          return res.status(404).json({ error: "Not found" });
        res.json({ ok: true });
      } catch (error) {
        logger.error({ error, userId }, "Failed to delete polar");
        res.status(500).json({ error: "Failed to delete polar" });
      }
    });

    this.app.get("/api/geocode/reverse", async (req, res) => {
      if (
        !(await this.checkRateLimit(req, res, { bucket: "geocode", limit: 60 }))
      )
        return;
      const schema = z.object({
        lat: z.coerce.number().min(-90).max(90),
        lon: z.coerce.number().min(-180).max(180),
      });
      const parsed = schema.safeParse(req.query);
      if (!parsed.success) {
        return res.status(400).json({
          error: "Invalid coordinates",
          details: parsed.error.issues,
        });
      }
      try {
        const result = await this.geocodingService.reverse(
          parsed.data.lat,
          parsed.data.lon,
        );
        res.json({ result });
      } catch (error) {
        logger.error({ error }, "Reverse geocode failed");
        res.status(503).json({ error: "Reverse geocode service unavailable" });
      }
    });
  }

  async start() {
    const httpPort = parseInt(process.env.PORT || "8080", 10);
    await new Promise<void>((resolve) => {
      this.httpServer.listen(httpPort, () => {
        logger.info(
          {
            httpPort,
            httpServer: `http://localhost:${httpPort}`,
            wsServer: `ws://localhost:${httpPort}`,
            healthEndpoint: `http://localhost:${httpPort}/health`,
          },
          "Orchestrator started successfully",
        );
        resolve();
      });
    });

    // Background cron jobs (welcome/trial/usage emails, ASAM piracy
    // ingest, external-API health). Disabled by default in development
    // so a local `npm run dev` doesn't spam Resend or attempt to write
    // to a production DB; set DISABLE_CRON=false (or omit it in prod)
    // to enable. In production we always want them on.
    const cronDisabled = process.env.DISABLE_CRON === "true";
    if (!cronDisabled) {
      try {
        // R4 — wire the drift monitor only if Redis is up. Without Redis
        // there's no passage store to scan, so the cron job is a no-op
        // anyway. Wiring it conditionally keeps the cron service from
        // logging a "no-op job scheduled" line in dev.
        if (this.redis) {
          this.driftMonitor = new PassageDriftMonitor({
            redis: this.redis,
            pool: this.postgres,
            openMeteo: this.multiModelWeather,
            safetyAgent: this.agents["safety"] as SafetyAgent,
            push: this.pushService,
            logger,
          });
        }
        if (this.postgres) {
          this.maintenanceMonitor = new MaintenanceMonitor({
            pool: this.postgres,
            push: this.pushService,
            logger,
          });
        }
        this.cronService = new CronService(logger, {
          driftMonitor: this.driftMonitor,
          maintenanceMonitor: this.maintenanceMonitor,
        });
        this.cronService.start();
        logger.info("Cron service started");
      } catch (error) {
        // Cron failing to start must not block HTTP — the orchestrator
        // is still useful for planning. Log loudly and continue.
        logger.error({ error }, "Failed to start cron service");
        this.cronService = null;
      }
    } else {
      logger.info("Cron service disabled via DISABLE_CRON=true");
    }
  }

  async shutdown() {
    logger.info("Shutting down orchestrator...");

    // Stop cron jobs first so a long-running job doesn't fire mid-shutdown
    // and try to write to a closing DB/Redis pool.
    if (this.cronService) {
      try {
        this.cronService.stop();
        logger.info("Cron service stopped");
      } catch (error) {
        logger.error({ error }, "Error stopping cron service");
      }
    }

    // Flush pending audit log writes before shutting down
    try {
      await this.auditLogger.flushPendingWrites();
      logger.info("Audit log writes flushed");
    } catch (error) {
      logger.error({ error }, "Error flushing audit logs during shutdown");
    }

    for (const agent of Object.values(this.agents)) {
      try {
        await agent.shutdown();
      } catch (error) {
        logger.error({ error }, "Error shutting down agent");
      }
    }

    try {
      await this.portAgent.shutdown();
    } catch (error) {
      logger.error({ error }, "Error shutting down port agent");
    }

    try {
      if (this.redis) await this.redis.quit();
    } catch (error) {
      // Ignore Redis errors during shutdown
    }

    this.wss.clients.forEach((client: WebSocket) => {
      client.close();
    });
    this.wss.close();

    await new Promise<void>((resolve) => {
      this.httpServer.close(() => {
        logger.info("Orchestrator shutdown complete");
        resolve();
      });
    });
  }

  private calculateSimpleDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    // Haversine formula for distance in nautical miles
    const R = 3440.1; // Earth radius in nautical miles
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
}

// Defensive numeric extractor used by buildRiskInput — Open-Meteo and the
// various agents return mixed string/number shapes, so we coerce gently and
// fall back to a caller-provided default for non-numeric / missing inputs.
function numOr(v: unknown, fallback: number): number {
  if (v === undefined || v === null || v === "") return fallback;
  if (typeof v === "number") return Number.isFinite(v) ? v : fallback;
  if (typeof v === "string") {
    const m = v.match(/-?\d+(\.\d+)?/);
    if (!m) return fallback;
    const n = Number(m[0]);
    return Number.isFinite(n) ? n : fallback;
  }
  return fallback;
}
