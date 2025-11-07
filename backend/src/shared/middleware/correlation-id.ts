/**
 * Correlation ID Middleware
 * 
 * Generates and propagates correlation IDs for request tracing across services.
 * Critical for debugging distributed systems and audit trail requirements.
 */

import { v4 as uuidv4 } from 'uuid'
import { Request, Response, NextFunction } from 'express'

export const CORRELATION_ID_HEADER = 'x-correlation-id'

/**
 * Express middleware to add correlation IDs to requests
 */
export function correlationIdMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Get correlation ID from header or generate new one
  const correlationId = req.headers[CORRELATION_ID_HEADER] as string || uuidv4()
  
  // Attach to request object
  ;(req as any).correlationId = correlationId
  
  // Add to response headers for client tracking
  res.setHeader(CORRELATION_ID_HEADER, correlationId)
  
  // Log request with correlation ID
  console.log(`[${correlationId}] ${req.method} ${req.path}`)
  
  next()
}

/**
 * Generate correlation ID for client-side requests
 */
export function generateCorrelationId(): string {
  return uuidv4()
}

/**
 * Storage for current correlation ID (client-side)
 */
let currentCorrelationId: string | null = null

/**
 * Set correlation ID for current request context
 */
export function setCorrelationId(id: string): void {
  currentCorrelationId = id
}

/**
 * Get current correlation ID
 */
export function getCorrelationId(): string {
  if (!currentCorrelationId) {
    currentCorrelationId = generateCorrelationId()
  }
  return currentCorrelationId
}

/**
 * Clear correlation ID (call after request completes)
 */
export function clearCorrelationId(): void {
  currentCorrelationId = null
}

/**
 * Add correlation ID to fetch headers
 */
export function withCorrelationId(headers: Record<string, string> = {}): Record<string, string> {
  return {
    ...headers,
    [CORRELATION_ID_HEADER]: getCorrelationId(),
  }
}

/**
 * Structured log entry with correlation ID
 */
export interface LogEntry {
  correlationId: string
  timestamp: string
  level: 'debug' | 'info' | 'warn' | 'error'
  message: string
  context?: Record<string, any>
  error?: {
    message: string
    stack?: string
    code?: string
  }
}

/**
 * Create structured log entry
 */
export function createLogEntry(
  level: LogEntry['level'],
  message: string,
  context?: Record<string, any>,
  error?: Error
): LogEntry {
  return {
    correlationId: getCorrelationId(),
    timestamp: new Date().toISOString(),
    level,
    message,
    context,
    error: error ? {
      message: error.message,
      stack: error.stack,
      code: (error as any).code,
    } : undefined,
  }
}

/**
 * Structured logger with correlation ID support
 */
export const logger = {
  debug: (message: string, context?: Record<string, any>) => {
    const entry = createLogEntry('debug', message, context)
    console.debug(JSON.stringify(entry))
  },
  
  info: (message: string, context?: Record<string, any>) => {
    const entry = createLogEntry('info', message, context)
    console.info(JSON.stringify(entry))
  },
  
  warn: (message: string, context?: Record<string, any>) => {
    const entry = createLogEntry('warn', message, context)
    console.warn(JSON.stringify(entry))
  },
  
  error: (message: string, context?: Record<string, any>, error?: Error) => {
    const entry = createLogEntry('error', message, context, error)
    console.error(JSON.stringify(entry))
  },
}

