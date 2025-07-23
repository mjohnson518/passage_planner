import { Request, Response, NextFunction } from 'express';
import { z, ZodError, ZodSchema } from 'zod';
import validator from 'validator';
import { Logger } from 'pino';

export interface ValidationOptions {
  stripUnknown?: boolean;
  maxDepth?: number;
  maxArrayLength?: number;
  maxStringLength?: number;
}

export class InputValidation {
  private logger: Logger;
  private defaultOptions: ValidationOptions = {
    stripUnknown: true,
    maxDepth: 5,
    maxArrayLength: 100,
    maxStringLength: 10000
  };
  
  constructor(logger: Logger) {
    this.logger = logger;
  }
  
  /**
   * Common validation schemas
   */
  static schemas = {
    // Geographic coordinates
    coordinates: z.object({
      latitude: z.number().min(-90).max(90),
      longitude: z.number().min(-180).max(180)
    }),
    
    // Port/waypoint
    waypoint: z.object({
      id: z.string().optional(),
      name: z.string().max(200).optional(),
      latitude: z.number().min(-90).max(90),
      longitude: z.number().min(-180).max(180)
    }),
    
    // Date/time
    dateTime: z.string().datetime().or(z.date()),
    
    // Boat details
    boatDetails: z.object({
      type: z.enum(['sailboat', 'motorboat', 'catamaran', 'trimaran']),
      length: z.number().min(1).max(500), // feet
      beam: z.number().min(1).max(100).optional(),
      draft: z.number().min(0).max(50),
      name: z.string().max(100).optional()
    }),
    
    // Weather preferences
    weatherPreferences: z.object({
      maxWindSpeed: z.number().min(0).max(100).optional(),
      maxWaveHeight: z.number().min(0).max(20).optional(),
      minVisibility: z.number().min(0).max(50).optional(),
      avoidNight: z.boolean().optional()
    }),
    
    // Pagination
    pagination: z.object({
      page: z.number().int().min(1).default(1),
      limit: z.number().int().min(1).max(100).default(20),
      sortBy: z.string().max(50).optional(),
      sortOrder: z.enum(['asc', 'desc']).default('asc')
    }),
    
    // UUID
    uuid: z.string().uuid(),
    
    // Email
    email: z.string().email().max(255),
    
    // Password (min 8 chars, must contain number and letter)
    password: z.string()
      .min(8)
      .max(128)
      .refine(val => /[a-zA-Z]/.test(val) && /[0-9]/.test(val), {
        message: 'Password must contain at least one letter and one number'
      }),
    
    // Phone
    phone: z.string().refine(val => validator.isMobilePhone(val, 'any'), {
      message: 'Invalid phone number'
    }),
    
    // URL
    url: z.string().url().max(2000),
    
    // Safe string (alphanumeric + basic punctuation)
    safeString: z.string().regex(/^[a-zA-Z0-9\s\-_.,!?'"]+$/),
    
    // Search query
    searchQuery: z.string()
      .max(200)
      .transform(val => validator.escape(val))
  };
  
  /**
   * Validate request body
   */
  validateBody<T>(schema: ZodSchema<T>, options?: ValidationOptions) {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        const opts = { ...this.defaultOptions, ...options };
        
        // Check request size
        if (JSON.stringify(req.body).length > 1048576) { // 1MB
          return res.status(413).json({
            error: 'Request body too large'
          });
        }
        
        // Validate and sanitize
        const validated = await schema.parseAsync(req.body);
        
        // Additional sanitization
        req.body = this.deepSanitize(validated, opts);
        
        next();
      } catch (error) {
        if (error instanceof ZodError) {
          this.logger.warn({ error: error.errors }, 'Validation failed');
          return res.status(400).json({
            error: 'Validation failed',
            details: error.errors.map(e => ({
              path: e.path.join('.'),
              message: e.message
            }))
          });
        }
        
        this.logger.error({ error }, 'Unexpected validation error');
        return res.status(500).json({
          error: 'Internal validation error'
        });
      }
    };
  }
  
