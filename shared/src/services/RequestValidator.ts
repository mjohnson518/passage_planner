import { z } from 'zod';
import DOMPurify from 'isomorphic-dompurify';
import { Request, Response, NextFunction } from 'express';
import pino from 'pino';
import { ValidationError } from './ErrorHandler';

// Common validation schemas
export const CoordinateSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

export const DateTimeSchema = z.string().datetime().or(z.date()).transform(val => 
  val instanceof Date ? val : new Date(val)
);

export const PaginationSchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});

// Passage planning schemas
export const PassagePlanRequestSchema = z.object({
  departure: z.string()
    .min(1, 'Departure port is required')
    .max(100, 'Departure port name too long'),
  destination: z.string()
    .min(1, 'Destination port is required')
    .max(100, 'Destination port name too long'),
  departureTime: DateTimeSchema.refine(
    val => val > new Date(),
    'Departure time must be in the future'
  ),
  boatType: z.enum(['sailboat', 'powerboat', 'catamaran']).optional(),
  preferences: z.object({
    avoidNightSailing: z.boolean().optional(),
    maxWindSpeed: z.number()
      .min(0, 'Wind speed cannot be negative')
      .max(100, 'Wind speed limit unrealistic')
      .optional(),
    maxWaveHeight: z.number()
      .min(0, 'Wave height cannot be negative')
      .max(20, 'Wave height limit unrealistic')
      .optional(),
    fuelCapacity: z.number().positive().optional(),
    cruisingSpeed: z.number().positive().max(50).optional(),
  }).optional(),
});

export const WeatherRequestSchema = z.object({
  coordinates: CoordinateSchema,
  units: z.enum(['metric', 'imperial']).default('metric'),
  hours: z.number().int().min(1).max(240).optional(),
  includeAlerts: z.boolean().default(true),
});

export const TideRequestSchema = z.object({
  coordinates: CoordinateSchema.optional(),
  stationId: z.string().optional(),
  days: z.number().int().min(1).max(30).default(7),
  datum: z.enum(['MLLW', 'MLW', 'MSL', 'MHW', 'MHHW']).optional(),
}).refine(
  data => data.coordinates || data.stationId,
  'Either coordinates or stationId must be provided'
);

export const RouteRequestSchema = z.object({
  waypoints: z.array(CoordinateSchema).min(2),
  optimize: z.boolean().default(false),
  avoidAreas: z.array(z.object({
    center: CoordinateSchema,
    radius: z.number().positive(), // nautical miles
  })).optional(),
  constraints: z.object({
    maxDistance: z.number().positive().optional(),
    preferredDepth: z.number().positive().optional(),
    avoidShallowWater: z.boolean().optional(),
  }).optional(),
});

export const PortSearchSchema = z.object({
  query: z.string().optional(),
  coordinates: CoordinateSchema.optional(),
  radius: z.number().positive().max(500).optional(), // nautical miles
  country: z.string().length(2).optional(), // ISO country code
  facilities: z.array(z.enum(['fuel', 'water', 'provisions', 'repairs', 'customs'])).optional(),
  minDepth: z.number().positive().optional(),
  pagination: PaginationSchema.optional(),
});

// Request validator class
export class RequestValidator {
  private logger = pino({
    level: process.env.LOG_LEVEL || 'info',
    transport: {
      target: 'pino-pretty',
      options: { colorize: true }
    }
  });
  
  private readonly maxRequestSize = 10 * 1024 * 1024; // 10MB
  private readonly allowedContentTypes = [
    'application/json',
    'application/x-www-form-urlencoded',
    'multipart/form-data',
  ];
  
