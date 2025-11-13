"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.InputValidation = void 0;
const zod_1 = require("zod");
const validator_1 = __importDefault(require("validator"));
class InputValidation {
    logger;
    defaultOptions = {
        stripUnknown: true,
        maxDepth: 5,
        maxArrayLength: 100,
        maxStringLength: 10000
    };
    constructor(logger) {
        this.logger = logger;
    }
    /**
     * Common validation schemas
     */
    static schemas = {
        // Geographic coordinates
        coordinates: zod_1.z.object({
            latitude: zod_1.z.number().min(-90).max(90),
            longitude: zod_1.z.number().min(-180).max(180)
        }),
        // Port/waypoint
        waypoint: zod_1.z.object({
            id: zod_1.z.string().optional(),
            name: zod_1.z.string().max(200).optional(),
            latitude: zod_1.z.number().min(-90).max(90),
            longitude: zod_1.z.number().min(-180).max(180)
        }),
        // Date/time
        dateTime: zod_1.z.string().datetime().or(zod_1.z.date()),
        // Boat details
        boatDetails: zod_1.z.object({
            type: zod_1.z.enum(['sailboat', 'motorboat', 'catamaran', 'trimaran']),
            length: zod_1.z.number().min(1).max(500), // feet
            beam: zod_1.z.number().min(1).max(100).optional(),
            draft: zod_1.z.number().min(0).max(50),
            name: zod_1.z.string().max(100).optional()
        }),
        // Weather preferences
        weatherPreferences: zod_1.z.object({
            maxWindSpeed: zod_1.z.number().min(0).max(100).optional(),
            maxWaveHeight: zod_1.z.number().min(0).max(20).optional(),
            minVisibility: zod_1.z.number().min(0).max(50).optional(),
            avoidNight: zod_1.z.boolean().optional()
        }),
        // Pagination
        pagination: zod_1.z.object({
            page: zod_1.z.number().int().min(1).default(1),
            limit: zod_1.z.number().int().min(1).max(100).default(20),
            sortBy: zod_1.z.string().max(50).optional(),
            sortOrder: zod_1.z.enum(['asc', 'desc']).default('asc')
        }),
        // UUID
        uuid: zod_1.z.string().uuid(),
        // Email
        email: zod_1.z.string().email().max(255),
        // Password (min 8 chars, must contain number and letter)
        password: zod_1.z.string()
            .min(8)
            .max(128)
            .refine(val => /[a-zA-Z]/.test(val) && /[0-9]/.test(val), {
            message: 'Password must contain at least one letter and one number'
        }),
        // Phone
        phone: zod_1.z.string().refine(val => validator_1.default.isMobilePhone(val, 'any'), {
            message: 'Invalid phone number'
        }),
        // URL
        url: zod_1.z.string().url().max(2000),
        // Safe string (alphanumeric + basic punctuation)
        safeString: zod_1.z.string().regex(/^[a-zA-Z0-9\s\-_.,!?'"]+$/),
        // Search query
        searchQuery: zod_1.z.string()
            .max(200)
            .transform(val => validator_1.default.escape(val))
    };
    /**
     * Validate request body
     */
    validateBody(schema, options) {
        return async (req, res, next) => {
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
            }
            catch (error) {
                if (error instanceof zod_1.ZodError) {
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
    validateQuery(schema, options) {
        return async (req, res, next) => {
            try {
                const validated = await schema.parseAsync(req.query);
                req.query = this.deepSanitize(validated, options || this.defaultOptions);
                next();
            }
            catch (error) {
                if (error instanceof zod_1.ZodError) {
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
    validateParams(schema) {
        return async (req, res, next) => {
            try {
                const validated = await schema.parseAsync(req.params);
                req.params = validated;
                next();
            }
            catch (error) {
                if (error instanceof zod_1.ZodError) {
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
    validateFile(options) {
        return (req, res, next) => {
            const file = req.file;
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
            file.originalname = validator_1.default.escape(file.originalname);
            next();
        };
    }
    /**
     * Deep sanitize object
     */
    deepSanitize(obj, options, depth = 0) {
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
                sanitized = validator_1.default.escape(sanitized);
            }
            return sanitized;
        }
        if (Array.isArray(obj)) {
            if (options.maxArrayLength && obj.length > options.maxArrayLength) {
                obj = obj.slice(0, options.maxArrayLength);
            }
            return obj.map((item) => this.deepSanitize(item, options, depth + 1));
        }
        if (typeof obj === 'object') {
            const sanitized = {};
            for (const key in obj) {
                if (obj.hasOwnProperty(key)) {
                    // Sanitize key
                    const sanitizedKey = validator_1.default.escape(key);
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
    rateLimitedValidation(schema, maxRequests, windowMs) {
        const requests = new Map();
        return async (req, res, next) => {
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
            }
            catch (error) {
                if (error instanceof zod_1.ZodError) {
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
    static validateBounds(bounds) {
        if (!bounds || typeof bounds !== 'object')
            return false;
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
    static sanitizeSQLIdentifier(identifier) {
        // Only allow alphanumeric and underscore
        return identifier.replace(/[^a-zA-Z0-9_]/g, '');
    }
    /**
     * Validate and sanitize port name
     */
    static sanitizePortName(name) {
        // Remove special characters that could cause issues
        return name
            .replace(/[<>\"'`]/g, '')
            .substring(0, 200)
            .trim();
    }
}
exports.InputValidation = InputValidation;
//# sourceMappingURL=InputValidation.js.map