"use strict";
/**
 * Typed Error Classes for Helmwise
 *
 * Provides structured, informative errors with context for debugging.
 * All errors include correlation IDs for request tracing.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ServiceUnavailableError = exports.ConfigurationError = exports.DatabaseError = exports.DataFreshnessError = exports.ExternalAPIError = exports.RateLimitError = exports.AuthorizationError = exports.AuthenticationError = exports.NotFoundError = exports.ValidationError = exports.SafetyValidationError = exports.RouteCalculationError = exports.TidalServiceError = exports.WeatherServiceError = exports.ApplicationError = void 0;
exports.isOperationalError = isOperationalError;
exports.getErrorStatusCode = getErrorStatusCode;
exports.formatErrorResponse = formatErrorResponse;
/**
 * Base Application Error
 */
class ApplicationError extends Error {
    code;
    statusCode;
    context;
    isOperational;
    constructor(message, code = 'APPLICATION_ERROR', statusCode = 500, context, isOperational = true) {
        super(message);
        this.name = this.constructor.name;
        this.code = code;
        this.statusCode = statusCode;
        this.context = context || {};
        this.isOperational = isOperational;
        // Ensure proper prototype chain for instanceof checks
        Object.setPrototypeOf(this, new.target.prototype);
        // Capture stack trace
        Error.captureStackTrace(this, this.constructor);
    }
    toJSON() {
        return {
            name: this.name,
            message: this.message,
            code: this.code,
            statusCode: this.statusCode,
            context: this.context,
            stack: this.stack,
        };
    }
}
exports.ApplicationError = ApplicationError;
/**
 * Weather Service Error
 */
class WeatherServiceError extends ApplicationError {
    constructor(message, context) {
        super(message, 'WEATHER_SERVICE_ERROR', 503, context);
    }
}
exports.WeatherServiceError = WeatherServiceError;
/**
 * Tidal Service Error
 */
class TidalServiceError extends ApplicationError {
    constructor(message, context) {
        super(message, 'TIDAL_SERVICE_ERROR', 503, context);
    }
}
exports.TidalServiceError = TidalServiceError;
/**
 * Route Calculation Error
 */
class RouteCalculationError extends ApplicationError {
    constructor(message, context) {
        super(message, 'ROUTE_CALCULATION_ERROR', 400, context);
    }
}
exports.RouteCalculationError = RouteCalculationError;
/**
 * Safety Validation Error
 */
class SafetyValidationError extends ApplicationError {
    constructor(message, context) {
        super(message, 'SAFETY_VALIDATION_ERROR', 400, context);
    }
}
exports.SafetyValidationError = SafetyValidationError;
/**
 * Data Validation Error
 */
class ValidationError extends ApplicationError {
    field;
    value;
    constructor(message, field, value, context) {
        super(message, 'VALIDATION_ERROR', 400, context);
        this.field = field;
        this.value = value;
    }
}
exports.ValidationError = ValidationError;
/**
 * Not Found Error
 */
class NotFoundError extends ApplicationError {
    resource;
    constructor(message, resource, context) {
        super(message, 'NOT_FOUND', 404, context);
        this.resource = resource;
    }
}
exports.NotFoundError = NotFoundError;
/**
 * Authentication Error
 */
class AuthenticationError extends ApplicationError {
    constructor(message, context) {
        super(message, 'AUTHENTICATION_ERROR', 401, context);
    }
}
exports.AuthenticationError = AuthenticationError;
/**
 * Authorization Error
 */
class AuthorizationError extends ApplicationError {
    requiredPermission;
    constructor(message, requiredPermission, context) {
        super(message, 'AUTHORIZATION_ERROR', 403, context);
        this.requiredPermission = requiredPermission;
    }
}
exports.AuthorizationError = AuthorizationError;
/**
 * Rate Limit Error
 */
class RateLimitError extends ApplicationError {
    retryAfter; // seconds
    constructor(message, retryAfter, context) {
        super(message, 'RATE_LIMIT_EXCEEDED', 429, context);
        this.retryAfter = retryAfter;
    }
}
exports.RateLimitError = RateLimitError;
/**
 * External API Error
 */
class ExternalAPIError extends ApplicationError {
    apiName;
    apiStatusCode;
    constructor(message, apiName, apiStatusCode, context) {
        super(message, 'EXTERNAL_API_ERROR', 503, context);
        this.apiName = apiName;
        this.apiStatusCode = apiStatusCode;
    }
}
exports.ExternalAPIError = ExternalAPIError;
/**
 * Data Freshness Error (stale data detected)
 */
class DataFreshnessError extends ApplicationError {
    dataAge; // milliseconds
    maxAge; // milliseconds
    constructor(message, dataAge, maxAge, context) {
        super(message, 'DATA_FRESHNESS_ERROR', 500, context);
        this.dataAge = dataAge;
        this.maxAge = maxAge;
    }
}
exports.DataFreshnessError = DataFreshnessError;
/**
 * Database Error
 */
class DatabaseError extends ApplicationError {
    operation;
    constructor(message, operation, context) {
        super(message, 'DATABASE_ERROR', 500, context, false // Database errors are not operational
        );
        this.operation = operation;
    }
}
exports.DatabaseError = DatabaseError;
/**
 * Configuration Error
 */
class ConfigurationError extends ApplicationError {
    configKey;
    constructor(message, configKey, context) {
        super(message, 'CONFIGURATION_ERROR', 500, context, false // Configuration errors are not operational
        );
        this.configKey = configKey;
    }
}
exports.ConfigurationError = ConfigurationError;
/**
 * Service Unavailable Error
 */
class ServiceUnavailableError extends ApplicationError {
    serviceName;
    constructor(message, serviceName, context) {
        super(message, 'SERVICE_UNAVAILABLE', 503, context);
        this.serviceName = serviceName;
    }
}
exports.ServiceUnavailableError = ServiceUnavailableError;
/**
 * Check if error is operational (expected) vs programming error
 */
function isOperationalError(error) {
    if (error instanceof ApplicationError) {
        return error.isOperational;
    }
    return false;
}
/**
 * Extract HTTP status code from error
 */
function getErrorStatusCode(error) {
    if (error instanceof ApplicationError) {
        return error.statusCode;
    }
    return 500;
}
/**
 * Format error for API response
 */
function formatErrorResponse(error, includeStack = false) {
    if (error instanceof ApplicationError) {
        return {
            error: {
                message: error.message,
                code: error.code,
                ...(includeStack ? { stack: error.stack } : {}),
                ...(error.context || {}),
            },
        };
    }
    return {
        error: {
            message: error.message,
            code: 'INTERNAL_ERROR',
            ...(includeStack ? { stack: error.stack } : {}),
        },
    };
}
//# sourceMappingURL=errors.js.map