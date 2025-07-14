import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { z } from 'zod';
import pino from 'pino';
import { Request, Response, NextFunction } from 'express';
import { AuthenticationError, AuthorizationError, ValidationError } from './ErrorHandler';

// User and auth types
export interface User {
  id: string;
  email: string;
  passwordHash?: string;
  name: string;
  role: UserRole;
  subscription: SubscriptionTier;
  apiKeys: APIKey[];
  createdAt: Date;
  updatedAt: Date;
  lastLogin?: Date;
  isActive: boolean;
  emailVerified: boolean;
  twoFactorEnabled: boolean;
  preferences: UserPreferences;
}

export type UserRole = 'user' | 'premium' | 'admin';
export type SubscriptionTier = 'free' | 'basic' | 'premium' | 'enterprise';

export interface APIKey {
  id: string;
  key: string; // Hashed
  name: string;
  lastUsed?: Date;
  expiresAt?: Date;
  scopes: string[];
  rateLimit?: {
    requestsPerMinute: number;
    requestsPerDay: number;
  };
}

export interface UserPreferences {
  units: 'metric' | 'imperial';
  language: string;
  timezone: string;
  notifications: {
    email: boolean;
    weatherAlerts: boolean;
  };
}

export interface JWTPayload {
  userId: string;
  email: string;
  role: UserRole;
  subscription: SubscriptionTier;
  iat?: number;
  exp?: number;
}

export interface RefreshToken {
  token: string;
  userId: string;
  expiresAt: Date;
  createdAt: Date;
}

// Validation schemas
export const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).regex(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
    'Password must contain uppercase, lowercase, number and special character'
  ),
  name: z.string().min(2).max(100),
});

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
  rememberMe: z.boolean().optional(),
});

export const UpdateProfileSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  preferences: z.object({
    units: z.enum(['metric', 'imperial']).optional(),
    language: z.string().optional(),
    timezone: z.string().optional(),
    notifications: z.object({
      email: z.boolean().optional(),
      weatherAlerts: z.boolean().optional(),
    }).optional(),
  }).optional(),
});

// Auth service
export class AuthService {
  private logger = pino({
    level: process.env.LOG_LEVEL || 'info',
    transport: {
      target: 'pino-pretty',
      options: { colorize: true }
    }
  });
  
  private readonly jwtSecret: string;
  private readonly jwtExpiry: string = '1h';
  private readonly refreshTokenExpiry: string = '30d';
  private readonly saltRounds: number = 12;
  private readonly apiKeyPrefix: string = 'pp_';
  
  constructor(private db: any) { // Database connection
    this.jwtSecret = process.env.JWT_SECRET || crypto.randomBytes(64).toString('hex');
    
    if (!process.env.JWT_SECRET) {
      this.logger.warn('JWT_SECRET not set, using random secret (not suitable for production)');
    }
  }
  
  /**
   * Register new user
   */
  async register(data: z.infer<typeof RegisterSchema>): Promise<{
    user: User;
    accessToken: string;
    refreshToken: string;
  }> {
    // Validate input
    const validated = RegisterSchema.parse(data);
    
    // Check if email already exists
    const existing = await this.db.query(
      'SELECT id FROM users WHERE email = $1',
      [validated.email]
    );
    
    if (existing.rows.length > 0) {
      throw new ValidationError('Email already registered');
    }
    
    // Hash password
    const passwordHash = await bcrypt.hash(validated.password, this.saltRounds);
    
    // Create user
    const userId = crypto.randomUUID();
    const now = new Date();
    
    const result = await this.db.query(
      `INSERT INTO users (
        id, email, password_hash, name, role, subscription,
        created_at, updated_at, is_active, email_verified,
        two_factor_enabled, preferences
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *`,
      [
        userId,
        validated.email.toLowerCase(),
        passwordHash,
        validated.name,
        'user',
        'free',
        now,
        now,
        true,
        false,
        false,
        JSON.stringify({
          units: 'metric',
          language: 'en',
          timezone: 'UTC',
          notifications: {
            email: true,
            weatherAlerts: true,
          },
        }),
      ]
    );
    
    const user = this.mapDbUser(result.rows[0]);
    
    // Generate tokens
    const accessToken = await this.generateAccessToken(user);
    const refreshToken = await this.generateRefreshToken(user.id);
    
    // Send verification email (would implement email service)
    await this.sendVerificationEmail(user);
    
    this.logger.info({ userId: user.id, email: user.email }, 'User registered');
    
    return { user, accessToken, refreshToken };
  }
  
