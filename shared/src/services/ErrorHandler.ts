import { Logger } from 'pino';

export enum ErrorCode {
  // Client errors
  BAD_REQUEST = 'BAD_REQUEST',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  
  // Server errors
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  TIMEOUT = 'TIMEOUT',
  
  // Business logic errors
  USAGE_LIMIT_EXCEEDED = 'USAGE_LIMIT_EXCEEDED',
  SUBSCRIPTION_REQUIRED = 'SUBSCRIPTION_REQUIRED',
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',
  
  // External service errors
  EXTERNAL_API_ERROR = 'EXTERNAL_API_ERROR',
  PAYMENT_FAILED = 'PAYMENT_FAILED',
  
  // Agent errors
  AGENT_UNAVAILABLE = 'AGENT_UNAVAILABLE',
  AGENT_TIMEOUT = 'AGENT_TIMEOUT',
  AGENT_ERROR = 'AGENT_ERROR',
}

export interface ErrorDetails {
  code: ErrorCode;
  message: string;
  statusCode: number;
  details?: any;
  retryable: boolean;
  userMessage?: string;
}

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly details?: any;
  public readonly retryable: boolean;
  public readonly userMessage?: string;
  
  constructor(errorDetails: ErrorDetails) {
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

export class ErrorHandler {
  private logger: Logger;
  
  constructor(logger: Logger) {
    this.logger = logger;
  }
  
  // Create common errors
  static badRequest(message: string, details?: any): AppError {
    return new AppError({
      code: ErrorCode.BAD_REQUEST,
      message,
      statusCode: 400,
      details,
      retryable: false,
    });
  }
  
  static unauthorized(message = 'Unauthorized'): AppError {
    return new AppError({
      code: ErrorCode.UNAUTHORIZED,
      message,
      statusCode: 401,
      retryable: false,
    });
  }
  
  static forbidden(message = 'Forbidden'): AppError {
    return new AppError({
      code: ErrorCode.FORBIDDEN,
      message,
      statusCode: 403,
      retryable: false,
    });
  }
  
  static notFound(resource: string): AppError {
    return new AppError({
      code: ErrorCode.NOT_FOUND,
      message: `${resource} not found`,
      statusCode: 404,
      retryable: false,
    });
  }
  
  static validationError(message: string, details?: any): AppError {
    return new AppError({
      code: ErrorCode.VALIDATION_ERROR,
      message,
      statusCode: 422,
      details,
      retryable: false,
    });
  }
  
  static rateLimitExceeded(retryAfter?: number): AppError {
    return new AppError({
      code: ErrorCode.RATE_LIMIT_EXCEEDED,
      message: 'Rate limit exceeded',
      statusCode: 429,
      details: { retryAfter },
      retryable: true,
      userMessage: 'Too many requests. Please try again later.',
    });
  }
  
  static usageLimitExceeded(limit: string): AppError {
    return new AppError({
      code: ErrorCode.USAGE_LIMIT_EXCEEDED,
      message: `Usage limit exceeded: ${limit}`,
      statusCode: 403,
      retryable: false,
      userMessage: 'You have reached your plan limit. Please upgrade to continue.',
    });
  }
  
  static subscriptionRequired(feature: string): AppError {
    return new AppError({
      code: ErrorCode.SUBSCRIPTION_REQUIRED,
      message: `Subscription required for: ${feature}`,
      statusCode: 403,
      retryable: false,
      userMessage: 'This feature requires a premium subscription.',
    });
  }
  
  static agentError(agentId: string, error: any): AppError {
    return new AppError({
      code: ErrorCode.AGENT_ERROR,
      message: `Agent error: ${agentId}`,
      statusCode: 500,
      details: { agentId, originalError: error },
      retryable: true,
    });
  }
  
  static externalApiError(service: string, error: any): AppError {
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
  handle(error: any, context?: any): AppError {
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
    return (err: any, req: any, res: any, next: any) => {
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