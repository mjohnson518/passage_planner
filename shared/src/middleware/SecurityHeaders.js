"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SecurityHeaders = void 0;
const helmet_1 = __importDefault(require("helmet"));
class SecurityHeaders {
    options;
    defaultOptions = {
        enableHSTS: true,
        enableCSP: true,
        enableXFrameOptions: true,
        enableXContentTypeOptions: true,
        enableReferrerPolicy: true,
        referrerPolicy: 'strict-origin-when-cross-origin',
        enablePermissionsPolicy: true,
        enableCORS: true,
        corsOrigins: []
    };
    defaultCSP = {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // For Next.js
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:", "blob:"],
        connectSrc: ["'self'", "https://api.weather.gov", "https://api.tidesandcurrents.noaa.gov"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
        workerSrc: ["'self'", "blob:"],
        childSrc: ["'self'", "blob:"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
        upgradeInsecureRequests: []
    };
    defaultPermissionsPolicy = {
        accelerometer: [],
        camera: [],
        geolocation: ['self'],
        gyroscope: [],
        magnetometer: [],
        microphone: [],
        payment: ['self'],
        usb: []
    };
    constructor(options = {}) {
        this.options = options;
        this.options = { ...this.defaultOptions, ...options };
    }
    /**
     * Apply all security headers
     */
    apply() {
        return (req, res, next) => {
            // Apply helmet for basic security headers
            (0, helmet_1.default)({
                contentSecurityPolicy: false, // We'll handle CSP separately
                hsts: this.options.enableHSTS ? {
                    maxAge: 31536000,
                    includeSubDomains: true,
                    preload: true
                } : false
            })(req, res, () => {
                // Apply additional headers
                this.applyCSP(req, res);
                this.applyXFrameOptions(req, res);
                this.applyXContentTypeOptions(req, res);
                this.applyReferrerPolicy(req, res);
                this.applyPermissionsPolicy(req, res);
                this.applyCORS(req, res);
                this.applyAdditionalHeaders(req, res);
                next();
            });
        };
    }
    /**
     * Apply Content Security Policy
     */
    applyCSP(req, res) {
        if (!this.options.enableCSP)
            return;
        const directives = { ...this.defaultCSP, ...this.options.cspDirectives };
        const cspString = Object.entries(directives)
            .map(([key, values]) => {
            if (values.length === 0)
                return key;
            return `${this.kebabCase(key)} ${values.join(' ')}`;
        })
            .join('; ');
        res.setHeader('Content-Security-Policy', cspString);
    }
    /**
     * Apply X-Frame-Options
     */
    applyXFrameOptions(req, res) {
        if (!this.options.enableXFrameOptions)
            return;
        if (this.options.frameAncestors && this.options.frameAncestors.length > 0) {
            // Use CSP frame-ancestors instead
            return;
        }
        res.setHeader('X-Frame-Options', 'DENY');
    }
    /**
     * Apply X-Content-Type-Options
     */
    applyXContentTypeOptions(req, res) {
        if (!this.options.enableXContentTypeOptions)
            return;
        res.setHeader('X-Content-Type-Options', 'nosniff');
    }
    /**
     * Apply Referrer-Policy
     */
    applyReferrerPolicy(req, res) {
        if (!this.options.enableReferrerPolicy)
            return;
        res.setHeader('Referrer-Policy', this.options.referrerPolicy || 'strict-origin-when-cross-origin');
    }
    /**
     * Apply Permissions-Policy
     */
    applyPermissionsPolicy(req, res) {
        if (!this.options.enablePermissionsPolicy)
            return;
        const policy = { ...this.defaultPermissionsPolicy, ...this.options.permissionsPolicy };
        const policyString = Object.entries(policy)
            .map(([feature, allowList]) => {
            if (allowList.length === 0) {
                return `${feature}=()`;
            }
            return `${feature}=(${allowList.join(' ')})`;
        })
            .join(', ');
        res.setHeader('Permissions-Policy', policyString);
    }
    /**
     * Apply CORS headers
     */
    applyCORS(req, res) {
        if (!this.options.enableCORS)
            return;
        const origin = req.headers.origin;
        const allowedOrigins = this.options.corsOrigins || [];
        // Add default allowed origins
        if (process.env.NEXT_PUBLIC_APP_URL) {
            allowedOrigins.push(process.env.NEXT_PUBLIC_APP_URL);
        }
        if (origin && (allowedOrigins.includes(origin) || allowedOrigins.includes('*'))) {
            res.setHeader('Access-Control-Allow-Origin', origin);
            res.setHeader('Access-Control-Allow-Credentials', 'true');
        }
        if (req.method === 'OPTIONS') {
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key');
            res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours
        }
    }
    /**
     * Apply additional security headers
     */
    applyAdditionalHeaders(req, res) {
        // Remove potentially dangerous headers
        res.removeHeader('X-Powered-By');
        res.removeHeader('Server');
        // Add additional security headers
        res.setHeader('X-XSS-Protection', '1; mode=block');
        res.setHeader('X-DNS-Prefetch-Control', 'off');
        res.setHeader('X-Download-Options', 'noopen');
        res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
        // Add security headers for modern browsers
        res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
        res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
        res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
        // Add cache control for sensitive endpoints
        if (req.path.includes('/api/auth') || req.path.includes('/api/user')) {
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
        }
    }
    /**
     * Convert camelCase to kebab-case
     */
    kebabCase(str) {
        return str.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
    }
    /**
     * Create nonce for inline scripts
     */
    static generateNonce() {
        return Buffer.from(crypto.randomUUID()).toString('base64');
    }
    /**
     * Apply nonce-based CSP for specific routes
     */
    applyNonceCSP(nonce) {
        return (req, res, next) => {
            const directives = { ...this.defaultCSP };
            directives.scriptSrc = ["'self'", `'nonce-${nonce}'`];
            directives.styleSrc = ["'self'", `'nonce-${nonce}'`];
            const cspString = Object.entries(directives)
                .map(([key, values]) => {
                if (values.length === 0)
                    return key;
                return `${this.kebabCase(key)} ${values.join(' ')}`;
            })
                .join('; ');
            res.setHeader('Content-Security-Policy', cspString);
            res.locals.nonce = nonce;
            next();
        };
    }
    /**
     * Report-only mode for testing CSP
     */
    applyReportOnlyCSP(reportUri) {
        return (req, res, next) => {
            const directives = { ...this.defaultCSP };
            directives.reportUri = [reportUri];
            const cspString = Object.entries(directives)
                .map(([key, values]) => {
                if (values.length === 0)
                    return key;
                return `${this.kebabCase(key)} ${values.join(' ')}`;
            })
                .join('; ');
            res.setHeader('Content-Security-Policy-Report-Only', cspString);
            next();
        };
    }
}
exports.SecurityHeaders = SecurityHeaders;
//# sourceMappingURL=SecurityHeaders.js.map