  /**
   * Login user
   */
  async login(data: z.infer<typeof LoginSchema>): Promise<{
    user: User;
    accessToken: string;
    refreshToken: string;
  }> {
    const validated = LoginSchema.parse(data);
    
    // Find user
    const result = await this.db.query(
      'SELECT * FROM users WHERE email = $1 AND is_active = true',
      [validated.email.toLowerCase()]
    );
    
    if (result.rows.length === 0) {
      throw new AuthenticationError('Invalid email or password');
    }
    
    const user = this.mapDbUser(result.rows[0]);
    
    // Verify password
    const isValid = await bcrypt.compare(validated.password, user.passwordHash!);
    if (!isValid) {
      throw new AuthenticationError('Invalid email or password');
    }
    
    // Update last login
    await this.db.query(
      'UPDATE users SET last_login = $1 WHERE id = $2',
      [new Date(), user.id]
    );
    
    // Generate tokens
    const accessToken = await this.generateAccessToken(user);
    const refreshToken = await this.generateRefreshToken(user.id);
    
    this.logger.info({ userId: user.id }, 'User logged in');
    
    // Remove password hash from response
    delete user.passwordHash;
    
    return { user, accessToken, refreshToken };
  }
  
  /**
   * Refresh access token
   */
  async refreshAccessToken(refreshToken: string): Promise<{
    accessToken: string;
    refreshToken: string;
  }> {
    // Verify refresh token
    const result = await this.db.query(
      'SELECT * FROM refresh_tokens WHERE token = $1 AND expires_at > NOW()',
      [refreshToken]
    );
    
    if (result.rows.length === 0) {
      throw new AuthenticationError('Invalid or expired refresh token');
    }
    
    const tokenData = result.rows[0];
    
    // Get user
    const userResult = await this.db.query(
      'SELECT * FROM users WHERE id = $1 AND is_active = true',
      [tokenData.user_id]
    );
    
    if (userResult.rows.length === 0) {
      throw new AuthenticationError('User not found or inactive');
    }
    
    const user = this.mapDbUser(userResult.rows[0]);
    
    // Delete old refresh token
    await this.db.query(
      'DELETE FROM refresh_tokens WHERE token = $1',
      [refreshToken]
    );
    
    // Generate new tokens
    const newAccessToken = await this.generateAccessToken(user);
    const newRefreshToken = await this.generateRefreshToken(user.id);
    
    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  }
  
  /**
   * Logout user
   */
  async logout(refreshToken: string): Promise<void> {
    await this.db.query(
      'DELETE FROM refresh_tokens WHERE token = $1',
      [refreshToken]
    );
    
    this.logger.info('User logged out');
  }
  
