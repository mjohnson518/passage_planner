import { z } from 'zod';
import DOMPurify from 'isomorphic-dompurify';
import { Logger } from 'pino';

export class RequestValidator {
  private logger: Logger;
  
  constructor(logger?: Logger) {
    this.logger = logger || console as any;
  }
  
  // Validate passage planning request
  validatePassagePlanRequest(data: any) {
    const schema = z.object({
      departure: z.string()
        .min(1, 'Departure port is required')
        .max(100, 'Departure port name too long')
        .transform(val => this.sanitizePortName(val)),
      
      destination: z.string()
        .min(1, 'Destination port is required')
        .max(100, 'Destination port name too long')
        .transform(val => this.sanitizePortName(val)),
      
      departureTime: z.string()
        .datetime('Invalid departure time format')
        .refine(val => new Date(val) > new Date(), 'Departure time must be in the future'),
      
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
      }).optional(),
      
      userId: z.string().uuid('Invalid user ID').optional(),
    });
    
    return schema.parse(data);
  }
  
  // Validate coordinates
  validateCoordinates(data: any) {
    const schema = z.object({
      latitude: z.number()
        .min(-90, 'Latitude must be >= -90')
        .max(90, 'Latitude must be <= 90'),
      longitude: z.number()
        .min(-180, 'Longitude must be >= -180')
        .max(180, 'Longitude must be <= 180'),
    });
    
    return schema.parse(data);
  }
  
  // Validate weather request
  validateWeatherRequest(data: any) {
    const schema = z.object({
      coordinates: z.array(this.validateCoordinates),
      days: z.number()
        .min(1, 'Minimum 1 day forecast')
        .max(14, 'Maximum 14 days forecast')
        .optional()
        .default(7),
      units: z.enum(['metric', 'imperial']).optional().default('metric'),
    });
    
    return schema.parse(data);
  }
  
  // Validate user registration
  validateUserRegistration(data: any) {
    const schema = z.object({
      email: z.string()
        .email('Invalid email address')
        .toLowerCase(),
      password: z.string()
        .min(8, 'Password must be at least 8 characters')
        .regex(
          /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
          'Password must contain uppercase, lowercase, number, and special character'
        ),
      displayName: z.string()
        .min(2, 'Display name too short')
        .max(50, 'Display name too long')
        .optional(),
      boatType: z.enum(['sailboat', 'powerboat', 'catamaran']).optional(),
      sailingExperience: z.enum(['beginner', 'intermediate', 'advanced', 'professional']).optional(),
    });
    
    return schema.parse(data);
  }
  
  // Validate subscription update
  validateSubscriptionUpdate(data: any) {
    const schema = z.object({
      tier: z.enum(['free', 'premium', 'pro', 'enterprise']),
      period: z.enum(['monthly', 'yearly']).optional(),
      paymentMethodId: z.string().optional(),
    });
    
    return schema.parse(data);
  }
  
  // Validate API key creation
  validateApiKeyCreation(data: any) {
    const schema = z.object({
      name: z.string()
        .min(3, 'Name too short')
        .max(50, 'Name too long'),
      scopes: z.array(z.string()).optional().default([]),
      expiresIn: z.number()
        .min(1, 'Minimum 1 day')
        .max(365, 'Maximum 365 days')
        .optional(),
    });
    
    return schema.parse(data);
  }
  
  // Sanitize port name to prevent injection
  private sanitizePortName(name: string): string {
    // Remove any HTML/script tags
    let sanitized = DOMPurify.sanitize(name, { ALLOWED_TAGS: [] });
    
    // Remove SQL injection attempts
    sanitized = sanitized
      .replace(/[';]/g, '')
      .replace(/--/g, '')
      .replace(/\/\*/g, '')
      .replace(/\*\//g, '')
      .replace(/xp_/gi, '')
      .replace(/exec/gi, '');
    
    // Limit to alphanumeric, spaces, commas, and basic punctuation
    sanitized = sanitized.replace(/[^a-zA-Z0-9\s,.-]/g, '');
    
    return sanitized.trim();
  }
  
  // Validate file upload
  validateFileUpload(file: any) {
    const allowedMimeTypes = [
      'application/gpx+xml',
      'text/csv',
      'application/json',
    ];
    
    const maxFileSize = 10 * 1024 * 1024; // 10MB
    
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new Error(`File type ${file.mimetype} not allowed`);
    }
    
    if (file.size > maxFileSize) {
      throw new Error(`File size ${file.size} exceeds maximum of ${maxFileSize}`);
    }
    
    return true;
  }
  
  // Create Express middleware
  middleware(schema: z.ZodSchema) {
    return async (req: any, res: any, next: any) => {
      try {
        const validated = await schema.parseAsync(req.body);
        req.body = validated;
        next();
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Validation failed',
              details: error.errors,
            },
          });
        }
        next(error);
      }
    };
  }
} 