  /**
   * Validate request body against schema
   */
  validateBody<T>(schema: z.ZodSchema<T>) {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        // Check content type
        const contentType = req.get('content-type');
        if (contentType && !this.allowedContentTypes.some(type => contentType.includes(type))) {
          throw new ValidationError(`Unsupported content type: ${contentType}`);
        }
        
        // Validate and sanitize
        const validated = await schema.parseAsync(req.body);
        req.body = this.sanitizeData(validated);
        
        next();
      } catch (error) {
        if (error instanceof z.ZodError) {
          next(new ValidationError('Validation failed', {
            errors: error.errors.map(err => ({
              path: err.path.join('.'),
              message: err.message,
            })),
          }));
        } else {
          next(error);
        }
      }
    };
  }
  
  /**
   * Validate query parameters
   */
  validateQuery<T>(schema: z.ZodSchema<T>) {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        const validated = await schema.parseAsync(req.query);
        req.query = this.sanitizeData(validated) as any;
        next();
      } catch (error) {
        if (error instanceof z.ZodError) {
          next(new ValidationError('Invalid query parameters', {
            errors: error.errors.map(err => ({
              path: err.path.join('.'),
              message: err.message,
            })),
          }));
        } else {
          next(error);
        }
      }
    };
  }
  
  /**
   * Validate route parameters
   */
  validateParams<T>(schema: z.ZodSchema<T>) {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        const validated = await schema.parseAsync(req.params);
        req.params = this.sanitizeData(validated) as any;
        next();
      } catch (error) {
        if (error instanceof z.ZodError) {
          next(new ValidationError('Invalid route parameters', {
            errors: error.errors.map(err => ({
              path: err.path.join('.'),
              message: err.message,
            })),
          }));
        } else {
          next(error);
        }
      }
    };
  }
  
  /**
   * Sanitize data to prevent XSS and injection attacks
   */
  private sanitizeData(data: any): any {
    if (typeof data === 'string') {
      // Remove HTML tags and scripts
      let sanitized = DOMPurify.sanitize(data, { 
        ALLOWED_TAGS: [],
        ALLOWED_ATTR: [],
      });
      
      // Remove SQL injection attempts
      sanitized = this.sanitizeSQL(sanitized);
      
      // Trim whitespace
      return sanitized.trim();
    }
    
    if (Array.isArray(data)) {
      return data.map(item => this.sanitizeData(item));
    }
    
    if (data && typeof data === 'object') {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(data)) {
        // Sanitize key as well
        const sanitizedKey = this.sanitizeData(key);
        sanitized[sanitizedKey] = this.sanitizeData(value);
      }
      return sanitized;
    }
    
    return data;
  }
  
  /**
   * Sanitize SQL injection attempts
   */
  private sanitizeSQL(input: string): string {
    // Basic SQL injection prevention
    // In production, always use parameterized queries
    return input
      .replace(/'/g, "''")
      .replace(/;/g, '')
      .replace(/--/g, '')
      .replace(/\/\*/g, '')
      .replace(/\*\//g, '')
      .replace(/xp_/gi, '')
      .replace(/exec/gi, '')
      .replace(/union.*select/gi, '');
  }
  
  /**
   * Validate file upload
   */
  validateFileUpload(options: {
    maxSize?: number;
    allowedMimeTypes?: string[];
    allowedExtensions?: string[];
  } = {}) {
    const {
      maxSize = 10 * 1024 * 1024, // 10MB default
      allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'],
      allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.pdf'],
    } = options;
    
    return (req: Request, res: Response, next: NextFunction) => {
      const files = req.files as Express.Multer.File[] | { [fieldname: string]: Express.Multer.File[] };
      
      if (!files) {
        return next();
      }
      
      const fileArray = Array.isArray(files) 
        ? files 
        : Object.values(files).flat();
      
      try {
        for (const file of fileArray) {
          // Check file size
          if (file.size > maxSize) {
            throw new ValidationError(`File ${file.originalname} exceeds maximum size of ${maxSize} bytes`);
          }
          
          // Check MIME type
          if (!allowedMimeTypes.includes(file.mimetype)) {
            throw new ValidationError(`File type ${file.mimetype} not allowed`);
          }
          
          // Check extension
          const ext = file.originalname.toLowerCase().substring(file.originalname.lastIndexOf('.'));
          if (!allowedExtensions.includes(ext)) {
            throw new ValidationError(`File extension ${ext} not allowed`);
          }
          
          // Additional security checks
          this.validateFileContent(file);
        }
        
        next();
      } catch (error) {
        next(error);
      }
    };
  }
  
  /**
   * Validate file content for security
   */
  private validateFileContent(file: Express.Multer.File) {
    // Check for suspicious patterns in file content
    const suspiciousPatterns = [
      /<script/i,
      /<iframe/i,
      /javascript:/i,
      /on\w+\s*=/i, // Event handlers
    ];
    
    // For text-based files, check content
    if (file.mimetype.startsWith('text/') || file.mimetype === 'application/json') {
      const content = file.buffer.toString('utf8');
      
      for (const pattern of suspiciousPatterns) {
        if (pattern.test(content)) {
          throw new ValidationError('File contains potentially malicious content');
        }
      }
    }
    
    // Check for file type mismatch (magic numbers)
    const magicNumbers: Record<string, Buffer> = {
      'image/jpeg': Buffer.from([0xFF, 0xD8, 0xFF]),
      'image/png': Buffer.from([0x89, 0x50, 0x4E, 0x47]),
      'image/gif': Buffer.from([0x47, 0x49, 0x46]),
      'application/pdf': Buffer.from([0x25, 0x50, 0x44, 0x46]),
    };
    
    const expectedMagic = magicNumbers[file.mimetype];
    if (expectedMagic && !file.buffer.slice(0, expectedMagic.length).equals(expectedMagic)) {
      throw new ValidationError('File content does not match declared type');
    }
  }
  
  /**
   * Rate limit validation
   */
  validateRateLimit(identifier: (req: Request) => string) {
    const requests = new Map<string, number[]>();
    const windowMs = 60 * 1000; // 1 minute
    const maxRequests = 100;
    
    return (req: Request, res: Response, next: NextFunction) => {
      const id = identifier(req);
      const now = Date.now();
      const windowStart = now - windowMs;
      
      // Get requests for this identifier
      const userRequests = requests.get(id) || [];
      const recentRequests = userRequests.filter(time => time > windowStart);
      
      if (recentRequests.length >= maxRequests) {
        res.set('Retry-After', '60');
        return next(new ValidationError('Rate limit exceeded', {
          retryAfter: 60,
        }));
      }
      
      // Add current request
      recentRequests.push(now);
      requests.set(id, recentRequests);
      
      // Clean up old entries periodically
      if (Math.random() < 0.01) {
        for (const [key, times] of requests.entries()) {
          const recent = times.filter(time => time > windowStart);
          if (recent.length === 0) {
            requests.delete(key);
          } else {
            requests.set(key, recent);
          }
        }
      }
      
      next();
    };
  }
  
  /**
   * Validate coordinates are within valid marine areas
   */
  async validateMarineCoordinates(coordinates: { latitude: number; longitude: number }): Promise<boolean> {
    // Basic validation - ensure coordinates are not on land
    // In production, would use a proper land/water mask database
    
    // Check if coordinates are within reasonable marine bounds
    const marineBounds = [
      { name: 'Atlantic', minLat: -60, maxLat: 70, minLon: -100, maxLon: 20 },
      { name: 'Pacific', minLat: -60, maxLat: 65, minLon: -180, maxLon: -70 },
      { name: 'Pacific West', minLat: -60, maxLat: 65, minLon: 100, maxLon: 180 },
      { name: 'Indian', minLat: -60, maxLat: 30, minLon: 20, maxLon: 150 },
      { name: 'Arctic', minLat: 65, maxLat: 90, minLon: -180, maxLon: 180 },
      { name: 'Southern', minLat: -90, maxLat: -60, minLon: -180, maxLon: 180 },
    ];
    
    const isInOcean = marineBounds.some(bound => 
      coordinates.latitude >= bound.minLat &&
      coordinates.latitude <= bound.maxLat &&
      coordinates.longitude >= bound.minLon &&
      coordinates.longitude <= bound.maxLon
    );
    
    if (!isInOcean) {
      this.logger.warn({ coordinates }, 'Coordinates may not be in navigable waters');
    }
    
    return isInOcean;
  }
  
  /**
   * Create a composite validator
   */
  static compose(...validators: Array<(req: Request, res: Response, next: NextFunction) => void>) {
    return async (req: Request, res: Response, next: NextFunction) => {
      let index = 0;
      
      const runNext = async (err?: any) => {
        if (err) {
          return next(err);
        }
        
        if (index >= validators.length) {
          return next();
        }
        
        const validator = validators[index++];
        try {
          await validator(req, res, runNext);
        } catch (error) {
          next(error);
        }
      };
      
      runNext();
    };
  }
} 