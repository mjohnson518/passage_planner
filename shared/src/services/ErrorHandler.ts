import pino from 'pino';
import { Request, Response, NextFunction } from 'express';

// Custom error types
export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number = 500,
    public code: string = 'INTERNAL_ERROR',
    public isOperational: boolean = true,
    public details?: any
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 400, 'VALIDATION_ERROR', true, details);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, identifier?: string) {
    const message = identifier 
      ? `${resource} with identifier ${identifier} not found`
      : `${resource} not found`;
    super(message, 404, 'NOT_FOUND', true);
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication failed') {
    super(message, 401, 'AUTHENTICATION_ERROR', true);
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = 'Insufficient permissions') {
    super(message, 403, 'AUTHORIZATION_ERROR', true);
  }
}

export class RateLimitError extends AppError {
  constructor(
    message: string = 'Rate limit exceeded',
    public retryAfter?: number
  ) {
    super(message, 429, 'RATE_LIMIT_ERROR', true, { retryAfter });
  }
}

export class ExternalAPIError extends AppError {
  constructor(
    service: string,
    originalError?: any,
    public isRetryable: boolean = true
  ) {
    const message = `External API error from ${service}`;
    super(message, 502, 'EXTERNAL_API_ERROR', true, { service, originalError });
  }
}

export class TimeoutError extends AppError {
  constructor(
    operation: string,
    timeout: number
  ) {
    const message = `Operation ${operation} timed out after ${timeout}ms`;
    super(message, 504, 'TIMEOUT_ERROR', true, { operation, timeout });
  }
}

export class ConflictError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 409, 'CONFLICT_ERROR', true, details);
  }
}

// Error handler class
export class ErrorHandler {
  private logger: pino.Logger;
  private isDevelopment: boolean;
  
  constructor() {
    this.logger = pino({
      level: process.env.LOG_LEVEL || 'info',
      transport: {
        target: 'pino-pretty',
        options: { colorize: true }
      }
    });
    this.isDevelopment = process.env.NODE_ENV === 'development';
  }
  
  /**
   * Express error handling middleware
   */
  middleware() {
    return (err: Error, req: Request, res: Response, next: NextFunction) => {
      if (res.headersSent) {
        return next(err);
      }
      
      this.handleError(err, req, res);
    };
  }
  
  /**
   * Handle error and send response
   */
  private handleError(err: Error, req: Request, res: Response) {
    // Log error
    this.logError(err, req);
    
    // Prepare error response
    const errorResponse = this.prepareErrorResponse(err);
    
    // Send response
    res.status(errorResponse.statusCode).json(errorResponse);
  }
  
  /**
   * Log error with context
   */
  private logError(err: Error, req?: Request) {
    const errorContext = {
      error: {
        name: err.name,
        message: err.message,
        stack: err.stack,
        ...(err instanceof AppError && { code: err.code, details: err.details })
      },
      request: req ? {
        method: req.method,
        url: req.url,
        ip: req.ip,
        userAgent: req.get('user-agent'),
        userId: (req as any).user?.userId
      } : undefined,
      timestamp: new Date().toISOString()
    };
    
    if (err instanceof AppError && err.isOperational) {
      this.logger.warn(errorContext, 'Operational error occurred');
    } else {
      this.logger.error(errorContext, 'Unexpected error occurred');
    }
  }
  
  /**
   * Prepare error response
   */
  private prepareErrorResponse(err: Error): any {
    if (err instanceof AppError) {
      const response: any = {
        error: {
          code: err.code,
          message: err.message,
          statusCode: err.statusCode
        }
      };
      
      // Add details in development
      if (this.isDevelopment && err.details) {
        response.error.details = err.details;
      }
      
      // Add retry information for rate limit errors
      if (err instanceof RateLimitError && err.retryAfter) {
        response.error.retryAfter = err.retryAfter;
      }
      
      // Add stack trace in development
      if (this.isDevelopment && err.stack) {
        response.error.stack = err.stack;
      }
      
      return {
        ...response,
        statusCode: err.statusCode
      };
    }
    
    // Handle unexpected errors
    const statusCode = 500;
    const response: any = {
      error: {
        code: 'INTERNAL_ERROR',
        message: this.isDevelopment ? err.message : 'An unexpected error occurred',
        statusCode
      }
    };
    
    if (this.isDevelopment && err.stack) {
      response.error.stack = err.stack;
    }
    
    return {
      ...response,
      statusCode
    };
  }
  
  /**
   * Async error wrapper for route handlers
   */
  static asyncHandler(fn: Function) {
    return (req: Request, res: Response, next: NextFunction) => {
      Promise.resolve(fn(req, res, next)).catch(next);
    };
  }
  
