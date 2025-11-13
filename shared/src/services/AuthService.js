"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const crypto_1 = __importDefault(require("crypto"));
class AuthService {
    jwtSecret;
    jwtExpiry = '24h';
    saltRounds = 12;
    constructor() {
        this.jwtSecret = process.env.JWT_SECRET || crypto_1.default.randomBytes(64).toString('hex');
        if (!process.env.JWT_SECRET) {
            console.warn('JWT_SECRET not set, using random secret (not suitable for production)');
        }
    }
    // Generate JWT token
    async generateToken(user) {
        const payload = {
            userId: user.id,
            email: user.email,
            role: user.role,
            subscription: user.subscription?.tier || 'free',
        };
        return jsonwebtoken_1.default.sign(payload, this.jwtSecret, {
            expiresIn: this.jwtExpiry.toString(),
            issuer: 'passage-planner',
            audience: 'passage-planner-api',
        });
    }
    // Verify JWT token
    async verifyToken(token) {
        try {
            const decoded = jsonwebtoken_1.default.verify(token, this.jwtSecret, {
                issuer: 'passage-planner',
                audience: 'passage-planner-api',
            });
            return decoded;
        }
        catch (error) {
            throw new Error('Invalid or expired token');
        }
    }
    // Hash password
    async hashPassword(password) {
        return bcryptjs_1.default.hash(password, this.saltRounds);
    }
    // Verify password
    async verifyPassword(password, hash) {
        return bcryptjs_1.default.compare(password, hash);
    }
    // Generate API key
    generateApiKey() {
        const prefix = 'pp_'; // passage-planner prefix
        const key = crypto_1.default.randomBytes(32).toString('base64url');
        return `${prefix}${key}`;
    }
    // Hash API key for storage
    async hashApiKey(apiKey) {
        return bcryptjs_1.default.hash(apiKey, this.saltRounds);
    }
    // Verify API key
    async verifyApiKey(apiKey, hashedKey) {
        return bcryptjs_1.default.compare(apiKey, hashedKey);
    }
    // Generate session token
    generateSessionToken() {
        return crypto_1.default.randomBytes(32).toString('hex');
    }
    // Get rate limits based on subscription
    getRateLimits(subscription) {
        switch (subscription) {
            case 'free':
                return { requestsPerMinute: 10, requestsPerDay: 100 };
            case 'premium':
                return { requestsPerMinute: 60, requestsPerDay: 1000 };
            case 'pro':
                return { requestsPerMinute: 300, requestsPerDay: 10000 };
            case 'enterprise':
                return { requestsPerMinute: -1, requestsPerDay: -1 }; // unlimited
            default:
                return { requestsPerMinute: 10, requestsPerDay: 100 };
        }
    }
    // Generate reset password token
    generateResetToken() {
        return crypto_1.default.randomBytes(32).toString('hex');
    }
    // Generate email verification token
    generateVerificationToken() {
        return crypto_1.default.randomBytes(32).toString('hex');
    }
}
exports.AuthService = AuthService;
//# sourceMappingURL=AuthService.js.map