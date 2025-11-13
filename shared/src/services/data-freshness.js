"use strict";
/**
 * Data Freshness Validator
 *
 * SAFETY CRITICAL: Validates that data is recent enough for safe maritime decisions.
 * Rejects stale weather/tidal data that could lead to unsafe passage planning.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DataFreshnessValidator = void 0;
const errors_1 = require("../types/errors");
class DataFreshnessValidator {
    config;
    logger;
    constructor(config, logger) {
        this.config = {
            weatherForecastMaxAgeMs: config?.weatherForecastMaxAgeMs ?? 3 * 60 * 60 * 1000, // 3 hours
            tidalPredictionMaxAgeMs: config?.tidalPredictionMaxAgeMs ?? 24 * 60 * 60 * 1000, // 24 hours
            navigationWarningMaxAgeMs: config?.navigationWarningMaxAgeMs ?? 48 * 60 * 60 * 1000, // 48 hours
            portInformationMaxAgeMs: config?.portInformationMaxAgeMs ?? 7 * 24 * 60 * 60 * 1000, // 7 days
            chartDataMaxAgeMs: config?.chartDataMaxAgeMs ?? 30 * 24 * 60 * 60 * 1000, // 30 days
            ...config,
        };
        this.logger = logger;
    }
    /**
     * Validate weather forecast data freshness
     */
    validateWeatherForecast(timestamp, correlationId) {
        this.validate(timestamp, this.config.weatherForecastMaxAgeMs, 'Weather Forecast', correlationId);
    }
    /**
     * Validate tidal prediction data freshness
     */
    validateTidalPrediction(timestamp, correlationId) {
        this.validate(timestamp, this.config.tidalPredictionMaxAgeMs, 'Tidal Prediction', correlationId);
    }
    /**
     * Validate navigation warning data freshness
     */
    validateNavigationWarning(timestamp, correlationId) {
        this.validate(timestamp, this.config.navigationWarningMaxAgeMs, 'Navigation Warning', correlationId);
    }
    /**
     * Validate port information data freshness
     */
    validatePortInformation(timestamp, correlationId) {
        this.validate(timestamp, this.config.portInformationMaxAgeMs, 'Port Information', correlationId);
    }
    /**
     * Core validation logic
     */
    validate(timestamp, maxAgeMs, dataType, correlationId) {
        const retrievedAt = new Date(timestamp.retrievedAt);
        const now = new Date();
        const ageMs = now.getTime() - retrievedAt.getTime();
        // Check if data is too old
        if (ageMs > maxAgeMs) {
            const ageHours = (ageMs / (60 * 60 * 1000)).toFixed(1);
            const maxAgeHours = (maxAgeMs / (60 * 60 * 1000)).toFixed(1);
            if (this.logger) {
                this.logger.error({
                    dataType,
                    source: timestamp.source,
                    retrievedAt: retrievedAt.toISOString(),
                    ageHours,
                    maxAgeHours,
                    correlationId,
                }, `Stale ${dataType} data detected - exceeds maximum age`);
            }
            throw new errors_1.DataFreshnessError(`${dataType} data is too old (${ageHours} hours). Maximum age: ${maxAgeHours} hours. Data from ${timestamp.source} retrieved at ${retrievedAt.toISOString()}.`, ageMs, maxAgeMs, {
                correlationId,
                dataType,
                source: timestamp.source,
                retrievedAt: retrievedAt.toISOString(),
                ageHours,
                maxAgeHours,
            });
        }
        // Check validUntil if provided
        if (timestamp.validUntil) {
            const validUntil = new Date(timestamp.validUntil);
            if (now > validUntil) {
                if (this.logger) {
                    this.logger.error({
                        dataType,
                        source: timestamp.source,
                        validUntil: validUntil.toISOString(),
                        correlationId,
                    }, `${dataType} data has expired`);
                }
                throw new errors_1.DataFreshnessError(`${dataType} data has expired. Valid until ${validUntil.toISOString()}.`, ageMs, 0, // Already expired
                {
                    correlationId,
                    dataType,
                    source: timestamp.source,
                    validUntil: validUntil.toISOString(),
                });
            }
        }
        // Log successful validation
        if (this.logger) {
            this.logger.debug({
                dataType,
                source: timestamp.source,
                ageMs,
                maxAgeMs,
                correlationId,
            }, `${dataType} data freshness validated`);
        }
    }
    /**
     * Check if data is fresh without throwing
     */
    isFresh(timestamp, maxAgeMs) {
        try {
            this.validate(timestamp, maxAgeMs, 'Data', undefined);
            return true;
        }
        catch (error) {
            return false;
        }
    }
    /**
     * Get data age in milliseconds
     */
    getDataAge(timestamp) {
        const retrievedAt = new Date(timestamp.retrievedAt);
        const now = new Date();
        return now.getTime() - retrievedAt.getTime();
    }
    /**
     * Get data age in human-readable format
     */
    getDataAgeFormatted(timestamp) {
        const ageMs = this.getDataAge(timestamp);
        const ageMinutes = Math.floor(ageMs / (60 * 1000));
        const ageHours = Math.floor(ageMs / (60 * 60 * 1000));
        const ageDays = Math.floor(ageMs / (24 * 60 * 60 * 1000));
        if (ageDays > 0)
            return `${ageDays} day${ageDays > 1 ? 's' : ''} ago`;
        if (ageHours > 0)
            return `${ageHours} hour${ageHours > 1 ? 's' : ''} ago`;
        if (ageMinutes > 0)
            return `${ageMinutes} minute${ageMinutes > 1 ? 's' : ''} ago`;
        return 'just now';
    }
    /**
     * Calculate time until data becomes stale
     */
    timeUntilStale(timestamp, maxAgeMs) {
        const ageMs = this.getDataAge(timestamp);
        return Math.max(0, maxAgeMs - ageMs);
    }
}
exports.DataFreshnessValidator = DataFreshnessValidator;
//# sourceMappingURL=data-freshness.js.map