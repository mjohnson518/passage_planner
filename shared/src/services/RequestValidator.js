"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RequestValidator = void 0;
const zod_1 = require("zod");
const isomorphic_dompurify_1 = __importDefault(require("isomorphic-dompurify"));
class RequestValidator {
    logger;
    constructor(logger) {
        this.logger = logger || console;
    }
    // Validate passage planning request
    validatePassagePlanRequest(data) {
        const schema = zod_1.z.object({
            departure: zod_1.z.string()
                .min(1, 'Departure port is required')
                .max(100, 'Departure port name too long')
                .transform(val => this.sanitizePortName(val)),
            destination: zod_1.z.string()
                .min(1, 'Destination port is required')
                .max(100, 'Destination port name too long')
                .transform(val => this.sanitizePortName(val)),
            departureTime: zod_1.z.string()
                .datetime('Invalid departure time format')
                .refine(val => new Date(val) > new Date(), 'Departure time must be in the future'),
            boatType: zod_1.z.enum(['sailboat', 'powerboat', 'catamaran']).optional(),
            preferences: zod_1.z.object({
                avoidNightSailing: zod_1.z.boolean().optional(),
                maxWindSpeed: zod_1.z.number()
                    .min(0, 'Wind speed cannot be negative')
                    .max(100, 'Wind speed limit unrealistic')
                    .optional(),
                maxWaveHeight: zod_1.z.number()
                    .min(0, 'Wave height cannot be negative')
                    .max(20, 'Wave height limit unrealistic')
                    .optional(),
            }).optional(),
            userId: zod_1.z.string().uuid('Invalid user ID').optional(),
        });
        return schema.parse(data);
    }
    // Validate coordinates
    validateCoordinates(data) {
        const schema = zod_1.z.object({
            latitude: zod_1.z.number()
                .min(-90, 'Latitude must be >= -90')
                .max(90, 'Latitude must be <= 90'),
            longitude: zod_1.z.number()
                .min(-180, 'Longitude must be >= -180')
                .max(180, 'Longitude must be <= 180'),
        });
        return schema.parse(data);
    }
    // Validate weather request
    validateWeatherRequest(data) {
        const schema = zod_1.z.object({
            coordinates: zod_1.z.array(zod_1.z.object({
                latitude: zod_1.z.number().min(-90).max(90),
                longitude: zod_1.z.number().min(-180).max(180),
            })),
            days: zod_1.z.number()
                .min(1, 'Minimum 1 day forecast')
                .max(14, 'Maximum 14 days forecast')
                .optional()
                .default(7),
            units: zod_1.z.enum(['metric', 'imperial']).optional().default('metric'),
        });
        return schema.parse(data);
    }
    // Validate user registration
    validateUserRegistration(data) {
        const schema = zod_1.z.object({
            email: zod_1.z.string()
                .email('Invalid email address')
                .toLowerCase(),
            password: zod_1.z.string()
                .min(8, 'Password must be at least 8 characters')
                .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, 'Password must contain uppercase, lowercase, number, and special character'),
            displayName: zod_1.z.string()
                .min(2, 'Display name too short')
                .max(50, 'Display name too long')
                .optional(),
            boatType: zod_1.z.enum(['sailboat', 'powerboat', 'catamaran']).optional(),
            sailingExperience: zod_1.z.enum(['beginner', 'intermediate', 'advanced', 'professional']).optional(),
        });
        return schema.parse(data);
    }
    // Validate subscription update
    validateSubscriptionUpdate(data) {
        const schema = zod_1.z.object({
            tier: zod_1.z.enum(['free', 'premium', 'pro', 'enterprise']),
            period: zod_1.z.enum(['monthly', 'yearly']).optional(),
            paymentMethodId: zod_1.z.string().optional(),
        });
        return schema.parse(data);
    }
    // Validate API key creation
    validateApiKeyCreation(data) {
        const schema = zod_1.z.object({
            name: zod_1.z.string()
                .min(3, 'Name too short')
                .max(50, 'Name too long'),
            scopes: zod_1.z.array(zod_1.z.string()).optional().default([]),
            expiresIn: zod_1.z.number()
                .min(1, 'Minimum 1 day')
                .max(365, 'Maximum 365 days')
                .optional(),
        });
        return schema.parse(data);
    }
    // Sanitize port name to prevent injection
    sanitizePortName(name) {
        // Remove any HTML/script tags
        let sanitized = isomorphic_dompurify_1.default.sanitize(name, { ALLOWED_TAGS: [] });
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
    validateFileUpload(file) {
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
    middleware(schema) {
        return async (req, res, next) => {
            try {
                const validated = await schema.parseAsync(req.body);
                req.body = validated;
                next();
            }
            catch (error) {
                if (error instanceof zod_1.z.ZodError) {
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
exports.RequestValidator = RequestValidator;
//# sourceMappingURL=RequestValidator.js.map