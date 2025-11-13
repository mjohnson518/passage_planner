"use strict";
/**
 * Mock NOAA API Response Fixtures
 * Based on actual api.weather.gov response structures
 * Used for testing without external API dependencies
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MOCK_FORECAST_STALE = exports.MOCK_ERROR_RATE_LIMIT = exports.MOCK_ERROR_SERVICE_UNAVAILABLE = exports.MOCK_ERROR_INVALID_COORDINATES = exports.MOCK_ALERTS_NONE = exports.MOCK_ALERTS_GALE_WARNING = exports.MOCK_FORECAST_GALE_WARNING = exports.MOCK_FORECAST_BOSTON = exports.MOCK_GRID_POINT_PORTLAND = exports.MOCK_GRID_POINT_BOSTON = void 0;
exports.createMockGridPoint = createMockGridPoint;
exports.createMockForecast = createMockForecast;
/**
 * NOAA Grid Point Response
 * Step 1 of NOAA weather lookup: /points/{lat},{lon}
 */
exports.MOCK_GRID_POINT_BOSTON = {
    properties: {
        gridId: 'BOX',
        gridX: 70,
        gridY: 90,
        relativeLocation: {
            properties: {
                city: 'Boston',
                state: 'MA'
            }
        },
        timeZone: 'America/New_York',
        radarStation: 'KBOX'
    }
};
exports.MOCK_GRID_POINT_PORTLAND = {
    properties: {
        gridId: 'GYX',
        gridX: 45,
        gridY: 75,
        relativeLocation: {
            properties: {
                city: 'Portland',
                state: 'ME'
            }
        },
        timeZone: 'America/New_York',
        radarStation: 'KGYX'
    }
};
/**
 * NOAA Forecast Response
 * Step 2 of NOAA weather lookup: /gridpoints/{office}/{x},{y}/forecast
 */
exports.MOCK_FORECAST_BOSTON = {
    properties: {
        updated: new Date().toISOString(),
        generatedAt: new Date().toISOString(),
        updateTime: new Date().toISOString(),
        periods: [
            {
                number: 1,
                name: 'Tonight',
                startTime: new Date().toISOString(),
                endTime: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
                isDaytime: false,
                temperature: 45,
                temperatureUnit: 'F',
                windSpeed: '10 to 15 mph',
                windDirection: 'SW',
                shortForecast: 'Partly Cloudy',
                detailedForecast: 'Partly cloudy with light winds from the southwest.',
                probabilityOfPrecipitation: {
                    unitCode: 'wmoUnit:percent',
                    value: 20
                }
            },
            {
                number: 2,
                name: 'Wednesday',
                startTime: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
                endTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                isDaytime: true,
                temperature: 66,
                temperatureUnit: 'F',
                windSpeed: '8 to 13 mph',
                windDirection: 'SW',
                shortForecast: 'Mostly Sunny',
                detailedForecast: 'Mostly sunny with light southwest winds.',
                probabilityOfPrecipitation: {
                    unitCode: 'wmoUnit:percent',
                    value: 10
                }
            }
        ]
    }
};
/**
 * NOAA Forecast with Hazardous Conditions
 */
exports.MOCK_FORECAST_GALE_WARNING = {
    properties: {
        updated: new Date().toISOString(),
        generatedAt: new Date().toISOString(),
        updateTime: new Date().toISOString(),
        periods: [
            {
                number: 1,
                name: 'Tonight',
                startTime: new Date().toISOString(),
                endTime: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
                isDaytime: false,
                temperature: 38,
                temperatureUnit: 'F',
                windSpeed: '35 to 45 mph',
                windDirection: 'NE',
                shortForecast: 'Gale Force Winds',
                detailedForecast: 'Gale force winds with heavy rain. Small craft advisory in effect.',
                probabilityOfPrecipitation: {
                    unitCode: 'wmoUnit:percent',
                    value: 90
                }
            }
        ]
    }
};
/**
 * NOAA Active Alerts Response
 */
