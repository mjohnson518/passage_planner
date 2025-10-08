/**
 * Typed Error Classes for Helmwise
 * 
 * Provides structured, informative errors with context for debugging.
 * All errors include correlation IDs for request tracing.
 */

export interface ErrorContext {
  correlationId?: string;
  userId?: string;
  service?: string;
  operation?: string;
  timestamp?: string;
  [key: string]: any;
}

/**
 * Base Application Error
 */
export class ApplicationError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly context: ErrorContext;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    code: string = 'APPLICATION_ERROR',
    statusCode: number = 500,
    context?: ErrorContext,
    isOperational: boolean = true
  ) {
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

/**
 * Weather Service Error
 */
export class WeatherServiceError extends ApplicationError {
  constructor(
    message: string,
    context?: ErrorContext
  ) {
    super(
      message,
      'WEATHER_SERVICE_ERROR',
      503,
      context
    );
  }
}

/**
 * Tidal Service Error
 */
export class TidalServiceError extends ApplicationError {
  constructor(
    message: string,
    context?: ErrorContext
  ) {
    super(
      message,
      'TIDAL_SERVICE_ERROR',
      503,
      context
    );
  }
}

/**
 * Route Calculation Error
 */
export class RouteCalculationError extends ApplicationError {
  constructor(
    message: string,
    context?: ErrorContext
  ) {
    super(
      message,
      'ROUTE_CALCULATION_ERROR',
      400,
      context
    );
  }
}

/**
 * Safety Validation Error
 */
export class SafetyValidationError extends ApplicationError {
  constructor(
    message: string,
    context?: ErrorContext
  ) {
    super(
      message,
      'SAFETY_VALIDATION_ERROR',
      400,
      context
    );
  }
}

/**
 * Data Validation Error
 */
export class ValidationError extends ApplicationError {
  public readonly field?: string;
  public readonly value?: any;

  constructor(
    message: string,
    field?: string,
    value?: any,
    context?: ErrorContext
  ) {
    super(
      message,
      'VALIDATION_ERROR',
      400,
      context
    );
    this.field = field;
    this.value = value;
  }
}

/**
 * Not Found Error
 */
export class NotFoundError extends ApplicationError {
  public readonly resource: string;

  constructor(
    message: string,
    resource: string,
    context?: ErrorContext
  ) {
    super(
      message,
      'NOT_FOUND',
      404,
      context
    );
    this.resource = resource;
  }
}

/**
 * Authentication Error
 */
export class AuthenticationError extends ApplicationError {
  constructor(
    message: string,
    context?: ErrorContext
  ) {
    super(
      message,
      'AUTHENTICATION_ERROR',
      401,
      context
    );
  }
}

/**
 * Authorization Error
 */
export class AuthorizationError extends ApplicationError {
  public readonly requiredPermission?: string;

  constructor(
    message: string,
    requiredPermission?: string,
    context?: ErrorContext
  ) {
    super(
      message,
      'AUTHORIZATION_ERROR',
      403,
      context
    );
    this.requiredPermission = requiredPermission;
  }
}

/**
 * Rate Limit Error
 */
export class RateLimitError extends ApplicationError {
  public readonly retryAfter?: number; // seconds

  constructor(
    message: string,
    retryAfter?: number,
    context?: ErrorContext
  ) {
    super(
      message,
      'RATE_LIMIT_EXCEEDED',
      429,
      context
    );
    this.retryAfter = retryAfter;
  }
}

/**
 * External API Error
 */
export class ExternalAPIError extends ApplicationError {
  public readonly apiName: string;
  public readonly apiStatusCode?: number;

  constructor(
    message: string,
    apiName: string,
    apiStatusCode?: number,
    context?: ErrorContext
  ) {
    super(
      message,
      'EXTERNAL_API_ERROR',
      503,
      context
    );
    this.apiName = apiName;
    this.apiStatusCode = apiStatusCode;
  }
}

/**
 * Data Freshness Error (stale data detected)
 */
export class DataFreshnessError extends ApplicationError {
  public readonly dataAge: number; // milliseconds
  public readonly maxAge: number; // milliseconds

  constructor(
    message: string,
    dataAge: number,
    maxAge: number,
    context?: ErrorContext
  ) {
    super(
      message,
      'DATA_FRESHNESS_ERROR',
      500,
      context
    );
    this.dataAge = dataAge;
    this.maxAge = maxAge;
  }
}

/**
 * Database Error
 */
export class DatabaseError extends ApplicationError {
  public readonly operation: string;

  constructor(
    message: string,
    operation: string,
    context?: ErrorContext
  ) {
    super(
      message,
      'DATABASE_ERROR',
      500,
      context,
      false // Database errors are not operational
    );
    this.operation = operation;
  }
}

/**
 * Configuration Error
 */
export class ConfigurationError extends ApplicationError {
  public readonly configKey: string;

  constructor(
    message: string,
    configKey: string,
    context?: ErrorContext
  ) {
    super(
      message,
      'CONFIGURATION_ERROR',
      500,
      context,
      false // Configuration errors are not operational
    );
    this.configKey = configKey;
  }
}

/**
 * Service Unavailable Error
 */
export class ServiceUnavailableError extends ApplicationError {
  public readonly serviceName: string;

  constructor(
    message: string,
    serviceName: string,
    context?: ErrorContext
  ) {
    super(
      message,
      'SERVICE_UNAVAILABLE',
      503,
      context
    );
    this.serviceName = serviceName;
  }
}

/**
 * Check if error is operational (expected) vs programming error
 */
export function isOperationalError(error: Error): boolean {
  if (error instanceof ApplicationError) {
    return error.isOperational;
  }
  return false;
}

/**
 * Extract HTTP status code from error
 */
export function getErrorStatusCode(error: Error): number {
  if (error instanceof ApplicationError) {
    return error.statusCode;
  }
  return 500;
}

/**
 * Format error for API response
 */
export function formatErrorResponse(error: Error, includeStack: boolean = false) {
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

