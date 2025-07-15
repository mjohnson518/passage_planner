import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import crypto from 'crypto';
import { User, Session, ApiKey, SubscriptionTier } from '../types/core';

export interface JWTPayload {
  userId: string;
  email: string;
  role: string;
  subscription: SubscriptionTier;
}

export class AuthService {
  private jwtSecret: string;
  private jwtExpiry: string = '24h';
  private saltRounds: number = 12;
  
  constructor() {
    this.jwtSecret = process.env.JWT_SECRET || crypto.randomBytes(64).toString('hex');
    if (!process.env.JWT_SECRET) {
      console.warn('JWT_SECRET not set, using random secret (not suitable for production)');
    }
  }
  
  // Generate JWT token
  async generateToken(user: User): Promise<string> {
    const payload: JWTPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      subscription: user.subscription?.tier || 'free',
    };
    
    return jwt.sign(payload, this.jwtSecret, {
      expiresIn: this.jwtExpiry,
      issuer: 'passage-planner',
      audience: 'passage-planner-api',
    });
  }
  
  // Verify JWT token
  async verifyToken(token: string): Promise<JWTPayload> {
    try {
      const decoded = jwt.verify(token, this.jwtSecret, {
        issuer: 'passage-planner',
        audience: 'passage-planner-api',
      }) as JWTPayload;
      
      return decoded;
    } catch (error) {
      throw new Error('Invalid or expired token');
    }
  }
  
  // Hash password
  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, this.saltRounds);
  }
  
  // Verify password
  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }
  
  // Generate API key
  generateApiKey(): string {
    const prefix = 'pp_'; // passage-planner prefix
    const key = crypto.randomBytes(32).toString('base64url');
    return `${prefix}${key}`;
  }
  
  // Hash API key for storage
  async hashApiKey(apiKey: string): Promise<string> {
    return bcrypt.hash(apiKey, this.saltRounds);
  }
  
  // Verify API key
  async verifyApiKey(apiKey: string, hashedKey: string): Promise<boolean> {
    return bcrypt.compare(apiKey, hashedKey);
  }
  
  // Generate session token
  generateSessionToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }
  
  // Get rate limits based on subscription
  getRateLimits(subscription: SubscriptionTier): { requestsPerMinute: number; requestsPerDay: number } {
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
  generateResetToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }
  
  // Generate email verification token
  generateVerificationToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }
} 