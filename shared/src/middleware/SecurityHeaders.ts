import { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';

export interface SecurityHeadersOptions {
  enableHSTS?: boolean;
  enableCSP?: boolean;
  cspDirectives?: Record<string, string[]>;
  enableXFrameOptions?: boolean;
  frameAncestors?: string[];
  enableXContentTypeOptions?: boolean;
  enableReferrerPolicy?: boolean;
  referrerPolicy?: string;
  enablePermissionsPolicy?: boolean;
  permissionsPolicy?: Record<string, string[]>;
  enableCORS?: boolean;
  corsOrigins?: string[];
}

export class SecurityHeaders {
  private defaultOptions: SecurityHeadersOptions = {
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
  
  private defaultCSP = {
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
  
  private defaultPermissionsPolicy = {
    accelerometer: [],
    camera: [],
    geolocation: ['self'],
    gyroscope: [],
    magnetometer: [],
    microphone: [],
    payment: ['self'],
    usb: []
  };
  
  constructor(private options: SecurityHeadersOptions = {}) {
    this.options = { ...this.defaultOptions, ...options };
  }
  
  /**
   * Apply all security headers
   */
  apply() {
    return (req: Request, res: Response, next: NextFunction) => {
      // Apply helmet for basic security headers
      helmet({
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
  private applyCSP(req: Request, res: Response) {
    if (!this.options.enableCSP) return;
    
    const directives = { ...this.defaultCSP, ...this.options.cspDirectives };
    const cspString = Object.entries(directives)
      .map(([key, values]) => {
        if (values.length === 0) return key;
        return `${this.kebabCase(key)} ${values.join(' ')}`;
      })
      .join('; ');
    
    res.setHeader('Content-Security-Policy', cspString);
  }
  
  /**
   * Apply X-Frame-Options
   */
  private applyXFrameOptions(req: Request, res: Response) {
    if (!this.options.enableXFrameOptions) return;
    
    if (this.options.frameAncestors && this.options.frameAncestors.length > 0) {
      // Use CSP frame-ancestors instead
      return;
    }
    
    res.setHeader('X-Frame-Options', 'DENY');
  }
  
  /**
   * Apply X-Content-Type-Options
   */
  private applyXContentTypeOptions(req: Request, res: Response) {
    if (!this.options.enableXContentTypeOptions) return;
    
    res.setHeader('X-Content-Type-Options', 'nosniff');
  }
  
  /**
   * Apply Referrer-Policy
   */
  private applyReferrerPolicy(req: Request, res: Response) {
    if (!this.options.enableReferrerPolicy) return;
    
    res.setHeader('Referrer-Policy', this.options.referrerPolicy || 'strict-origin-when-cross-origin');
  }
  
  /**
   * Apply Permissions-Policy
   */
  private applyPermissionsPolicy(req: Request, res: Response) {
    if (!this.options.enablePermissionsPolicy) return;
    
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
  private applyCORS(req: Request, res: Response) {
    if (!this.options.enableCORS) return;
    
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
  private applyAdditionalHeaders(req: Request, res: Response) {
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
  private kebabCase(str: string): string {
    return str.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
  }
  
  /**
   * Create nonce for inline scripts
   */
  static generateNonce(): string {
    return Buffer.from(crypto.randomUUID()).toString('base64');
  }
  
  /**
   * Apply nonce-based CSP for specific routes
   */
  applyNonceCSP(nonce: string) {
    return (req: Request, res: Response, next: NextFunction) => {
      const directives = { ...this.defaultCSP };
      directives.scriptSrc = ["'self'", `'nonce-${nonce}'`];
      directives.styleSrc = ["'self'", `'nonce-${nonce}'`];
      
      const cspString = Object.entries(directives)
        .map(([key, values]) => {
          if (values.length === 0) return key;
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
  applyReportOnlyCSP(reportUri: string) {
    return (req: Request, res: Response, next: NextFunction) => {
      const directives: any = { ...this.defaultCSP };
      directives.reportUri = [reportUri];
      
      const cspString = Object.entries(directives)
        .map(([key, values]) => {
          if ((values as any).length === 0) return key;
          return `${this.kebabCase(key)} ${(values as any).join(' ')}`;
        })
        .join('; ');
      
      res.setHeader('Content-Security-Policy-Report-Only', cspString);
      next();
    };
  }
} 