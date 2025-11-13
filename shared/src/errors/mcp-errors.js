"use strict";
/**
 * MCP Error classes for comprehensive error handling
 * Provides specific error types with context and retry information
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DataError = exports.AgentError = exports.CircuitBreakerError = exports.ValidationError = exports.CacheError = exports.NOAAAPIError = exports.MCPError = exports.ErrorCode = void 0;
exports.isRetryableError = isRetryableError;
exports.toMCPError = toMCPError;
var ErrorCode;
(function (ErrorCode) {
    // API Errors
    ErrorCode["API_ERROR"] = "API_ERROR";
    ErrorCode["API_TIMEOUT"] = "API_TIMEOUT";
    ErrorCode["API_RATE_LIMIT"] = "API_RATE_LIMIT";
    ErrorCode["API_UNAUTHORIZED"] = "API_UNAUTHORIZED";
    // Cache Errors
    ErrorCode["CACHE_MISS"] = "CACHE_MISS";
    ErrorCode["CACHE_ERROR"] = "CACHE_ERROR";
    ErrorCode["CACHE_CONNECTION_FAILED"] = "CACHE_CONNECTION_FAILED";
    // Validation Errors
    ErrorCode["INVALID_COORDINATES"] = "INVALID_COORDINATES";
    ErrorCode["INVALID_DATE_RANGE"] = "INVALID_DATE_RANGE";
    ErrorCode["INVALID_PARAMETERS"] = "INVALID_PARAMETERS";
    // Circuit Breaker Errors
    ErrorCode["CIRCUIT_OPEN"] = "CIRCUIT_OPEN";
    ErrorCode["CIRCUIT_TIMEOUT"] = "CIRCUIT_TIMEOUT";
    // Agent Errors
    ErrorCode["AGENT_UNAVAILABLE"] = "AGENT_UNAVAILABLE";
    ErrorCode["AGENT_TIMEOUT"] = "AGENT_TIMEOUT";
    // Data Errors
    ErrorCode["DATA_NOT_FOUND"] = "DATA_NOT_FOUND";
    ErrorCode["DATA_STALE"] = "DATA_STALE";
    ErrorCode["DATA_INVALID"] = "DATA_INVALID";
})(ErrorCode || (exports.ErrorCode = ErrorCode = {}));
/**
 * Base MCP Error class with context and retry information
 */
class MCPError extends Error {
    code;
    retryable;
    context;
    timestamp;
    constructor(message, code, retryable = false, context) {
        super(message);
        this.name = 'MCPError';
        this.code = code;
        this.retryable = retryable;
        this.context = context;
        this.timestamp = new Date();
        // Maintains proper stack trace for where our error was thrown
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, MCPError);
        }
    }
    toJSON() {
        return {
            name: this.name,
            message: this.message,
            code: this.code,
            retryable: this.retryable,
            context: this.context,
            timestamp: this.timestamp,
            stack: this.stack
        };
    }
}
exports.MCPError = MCPError;
/**
 * NOAA API specific error
 */
class NOAAAPIError extends MCPError {
    statusCode;
    endpoint;
    constructor(message, statusCode, endpoint, retryable = true) {
        const code = statusCode === 429 ? ErrorCode.API_RATE_LIMIT :
            statusCode === 401 ? ErrorCode.API_UNAUTHORIZED :
                ErrorCode.API_ERROR;
        super(message, code, retryable, { statusCode, endpoint });
        this.name = 'NOAAAPIError';
        this.statusCode = statusCode;
        this.endpoint = endpoint;
    }
    static fromResponse(response, endpoint) {
        const statusCode = response.status || response.statusCode;
        const message = `NOAA API error: ${statusCode} - ${response.statusText || 'Unknown error'}`;
        // 5xx errors are retryable, 4xx generally are not (except 429)
        const retryable = statusCode >= 500 || statusCode === 429;
        return new NOAAAPIError(message, statusCode, endpoint, retryable);
    }
}
exports.NOAAAPIError = NOAAAPIError;
/**
 * Cache operation error
 */
class CacheError extends MCPError {
    constructor(message, operation, key) {
        const code = operation === 'connect' ?
            ErrorCode.CACHE_CONNECTION_FAILED :
            ErrorCode.CACHE_ERROR;
        super(message, code, true, { operation, key });
        this.name = 'CacheError';
    }
}
exports.CacheError = CacheError;
/**
 * Validation error for input parameters
 */
