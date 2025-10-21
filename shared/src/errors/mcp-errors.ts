/**
 * MCP Error classes for comprehensive error handling
 * Provides specific error types with context and retry information
 */

export enum ErrorCode {
  // API Errors
  API_ERROR = 'API_ERROR',
  API_TIMEOUT = 'API_TIMEOUT',
  API_RATE_LIMIT = 'API_RATE_LIMIT',
  API_UNAUTHORIZED = 'API_UNAUTHORIZED',
  
  // Cache Errors
  CACHE_MISS = 'CACHE_MISS',
  CACHE_ERROR = 'CACHE_ERROR',
  CACHE_CONNECTION_FAILED = 'CACHE_CONNECTION_FAILED',
  
  // Validation Errors
  INVALID_COORDINATES = 'INVALID_COORDINATES',
  INVALID_DATE_RANGE = 'INVALID_DATE_RANGE',
  INVALID_PARAMETERS = 'INVALID_PARAMETERS',
  
  // Circuit Breaker Errors
  CIRCUIT_OPEN = 'CIRCUIT_OPEN',
  CIRCUIT_TIMEOUT = 'CIRCUIT_TIMEOUT',
  
  // Agent Errors
  AGENT_UNAVAILABLE = 'AGENT_UNAVAILABLE',
  AGENT_TIMEOUT = 'AGENT_TIMEOUT',
  
  // Data Errors
  DATA_NOT_FOUND = 'DATA_NOT_FOUND',
  DATA_STALE = 'DATA_STALE',
  DATA_INVALID = 'DATA_INVALID'
}

/**
 * Base MCP Error class with context and retry information
 */
export class MCPError extends Error {
  public readonly code: ErrorCode;
  public readonly retryable: boolean;
  public readonly context?: any;
  public readonly timestamp: Date;
  
  constructor(
    message: string,
    code: ErrorCode,
    retryable: boolean = false,
    context?: any
  ) {
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

/**
 * NOAA API specific error
 */
export class NOAAAPIError extends MCPError {
  public readonly statusCode?: number;
  public readonly endpoint?: string;
  
  constructor(
    message: string,
    statusCode?: number,
    endpoint?: string,
    retryable: boolean = true
  ) {
    const code = statusCode === 429 ? ErrorCode.API_RATE_LIMIT : 
                 statusCode === 401 ? ErrorCode.API_UNAUTHORIZED :
                 ErrorCode.API_ERROR;
    
    super(message, code, retryable, { statusCode, endpoint });
    this.name = 'NOAAAPIError';
    this.statusCode = statusCode;
    this.endpoint = endpoint;
  }
  
  static fromResponse(response: any, endpoint: string): NOAAAPIError {
    const statusCode = response.status || response.statusCode;
    const message = `NOAA API error: ${statusCode} - ${response.statusText || 'Unknown error'}`;
    
    // 5xx errors are retryable, 4xx generally are not (except 429)
    const retryable = statusCode >= 500 || statusCode === 429;
    
    return new NOAAAPIError(message, statusCode, endpoint, retryable);
  }
}

/**
 * Cache operation error
 */
export class CacheError extends MCPError {
  constructor(
    message: string,
    operation: 'get' | 'set' | 'delete' | 'connect',
    key?: string
  ) {
    const code = operation === 'connect' ? 
      ErrorCode.CACHE_CONNECTION_FAILED : 
      ErrorCode.CACHE_ERROR;
    
    super(message, code, true, { operation, key });
    this.name = 'CacheError';
  }
}

/**
 * Validation error for input parameters
 */
export class ValidationError extends MCPError {
  public readonly field?: string;
  public readonly value?: any;
  
  constructor(
    message: string,
    field?: string,
    value?: any
  ) {
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
  
  static validateCoordinates(lat: number, lon: number): void {
    if (lat < -90 || lat > 90) {
      throw new ValidationError(
        `Invalid latitude: ${lat}. Must be between -90 and 90`,
        'latitude',
        lat
      );
    }
    
    if (lon < -180 || lon > 180) {
      throw new ValidationError(
        `Invalid longitude: ${lon}. Must be between -180 and 180`,
        'longitude',
        lon
      );
    }
  }
  
  static validateDateRange(startDate: Date, endDate: Date): void {
    if (startDate >= endDate) {
      throw new ValidationError(
        'Start date must be before end date',
        'dateRange',
        { startDate, endDate }
      );
    }
    
    const maxRange = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds
    if (endDate.getTime() - startDate.getTime() > maxRange) {
      throw new ValidationError(
        'Date range cannot exceed 30 days',
        'dateRange',
        { startDate, endDate }
      );
    }
  }
}

/**
 * Circuit breaker error
 */
export class CircuitBreakerError extends MCPError {
  public readonly serviceName: string;
  public readonly state: 'OPEN' | 'HALF_OPEN';
  
  constructor(
    serviceName: string,
    state: 'OPEN' | 'HALF_OPEN' = 'OPEN'
  ) {
    super(
      `Circuit breaker is ${state} for service: ${serviceName}`,
      ErrorCode.CIRCUIT_OPEN,
      true,
      { serviceName, state }
    );
    this.name = 'CircuitBreakerError';
    this.serviceName = serviceName;
    this.state = state;
  }
}

/**
 * Agent communication error
 */
export class AgentError extends MCPError {
  public readonly agentName: string;
  
  constructor(
    message: string,
    agentName: string,
    timeout: boolean = false
  ) {
    super(
      message,
      timeout ? ErrorCode.AGENT_TIMEOUT : ErrorCode.AGENT_UNAVAILABLE,
      true,
      { agentName }
    );
    this.name = 'AgentError';
    this.agentName = agentName;
  }
}

/**
 * Data quality error
 */
export class DataError extends MCPError {
  constructor(
    message: string,
    dataType: 'weather' | 'tidal' | 'route',
    issue: 'not_found' | 'stale' | 'invalid'
  ) {
    const code = issue === 'not_found' ? ErrorCode.DATA_NOT_FOUND :
                 issue === 'stale' ? ErrorCode.DATA_STALE :
                 ErrorCode.DATA_INVALID;
    
    super(message, code, issue === 'not_found', { dataType, issue });
    this.name = 'DataError';
  }
  
  static checkDataFreshness(data: any, maxAgeHours: number = 3): void {
    if (!data.timestamp && !data.updated && !data.generatedAt) {
      throw new DataError(
        'Data missing timestamp - cannot verify freshness',
        'weather',
        'invalid'
      );
    }
    
    const timestamp = new Date(data.timestamp || data.updated || data.generatedAt);
    const ageHours = (Date.now() - timestamp.getTime()) / (1000 * 60 * 60);
    
    if (ageHours > maxAgeHours) {
      throw new DataError(
        `Data is ${ageHours.toFixed(1)} hours old (max: ${maxAgeHours} hours)`,
        'weather',
        'stale'
      );
    }
  }
}

/**
 * Helper function to determine if an error is retryable
 */
export function isRetryableError(error: any): boolean {
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
export function toMCPError(error: any, defaultCode: ErrorCode = ErrorCode.API_ERROR): MCPError {
  if (error instanceof MCPError) {
    return error;
  }
  
  if (error.response) {
    // Axios error
    return NOAAAPIError.fromResponse(error.response, error.config?.url || 'unknown');
  }
  
  if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
    return new MCPError(
      `Connection failed: ${error.message}`,
      ErrorCode.API_ERROR,
      true,
      { originalError: error }
    );
  }
  
  return new MCPError(
    error.message || 'Unknown error',
    defaultCode,
    false,
    { originalError: error }
  );
}
