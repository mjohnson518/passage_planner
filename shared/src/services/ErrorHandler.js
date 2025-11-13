"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ErrorHandler = exports.AppError = exports.ErrorCode = void 0;
var ErrorCode;
(function (ErrorCode) {
    // Client errors
    ErrorCode["BAD_REQUEST"] = "BAD_REQUEST";
    ErrorCode["UNAUTHORIZED"] = "UNAUTHORIZED";
    ErrorCode["FORBIDDEN"] = "FORBIDDEN";
    ErrorCode["NOT_FOUND"] = "NOT_FOUND";
    ErrorCode["VALIDATION_ERROR"] = "VALIDATION_ERROR";
    ErrorCode["RATE_LIMIT_EXCEEDED"] = "RATE_LIMIT_EXCEEDED";
    // Server errors
    ErrorCode["INTERNAL_ERROR"] = "INTERNAL_ERROR";
    ErrorCode["SERVICE_UNAVAILABLE"] = "SERVICE_UNAVAILABLE";
    ErrorCode["TIMEOUT"] = "TIMEOUT";
    // Business logic errors
    ErrorCode["USAGE_LIMIT_EXCEEDED"] = "USAGE_LIMIT_EXCEEDED";
    ErrorCode["SUBSCRIPTION_REQUIRED"] = "SUBSCRIPTION_REQUIRED";
    ErrorCode["INSUFFICIENT_PERMISSIONS"] = "INSUFFICIENT_PERMISSIONS";
    // External service errors
    ErrorCode["EXTERNAL_API_ERROR"] = "EXTERNAL_API_ERROR";
    ErrorCode["PAYMENT_FAILED"] = "PAYMENT_FAILED";
    // Agent errors
    ErrorCode["AGENT_UNAVAILABLE"] = "AGENT_UNAVAILABLE";
    ErrorCode["AGENT_TIMEOUT"] = "AGENT_TIMEOUT";
    ErrorCode["AGENT_ERROR"] = "AGENT_ERROR";
})(ErrorCode || (exports.ErrorCode = ErrorCode = {}));
class AppError extends Error {
    code;
    statusCode;
    details;
    retryable;
    userMessage;
    constructor(errorDetails) {
        super(errorDetails.message);
        this.code = errorDetails.code;
        this.statusCode = errorDetails.statusCode;
        this.details = errorDetails.details;
        this.retryable = errorDetails.retryable;
        this.userMessage = errorDetails.userMessage || errorDetails.message;
        // Maintains proper stack trace
        Error.captureStackTrace(this, this.constructor);
    }
    toJSON() {
        return {
            code: this.code,
            message: this.message,
            statusCode: this.statusCode,
            details: this.details,
            retryable: this.retryable,
            userMessage: this.userMessage,
        };
    }
}
exports.AppError = AppError;
class ErrorHandler {
    logger;
    constructor(logger) {
        this.logger = logger;
    }
    // Create common errors
    static badRequest(message, details) {
        return new AppError({
            code: ErrorCode.BAD_REQUEST,
            message,
            statusCode: 400,
            details,
            retryable: false,
        });
    }
    static unauthorized(message = 'Unauthorized') {
        return new AppError({
            code: ErrorCode.UNAUTHORIZED,
            message,
            statusCode: 401,
            retryable: false,
        });
    }
    static forbidden(message = 'Forbidden') {
        return new AppError({
            code: ErrorCode.FORBIDDEN,
            message,
            statusCode: 403,
            retryable: false,
        });
    }
    static notFound(resource) {
        return new AppError({
            code: ErrorCode.NOT_FOUND,
            message: `${resource} not found`,
            statusCode: 404,
            retryable: false,
        });
    }
    static validationError(message, details) {
        return new AppError({
            code: ErrorCode.VALIDATION_ERROR,
            message,
            statusCode: 422,
            details,
            retryable: false,
        });
    }
    static rateLimitExceeded(retryAfter) {
        return new AppError({
            code: ErrorCode.RATE_LIMIT_EXCEEDED,
            message: 'Rate limit exceeded',
            statusCode: 429,
            details: { retryAfter },
            retryable: true,
            userMessage: 'Too many requests. Please try again later.',
        });
    }
    static usageLimitExceeded(limit) {
        return new AppError({
            code: ErrorCode.USAGE_LIMIT_EXCEEDED,
            message: `Usage limit exceeded: ${limit}`,
            statusCode: 403,
            retryable: false,
            userMessage: 'You have reached your plan limit. Please upgrade to continue.',
        });
    }
    static subscriptionRequired(feature) {
        return new AppError({
            code: ErrorCode.SUBSCRIPTION_REQUIRED,
            message: `Subscription required for: ${feature}`,
            statusCode: 403,
            retryable: false,
            userMessage: 'This feature requires a premium subscription.',
        });
    }
    static agentError(agentId, error) {
        return new AppError({
            code: ErrorCode.AGENT_ERROR,
            message: `Agent error: ${agentId}`,
            statusCode: 500,
            details: { agentId, originalError: error },
            retryable: true,
        });
    }
    static externalApiError(service, error) {
        return new AppError({
            code: ErrorCode.EXTERNAL_API_ERROR,
            message: `External API error: ${service}`,
            statusCode: 502,
            details: { service, originalError: error },
            retryable: true,
            userMessage: 'A third-party service is temporarily unavailable.',
        });
    }
    // Handle and log errors
    handle(error, context) {
        // If already an AppError, just log and return
        if (error instanceof AppError) {
            this.logger.error({
                code: error.code,
                message: error.message,
                statusCode: error.statusCode,
                details: error.details,
                context,
            }, 'Application error');
            return error;
        }
        // Handle Stripe errors
        if (error.type === 'StripeCardError') {
            return new AppError({
                code: ErrorCode.PAYMENT_FAILED,
                message: error.message,
                statusCode: 402,
                details: { stripeError: error },
                retryable: false,
                userMessage: 'Payment failed. Please check your card details.',
            });
        }
        // Handle database errors
        if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
            return new AppError({
                code: ErrorCode.SERVICE_UNAVAILABLE,
                message: 'Database connection failed',
                statusCode: 503,
                details: { originalError: error },
                retryable: true,
                userMessage: 'Service temporarily unavailable. Please try again.',
            });
        }
        // Default to internal error
        this.logger.error({
            error: error.message,
            stack: error.stack,
            context,
        }, 'Unhandled error');
        return new AppError({
            code: ErrorCode.INTERNAL_ERROR,
            message: 'Internal server error',
            statusCode: 500,
            details: process.env.NODE_ENV === 'development' ? { originalError: error } : undefined,
            retryable: true,
            userMessage: 'An unexpected error occurred. Please try again.',
        });
    }
    // Express error middleware
    expressHandler() {
        return (err, req, res, next) => {
            const appError = this.handle(err, {
                method: req.method,
                path: req.path,
                ip: req.ip,
                userId: req.user?.userId,
            });
            res.status(appError.statusCode).json({
                error: {
                    code: appError.code,
                    message: appError.userMessage || appError.message,
                    details: appError.details,
                    retryable: appError.retryable,
                },
            });
        };
    }
}
exports.ErrorHandler = ErrorHandler;
//# sourceMappingURL=ErrorHandler.js.map