  /**
   * Generate API key
   */
  async generateAPIKey(
    userId: string,
    name: string,
    scopes: string[] = ['read'],
    expiresInDays?: number
  ): Promise<{ key: string; keyId: string }> {
    // Generate key
    const keyId = crypto.randomUUID();
    const rawKey = crypto.randomBytes(32).toString('base64url');
    const fullKey = `${this.apiKeyPrefix}${rawKey}`;
    
    // Hash key for storage
    const keyHash = await bcrypt.hash(fullKey, this.saltRounds);
    
    // Calculate expiry
    const expiresAt = expiresInDays
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
      : null;
    
    // Get rate limits based on user subscription
    const userResult = await this.db.query(
      'SELECT subscription FROM users WHERE id = $1',
      [userId]
    );
    
    const subscription = userResult.rows[0]?.subscription || 'free';
    const rateLimit = this.getRateLimits(subscription);
    
    // Store key
    await this.db.query(
      `INSERT INTO api_keys (
        id, user_id, key_hash, name, scopes,
        expires_at, rate_limit, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        keyId,
        userId,
        keyHash,
        name,
        JSON.stringify(scopes),
        expiresAt,
        JSON.stringify(rateLimit),
        new Date(),
      ]
    );
    
    this.logger.info({ userId, keyId, name }, 'API key generated');
    
    return { key: fullKey, keyId };
  }
  
  /**
   * Verify API key
   */
  async verifyAPIKey(apiKey: string): Promise<{
    userId: string;
    keyId: string;
    scopes: string[];
    rateLimit: any;
  }> {
    if (!apiKey.startsWith(this.apiKeyPrefix)) {
      throw new AuthenticationError('Invalid API key format');
    }
    
    // Get all active keys (we need to check each one)
    const result = await this.db.query(
      `SELECT * FROM api_keys 
       WHERE (expires_at IS NULL OR expires_at > NOW())`,
    );
    
    for (const row of result.rows) {
      const isValid = await bcrypt.compare(apiKey, row.key_hash);
      
      if (isValid) {
        // Update last used
        await this.db.query(
          'UPDATE api_keys SET last_used = $1 WHERE id = $2',
          [new Date(), row.id]
        );
        
        return {
          userId: row.user_id,
          keyId: row.id,
          scopes: JSON.parse(row.scopes),
          rateLimit: JSON.parse(row.rate_limit),
        };
      }
    }
    
    throw new AuthenticationError('Invalid API key');
  }
  
  /**
   * JWT middleware
   */
  authenticateJWT() {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader) {
          throw new AuthenticationError('No authorization header');
        }
        
        const token = authHeader.split(' ')[1]; // Bearer <token>
        
        if (!token) {
          throw new AuthenticationError('No token provided');
        }
        
        const payload = jwt.verify(token, this.jwtSecret) as JWTPayload;
        
        // Attach user info to request
        (req as any).user = payload;
        
        next();
      } catch (error) {
        if (error instanceof jwt.TokenExpiredError) {
          next(new AuthenticationError('Token expired'));
        } else if (error instanceof jwt.JsonWebTokenError) {
          next(new AuthenticationError('Invalid token'));
        } else {
          next(error);
        }
      }
    };
  }
  
  /**
   * API key middleware
   */
  authenticateAPIKey() {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        const apiKey = req.headers['x-api-key'] as string;
        
        if (!apiKey) {
          throw new AuthenticationError('No API key provided');
        }
        
        const keyData = await this.verifyAPIKey(apiKey);
        
        // Get user info
        const userResult = await this.db.query(
          'SELECT id, email, role, subscription FROM users WHERE id = $1',
          [keyData.userId]
        );
        
        if (userResult.rows.length === 0) {
          throw new AuthenticationError('User not found');
        }
        
        const user = userResult.rows[0];
        
        // Attach to request
        (req as any).user = {
          userId: user.id,
          email: user.email,
          role: user.role,
          subscription: user.subscription,
        };
        (req as any).apiKey = keyData;
        
        next();
      } catch (error) {
        next(error);
      }
    };
  }
  
  /**
   * Authorization middleware
   */
  authorize(...allowedRoles: UserRole[]) {
    return (req: Request, res: Response, next: NextFunction) => {
      const user = (req as any).user;
      
      if (!user) {
        return next(new AuthenticationError('Not authenticated'));
      }
      
      if (!allowedRoles.includes(user.role)) {
        return next(new AuthorizationError(
          `Role ${user.role} not authorized. Required: ${allowedRoles.join(', ')}`
        ));
      }
      
      next();
    };
  }
  
  /**
   * Scope authorization for API keys
   */
  authorizeScope(...requiredScopes: string[]) {
    return (req: Request, res: Response, next: NextFunction) => {
      const apiKey = (req as any).apiKey;
      
      if (!apiKey) {
        return next(new AuthenticationError('API key authentication required'));
      }
      
      const hasScope = requiredScopes.every(scope => 
        apiKey.scopes.includes(scope) || apiKey.scopes.includes('*')
      );
      
      if (!hasScope) {
        return next(new AuthorizationError(
          `Missing required scopes: ${requiredScopes.join(', ')}`
        ));
      }
      
      next();
    };
  }
  
  // Helper methods
  private async generateAccessToken(user: User): Promise<string> {
    const payload: JWTPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      subscription: user.subscription,
    };
    
    return jwt.sign(payload, this.jwtSecret, {
      expiresIn: this.jwtExpiry,
      issuer: 'passage-planner',
      audience: 'passage-planner-api',
    });
  }
  
  private async generateRefreshToken(userId: string): Promise<string> {
    const token = crypto.randomBytes(64).toString('base64url');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30 days
    
    await this.db.query(
      `INSERT INTO refresh_tokens (token, user_id, expires_at, created_at)
       VALUES ($1, $2, $3, $4)`,
      [token, userId, expiresAt, new Date()]
    );
    
    return token;
  }
  
  private getRateLimits(subscription: SubscriptionTier) {
    const limits = {
      free: { requestsPerMinute: 10, requestsPerDay: 100 },
      basic: { requestsPerMinute: 30, requestsPerDay: 500 },
      premium: { requestsPerMinute: 60, requestsPerDay: 2000 },
      enterprise: { requestsPerMinute: 300, requestsPerDay: 10000 },
    };
    
    return limits[subscription] || limits.free;
  }
  
  private mapDbUser(row: any): User {
    return {
      id: row.id,
      email: row.email,
      passwordHash: row.password_hash,
      name: row.name,
      role: row.role,
      subscription: row.subscription,
      apiKeys: [], // Would load separately if needed
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      lastLogin: row.last_login,
      isActive: row.is_active,
      emailVerified: row.email_verified,
      twoFactorEnabled: row.two_factor_enabled,
      preferences: JSON.parse(row.preferences || '{}'),
    };
  }
  
  private async sendVerificationEmail(user: User): Promise<void> {
    // Would implement email service
    this.logger.info({ userId: user.id }, 'Verification email sent');
  }
} 