  /**
   * Validate query parameters
   */
  validateQuery<T>(schema: ZodSchema<T>, options?: ValidationOptions) {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        const validated = await schema.parseAsync(req.query);
        req.query = this.deepSanitize(validated, options || this.defaultOptions) as any;
        next();
      } catch (error) {
        if (error instanceof ZodError) {
          return res.status(400).json({
            error: 'Invalid query parameters',
            details: error.errors
          });
        }
        next(error);
      }
    };
  }
  
  /**
   * Validate route parameters
   */
  validateParams<T>(schema: ZodSchema<T>) {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        const validated = await schema.parseAsync(req.params);
        req.params = validated as any;
        next();
      } catch (error) {
        if (error instanceof ZodError) {
          return res.status(400).json({
            error: 'Invalid route parameters',
            details: error.errors
          });
        }
        next(error);
      }
    };
  }
  
  /**
   * Sanitize file uploads
   */
  validateFile(options: {
    maxSize?: number; // bytes
    allowedTypes?: string[];
    required?: boolean;
  }) {
    return (req: Request, res: Response, next: NextFunction) => {
      const file = (req as any).file;
      
      if (!file && options.required) {
        return res.status(400).json({
          error: 'File upload required'
        });
      }
      
      if (!file) {
        return next();
      }
      
      // Check file size
      if (options.maxSize && file.size > options.maxSize) {
        return res.status(400).json({
          error: `File too large. Maximum size: ${options.maxSize} bytes`
        });
      }
      
      // Check file type
      if (options.allowedTypes && !options.allowedTypes.includes(file.mimetype)) {
        return res.status(400).json({
          error: `Invalid file type. Allowed types: ${options.allowedTypes.join(', ')}`
        });
      }
      
      // Sanitize filename
      file.originalname = validator.escape(file.originalname);
      
      next();
    };
  }
  
  /**
   * Deep sanitize object
   */
  private deepSanitize(obj: any, options: ValidationOptions, depth = 0): any {
    if (depth > (options.maxDepth || 5)) {
      throw new Error('Object too deeply nested');
    }
    
    if (obj === null || obj === undefined) {
      return obj;
    }
    
    if (typeof obj === 'string') {
      // Trim and limit length
      let sanitized = obj.trim();
      if (options.maxStringLength && sanitized.length > options.maxStringLength) {
        sanitized = sanitized.substring(0, options.maxStringLength);
      }
      
      // Remove null bytes
      sanitized = sanitized.replace(/\0/g, '');
      
      // Escape HTML by default (can be overridden by schema transform)
      if (!obj.startsWith('http://') && !obj.startsWith('https://')) {
        sanitized = validator.escape(sanitized);
      }
      
      return sanitized;
    }
    
    if (Array.isArray(obj)) {
      if (options.maxArrayLength && obj.length > options.maxArrayLength) {
        obj = obj.slice(0, options.maxArrayLength);
      }
      return obj.map((item: any) => this.deepSanitize(item, options, depth + 1));
    }
    
    if (typeof obj === 'object') {
      const sanitized: any = {};
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          // Sanitize key
          const sanitizedKey = validator.escape(key);
          sanitized[sanitizedKey] = this.deepSanitize(obj[key], options, depth + 1);
        }
      }
      return sanitized;
    }
    
    return obj;
  }
  
  /**
   * Create rate-limited validation middleware
   */
  rateLimitedValidation<T>(
    schema: ZodSchema<T>,
    maxRequests: number,
    windowMs: number
  ) {
    const requests = new Map<string, number[]>();
    
    return async (req: Request, res: Response, next: NextFunction) => {
      const key = req.ip || 'unknown';
      const now = Date.now();
      const windowStart = now - windowMs;
      
      // Clean old entries
      const userRequests = requests.get(key) || [];
      const recentRequests = userRequests.filter(time => time > windowStart);
      
      if (recentRequests.length >= maxRequests) {
        return res.status(429).json({
          error: 'Too many requests',
          retryAfter: Math.ceil(windowMs / 1000)
        });
      }
      
      // Validate
      try {
        const validated = await schema.parseAsync(req.body);
        req.body = this.deepSanitize(validated, this.defaultOptions);
        
        // Record request
        recentRequests.push(now);
        requests.set(key, recentRequests);
        
        next();
      } catch (error) {
        if (error instanceof ZodError) {
          return res.status(400).json({
            error: 'Validation failed',
            details: error.errors
          });
        }
        next(error);
      }
    };
  }
  
  /**
   * Validate geographic bounds
   */
  static validateBounds(bounds: any): boolean {
    if (!bounds || typeof bounds !== 'object') return false;
    
    const { north, south, east, west } = bounds;
    
    if (typeof north !== 'number' || typeof south !== 'number' ||
        typeof east !== 'number' || typeof west !== 'number') {
      return false;
    }
    
    if (north < -90 || north > 90 || south < -90 || south > 90) {
      return false;
    }
    
    if (east < -180 || east > 180 || west < -180 || west > 180) {
      return false;
    }
    
    if (north <= south) {
      return false;
    }
    
    return true;
  }
  
  /**
   * Sanitize SQL identifiers (table names, column names)
   */
  static sanitizeSQLIdentifier(identifier: string): string {
    // Only allow alphanumeric and underscore
    return identifier.replace(/[^a-zA-Z0-9_]/g, '');
  }
  
  /**
   * Validate and sanitize port name
   */
  static sanitizePortName(name: string): string {
    // Remove special characters that could cause issues
    return name
      .replace(/[<>\"'`]/g, '')
      .substring(0, 200)
      .trim();
  }
} 