class ValidationError extends MCPError {
    field;
    value;
    constructor(message, field, value) {
        const code = field?.includes('lat') || field?.includes('lon') ?
            ErrorCode.INVALID_COORDINATES :
            field?.includes('date') || field?.includes('time') ?
                ErrorCode.INVALID_DATE_RANGE :
                ErrorCode.INVALID_PARAMETERS;
        super(message, code, false, { field, value });
        this.name = 'ValidationError';
        this.field = field;
        this.value = value;
    }
    static validateCoordinates(lat, lon) {
        if (lat < -90 || lat > 90) {
            throw new ValidationError(`Invalid latitude: ${lat}. Must be between -90 and 90`, 'latitude', lat);
        }
        if (lon < -180 || lon > 180) {
            throw new ValidationError(`Invalid longitude: ${lon}. Must be between -180 and 180`, 'longitude', lon);
        }
    }
    static validateDateRange(startDate, endDate) {
        if (startDate >= endDate) {
            throw new ValidationError('Start date must be before end date', 'dateRange', { startDate, endDate });
        }
        const maxRange = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds
        if (endDate.getTime() - startDate.getTime() > maxRange) {
            throw new ValidationError('Date range cannot exceed 30 days', 'dateRange', { startDate, endDate });
        }
    }
}
exports.ValidationError = ValidationError;
/**
 * Circuit breaker error
 */
class CircuitBreakerError extends MCPError {
    serviceName;
    state;
    constructor(serviceName, state = 'OPEN') {
        super(`Circuit breaker is ${state} for service: ${serviceName}`, ErrorCode.CIRCUIT_OPEN, true, { serviceName, state });
        this.name = 'CircuitBreakerError';
        this.serviceName = serviceName;
        this.state = state;
    }
}
exports.CircuitBreakerError = CircuitBreakerError;
/**
 * Agent communication error
 */
class AgentError extends MCPError {
    agentName;
    constructor(message, agentName, timeout = false) {
        super(message, timeout ? ErrorCode.AGENT_TIMEOUT : ErrorCode.AGENT_UNAVAILABLE, true, { agentName });
        this.name = 'AgentError';
        this.agentName = agentName;
    }
}
exports.AgentError = AgentError;
/**
 * Data quality error
 */
class DataError extends MCPError {
    constructor(message, dataType, issue) {
        const code = issue === 'not_found' ? ErrorCode.DATA_NOT_FOUND :
            issue === 'stale' ? ErrorCode.DATA_STALE :
                ErrorCode.DATA_INVALID;
        super(message, code, issue === 'not_found', { dataType, issue });
        this.name = 'DataError';
    }
    static checkDataFreshness(data, maxAgeHours = 3) {
        if (!data.timestamp && !data.updated && !data.generatedAt) {
            throw new DataError('Data missing timestamp - cannot verify freshness', 'weather', 'invalid');
        }
        const timestamp = new Date(data.timestamp || data.updated || data.generatedAt);
        const ageHours = (Date.now() - timestamp.getTime()) / (1000 * 60 * 60);
        if (ageHours > maxAgeHours) {
            throw new DataError(`Data is ${ageHours.toFixed(1)} hours old (max: ${maxAgeHours} hours)`, 'weather', 'stale');
        }
    }
}
exports.DataError = DataError;
/**
 * Helper function to determine if an error is retryable
 */
function isRetryableError(error) {
    if (error instanceof MCPError) {
        return error.retryable;
    }
    // Network errors are generally retryable
    if (error.code && ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND'].includes(error.code)) {
        return true;
    }
    // HTTP status codes
    if (error.statusCode) {
        return error.statusCode >= 500 || error.statusCode === 429;
    }
    return false;
}
/**
 * Convert any error to MCPError
 */
function toMCPError(error, defaultCode = ErrorCode.API_ERROR) {
    if (error instanceof MCPError) {
        return error;
    }
    if (error.response) {
        // Axios error
        return NOAAAPIError.fromResponse(error.response, error.config?.url || 'unknown');
    }
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
        return new MCPError(`Connection failed: ${error.message}`, ErrorCode.API_ERROR, true, { originalError: error });
    }
    return new MCPError(error.message || 'Unknown error', defaultCode, false, { originalError: error });
}
//# sourceMappingURL=mcp-errors.js.map