  /**
   * Handle unhandled rejections
   */
  handleUnhandledRejection() {
    process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
      this.logger.fatal({
        error: reason,
        promise
      }, 'Unhandled Promise Rejection');
      
      // Give time to log then exit
      setTimeout(() => {
        process.exit(1);
      }, 1000);
    });
  }
  
  /**
   * Handle uncaught exceptions
   */
  handleUncaughtException() {
    process.on('uncaughtException', (error: Error) => {
      this.logger.fatal({
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack
        }
      }, 'Uncaught Exception');
      
      // Give time to log then exit
      setTimeout(() => {
        process.exit(1);
      }, 1000);
    });
  }
  
  /**
   * Graceful shutdown handler
   */
  handleGracefulShutdown(cleanup: () => Promise<void>) {
    const shutdown = async (signal: string) => {
      this.logger.info({ signal }, 'Received shutdown signal');
      
      try {
        await cleanup();
        this.logger.info('Graceful shutdown completed');
        process.exit(0);
      } catch (error) {
        this.logger.error({ error }, 'Error during graceful shutdown');
        process.exit(1);
      }
    };
    
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  }
  
  /**
   * Create error from various inputs
   */
  static createError(input: any): AppError {
    // Already an AppError
    if (input instanceof AppError) {
      return input;
    }
    
    // Standard Error
    if (input instanceof Error) {
      return new AppError(input.message, 500, 'INTERNAL_ERROR', false);
    }
    
    // API response error
    if (input?.response?.status) {
      const status = input.response.status;
      const message = input.response.data?.message || input.message || 'External API error';
      
      if (status === 404) {
        return new NotFoundError('Resource');
      } else if (status === 401) {
        return new AuthenticationError(message);
      } else if (status === 403) {
        return new AuthorizationError(message);
      } else if (status === 429) {
        return new RateLimitError(message);
      } else if (status >= 500) {
        return new ExternalAPIError('External Service', input);
      }
      
      return new AppError(message, status, 'API_ERROR');
    }
    
    // Timeout error
    if (input?.code === 'ECONNABORTED' || input?.code === 'ETIMEDOUT') {
      return new TimeoutError('Request', input.timeout || 30000);
    }
    
    // Network error
    if (input?.code === 'ENOTFOUND' || input?.code === 'ECONNREFUSED') {
      return new ExternalAPIError('Network', input, true);
    }
    
    // Default
    const message = input?.message || input?.toString() || 'Unknown error';
    return new AppError(message, 500, 'UNKNOWN_ERROR', false);
  }
  
  /**
   * Error recovery strategies
   */
  static async withRetry<T>(
    fn: () => Promise<T>,
    options: {
      attempts?: number;
      delay?: number;
      backoff?: number;
      onRetry?: (error: Error, attempt: number) => void;
      retryIf?: (error: Error) => boolean;
    } = {}
  ): Promise<T> {
    const {
      attempts = 3,
      delay = 1000,
      backoff = 2,
      onRetry,
      retryIf = (error) => error instanceof ExternalAPIError && error.isRetryable
    } = options;
    
    let lastError: Error | undefined;
    let currentDelay = delay;
    
    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        return await fn();
      } catch (error: any) {
        lastError = error;
        
        if (attempt < attempts && retryIf(error)) {
          if (onRetry) {
            onRetry(error, attempt);
          }
          
          await new Promise(resolve => setTimeout(resolve, currentDelay));
          currentDelay *= backoff;
        } else {
          throw error;
        }
      }
    }
    
    throw lastError || new Error('Retry failed');
  }
  
  /**
   * Circuit breaker pattern
   */
  static createCircuitBreaker<T>(
    fn: (...args: any[]) => Promise<T>,
    options: {
      threshold?: number;
      timeout?: number;
      resetTimeout?: number;
    } = {}
  ) {
    const {
      threshold = 5,
      timeout = 60000,
      resetTimeout = 30000
    } = options;
    
    let failures = 0;
    let lastFailureTime: number | null = null;
    let state: 'closed' | 'open' | 'half-open' = 'closed';
    
    return async (...args: any[]): Promise<T> => {
      // Check if circuit should be reset
      if (state === 'open' && lastFailureTime && 
          Date.now() - lastFailureTime > resetTimeout) {
        state = 'half-open';
      }
      
      // If circuit is open, fail fast
      if (state === 'open') {
        throw new AppError('Circuit breaker is open', 503, 'CIRCUIT_OPEN');
      }
      
      try {
        // Set timeout
        const result = await Promise.race([
          fn(...args),
          new Promise<never>((_, reject) => 
            setTimeout(() => reject(new TimeoutError('Operation', timeout)), timeout)
          )
        ]);
        
        // Reset on success
        if (state === 'half-open') {
          state = 'closed';
          failures = 0;
        }
        
        return result;
      } catch (error) {
        failures++;
        lastFailureTime = Date.now();
        
        if (failures >= threshold) {
          state = 'open';
        }
        
        throw error;
      }
    };
  }
} 