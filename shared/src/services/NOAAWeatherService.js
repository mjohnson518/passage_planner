"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NOAAWeatherService = void 0;
const noaa_api_client_1 = require("./noaa-api-client");
const circuit_breaker_1 = require("./resilience/circuit-breaker");
class NOAAWeatherService {
    noaaClient;
    cache;
    logger;
    gridPointBreaker;
    forecastBreaker;
    constructor(cache, logger, apiClient // Optional for dependency injection in tests
    ) {
        this.cache = cache;
        this.logger = logger;
        this.noaaClient = apiClient ?? new noaa_api_client_1.NOAAAPIClient(logger, cache);
        // Initialize circuit breakers for NOAA API calls
        this.gridPointBreaker = circuit_breaker_1.CircuitBreakerFactory.create('noaa-gridpoint', this.noaaClient.getGridPoint.bind(this.noaaClient), {
            timeout: 30000,
            errorThresholdPercentage: 50,
            resetTimeout: 60000
        });
        this.forecastBreaker = circuit_breaker_1.CircuitBreakerFactory.create('noaa-forecast', this.noaaClient.getWeatherForecast.bind(this.noaaClient), {
            timeout: 30000,
            errorThresholdPercentage: 50,
            resetTimeout: 60000
        });
    }
    /**
     * Get marine weather forecast for a specific point
     * Now using REAL NOAA API data
     */
    async getMarineForecast(latitude, longitude, days = 7) {
        const cacheKey = `weather:forecast:${latitude.toFixed(4)},${longitude.toFixed(4)}:${days}`;
        // Check cache first with metadata (3 hour TTL for weather)
        const cachedData = await this.cache.getWithMetadata(cacheKey);
        if (cachedData && cachedData.value) {
            this.logger.debug({
                latitude,
                longitude,
                age: cachedData.age,
                ttl: cachedData.ttl
            }, 'Returning cached marine forecast');
            return cachedData.value;
        }
        try {
            // Get REAL weather forecast from NOAA with circuit breaker protection
            const [forecast, alerts] = await Promise.all([
                this.forecastBreaker.fire(latitude, longitude).then((result) => result).catch(async (error) => {
                    // If circuit is open, try to return cached data
                    this.logger.warn({ error: error.message }, 'Circuit breaker open for forecast, checking cache');
                    const fallbackCache = await this.cache.get(`weather:forecast:fallback:${latitude.toFixed(4)},${longitude.toFixed(4)}`);
                    if (fallbackCache) {
                        this.logger.info('Using fallback cached forecast data');
                        return fallbackCache;
                    }
                    throw error; // Re-throw if no cache available
                }),
                this.noaaClient.getActiveAlerts(latitude, longitude)
            ]);
            // Transform NOAA format to our internal format
            const marineForecast = {
                location: {
                    latitude,
                    longitude,
                    name: undefined // Will be populated from grid point city
                },
                issuedAt: new Date(forecast.generatedAt),
                periods: forecast.periods.slice(0, days * 2).map(period => ({
                    startTime: new Date(period.startTime),
                    endTime: new Date(period.endTime),
                    temperature: period.temperature,
                    temperatureUnit: period.temperatureUnit,
                    windSpeed: period.windSpeed,
                    windDirection: period.windDirection,
                    shortForecast: period.shortForecast,
                    detailedForecast: period.detailedForecast,
                    precipitationChance: period.probabilityOfPrecipitation?.value || 0,
                    isDaytime: period.isDaytime
                })),
                warnings: alerts.map(alert => ({
                    id: alert.id,
                    type: this.mapWarningType(alert.event),
                    severity: alert.severity.toLowerCase(),
                    headline: alert.headline,
                    description: alert.description,
                    instruction: alert.instruction,
                    onset: new Date(alert.onset),
                    expires: new Date(alert.expires),
                    areas: alert.areaDesc.split('; ')
                })),
                waveHeight: [], // TODO: Implement when we have marine buoy data
                windData: this.extractWindData(forecast.periods),
                visibility: [] // TODO: Implement when we have visibility data
            };
            // Cache the result with proper TTL (3 hours for weather data)
            await this.cache.setWithTTL(cacheKey, marineForecast, 10800); // 3 hour TTL
            // Also store a fallback cache with longer TTL for circuit breaker scenarios
            await this.cache.setWithTTL(`weather:forecast:fallback:${latitude.toFixed(4)},${longitude.toFixed(4)}`, forecast, 86400 // 24 hour TTL for fallback
            );
            return marineForecast;
        }
        catch (error) {
            this.logger.error({ error, latitude, longitude }, 'Failed to get marine forecast');
            throw new Error('Unable to retrieve marine weather forecast');
        }
    }
    /**
     * Extract wind data from forecast periods
     */
    extractWindData(periods) {
        return periods.map(period => {
            const speed = this.noaaClient.parseWindSpeed(period.windSpeed);
            return {
                time: new Date(period.startTime),
                speed: speed,
                gusts: Math.round(speed * 1.5), // Estimate gusts as 1.5x sustained
                direction: this.parseWindDirection(period.windDirection)
            };
        });
    }
    /**
     * Parse wind direction string to degrees
     */
    parseWindDirection(direction) {
        const directions = {
            'N': 0, 'NNE': 22.5, 'NE': 45, 'ENE': 67.5,
            'E': 90, 'ESE': 112.5, 'SE': 135, 'SSE': 157.5,
            'S': 180, 'SSW': 202.5, 'SW': 225, 'WSW': 247.5,
            'W': 270, 'WNW': 292.5, 'NW': 315, 'NNW': 337.5
        };
        // Extract direction from strings like "SW 10 mph"
        const match = direction.match(/([NSEW]+)/);
        if (match && directions[match[1]]) {
            return directions[match[1]];
        }
        return 0;
    }
    /**
     * Map NOAA warning types to our internal types
     */
    mapWarningType(noaaEvent) {
        const eventLower = noaaEvent.toLowerCase();
        if (eventLower.includes('hurricane'))
            return 'hurricane';
        if (eventLower.includes('gale'))
            return 'gale';
        if (eventLower.includes('storm'))
            return 'storm';
        if (eventLower.includes('fog'))
            return 'fog';
        if (eventLower.includes('thunderstorm'))
            return 'thunderstorm';
        if (eventLower.includes('small craft'))
            return 'small_craft';
        return 'storm'; // default
    }
    /**
     * Check if conditions are safe for sailing
     */
    async checkSafetyConditions(forecast, preferences) {
        const warnings = [];
        let safe = true;
        // Check active weather warnings
        const severeWarnings = forecast.warnings.filter(w => w.severity === 'extreme' || w.severity === 'severe');
        if (severeWarnings.length > 0) {
            safe = false;
            warnings.push(...severeWarnings.map(w => w.headline));
        }
        // Check wind conditions
        const dangerousWinds = forecast.windData.filter(w => w.speed > preferences.maxWindSpeed || w.gusts > preferences.maxWindSpeed * 1.5);
        if (dangerousWinds.length > 0) {
            safe = false;
            warnings.push(`Wind speeds exceeding ${preferences.maxWindSpeed} knots detected`);
        }
        // Check wave heights
        const dangerousWaves = forecast.waveHeight.filter(w => w.height > preferences.maxWaveHeight);
        if (dangerousWaves.length > 0) {
            safe = false;
            warnings.push(`Wave heights exceeding ${preferences.maxWaveHeight}m detected`);
        }
        // Check visibility
        const poorVisibility = forecast.visibility.filter(v => v.distance < preferences.minVisibility);
        if (poorVisibility.length > 0) {
            safe = false;
            warnings.push(`Visibility below ${preferences.minVisibility} nm detected`);
        }
        return { safe, warnings };
    }
}
exports.NOAAWeatherService = NOAAWeatherService;
//# sourceMappingURL=NOAAWeatherService.js.map