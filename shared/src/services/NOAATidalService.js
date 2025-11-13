"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.noaaTidalService = exports.NOAATidalService = void 0;
const axios_1 = __importDefault(require("axios"));
const axios_retry_1 = __importDefault(require("axios-retry"));
const pino_1 = __importDefault(require("pino"));
const circuit_breaker_1 = require("./resilience/circuit-breaker");
const retry_client_1 = require("./resilience/retry-client");
class NOAATidalService {
    httpClient;
    logger;
    cache;
    stationCache = new Map();
    stationsBreaker;
    predictionsBreaker;
    // NOAA Tides API endpoints
    TIDES_API_BASE = 'https://api.tidesandcurrents.noaa.gov/api/prod/datagetter';
    STATIONS_API = 'https://api.tidesandcurrents.noaa.gov/mdapi/prod/webapi/stations.json';
    constructor(cache, logger) {
        this.cache = cache;
        this.logger = logger || (0, pino_1.default)({
            level: process.env.LOG_LEVEL || 'info'
        });
        // Create axios instance for NOAA Tides API
        this.httpClient = axios_1.default.create({
            timeout: 30000,
            headers: {
                'Accept': 'application/json',
            }
        });
        // Configure retry logic
        (0, axios_retry_1.default)(this.httpClient, {
            retries: 3,
            retryDelay: (retryCount) => retryCount * 1000,
            retryCondition: (error) => {
                return axios_retry_1.default.isNetworkOrIdempotentRequestError(error) ||
                    (error.response?.status || 0) >= 500;
            },
            onRetry: (retryCount, error) => {
                this.logger.warn(`Tidal API retry attempt ${retryCount} for ${error.config?.url}`);
            }
        });
        // Initialize circuit breakers for NOAA Tides API calls
        this.stationsBreaker = circuit_breaker_1.CircuitBreakerFactory.create('noaa-tidal-stations', this.getAllStations.bind(this), {
            timeout: 30000,
            errorThresholdPercentage: 50,
            resetTimeout: 60000
        });
        this.predictionsBreaker = circuit_breaker_1.CircuitBreakerFactory.create('noaa-tidal-predictions', this.fetchPredictions.bind(this), {
            timeout: 30000,
            errorThresholdPercentage: 50,
            resetTimeout: 60000
        });
        this.logger.info('NOAA Tidal Service initialized - Critical component ready');
    }
    /**
     * Find nearest tidal stations to a location
     * This is essential for getting accurate local tide predictions
     */
    async findNearestStations(lat, lon, radiusNM = 50) {
        const cacheKey = `tidal:stations:${lat.toFixed(2)}:${lon.toFixed(2)}:${radiusNM}`;
        // Check cache with metadata (stations don't change often - 30 day TTL)
        const cachedData = await this.cache.getWithMetadata(cacheKey);
        if (cachedData && cachedData.value) {
            this.logger.debug({ age: cachedData.age, ttl: cachedData.ttl }, 'Returning cached tidal stations');
            return cachedData.value;
        }
        try {
            // Fetch all stations with circuit breaker protection
            const allStations = await this.stationsBreaker.fire().then((result) => result).catch(async (error) => {
                // If circuit is open, try to return cached data
                this.logger.warn({ error: error.message }, 'Circuit breaker open for stations, checking fallback cache');
                const fallbackCache = await this.cache.get('tidal:stations:fallback');
                if (fallbackCache) {
                    this.logger.info('Using fallback cached station data');
                    return fallbackCache;
                }
                throw error; // Re-throw if no cache available
            });
            // Calculate distances and filter by radius
            const nearbyStations = allStations
                .map(station => ({
                ...station,
                distance: this.calculateDistance(lat, lon, station.lat, station.lon)
            }))
                .filter(station => station.distance <= radiusNM)
                .sort((a, b) => a.distance - b.distance)
                .slice(0, 10); // Return top 10 nearest
            // Cache for 30 days (stations don't change often)
            await this.cache.setWithTTL(cacheKey, nearbyStations, 2592000); // 30 days = 2592000 seconds
            // Also store fallback cache for circuit breaker
            await this.cache.setWithTTL('tidal:stations:fallback', nearbyStations, 7776000); // 90 days fallback
            this.logger.info({ count: nearbyStations.length }, 'Found nearby tidal stations');
            return nearbyStations;
        }
        catch (error) {
            this.logger.error({ error }, 'Failed to find tidal stations');
            throw new Error('Unable to find nearby tidal stations');
        }
    }
    /**
     * Get tidal predictions for a specific station
     * This is the core functionality - returns actual tide times and heights
     */
    async getTidalPredictions(stationId, startDate, endDate) {
        const cacheKey = `tidal:predictions:${stationId}:${startDate.toISOString()}:${endDate.toISOString()}`;
        // Check cache with metadata (24 hour TTL for predictions)
        const cachedData = await this.cache.getWithMetadata(cacheKey);
        if (cachedData && cachedData.value) {
            this.logger.debug({
                stationId,
                age: cachedData.age,
                ttl: cachedData.ttl
            }, 'Returning cached tidal predictions');
            return cachedData.value;
        }
        try {
            // Format dates for NOAA API (YYYYMMDD HH:MM)
            const beginDate = this.formatDate(startDate);
            const endDateStr = this.formatDate(endDate);
            const range = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60));
            // Fetch predictions and extremes in parallel with circuit breaker protection
            const [predictions, extremes, station] = await Promise.all([
                this.predictionsBreaker.fire(stationId, beginDate, range).then((result) => result).catch(async (error) => {
                    // If circuit is open, try to return cached data
                    this.logger.warn({ error: error.message }, 'Circuit breaker open for predictions, checking fallback cache');
                    const fallbackCache = await this.cache.get(`tidal:predictions:fallback:${stationId}`);
                    if (fallbackCache) {
                        this.logger.info('Using fallback cached predictions data');
                        return fallbackCache;
                    }
                    throw error; // Re-throw if no cache available
                }),
                this.fetchExtremes(stationId, beginDate, endDateStr),
                this.getStationInfo(stationId)
            ]);
            const tidalData = {
                station,
                predictions,
                extremes,
                currentHeight: predictions[0]?.height, // First prediction is nearest to current
                datum: 'MLLW',
                units: 'english'
            };
            // Cache for 24 hours (tide predictions)
            await this.cache.setWithTTL(cacheKey, tidalData, 86400); // 24 hours = 86400 seconds
            // Store fallback cache for circuit breaker
            await this.cache.setWithTTL(`tidal:predictions:fallback:${stationId}`, predictions, 604800 // 7 days fallback
            );
            this.logger.info({
                stationId,
                predictions: predictions.length,
                extremes: extremes.length
            }, 'Retrieved tidal predictions successfully');
            return tidalData;
        }
        catch (error) {
            this.logger.error({ error, stationId }, 'Failed to get tidal predictions');
            throw new Error(`Unable to retrieve tidal predictions for station ${stationId}`);
        }
    }
    /**
     * Fetch hourly predictions from NOAA
     */
    async fetchPredictions(stationId, beginDate, hours) {
        const params = {
            product: 'predictions',
            station: stationId,
            datum: 'MLLW', // Mean Lower Low Water
            units: 'english', // feet
            time_zone: 'gmt',
            format: 'json',
            begin_date: beginDate,
            range: hours,
            interval: 'h' // hourly predictions
        };
        // Use retry logic for resilience
        const data = await retry_client_1.RetryClient.requestWithRetry(() => this.httpClient.get(this.TIDES_API_BASE, { params }), {
            retries: 3,
            minTimeout: 1000,
            onFailedAttempt: (error) => {
                this.logger.warn({
                    attempt: error.attemptNumber,
                    stationId
                }, 'Tidal predictions fetch retry');
            }
        });
        if (data.error) {
            throw new Error(data.error.message);
        }
        return data.predictions.map((pred) => ({
            time: new Date(pred.t + 'Z'), // Add Z for UTC
            height: parseFloat(pred.v)
        }));
    }
    /**
     * Fetch high/low tide times from NOAA
     */
    async fetchExtremes(stationId, beginDate, endDate) {
        const params = {
            product: 'predictions',
            station: stationId,
            datum: 'MLLW',
            units: 'english',
            time_zone: 'gmt',
            format: 'json',
            begin_date: beginDate,
            end_date: endDate,
            interval: 'hilo' // High/Low predictions only
        };
        // Use retry logic for resilience
        const data = await retry_client_1.RetryClient.requestWithRetry(() => this.httpClient.get(this.TIDES_API_BASE, { params }), {
            retries: 3,
            minTimeout: 1000,
            onFailedAttempt: (error) => {
                this.logger.warn({
                    attempt: error.attemptNumber,
                    stationId
                }, 'Tidal predictions fetch retry');
            }
        });
        if (data.error) {
            throw new Error(data.error.message);
        }
        return data.predictions.map((pred) => ({
            time: new Date(pred.t + 'Z'),
            height: parseFloat(pred.v),
            type: pred.type === 'H' ? 'high' : 'low'
        }));
    }
    /**
     * Get current predictions for a station
     */
    async getCurrentPredictions(stationId, startDate, hours = 24) {
        const params = {
            product: 'currents_predictions',
            station: stationId,
            units: 'english', // knots
            time_zone: 'gmt',
            format: 'json',
            begin_date: this.formatDate(startDate),
            range: hours,
            interval: '6' // 6-minute intervals
        };
        try {
            // Use retry logic for resilience
            const data = await retry_client_1.RetryClient.requestWithRetry(() => this.httpClient.get(this.TIDES_API_BASE, { params }), {
                retries: 3,
                minTimeout: 1000,
                onFailedAttempt: (error) => {
                    this.logger.warn({
                        attempt: error.attemptNumber,
                        stationId
                    }, 'Current predictions fetch retry');
                }
            });
            if (data.error) {
                this.logger.warn({ stationId }, 'Current predictions not available for station');
                return [];
            }
            return data.current_predictions.map((pred) => ({
                time: new Date(pred.t + 'Z'),
                velocity: parseFloat(pred.v),
                direction: parseFloat(pred.d),
                type: this.classifyCurrentType(parseFloat(pred.v))
            }));
        }
        catch (error) {
            this.logger.warn({ error, stationId }, 'Failed to get current predictions');
            return [];
        }
    }
    /**
     * Calculate safe tidal windows for navigation
     * Critical for shallow draft vessels and bridge clearances
     */
    async calculateTidalWindows(stationId, startDate, durationHours, requirements) {
        const endDate = new Date(startDate.getTime() + durationHours * 60 * 60 * 1000);
        const tidalData = await this.getTidalPredictions(stationId, startDate, endDate);
        const windows = [];
        let currentWindow = null;
        for (const prediction of tidalData.predictions) {
            const heightOk = prediction.height >= requirements.minTideHeight &&
                (!requirements.maxTideHeight || prediction.height <= requirements.maxTideHeight);
            if (heightOk) {
                if (!currentWindow) {
                    currentWindow = {
                        start: prediction.time,
                        end: prediction.time,
                        minHeight: prediction.height,
                        maxHeight: prediction.height,
                        isSafe: true
                    };
                }
                else {
                    currentWindow.end = prediction.time;
                    currentWindow.minHeight = Math.min(currentWindow.minHeight, prediction.height);
                    currentWindow.maxHeight = Math.max(currentWindow.maxHeight, prediction.height);
                }
            }
            else {
                if (currentWindow) {
                    // Window must be at least 1 hour to be useful
                    if ((currentWindow.end.getTime() - currentWindow.start.getTime()) >= 3600000) {
                        windows.push(currentWindow);
                    }
                    currentWindow = null;
                }
            }
        }
        // Add final window if exists
        if (currentWindow &&
            (currentWindow.end.getTime() - currentWindow.start.getTime()) >= 3600000) {
            windows.push(currentWindow);
        }
        this.logger.info({
            stationId,
            windowsFound: windows.length,
            requirements
        }, 'Calculated tidal windows');
        return windows;
    }
    /**
     * Get all tidal stations (cached)
     */
    async getAllStations() {
        const cacheKey = 'tidal:all_stations';
        // Check cache (30 day TTL - stations rarely change)
        const cached = await this.cache.get(cacheKey);
        if (cached) {
            return cached;
        }
        // Use retry logic for resilience
        const data = await retry_client_1.RetryClient.requestWithRetry(() => this.httpClient.get(this.STATIONS_API), {
            retries: 3,
            minTimeout: 1000,
            onFailedAttempt: (error) => {
                this.logger.warn({
                    attempt: error.attemptNumber
                }, 'Stations fetch retry');
            }
        });
        const stations = data.stations
            .filter((s) => s.tidal && s.tidal === 'true')
            .map((s) => ({
            id: s.id,
            name: s.name,
            lat: parseFloat(s.lat),
            lon: parseFloat(s.lng),
            timezone: s.timezone,
            type: s.type === 'H' ? 'harmonic' : 'subordinate',
            reference_id: s.reference_id
        }));
        // Cache for 30 days (station list rarely changes)
        await this.cache.setWithTTL(cacheKey, stations, 2592000); // 30 days = 2592000 seconds
        return stations;
    }
    /**
     * Get station information
     */
    async getStationInfo(stationId) {
        if (this.stationCache.has(stationId)) {
            return this.stationCache.get(stationId);
        }
        const allStations = await this.getAllStations();
        const station = allStations.find(s => s.id === stationId);
        if (!station) {
            throw new Error(`Station ${stationId} not found`);
        }
        this.stationCache.set(stationId, station);
        return station;
    }
    /**
     * Calculate distance between two points (nautical miles)
     */
    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 3440.065; // Earth radius in nautical miles
        const φ1 = lat1 * Math.PI / 180;
        const φ2 = lat2 * Math.PI / 180;
        const Δφ = (lat2 - lat1) * Math.PI / 180;
        const Δλ = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
                Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }
    /**
     * Format date for NOAA API
     */
    formatDate(date) {
        const year = date.getUTCFullYear();
        const month = String(date.getUTCMonth() + 1).padStart(2, '0');
        const day = String(date.getUTCDate()).padStart(2, '0');
        const hours = String(date.getUTCHours()).padStart(2, '0');
        const minutes = String(date.getUTCMinutes()).padStart(2, '0');
        return `${year}${month}${day} ${hours}:${minutes}`;
    }
    /**
     * Classify current type based on velocity
     */
    classifyCurrentType(velocity) {
        if (Math.abs(velocity) < 0.1)
            return 'slack';
        if (velocity > 0.5)
            return 'max_flood';
        if (velocity < -0.5)
            return 'max_ebb';
        return undefined;
    }
}
exports.NOAATidalService = NOAATidalService;
// Export for immediate use
const noaaTidalService = (cache, logger) => new NOAATidalService(cache, logger);
exports.noaaTidalService = noaaTidalService;
//# sourceMappingURL=NOAATidalService.js.map