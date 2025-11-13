"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.noaaClient = exports.NOAAAPIClient = void 0;
const axios_1 = __importDefault(require("axios"));
const axios_retry_1 = __importDefault(require("axios-retry"));
const pino_1 = __importDefault(require("pino"));
const retry_client_1 = require("./resilience/retry-client");
class NOAAAPIClient {
    httpClient;
    logger;
    gridCache = new Map();
    cache;
    constructor(logger, cache) {
        this.logger = logger || (0, pino_1.default)({
            level: process.env.LOG_LEVEL || 'info'
        });
        this.cache = cache;
        // Create axios instance with required User-Agent header
        this.httpClient = axios_1.default.create({
            baseURL: 'https://api.weather.gov',
            timeout: 30000,
            headers: {
                'User-Agent': '(helmwise.co, support@helmwise.co)', // REQUIRED by NOAA
                'Accept': 'application/geo+json, application/json',
            }
        });
        // Configure retry logic
        (0, axios_retry_1.default)(this.httpClient, {
            retries: 3,
            retryDelay: (retryCount) => {
                return retryCount * 1000; // exponential backoff
            },
            retryCondition: (error) => {
                // Retry on network errors or 5xx errors
                return axios_retry_1.default.isNetworkOrIdempotentRequestError(error) ||
                    (error.response?.status || 0) >= 500;
            },
            onRetry: (retryCount, error) => {
                this.logger.warn(`Retry attempt ${retryCount} for ${error.config?.url}`);
            }
        });
        this.logger.info('NOAA API Client initialized with real endpoints');
    }
    /**
     * Get weather forecast for coordinates
     * This is the main entry point - returns REAL weather data
     */
    async getWeatherForecast(lat, lon) {
        this.logger.info({ lat, lon }, 'Fetching real weather forecast from NOAA');
        try {
            // Step 1: Get grid point from coordinates
            const gridPoint = await this.getGridPoint(lat, lon);
            // Step 2: Get forecast using grid point
            const forecast = await this.getForecastFromGrid(gridPoint.office, gridPoint.gridX, gridPoint.gridY);
            // Validate data freshness
            const generatedAt = new Date(forecast.generatedAt);
            const ageHours = (Date.now() - generatedAt.getTime()) / (1000 * 60 * 60);
            if (ageHours > 3) {
                this.logger.warn({ ageHours }, 'Weather data is stale (>3 hours old)');
            }
            this.logger.info({
                location: `${gridPoint.city}, ${gridPoint.state}`,
                periods: forecast.periods.length,
                generated: forecast.generatedAt
            }, 'Successfully fetched real weather data');
            return forecast;
        }
        catch (error) {
            this.logger.error({ error, lat, lon }, 'Failed to fetch weather forecast');
            throw error;
        }
    }
    /**
     * Get grid point from latitude/longitude
     * NOAA requires this two-step process
     */
    async getGridPoint(lat, lon) {
        const cacheKey = `weather:grid:${lat.toFixed(4)},${lon.toFixed(4)}`;
        // Check Redis cache first (7 day TTL for grid points - they rarely change)
        if (this.cache) {
            const cached = await this.cache.get(cacheKey);
            if (cached) {
                this.logger.debug({ cacheKey }, 'Using Redis cached grid point');
                return cached;
            }
        }
        // Check in-memory cache as fallback
        const memCacheKey = `${lat.toFixed(4)},${lon.toFixed(4)}`;
        if (this.gridCache.has(memCacheKey)) {
            this.logger.debug({ cacheKey: memCacheKey }, 'Using memory cached grid point');
            return this.gridCache.get(memCacheKey);
        }
        const url = `/points/${lat.toFixed(4)},${lon.toFixed(4)}`;
        this.logger.debug({ url }, 'Fetching grid point from NOAA');
        // Use retry logic for resilience
        const response = await retry_client_1.RetryClient.requestWithRetry(() => this.httpClient.get(url), {
            retries: 3,
            minTimeout: 1000,
            onFailedAttempt: (error) => {
                this.logger.warn({
                    attempt: error.attemptNumber,
                    url
                }, 'Grid point fetch retry');
            }
        });
        const properties = response.properties;
        const gridPoint = {
            office: properties.gridId,
            gridX: properties.gridX,
            gridY: properties.gridY,
            city: properties.relativeLocation?.properties?.city,
            state: properties.relativeLocation?.properties?.state,
            timeZone: properties.timeZone
        };
        // Cache for future use
        this.gridCache.set(memCacheKey, gridPoint);
        // Store in Redis with 7 day TTL (grid points rarely change)
        if (this.cache) {
            await this.cache.setWithTTL(cacheKey, gridPoint, 604800); // 7 days = 604800 seconds
        }
        this.logger.info({
            office: gridPoint.office,
            gridX: gridPoint.gridX,
            gridY: gridPoint.gridY,
            city: gridPoint.city,
            state: gridPoint.state
        }, 'Grid point retrieved successfully');
        return gridPoint;
    }
    /**
     * Get forecast from grid coordinates
     * Returns actual NOAA forecast data
     */
    async getForecastFromGrid(office, gridX, gridY) {
        const url = `/gridpoints/${office}/${gridX},${gridY}/forecast`;
        this.logger.debug({ url }, 'Fetching forecast from NOAA');
        // Use retry logic for resilience
        const data = await retry_client_1.RetryClient.requestWithRetry(() => this.httpClient.get(url), {
            retries: 3,
            minTimeout: 1000,
            onFailedAttempt: (error) => {
                this.logger.warn({
                    attempt: error.attemptNumber,
                    url
                }, 'Forecast fetch retry');
            }
        });
        const properties = data.properties;
        return {
            updated: properties.updated,
            generatedAt: properties.generatedAt,
            updateTime: properties.updateTime,
            periods: properties.periods,
            elevation: properties.elevation
        };
    }
    /**
     * Get marine forecast for coastal areas
     * Uses marine-specific endpoints when available
     */
    async getMarineForecast(lat, lon) {
        this.logger.info({ lat, lon }, 'Fetching marine forecast');
        try {
            // First get regular forecast
            const forecast = await this.getWeatherForecast(lat, lon);
            // Then try to get marine-specific data
            const gridPoint = await this.getGridPoint(lat, lon);
            const marineUrl = `/gridpoints/${gridPoint.office}/${gridPoint.gridX},${gridPoint.gridY}/forecast/marine`;
            try {
                const marineResponse = await this.httpClient.get(marineUrl);
                // Combine regular and marine forecasts
                return {
                    ...forecast,
                    marine: marineResponse.data.properties
                };
            }
            catch (marineError) {
                // Marine forecast not available for all locations
                this.logger.debug('Marine forecast not available, using regular forecast');
                return forecast;
            }
        }
        catch (error) {
            this.logger.error({ error }, 'Failed to fetch marine forecast');
            throw error;
        }
    }
    /**
     * Get active weather alerts/warnings for an area
     */
    async getActiveAlerts(lat, lon) {
        const url = '/alerts/active';
        const params = {
            point: `${lat.toFixed(4)},${lon.toFixed(4)}`,
            status: 'actual',
            message_type: 'alert,update'
        };
        this.logger.debug({ url, params }, 'Fetching active alerts');
        try {
            // Use retry logic for resilience
            const data = await retry_client_1.RetryClient.requestWithRetry(() => this.httpClient.get(url, { params }), {
                retries: 3,
                minTimeout: 1000,
                onFailedAttempt: (error) => {
                    this.logger.warn({
                        attempt: error.attemptNumber,
                        url
                    }, 'Alerts fetch retry');
                }
            });
            const warnings = data.features.map((feature) => ({
                id: feature.properties.id,
                areaDesc: feature.properties.areaDesc,
                headline: feature.properties.headline,
                description: feature.properties.description,
                severity: feature.properties.severity,
                certainty: feature.properties.certainty,
                urgency: feature.properties.urgency,
                event: feature.properties.event,
                onset: feature.properties.onset,
                expires: feature.properties.expires,
                instruction: feature.properties.instruction
            }));
            this.logger.info({ count: warnings.length }, 'Retrieved active alerts');
            return warnings;
        }
        catch (error) {
            this.logger.warn({ error }, 'Failed to fetch alerts, returning empty array');
            return [];
        }
    }
    /**
     * Parse wind speed string to knots
     * NOAA returns strings like "15 mph" or "10 to 15 mph"
     */
    parseWindSpeed(windSpeed) {
        const match = windSpeed.match(/(\d+)/);
        if (!match)
            return 0;
        const speed = parseInt(match[1]);
        // Convert to knots if in mph
        if (windSpeed.toLowerCase().includes('mph')) {
            return Math.round(speed * 0.868976);
        }
        return speed;
    }
}
exports.NOAAAPIClient = NOAAAPIClient;
// Export singleton instance for immediate use
exports.noaaClient = new NOAAAPIClient();
//# sourceMappingURL=noaa-api-client.js.map