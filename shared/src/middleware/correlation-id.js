"use strict";
/**
 * Correlation ID Middleware
 *
 * Generates and propagates correlation IDs for request tracing across services.
 * Critical for debugging distributed systems and audit trail requirements.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = exports.CORRELATION_ID_HEADER = void 0;
exports.correlationIdMiddleware = correlationIdMiddleware;
exports.generateCorrelationId = generateCorrelationId;
exports.setCorrelationId = setCorrelationId;
exports.getCorrelationId = getCorrelationId;
exports.clearCorrelationId = clearCorrelationId;
exports.withCorrelationId = withCorrelationId;
exports.createLogEntry = createLogEntry;
const uuid_1 = require("uuid");
exports.CORRELATION_ID_HEADER = 'x-correlation-id';
/**
 * Express middleware to add correlation IDs to requests
 */
function correlationIdMiddleware(req, res, next) {
    // Get correlation ID from header or generate new one
    const correlationId = req.headers[exports.CORRELATION_ID_HEADER] || (0, uuid_1.v4)();
    req.correlationId = correlationId;
    // Add to response headers for client tracking
    res.setHeader(exports.CORRELATION_ID_HEADER, correlationId);
    // Log request with correlation ID
    console.log(`[${correlationId}] ${req.method} ${req.path}`);
    next();
}
/**
 * Generate correlation ID for client-side requests
 */
function generateCorrelationId() {
    return (0, uuid_1.v4)();
}
/**
 * Storage for current correlation ID (client-side)
 */
let currentCorrelationId = null;
/**
 * Set correlation ID for current request context
 */
function setCorrelationId(id) {
    currentCorrelationId = id;
}
/**
 * Get current correlation ID
 */
function getCorrelationId() {
    if (!currentCorrelationId) {
        currentCorrelationId = generateCorrelationId();
    }
    return currentCorrelationId;
}
/**
 * Clear correlation ID (call after request completes)
 */
function clearCorrelationId() {
    currentCorrelationId = null;
}
/**
 * Add correlation ID to fetch headers
 */
function withCorrelationId(headers = {}) {
    return {
        ...headers,
        [exports.CORRELATION_ID_HEADER]: getCorrelationId(),
    };
}
/**
 * Create structured log entry
 */
function createLogEntry(level, message, context, error) {
    return {
        correlationId: getCorrelationId(),
        timestamp: new Date().toISOString(),
        level,
        message,
        context,
        error: error ? {
            message: error.message,
            stack: error.stack,
            code: error.code,
        } : undefined,
    };
}
/**
 * Structured logger with correlation ID support
 */
exports.logger = {
    debug: (message, context) => {
        const entry = createLogEntry('debug', message, context);
        console.debug(JSON.stringify(entry));
    },
    info: (message, context) => {
        const entry = createLogEntry('info', message, context);
        console.info(JSON.stringify(entry));
    },
    warn: (message, context) => {
        const entry = createLogEntry('warn', message, context);
        console.warn(JSON.stringify(entry));
    },
    error: (message, context, error) => {
        const entry = createLogEntry('error', message, context, error);
        console.error(JSON.stringify(entry));
    },
};
//# sourceMappingURL=correlation-id.js.map