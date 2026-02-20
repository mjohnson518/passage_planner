// Simplified orchestrator without MCP SDK (HTTP + WebSocket only)
import Redis from 'ioredis';
import { WeatherAgent } from '../../agents/weather/src/index';
import { TidalAgent } from '../../agents/tidal/src/index';
import { RouteAgent } from '../../agents/route/src';
import { SafetyAgent } from '../../agents/safety/src/index';
import { PortAgent } from '../../agents/port/src/index';
import { SafetyAuditLogger } from '../../agents/safety/src/utils/audit-logger';
import { WeatherAggregator, AggregateForecast } from './services/weather-aggregator';
import { WeatherRoutingService, WeatherRoute } from './services/weather-routing';
import { BaseAgent } from '@passage-planner/shared';
import { WebSocketServer, WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import express from 'express';
import http from 'http';
import pino from 'pino';
import jwt from 'jsonwebtoken';
import { z } from 'zod';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

interface AgentRegistry {
  [key: string]: BaseAgent | SafetyAgent;
}

export class SimpleOrchestrator {
  private agents: AgentRegistry = {};
  private redis: Redis | null;
  private wss: WebSocketServer;
  private httpServer: http.Server;
  private app: express.Application;
  private portAgent: PortAgent;
  private auditLogger: SafetyAuditLogger;
  private weatherAggregator: WeatherAggregator;
  private weatherRouting: WeatherRoutingService;

  constructor() {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      logger.warn('REDIS_URL not set — running without Redis (no caching/rate limiting)');
      this.redis = null;
    } else {
      this.redis = new Redis(redisUrl, {
        maxRetriesPerRequest: 1,
        retryStrategy: () => null // Don't retry if Redis is down
      });
    }
    
    this.app = express();
    this.httpServer = http.createServer(this.app);
    this.wss = new WebSocketServer({ server: this.httpServer });
    this.portAgent = new PortAgent();
    this.auditLogger = new SafetyAuditLogger(logger);
    this.weatherAggregator = new WeatherAggregator(logger);
    this.weatherRouting = new WeatherRoutingService(logger);

    this.initializeAgents();
    this.setupWebSocket();
    this.setupHttpServer();
  }

  private async initializeAgents() {
    logger.info('Initializing agents...');

    // Initialize all four agents - including CRITICAL SafetyAgent
    this.agents['weather'] = new WeatherAgent();
    logger.info('Weather agent initialized');

    this.agents['tidal'] = new TidalAgent();
    logger.info('Tidal agent initialized');

    // RouteAgent now working with geolib (no more Turf.js ESM issues)
    this.agents['route'] = new RouteAgent();
    logger.info('Route agent initialized');

    // CRITICAL: SafetyAgent for hazard detection, depth checks, and safety warnings
    // This is life-safety infrastructure - never skip safety checks
    this.agents['safety'] = new SafetyAgent();
    await (this.agents['safety'] as SafetyAgent).initialize();
    logger.info('Safety agent initialized - CRITICAL for mariner safety');

    // PortAgent for port/marina information and emergency harbors
    await this.portAgent.initialize();
    logger.info('Port agent initialized');

    logger.info('All agents initialized');
  }

  private async planPassage(request: any): Promise<any> {
    const planningId = uuidv4();
    const startTime = Date.now();
    
    // Broadcast planning start
    this.broadcastUpdate({
      type: 'planning_started',
      planningId,
      request
    });
    
    logger.info({ planningId, request }, 'Starting passage planning with PARALLEL execution');

    try {
      // PARALLEL EXECUTION - All agents at once for <3 second response!
      logger.info({ planningId }, 'Executing all agents in parallel');
      
      // Prepare all agent calls with timeout protection
      const agentTimeout = 30000; // 30 second timeout
      
      const routePromise = Promise.race([
        this.agents['route'].callTool('calculate_route', {
          startLat: request.departure.latitude,
          startLon: request.departure.longitude,
          endLat: request.destination.latitude,
          endLon: request.destination.longitude,
          speed: request.vessel?.cruiseSpeed || 5
        }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Route calculation timeout')), agentTimeout)
        )
      ]).catch(error => {
        logger.error({ error }, 'Route agent error');
        // Fallback to simple calculation
        const distance = this.calculateSimpleDistance(
          request.departure.latitude,
          request.departure.longitude,
          request.destination.latitude,
          request.destination.longitude
        );
        return {
          waypoints: [request.departure, request.destination],
          totalDistance: distance,
          estimatedDuration: distance / (request.vessel?.cruiseSpeed || 5)
        };
      });
      
      const weatherDeparturePromise = Promise.race([
        this.agents['weather'].callTool('get_marine_weather', {
          latitude: request.departure.latitude,
          longitude: request.departure.longitude,
          days: 3
        }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Weather fetch timeout')), agentTimeout)
        )
      ]).catch(error => {
        logger.error({ error }, 'Weather departure error');
        return null;
      });
      
      const weatherArrivalPromise = Promise.race([
        this.agents['weather'].callTool('get_marine_weather', {
          latitude: request.destination.latitude,
          longitude: request.destination.longitude,
          days: 3
        }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Weather fetch timeout')), agentTimeout)
        )
      ]).catch(error => {
        logger.error({ error }, 'Weather arrival error');
        return null;
      });
      
      const tidalDeparturePromise = Promise.race([
        this.agents['tidal'].callTool('get_tides', {
          latitude: request.departure.latitude,
          longitude: request.departure.longitude,
          startDate: request.departure.time || new Date().toISOString(),
          endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
        }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Tidal fetch timeout')), agentTimeout)
        )
      ]).catch(error => {
        logger.error({ error }, 'Tidal departure error');
        return null;
      });
      
      const tidalArrivalPromise = Promise.race([
        this.agents['tidal'].callTool('get_tides', {
          latitude: request.destination.latitude,
          longitude: request.destination.longitude,
          startDate: request.departure.time || new Date().toISOString(),
          endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Tidal fetch timeout')), agentTimeout)
        )
      ]).catch(error => {
        logger.error({ error }, 'Tidal arrival error');
        return null;
      });

      // CRITICAL: Safety Agent checks - LIFE SAFETY INFRASTRUCTURE
      // These checks detect hazards, verify depths, and provide safety warnings
      const routeWaypoints = [
        { latitude: request.departure.latitude, longitude: request.departure.longitude },
        { latitude: request.destination.latitude, longitude: request.destination.longitude }
      ];

      const safetyRoutePromise = Promise.race([
        this.agents['safety'].callTool('check_route_safety', {
          route: routeWaypoints,
          departure_time: request.departure.time || new Date().toISOString(),
          vessel_draft: request.vessel?.draft || 6
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Safety check timeout')), agentTimeout)
        )
      ]).catch(error => {
        logger.error({ error }, 'Safety route check error - CRITICAL');
        // CRITICAL: Log safety system failure to audit trail
        this.auditLogger.logWarningGenerated(
          planningId, undefined, 'system_failure', 'critical', undefined,
          `SafetyAgent failed: ${error.message || 'Unknown error'}`
        );
        // Return enriched fallback with manual safety checklist
        return {
          warnings: [],
          hazards: [],
          recommendations: ['Safety check failed - exercise extreme caution'],
          safetyCheckFailed: true,
          failureDetails: {
            reason: error.message || 'Safety system unavailable',
            timestamp: new Date().toISOString(),
            manualChecklist: [
              'Check NOAA marine weather warnings for your route area',
              'Verify water depths against official nautical charts (NOAA/UKHO)',
              'Check for restricted areas and active NOTAMs along route',
              'Confirm current weather conditions at departure and destination',
              'Verify tidal heights are safe for vessel draft at all waypoints',
              'Ensure emergency contacts and Coast Guard frequencies are accessible'
            ],
            requiredActions: [
              'DO NOT depart without completing manual safety verification',
              'Consult official nautical charts for the entire route',
              'File a float plan with a trusted shore contact',
              'Monitor VHF Channel 16 continuously during passage'
            ]
          }
        };
      });

      const safetyBriefPromise = Promise.race([
        this.agents['safety'].callTool('generate_safety_brief', {
          departure_port: request.departure.name || 'Unknown',
          destination_port: request.destination.name || 'Unknown',
          route_distance: 0, // Will be updated after route calculation
          estimated_duration: '0h',
          crew_size: request.crew?.size || 2,
          vessel_type: request.vessel?.type || 'sailboat'
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Safety brief timeout')), agentTimeout)
        )
      ]).catch(error => {
        logger.error({ error }, 'Safety brief generation error');
        return null;
      });

      // Fetch real-time buoy wave data along route
      const buoyDataPromise = Promise.race([
        this.agents['weather'].callTool('get_buoy_wave_data', {
          waypoints: routeWaypoints,
          radius_nm: 50
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Buoy data fetch timeout')), agentTimeout)
        )
      ]).catch(error => {
        logger.warn({ error }, 'Buoy data fetch failed - using forecast-only wave estimates');
        return null;
      });

      // Gridded wind field for weather routing
      const windFieldPromise = Promise.race([
        this.agents['weather'].callTool('get_route_wind_field', {
          waypoints: routeWaypoints,
          forecastHours: [0, 6, 12, 18, 24, 36, 48, 72, 96, 120]
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Wind field fetch timeout')), agentTimeout)
        )
      ]).catch(error => {
        logger.warn({ error }, 'Wind field fetch failed - weather routing unavailable');
        return null;
      });

      // Port information for departure and arrival
      const departurePortPromise = Promise.race([
        this.portAgent.handleToolCall('search_ports', {
          latitude: request.departure.latitude,
          longitude: request.departure.longitude,
          radius: 25,
          draft: request.vessel?.draft
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Port search timeout')), agentTimeout)
        )
      ]).catch(error => {
        logger.warn({ error }, 'Departure port search failed');
        return null;
      });

      const arrivalPortPromise = Promise.race([
        this.portAgent.handleToolCall('search_ports', {
          latitude: request.destination.latitude,
          longitude: request.destination.longitude,
          radius: 25,
          draft: request.vessel?.draft
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Port search timeout')), agentTimeout)
        )
      ]).catch(error => {
        logger.warn({ error }, 'Arrival port search failed');
        return null;
      });

      // Emergency harbors along route midpoint (SAFETY CRITICAL)
      const midLat = (request.departure.latitude + request.destination.latitude) / 2;
      const midLon = (request.departure.longitude + request.destination.longitude) / 2;
      const emergencyHarborsPromise = Promise.race([
        this.portAgent.handleToolCall('find_emergency_harbors', {
          latitude: midLat,
          longitude: midLon,
          maxDistance: 100,
          draft: request.vessel?.draft
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Emergency harbor search timeout')), agentTimeout)
        )
      ]).catch(error => {
        logger.warn({ error }, 'Emergency harbor search failed');
        return null;
      });

      // EXECUTE ALL IN PARALLEL - THIS IS THE KEY!
      // Including CRITICAL safety checks in parallel execution
      const parallelStart = Date.now();
      const [route, weatherDeparture, weatherArrival, tidalDeparture, tidalArrival, safetyRoute, safetyBrief, buoyData, windFieldResult, departurePort, arrivalPort, emergencyHarbors] = await Promise.all([
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
        emergencyHarborsPromise
      ]);

      const parallelTime = Date.now() - parallelStart;
      logger.info({ parallelTime, planningId }, 'All agents completed in parallel execution (including safety)');

      // Extract safety warnings from safety route check
      const safetyWarnings = this.extractSafetyWarnings(safetyRoute);

      // Step 2: Validate weather data freshness (SAFETY CRITICAL - reject stale data)
      const freshnessWarnings: string[] = [];
      freshnessWarnings.push(...this.validateWeatherFreshness(weatherDeparture, request.departure.name || 'departure'));
      freshnessWarnings.push(...this.validateWeatherFreshness(weatherArrival, request.destination.name || 'arrival'));

      // Step 3: Extract tidal freshness warnings from agent responses
      const tidalWarnings = this.extractTidalWarnings(tidalDeparture, tidalArrival);

      // Step 3b: Multi-source weather aggregation for consensus and confidence
      // SAFETY: CLAUDE.md requires "always present worst-case scenario when forecasts disagree"
      const weatherAggregation = this.aggregateWeatherSources(
        weatherDeparture, weatherArrival, request
      );

      // Step 4: Detect if safety system failed and build appropriate disclaimer
      const safetySystemFailed = !!(safetyRoute as any)?.safetyCheckFailed;
      const safetyDisclaimer = safetySystemFailed
        ? 'WARNING: Automated safety checks failed. Manual verification is REQUIRED before departure. Skipper retains ultimate responsibility for vessel safety.'
        : 'This safety analysis is advisory only. Skipper retains ultimate responsibility for vessel safety.';

      // Step 5: Generate weather warnings using worst-case values
      const weatherWarnings = this.generateWarnings([weatherDeparture, weatherArrival]);

      // Step 6: Adjust route ETA for tidal currents (SAFETY CRITICAL)
      const vesselSpeed = request.vessel?.cruiseSpeed || 5;
      const currentAdjustment = this.adjustRouteForCurrents(route, tidalDeparture, tidalArrival, vesselSpeed);

      // Step 7: Extract buoy wave warnings if available
      const buoyWarnings: string[] = [];
      if (buoyData?.content) {
        const buoyContent = buoyData.content.find((c: any) => c.type === 'data');
        if (buoyContent?.data) {
          const { overallHazard, coverage, worstConditions } = buoyContent.data;
          if (overallHazard === 'dangerous') {
            buoyWarnings.push(`DANGEROUS WAVE CONDITIONS: NDBC buoys report ${worstConditions?.significantWaveHeight?.toFixed(1) || '>3.0'}m waves along route`);
          } else if (overallHazard === 'elevated') {
            buoyWarnings.push(`Elevated wave conditions: NDBC buoys report ${worstConditions?.significantWaveHeight?.toFixed(1) || '>1.8'}m waves along route`);
          }
          if (coverage === 'none') {
            buoyWarnings.push('No real-time buoy data available along route - wave estimates are forecast-based only');
          }
        }
      }

      // Step 8: Weather routing (isochrone algorithm) if wind field data available
      let weatherRoute: WeatherRoute | null = null;
      try {
        const windFieldData = windFieldResult?.content?.find((c: any) => c.type === 'data')?.data;
        if (windFieldData && windFieldData.source !== 'unavailable') {
          weatherRoute = this.weatherRouting.calculateOptimalRoute(
            { latitude: request.departure.latitude, longitude: request.departure.longitude },
            { latitude: request.destination.latitude, longitude: request.destination.longitude },
            new Date(request.departure.time || Date.now()),
            windFieldData,
            vesselSpeed
          );
          logger.info({
            planningId,
            directDistance: weatherRoute.comparison.directRouteDistance,
            routeDistance: weatherRoute.totalDistance,
            timeSaved: weatherRoute.comparison.timeSaved,
          }, 'Weather routing calculated');
        }
      } catch (error) {
        logger.warn({ error }, 'Weather routing calculation failed - using direct route');
      }

      // Generate watch schedule
      const crewSize = request.crew?.size || request.vessel?.crewSize || 2;
      const departureTimeForWatch = new Date(request.departure.time || Date.now());
      const watchSchedule = this.generateWatchSchedule(crewSize, currentAdjustment.adjustedDuration, departureTimeForWatch);

      // Compile comprehensive passage plan
      const passagePlan = {
        id: planningId,
        request,
        route,
        weather: {
          departure: weatherDeparture,
          arrival: weatherArrival,
          aggregation: weatherAggregation.summary,
          confidence: weatherAggregation.overallConfidence,
          discrepancies: weatherAggregation.discrepancies
        },
        tides: {
          departure: tidalDeparture,
          arrival: tidalArrival,
          currentEffect: currentAdjustment.currentEffect,
          adjustedDuration: currentAdjustment.adjustedDuration
        },
        // Real-time buoy observations (when available)
        buoyData: buoyData?.content?.find((c: any) => c.type === 'data')?.data || null,
        // Watch schedule for crew management
        watchSchedule,
        // Weather-optimized route (isochrone algorithm)
        weatherRoute: weatherRoute ? {
          waypoints: weatherRoute.waypoints,
          totalDistance: weatherRoute.totalDistance,
          estimatedDuration: weatherRoute.estimatedDuration,
          adjustedDuration: weatherRoute.adjustedDuration,
          averageSpeed: weatherRoute.averageSpeed,
          comparison: weatherRoute.comparison,
          safetyWarnings: weatherRoute.safetyWarnings,
        } : null,
        // Port information for departure/arrival and emergency options
        ports: {
          departure: this.extractPortData(departurePort),
          arrival: this.extractPortData(arrivalPort),
          emergencyHarbors: this.extractEmergencyHarbors(emergencyHarbors)
        },
        // CRITICAL: Safety data for mariner awareness
        safety: {
          routeAnalysis: safetyRoute,
          brief: safetyBrief,
          warnings: safetyWarnings,
          systemFailure: safetySystemFailed,
          disclaimer: safetyDisclaimer
        },
        summary: {
          totalDistance: route.totalDistance,
          estimatedDuration: currentAdjustment.adjustedDuration,
          baseDuration: route.estimatedDuration,
          departureTime: request.departure.time,
          estimatedArrival: new Date(
            new Date(request.departure.time || Date.now()).getTime() +
            currentAdjustment.adjustedDuration * 60 * 60 * 1000
          ),
          // Combine ALL warnings: weather, freshness, aggregation, tidal, currents, buoy, and safety
          warnings: [
            ...freshnessWarnings,
            ...weatherWarnings,
            ...weatherAggregation.warnings,
            ...tidalWarnings,
            ...currentAdjustment.currentWarnings,
            ...buoyWarnings,
            ...(weatherRoute?.safetyWarnings || []),
            ...safetyWarnings
          ],
          recommendations: this.generateRecommendations([weatherDeparture, weatherArrival], route)
        },
        performance: {
          totalTime: Date.now() - startTime,
          parallelTime,
          agentsUsed: ['weather', 'tidal', 'route', 'safety', 'ndbc-buoy', 'port']
        }
      };

      logger.info({
        planningId,
        totalTime: passagePlan.performance.totalTime,
        under3Seconds: passagePlan.performance.totalTime < 3000
      }, 'Passage plan complete');

      // Step 1: Audit logging - log the final safety decision for incident investigation
      try {
        const routeWaypointsForAudit = (route.waypoints || []).map((wp: any) => ({
          latitude: wp.latitude || wp.lat,
          longitude: wp.longitude || wp.lon,
          name: wp.name
        }));

        this.auditLogger.logRouteAnalysis(
          planningId,
          undefined,
          routeWaypointsForAudit,
          safetyWarnings.filter((w: string) => w.includes('HAZARD')).length,
          passagePlan.summary.warnings.length,
          safetySystemFailed ? 'degraded' : 'normal',
          ['weather-agent', 'tidal-agent', 'route-agent', 'safety-agent'],
          safetySystemFailed ? 'low' : 'high'
        );

        // Log data sources for traceability
        this.auditLogger.logDataSource(planningId, 'weather', weatherDeparture ? 'weather-agent' : 'unavailable', weatherDeparture ? 'medium' : 'unknown');
        this.auditLogger.logDataSource(planningId, 'tidal', tidalDeparture ? 'tidal-agent' : 'unavailable', tidalDeparture ? 'medium' : 'unknown');

        // Log each warning shown to user for audit trail
        for (const warning of passagePlan.summary.warnings) {
          const severity = warning.includes('CRITICAL') || warning.includes('REJECTED') ? 'critical'
            : warning.includes('HAZARD') ? 'urgent'
            : 'warning';
          this.auditLogger.logWarningGenerated(planningId, undefined, 'passage_plan', severity, undefined, warning);
        }
      } catch (auditError) {
        // Audit logging must never break passage planning
        logger.error({ auditError, planningId }, 'Audit logging failed - non-blocking');
      }
      
      // Broadcast completion
      this.broadcastUpdate({
        type: 'planning_completed',
        planningId,
        plan: passagePlan
      });
      
      return passagePlan;
      
    } catch (error: any) {
      logger.error({ error, planningId }, 'Planning error');
      this.broadcastUpdate({
        type: 'planning_error',
        planningId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Validate weather data freshness per CLAUDE.md requirements:
   * - Reject stale data (weather >1hr)
   * - Warn on approaching staleness
   * SAFETY CRITICAL: Stale weather data is life-threatening for mariners
   */
  private validateWeatherFreshness(weatherData: any, location: string): string[] {
    const warnings: string[] = [];

    if (!weatherData) {
      warnings.push(`⚠️ WEATHER UNAVAILABLE for ${location} - verify weather independently before departure`);
      return warnings;
    }

    // Check metadata.freshnessStatus if available
    const metadata = weatherData?.metadata || weatherData?.freshnessStatus;
    if (metadata?.freshnessStatus || metadata?.ageMinutes !== undefined) {
      const freshness = metadata.freshnessStatus || metadata;
      const ageMinutes = freshness.ageMinutes;

      if (ageMinutes !== undefined) {
        if (ageMinutes > 60) {
          // CLAUDE.md: "Reject stale data (weather >1hr)"
          warnings.push(`🔴 CRITICAL: Weather data for ${location} is ${Math.round(ageMinutes)} minutes old - DATA REJECTED as stale. Verify weather independently before departure.`);
        } else if (freshness.isStale || ageMinutes > 30) {
          warnings.push(`⚠️ Weather data for ${location} is ${Math.round(ageMinutes)} minutes old and approaching staleness. Consider refreshing before departure.`);
        }
      }
    }

    // Check for confidence level and single-source data
    const confidence = weatherData?.metadata?.confidence || weatherData?.confidence;
    if (confidence === 'low') {
      warnings.push(`⚠️ Weather data for ${location} has LOW confidence - verify weather independently before departure`);
    } else if (confidence === 'medium') {
      warnings.push(`⚠️ Weather data for ${location} has moderate confidence - consider verifying independently`);
    }

    // Warn if no freshness metadata (can't verify data currency)
    if (!metadata?.freshnessStatus && metadata?.ageMinutes === undefined && !weatherData?.timestamp) {
      warnings.push(`⚠️ Weather freshness for ${location} could not be verified - data age unknown`);
    }

    return warnings;
  }

  /**
   * Extract tidal freshness warnings from tidal agent responses
   */
  private extractTidalWarnings(tidalDeparture: any, tidalArrival: any): string[] {
    const warnings: string[] = [];

    const extractFromResponse = (response: any, location: string) => {
      if (!response) {
        warnings.push(`⚠️ TIDAL DATA UNAVAILABLE for ${location} - verify tidal conditions from official sources`);
        return;
      }

      // Check content array for warnings from the tidal agent
      if (response.content && Array.isArray(response.content)) {
        for (const item of response.content) {
          if (item.type === 'data' && item.data?.freshnessWarnings) {
            warnings.push(...item.data.freshnessWarnings);
          }
        }
      }

      // Check for direct freshnessWarnings property
      if (response.freshnessWarnings && Array.isArray(response.freshnessWarnings)) {
        warnings.push(...response.freshnessWarnings);
      }
    };

    extractFromResponse(tidalDeparture, 'departure');
    extractFromResponse(tidalArrival, 'arrival');

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
    request: any
  ): {
    summary: any;
    overallConfidence: 'high' | 'medium' | 'low';
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
          const dataContent = weatherData.content.find((c: any) => c.type === 'data');
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
              longitude: request.departure.longitude
            }
          )
        : [];

      // Run aggregation for arrival location
      const arrivalAgg = arrivalPeriods
        ? this.weatherAggregator.aggregateForecasts(
            arrivalPeriods,
            null,
            {
              latitude: request.destination.latitude,
              longitude: request.destination.longitude
            }
          )
        : [];

      // Determine overall confidence from all aggregated periods
      const allForecasts = [...departureAgg, ...arrivalAgg];
      let overallConfidence: 'high' | 'medium' | 'low' = 'medium';

      if (allForecasts.length > 0) {
        const lowCount = allForecasts.filter(f => f.confidence === 'low').length;
        const highCount = allForecasts.filter(f => f.confidence === 'high').length;

        if (lowCount > allForecasts.length * 0.3) {
          overallConfidence = 'low';
        } else if (highCount > allForecasts.length * 0.7) {
          overallConfidence = 'high';
        }
      } else {
        overallConfidence = 'low';
      }

      // Collect discrepancies from all periods
      for (const forecast of allForecasts) {
        if (forecast.discrepancies) {
          allDiscrepancies.push(...forecast.discrepancies);
        }
      }

      // Generate warnings based on aggregation results
      if (overallConfidence === 'low') {
        warnings.push('⚠️ Weather forecast confidence is LOW - verify weather independently before departure');
      }

      if (allDiscrepancies.length > 0) {
        // CLAUDE.md: "always present worst-case scenario when forecasts disagree"
        const uniqueDiscrepancies = [...new Set(allDiscrepancies)];
        warnings.push(`⚠️ Weather source disagreement detected: ${uniqueDiscrepancies.slice(0, 3).join('; ')}. Plan for worst-case conditions.`);
      }

      // Extract worst-case wind/wave from aggregated data for safety
      const maxAggWind = Math.max(
        ...allForecasts.map(f => f.windSpeed?.max || 0),
        0
      );
      const maxAggWave = Math.max(
        ...allForecasts.map(f => f.waveHeight?.max || 0),
        0
      );

      if (maxAggWind > 0 && maxAggWave > 0) {
        // Only add worst-case summary if we have meaningful data
        const worstCaseSummary = {
          maxWindSpeed: maxAggWind,
          maxWaveHeight: maxAggWave,
          maxWindGust: Math.max(...allForecasts.map(f => f.windGust?.max || 0), 0),
        };

        return {
          summary: {
            departure: {
              periods: departureAgg.length,
              sources: departureAgg[0]?.sources || ['noaa'],
            },
            arrival: {
              periods: arrivalAgg.length,
              sources: arrivalAgg[0]?.sources || ['noaa'],
            },
            worstCase: worstCaseSummary,
            sourcesAvailable: ['noaa'],
            sourcesUnavailable: ['ukmo', 'openweather'],
          },
          overallConfidence,
          discrepancies: [...new Set(allDiscrepancies)],
          warnings
        };
      }

      return {
        summary: {
          departure: { periods: departureAgg.length, sources: ['noaa'] },
          arrival: { periods: arrivalAgg.length, sources: ['noaa'] },
          worstCase: null,
          sourcesAvailable: ['noaa'],
          sourcesUnavailable: ['ukmo', 'openweather'],
        },
        overallConfidence,
        discrepancies: [...new Set(allDiscrepancies)],
        warnings
      };
    } catch (error) {
      logger.warn({ error }, 'Weather aggregation failed - using raw forecasts');
      return {
        summary: { error: 'Aggregation unavailable' },
        overallConfidence: 'low',
        discrepancies: [],
        warnings: ['⚠️ Multi-source weather comparison unavailable - using single source only']
      };
    }
  }

  private generateWarnings(weather: any[]): string[] {
    const warnings: string[] = [];

    if (weather && weather.length > 0) {
      const validWeather = weather.filter(w => w);
      if (validWeather.length === 0) {
        warnings.push('⚠️ No weather data available - verify weather independently before departure');
        return warnings;
      }

      try {
        // SAFETY: Use Math.max (worst-case) for all safety-critical metrics
        const maxWindSpeed = Math.max(...validWeather.flatMap((w: any) => {
          if (Array.isArray(w)) return w.map((f: any) => f.windSpeed || f.windGust || 0);
          return [w.windSpeed || w.windGust || 0];
        }));

        if (maxWindSpeed > 33) {
          warnings.push('🔴 GALE WARNING: Wind speeds exceeding 33 knots forecast - delay departure strongly recommended');
        } else if (maxWindSpeed > 25) {
          warnings.push('⚠️ Strong winds expected (>25kt) - consider delaying departure');
        } else if (maxWindSpeed > 20) {
          warnings.push('⚠️ Moderate to strong winds expected (>20kt) - ensure vessel and crew are prepared');
        }

        const maxWaveHeight = Math.max(...validWeather.flatMap((w: any) => {
          if (Array.isArray(w)) return w.map((f: any) => f.waveHeight || f.significantWaveHeight || 0);
          return [w.waveHeight || w.significantWaveHeight || 0];
        }));

        if (maxWaveHeight > 4) {
          warnings.push('🔴 ROUGH SEAS WARNING: Wave heights exceeding 4m forecast - delay departure strongly recommended');
        } else if (maxWaveHeight > 3) {
          warnings.push('⚠️ Rough seas anticipated (>3m waves) - ensure crew is prepared');
        }

        // Step 5: Single-source confidence warning
        if (validWeather.length === 1) {
          warnings.push('⚠️ Weather forecast from single source only - no consensus verification possible. Verify weather independently before departure.');
        }
      } catch (error) {
        logger.error({ error }, 'Error generating warnings');
        warnings.push('⚠️ Error processing weather data - verify weather independently before departure');
      }
    }

    return warnings;
  }

  private generateRecommendations(weather: any[], route: any): string[] {
    const recommendations: string[] = [];

    if (route.totalDistance > 200) {
      recommendations.push('Long passage - ensure adequate provisions and fuel');
    }

    if (route.estimatedDuration > 24) {
      recommendations.push('Multi-day passage - plan watch schedule and rest periods');
    }

    recommendations.push('File a float plan with a trusted contact before departure');
    recommendations.push('Check all safety equipment is accessible and functional');

    return recommendations;
  }

  /**
   * Generate a watch schedule based on crew size and passage duration
   * Standard watch rotations for safe offshore passages
   */
  private generateWatchSchedule(
    crewSize: number,
    durationHours: number,
    departureTime: Date
  ): { schedule: any[]; system: string; recommendations: string[] } {
    const recommendations: string[] = [];

    if (crewSize < 2) {
      return {
        schedule: [],
        system: 'single-handed',
        recommendations: [
          'Single-handed passage - no formal watch schedule possible',
          'Use timer alarms every 20 minutes to check surroundings',
          'Set AIS alarm for approaching vessels',
          'Consider limiting passage length to daylight hours'
        ]
      };
    }

    // Determine watch system based on crew size
    let watchHours: number;
    let system: string;

    if (crewSize === 2) {
      watchHours = 4; // 4 on / 4 off
      system = '4 on / 4 off (Swedish watch)';
      recommendations.push('With 2 crew, each person gets 4 hours on watch and 4 hours off');
      recommendations.push('Consider adjusting to 3 on / 3 off for shorter passages to stay alert');
    } else if (crewSize === 3) {
      watchHours = 4; // 4 on / 8 off
      system = '4 on / 8 off (3-person rotation)';
      recommendations.push('3-person rotation allows 8 hours rest between watches');
    } else {
      watchHours = 4; // Standard 4-hour watches
      system = `4-hour watches (${crewSize}-person rotation)`;
      recommendations.push(`${crewSize}-person rotation with ${(24 / crewSize * (crewSize - 1)).toFixed(0)} hours rest between watches`);
    }

    // Generate schedule entries
    const schedule = [];
    let currentTime = new Date(departureTime);
    let watchNumber = 0;
    const crewNames = Array.from({ length: crewSize }, (_, i) => `Crew ${i + 1}`);

    const totalWatches = Math.ceil(durationHours / watchHours);

    for (let i = 0; i < totalWatches; i++) {
      const watchStart = new Date(currentTime);
      const watchEnd = new Date(currentTime.getTime() + watchHours * 3600000);

      // Don't extend past arrival
      const arrivalTime = new Date(departureTime.getTime() + durationHours * 3600000);
      const effectiveEnd = watchEnd > arrivalTime ? arrivalTime : watchEnd;

      schedule.push({
        watch: i + 1,
        crew: crewNames[watchNumber % crewSize],
        start: watchStart.toISOString(),
        end: effectiveEnd.toISOString(),
        startFormatted: watchStart.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        endFormatted: effectiveEnd.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isNight: watchStart.getHours() >= 20 || watchStart.getHours() < 6
      });

      currentTime = watchEnd;
      watchNumber++;

      if (currentTime >= arrivalTime) break;
    }

    if (durationHours > 12) {
      recommendations.push('Prepare meals and hot drinks before watch changes');
    }
    if (durationHours > 24) {
      recommendations.push('Ensure each crew member gets at least 6 hours of uninterrupted sleep per 24 hours');
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
    vesselSpeed: number
  ): { adjustedDuration: number; currentEffect: string; currentWarnings: string[] } {
    const warnings: string[] = [];
    let adjustedDuration = route.estimatedDuration;

    try {
      // Extract current predictions from tidal data
      const extractCurrents = (tidalData: any): Array<{ velocity: number; direction: number; type?: string }> => {
        if (!tidalData) return [];
        // Check MCP content format
        if (tidalData.content && Array.isArray(tidalData.content)) {
          const dataContent = tidalData.content.find((c: any) => c.type === 'data');
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
          currentEffect: 'No tidal current data available - ETA based on vessel speed only',
          currentWarnings: []
        };
      }

      // Calculate worst-case current effect using max velocities
      const allCurrents = [...departureCurr, ...arrivalCurr];
      const maxCurrentVelocity = Math.max(...allCurrents.map(c => Math.abs(c.velocity || 0)), 0);

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
            warnings.push(`🔴 STRONG TIDAL CURRENTS: Up to ${maxCurrentVelocity.toFixed(1)} knots detected. ETA extended by ${delayHours.toFixed(1)} hours (worst case)`);
          } else if (maxCurrentVelocity >= 1.5) {
            warnings.push(`⚠️ Moderate tidal currents up to ${maxCurrentVelocity.toFixed(1)} knots. ETA may be extended by ${delayHours.toFixed(1)} hours`);
          }
        }
      }

      // Check for slack water windows
      const slackPeriods = allCurrents.filter(c => c.type === 'slack');
      if (slackPeriods.length > 0 && maxCurrentVelocity > 1.5) {
        warnings.push(`Consider timing departure for slack water to minimize current effects (${slackPeriods.length} slack periods found)`);
      }

      return {
        adjustedDuration,
        currentEffect: maxCurrentVelocity > 0.5
          ? `Tidal currents up to ${maxCurrentVelocity.toFixed(1)} knots detected. Duration adjusted from ${route.estimatedDuration.toFixed(1)}h to ${adjustedDuration.toFixed(1)}h (worst-case)`
          : 'Minimal tidal current effect on passage timing',
        currentWarnings: warnings
      };
    } catch (error) {
      logger.warn({ error }, 'Error calculating current-adjusted ETA');
      return {
        adjustedDuration,
        currentEffect: 'Unable to calculate current effects - ETA based on vessel speed only',
        currentWarnings: []
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
      warnings.push('⚠️ SAFETY CHECK UNAVAILABLE - Exercise extreme caution');
      return warnings;
    }

    // Extract warnings from content array if present (MCP format)
    let safetyData = safetyRoute;
    if (safetyRoute.content && Array.isArray(safetyRoute.content)) {
      try {
        const textContent = safetyRoute.content.find((c: any) => c.type === 'text');
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
        if (typeof warning === 'string') {
          warnings.push(warning);
        } else if (warning.description) {
          const severity = warning.severity === 'urgent' ? '🔴' : '⚠️';
          warnings.push(`${severity} ${warning.description}`);
        }
      }
    }

    // Extract hazards
    if (safetyData.hazards && Array.isArray(safetyData.hazards)) {
      for (const hazard of safetyData.hazards) {
        const severity = hazard.severity === 'high' ? '🔴' : '⚠️';
        warnings.push(`${severity} HAZARD: ${hazard.description || hazard.type}`);
      }
    }

    // Extract recommendations
    if (safetyData.recommendations && Array.isArray(safetyData.recommendations)) {
      for (const rec of safetyData.recommendations) {
        if (typeof rec === 'string' && !warnings.includes(rec)) {
          warnings.push(`📋 ${rec}`);
        }
      }
    }

    return warnings;
  }

  /**
   * Extract port data from PortAgent search response
   */
  private extractPortData(portResponse: any): any {
    if (!portResponse) return null;
    try {
      if (portResponse.content && Array.isArray(portResponse.content)) {
        const textContent = portResponse.content.find((c: any) => c.type === 'text');
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
        const textContent = response.content.find((c: any) => c.type === 'text');
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
    vessel: z.object({
      cruiseSpeed: z.number().min(0.5).max(50).optional(),
      draft: z.number().min(0).max(100).optional(),
      type: z.string().max(100).optional(),
      crewSize: z.number().int().min(1).max(50).optional(),
      crewExperience: z.enum(['novice', 'intermediate', 'advanced', 'professional']).optional(),
    }).optional(),
    crew: z.object({
      size: z.number().int().min(1).max(50).optional(),
    }).optional(),
  });

  /**
   * Validate passage planning request body using Zod schema
   */
  private validatePassageRequest(body: unknown): { success: true; data: any } | { success: false; error: string } {
    const result = SimpleOrchestrator.PassageRequestSchema.safeParse(body);
    if (!result.success) {
      const issues = result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ');
      return { success: false, error: `Invalid request: ${issues}` };
    }
    return { success: true, data: result.data };
  }

  /**
   * JWT auth middleware - verifies Supabase JWTs
   * Dev bypass: skip auth when NODE_ENV=development && SKIP_AUTH=true
   */
  private async verifyAuth(req: express.Request, res: express.Response): Promise<boolean> {
    // Dev bypass for local development
    if (process.env.NODE_ENV === 'development' && process.env.SKIP_AUTH === 'true') {
      return true;
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ success: false, error: 'Authentication required. Provide a Bearer token.' });
      return false;
    }

    const token = authHeader.slice(7);
    const jwtSecret = process.env.SUPABASE_JWT_SECRET;

    if (!jwtSecret) {
      // If no JWT secret configured, allow in development
      if (process.env.NODE_ENV === 'development') {
        logger.warn('SUPABASE_JWT_SECRET not set — skipping auth in development');
        return true;
      }
      res.status(500).json({ success: false, error: 'Authentication not configured' });
      return false;
    }

    try {
      jwt.verify(token, jwtSecret);
      return true;
    } catch (err: any) {
      logger.warn({ err: err.message }, 'JWT verification failed');
      res.status(401).json({ success: false, error: 'Invalid or expired token' });
      return false;
    }
  }

  /**
   * Rate limiting using Redis sliding window
   * 20 requests/minute per IP, fails open if Redis is down
   */
  private async checkRateLimit(req: express.Request, res: express.Response): Promise<boolean> {
    try {
      const ip = req.ip || req.socket.remoteAddress || 'unknown';
      const key = `ratelimit:plan:${ip}`;
      const limit = 20;
      const windowSeconds = 60;

      if (!this.redis) return true; // No Redis — skip rate limiting

      const current = await this.redis.incr(key);
      if (current === 1) {
        await this.redis.expire(key, windowSeconds);
      }

      res.setHeader('X-RateLimit-Limit', String(limit));
      res.setHeader('X-RateLimit-Remaining', String(Math.max(0, limit - current)));

      if (current > limit) {
        res.status(429).json({ success: false, error: 'Rate limit exceeded. Try again shortly.' });
        return false;
      }
      return true;
    } catch (err) {
      // Fail open — if Redis is down, allow the request
      logger.warn({ err }, 'Rate limit check failed — allowing request (fail-open)');
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

    let goNoGo: 'GO' | 'CAUTION' | 'NO-GO' = 'GO';
    let overallRisk: 'low' | 'moderate' | 'high' | 'critical' = 'low';
    let safetyScore: 'Excellent' | 'Good' | 'Fair' | 'Poor' = 'Excellent';

    // Conservative safety derivation — any critical warning triggers NO-GO
    const criticalWarnings = allWarnings.filter((w: string) =>
      w.includes('CRITICAL') || w.includes('GALE') || w.includes('ROUGH SEAS') ||
      w.includes('DANGEROUS') || w.includes('REJECTED') || w.includes('NO-GO')
    );
    const cautionWarnings = allWarnings.filter((w: string) =>
      w.includes('⚠️') || w.includes('HAZARD') || w.includes('CAUTION')
    );

    if (safetySystemFailed || criticalWarnings.length > 0) {
      goNoGo = 'NO-GO';
      overallRisk = 'critical';
      safetyScore = 'Poor';
    } else if (cautionWarnings.length > 3) {
      goNoGo = 'CAUTION';
      overallRisk = 'high';
      safetyScore = 'Fair';
    } else if (cautionWarnings.length > 0) {
      goNoGo = 'CAUTION';
      overallRisk = 'moderate';
      safetyScore = 'Good';
    }

    // Extract weather data in the flat format frontend expects
    const extractWeatherLocation = (weatherData: any, locationName: string) => {
      if (!weatherData) {
        return {
          forecast: 'Unavailable',
          windSpeed: 0,
          windDirection: 0,
          waveHeight: 0,
          temperature: 0,
          conditions: 'Unknown',
          warnings: [`Weather data unavailable for ${locationName}`],
          source: 'N/A',
          timestamp: new Date().toISOString(),
          windDescription: 'N/A',
        };
      }

      // Handle MCP content format
      let data = weatherData;
      if (weatherData.content && Array.isArray(weatherData.content)) {
        const dataContent = weatherData.content.find((c: any) => c.type === 'data');
        if (dataContent?.data) data = dataContent.data;
      }

      const periods = data.periods || (Array.isArray(data) ? data : [data]);
      const first = periods[0] || {};

      return {
        forecast: first.detailedForecast || first.shortForecast || first.conditions || 'See detailed data',
        windSpeed: first.windSpeed || first.wind_speed || 0,
        windDirection: first.windDirection || first.wind_direction || 0,
        waveHeight: first.waveHeight || first.significantWaveHeight || first.wave_height || 0,
        temperature: first.temperature || first.temp || 0,
        conditions: first.shortForecast || first.conditions || 'N/A',
        warnings: first.warnings || [],
        source: data.source || 'NOAA',
        timestamp: data.timestamp || new Date().toISOString(),
        windDescription: first.windDescription || `${first.windSpeed || 0} kts`,
      };
    };

    const depWeather = extractWeatherLocation(plan.weather?.departure, plan.request?.departure?.name || 'departure');
    const destWeather = extractWeatherLocation(plan.weather?.arrival, plan.request?.destination?.name || 'destination');
    const maxWindSpeed = Math.max(depWeather.windSpeed, destWeather.windSpeed);

    // Extract tidal data in flat format
    const extractTidal = (tidalData: any, locationName: string) => {
      if (!tidalData) {
        return {
          station: 'N/A',
          predictions: [],
          nextTide: null,
          nextTideFormatted: 'No tidal data available',
          source: 'N/A',
          warning: `Tidal data unavailable for ${locationName}`,
        };
      }

      let data = tidalData;
      if (tidalData.content && Array.isArray(tidalData.content)) {
        const dataContent = tidalData.content.find((c: any) => c.type === 'data');
        if (dataContent?.data) data = dataContent.data;
      }

      const predictions = (data.predictions || data.tides || []).map((p: any) => ({
        time: p.time || p.t,
        type: p.type || (p.v > 0 ? 'high' : 'low'),
        height: p.height || parseFloat(p.v) || 0,
        unit: p.unit || 'ft',
      }));

      const nextTide = predictions[0] || null;

      return {
        station: data.station?.name || data.stationName || data.station || 'Nearest station',
        stationId: data.station?.id || data.stationId,
        distance: data.station?.distance,
        predictions,
        nextTide,
        nextTideFormatted: nextTide
          ? `${nextTide.type === 'high' ? 'High' : 'Low'} tide: ${nextTide.height.toFixed(1)} ${nextTide.unit} at ${new Date(nextTide.time).toLocaleTimeString()}`
          : 'No predictions available',
        source: data.source || 'NOAA CO-OPS',
      };
    };

    const depTidal = extractTidal(plan.tides?.departure, plan.request?.departure?.name || 'departure');
    const destTidal = extractTidal(plan.tides?.arrival, plan.request?.destination?.name || 'destination');

    // Extract port information
    const mapPort = (portData: any) => {
      if (!portData || !portData.nearest) {
        return { found: false, message: 'No port information available' };
      }
      const p = portData.nearest;
      return {
        found: true,
        name: p.name,
        type: p.type || p.portType,
        distance: p.distance ? `${p.distance.toFixed(1)} nm` : 'Nearby',
        facilities: p.facilities || {},
        navigation: p.navigation || {},
        contact: p.contact || {},
        customs: p.customs || {},
        recommendations: p.recommendations || [],
        rating: p.rating,
      };
    };

    const emergencyHarbors = (plan.ports?.emergencyHarbors || []).map((h: any) => ({
      name: h.name,
      distance: h.distance ? `${h.distance} nm` : 'N/A',
      vhf: h.vhf || 'Ch 16',
      protection: h.protection || 0,
      facilities: h.facilities || 0,
    }));

    // Build navigation warnings from safety data
    const navWarnings = safetyWarnings
      .filter((w: string) => w.includes('HAZARD') || w.includes('restricted') || w.includes('📋'))
      .map((w: string, i: number) => ({
        id: `nav-${i}`,
        type: w.includes('HAZARD') ? 'hazard' : 'notice',
        title: w.substring(0, 80),
        description: w,
        location: null,
        severity: (w.includes('🔴') ? 'critical' : w.includes('⚠️') ? 'warning' : 'info') as 'critical' | 'warning' | 'info',
        effectiveDate: new Date().toISOString(),
        source: 'Safety Agent',
      }));

    // Route data
    const route = plan.route || {};
    const totalDistance = route.totalDistance || 0;
    const estimatedDuration = plan.summary?.estimatedDuration || route.estimatedDuration || 0;
    const durationHours = typeof estimatedDuration === 'number' ? estimatedDuration : parseFloat(estimatedDuration) || 0;

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
        departure: plan.request?.departure?.name || 'Origin',
        destination: plan.request?.destination?.name || 'Destination',
      },
      weather: {
        departure: depWeather,
        destination: destWeather,
        summary: {
          maxWindSpeed,
          suitable: goNoGo !== 'NO-GO',
          warnings: allWarnings.filter((w: string) => w.toLowerCase().includes('weather') || w.toLowerCase().includes('wind') || w.toLowerCase().includes('wave')),
          overall: goNoGo === 'GO' ? 'Conditions suitable for passage' : goNoGo === 'CAUTION' ? 'Proceed with caution — review warnings' : 'Conditions not suitable — delay departure',
        },
      },
      tidal: {
        departure: depTidal,
        destination: destTidal,
        summary: {
          departureStation: depTidal.station,
          destinationStation: destTidal.station,
          tidalDataAvailable: depTidal.predictions.length > 0 || destTidal.predictions.length > 0,
          warnings: allWarnings.filter((w: string) => w.toLowerCase().includes('tidal') || w.toLowerCase().includes('current')),
        },
      },
      navigationWarnings: {
        count: navWarnings.length,
        critical: navWarnings.filter((w: any) => w.severity === 'critical').length,
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
              name: 'US Coast Guard',
              vhf: 'Channel 16',
              phone: '(855) 411-8727',
            },
          },
        },
        watchSchedule: plan.watchSchedule || null,
        timestamp: new Date().toISOString(),
        source: 'Helmwise Safety Agent',
        decision: {
          goNoGo,
          overallRisk,
          safetyScore,
          proceedWithPassage: goNoGo === 'GO',
          requiresCaution: goNoGo === 'CAUTION',
          doNotProceed: goNoGo === 'NO-GO',
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
          nearestEmergency: emergencyHarbors[0]?.name || 'None identified',
        },
      },
      summary: {
        totalDistance: `${totalDistance.toFixed(1)} nm`,
        estimatedTime: formatDuration(durationHours),
        safetyDecision: goNoGo,
        safetyScore,
        overallRisk,
        suitableForPassage: goNoGo !== 'NO-GO',
        warnings: allWarnings,
        recommendations: plan.summary?.recommendations || [],
      },
    };
  }

  private setupWebSocket() {
    this.wss.on('connection', (ws: WebSocket) => {
      logger.debug('WebSocket client connected');

      ws.on('close', () => {
        logger.debug('WebSocket client disconnected');
      });

      ws.on('error', (error: any) => {
        logger.error({ error }, 'WebSocket error');
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

  private setupHttpServer() {
    this.app.use(express.json({ limit: '1mb' }));

    // Trust proxy in production for correct IP detection behind load balancers
    if (process.env.NODE_ENV === 'production') {
      this.app.set('trust proxy', 1);
    }

    // CORS for frontend
    this.app.use((req, res, next) => {
      const allowedOrigins = [
        'http://localhost:3000',
        'http://localhost:3001',
        'https://helmwise.co',
        'https://www.helmwise.co',
        'https://helmwise.pages.dev',
        process.env.NEXT_PUBLIC_APP_URL,
      ].filter(Boolean) as string[];
      const origin = req.headers.origin;
      if (origin && allowedOrigins.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
      }
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      res.setHeader('Access-Control-Allow-Credentials', 'true');

      if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
      }
      next();
    });

    // REST endpoint for passage planning (original)
    this.app.post('/api/plan', async (req, res) => {
      // Auth + rate limit
      if (!(await this.verifyAuth(req, res))) return;
      if (!(await this.checkRateLimit(req, res))) return;

      // Validate input
      const validation = this.validatePassageRequest(req.body);
      if (!validation.success) {
        const { error } = validation as { success: false; error: string };
        res.status(400).json({ success: false, error });
        return;
      }

      try {
        logger.info({
          departure: req.body.departure?.name,
          destination: req.body.destination?.name
        }, 'Received planning request via /api/plan');
        const plan = await this.planPassage(validation.data);
        res.json({ success: true, plan });
      } catch (error: any) {
        logger.error({ error }, 'Planning failed');
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // Frontend-compatible endpoint — returns PassagePlanningResponse shape
    this.app.post('/api/passage-planning/analyze', async (req, res) => {
      // Auth + rate limit
      if (!(await this.verifyAuth(req, res))) return;
      if (!(await this.checkRateLimit(req, res))) return;

      // Validate input
      const validation = this.validatePassageRequest(req.body);
      if (!validation.success) {
        const { error } = validation as { success: false; error: string };
        res.status(400).json({ success: false, error });
        return;
      }

      try {
        logger.info({
          departure: req.body.departure?.name,
          destination: req.body.destination?.name
        }, 'Received planning request via /api/passage-planning/analyze');
        const plan = await this.planPassage(validation.data);
        const response = this.mapPlanToAnalyzeResponse(plan);
        res.json(response);
      } catch (error: any) {
        logger.error({ error }, 'Planning failed');
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });
    
    // Health check endpoint
    this.app.get('/health', async (req, res) => {
      try {
        const health: any = {
          status: 'healthy',
          timestamp: new Date().toISOString(),
          agents: {}
        };
        
        for (const [name] of Object.entries(this.agents)) {
          try {
            const agentHealth = this.redis ? await this.redis.hgetall(`agent:health:${name}-agent`) : {};
            health.agents[name] = {
              status: agentHealth.status || 'unknown',
              lastHeartbeat: agentHealth.lastHeartbeat || null
            };
          } catch (error) {
            health.agents[name] = {
              status: 'unknown',
              error: 'Failed to check health'
            };
          }
        }
        
        res.json(health);
      } catch (error: any) {
        res.status(500).json({
          status: 'unhealthy',
          error: error.message
        });
      }
    });
    
    // Readiness probe for Kubernetes
    this.app.get('/ready', async (req, res) => {
      res.json({ ready: true });
    });
  }

  async start() {
    const httpPort = parseInt(process.env.PORT || '8080', 10);
    await new Promise<void>((resolve) => {
      this.httpServer.listen(httpPort, () => {
        logger.info({
          httpPort,
          httpServer: `http://localhost:${httpPort}`,
          wsServer: `ws://localhost:${httpPort}`,
          healthEndpoint: `http://localhost:${httpPort}/health`
        }, 'Orchestrator started successfully');
        resolve();
      });
    });
  }

  async shutdown() {
    logger.info('Shutting down orchestrator...');

    // Flush pending audit log writes before shutting down
    try {
      await this.auditLogger.flushPendingWrites();
      logger.info('Audit log writes flushed');
    } catch (error) {
      logger.error({ error }, 'Error flushing audit logs during shutdown');
    }

    for (const agent of Object.values(this.agents)) {
      try {
        await agent.shutdown();
      } catch (error) {
        logger.error({ error }, 'Error shutting down agent');
      }
    }

    try {
      await this.portAgent.shutdown();
    } catch (error) {
      logger.error({ error }, 'Error shutting down port agent');
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
        logger.info('Orchestrator shutdown complete');
        resolve();
      });
    });
  }

  private calculateSimpleDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    // Haversine formula for distance in nautical miles
    const R = 3440.1; // Earth radius in nautical miles
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }
}