exports.MOCK_ALERTS_GALE_WARNING = {
    features: [
        {
            properties: {
                id: 'urn:oid:2.49.0.1.840.0.test',
                areaDesc: 'Boston Harbor, Massachusetts Bay',
                headline: 'Gale Warning',
                description: 'Northeast winds 35 to 45 mph with gusts to 55 mph. Seas 10 to 15 feet.',
                severity: 'Severe',
                urgency: 'Expected',
                event: 'Gale Warning',
                onset: new Date().toISOString(),
                expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                instruction: 'Mariners should alter plans to avoid hazardous conditions. Small craft should remain in port.'
            }
        }
    ]
};
exports.MOCK_ALERTS_NONE = {
    features: []
};
/**
 * NOAA Error Responses
 */
exports.MOCK_ERROR_INVALID_COORDINATES = {
    correlationId: 'test-correlation-id',
    title: 'Invalid Coordinates',
    type: 'https://api.weather.gov/problems/InvalidParameter',
    status: 400,
    detail: 'The provided coordinates are invalid.',
    instance: '/points/91,-71'
};
exports.MOCK_ERROR_SERVICE_UNAVAILABLE = {
    correlationId: 'test-correlation-id',
    title: 'Service Unavailable',
    type: 'https://api.weather.gov/problems/ServiceUnavailable',
    status: 503,
    detail: 'The NOAA API is temporarily unavailable. Please try again later.'
};
exports.MOCK_ERROR_RATE_LIMIT = {
    correlationId: 'test-correlation-id',
    title: 'Too Many Requests',
    type: 'https://api.weather.gov/problems/RateLimitExceeded',
    status: 429,
    detail: 'Rate limit exceeded. Please wait before making additional requests.',
    retryAfter: 60 // seconds
};
/**
 * Stale Forecast (>3 hours old - should be rejected)
 */
exports.MOCK_FORECAST_STALE = {
    properties: {
        updated: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(), // 4 hours ago
        generatedAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
        updateTime: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
        periods: [
            {
                number: 1,
                name: 'Stale Forecast',
                startTime: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
                endTime: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
                isDaytime: true,
                temperature: 65,
                temperatureUnit: 'F',
                windSpeed: '10 mph',
                windDirection: 'SW',
                shortForecast: 'OLD DATA',
                detailedForecast: 'This forecast is too old and should be rejected.',
                probabilityOfPrecipitation: { value: 0 }
            }
        ]
    }
};
/**
 * Helper to create grid point response for any coordinates
 */
function createMockGridPoint(lat, lon) {
    const office = lat > 40 ? 'BOX' : 'MIA';
    const gridX = Math.floor((lon + 180) * 2);
    const gridY = Math.floor((lat + 90) * 2);
    return {
        properties: {
            gridId: office,
            gridX,
            gridY,
            relativeLocation: {
                properties: {
                    city: `TestCity${lat.toFixed(0)}`,
                    state: 'TS'
                }
            },
            timeZone: 'America/New_York'
        }
    };
}
/**
 * Helper to create forecast with specific conditions
 */
function createMockForecast(conditions) {
    return {
        properties: {
            updated: new Date().toISOString(),
            generatedAt: new Date().toISOString(),
            updateTime: new Date().toISOString(),
            periods: [
                {
                    number: 1,
                    name: 'Current',
                    startTime: new Date().toISOString(),
                    endTime: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
                    isDaytime: true,
                    temperature: conditions.temp || 65,
                    temperatureUnit: 'F',
                    windSpeed: conditions.windSpeed || '10 mph',
                    windDirection: conditions.windDir || 'SW',
                    shortForecast: conditions.forecast || 'Clear',
                    detailedForecast: `Test forecast with ${conditions.forecast || 'clear'} conditions.`,
                    probabilityOfPrecipitation: {
                        unitCode: 'wmoUnit:percent',
                        value: conditions.precip || 0
                    }
                }
            ]
        }
    };
}
//# sourceMappingURL=noaa-api-responses.js.map