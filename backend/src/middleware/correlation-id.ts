/**
 * Correlation ID Middleware
 * 
 * Generates and propagates correlation IDs through all services for distributed tracing.
 * Enables end-to-end request tracking across agents and services.
 */

import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

// Extend Express Request to include correlationId
declare global {
  namespace Express {
    interface Request {
      correlationId?: string;
      startTime?: number;
    }
  }
}

export interface CorrelationIdOptions {
  headerName: string;
  generateId: () => string;
}

const defaultOptions: CorrelationIdOptions = {
  headerName: 'x-correlation-id',
  generateId: () => uuidv4(),
};

/**
 * Express middleware to generate/extract correlation IDs
 */
export function correlationIdMiddleware(
  options: Partial<CorrelationIdOptions> = {}
): (req: Request, res: Response, next: NextFunction) => void {
  const config = { ...defaultOptions, ...options };

  return (req: Request, res: Response, next: NextFunction) => {
    // Try to get existing correlation ID from header
    let correlationId = req.headers[config.headerName] as string;

    // Generate new ID if not present
    if (!correlationId) {
      correlationId = config.generateId();
    }

    // Attach to request
    req.correlationId = correlationId;
    req.startTime = Date.now();

    // Add to response headers for tracing
    res.setHeader(config.headerName, correlationId);

    next();
  };
}

/**
 * Get correlation ID from request
 */
export function getCorrelationId(req: Request): string | undefined {
  return req.correlationId;
}

/**
 * Create child correlation ID for nested operations
 */
export function createChildCorrelationId(parentId: string, operation: string): string {
  return `${parentId}:${operation}:${Date.now()}`;
}

/**
 * Extract parent correlation ID from child
 */
export function extractParentCorrelationId(childId: string): string {
  const parts = childId.split(':');
  return parts[0];
}

