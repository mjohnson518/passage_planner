import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';
import { Logger } from 'pino';
import crypto from 'crypto';

interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
  };
  subscription?: {
    tier: string;
    status: string;
  };
}

export class AuthMiddleware {
  private db: Pool;
  private logger: Logger;
  private jwtSecret: string;

  constructor(db: Pool, logger: Logger) {
    this.db = db;
    this.logger = logger.child({ middleware: 'auth' });

    // SECURITY: JWT_SECRET is required - never use fallback in production
    if (!process.env.JWT_SECRET) {
      throw new Error(
        'JWT_SECRET environment variable is required. ' +
        'Generate a secure secret with: openssl rand -base64 32'
      );
    }
    this.jwtSecret = process.env.JWT_SECRET;
  }

  async authenticate(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      // Check for JWT token
      const authHeader = req.headers.authorization;
      if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        const decoded = await this.verifyJWT(token);
        
        if (decoded) {
          req.user = decoded;
          await this.loadSubscription(req);
          return next();
        }
      }

      // Check for API key
      const apiKey = req.headers['x-api-key'] as string;
      if (apiKey) {
        const user = await this.verifyApiKey(apiKey);
        
        if (user) {
          req.user = user;
          await this.loadSubscription(req);
          return next();
        }
      }

      return res.status(401).json({ error: 'Authentication required' });
    } catch (error) {
      this.logger.error({ error }, 'Authentication failed');
      return res.status(401).json({ error: 'Authentication failed' });
    }
  }

  async generateToken(user: { id: string; email: string }): Promise<string> {
    return jwt.sign(
      { id: user.id, email: user.email },
      this.jwtSecret,
      { expiresIn: '7d' }
    );
  }

  private async verifyJWT(token: string): Promise<any> {
    try {
      return jwt.verify(token, this.jwtSecret);
    } catch (error) {
      return null;
    }
  }

  private async verifyApiKey(apiKey: string): Promise<any> {
    try {
      const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');
      
      const result = await this.db.query(
        `SELECT u.id, u.email, ak.id as key_id
         FROM api_keys ak
         JOIN users u ON u.id = ak.user_id
         WHERE ak.key_hash = $1 AND (ak.expires_at IS NULL OR ak.expires_at > NOW())`,
        [keyHash]
      );

      if (result.rows[0]) {
        // Update last used timestamp
        await this.db.query(
          'UPDATE api_keys SET last_used_at = NOW() WHERE id = $1',
          [result.rows[0].key_id]
        );

        return {
          id: result.rows[0].id,
          email: result.rows[0].email
        };
      }

      return null;
    } catch (error) {
      this.logger.error({ error }, 'API key verification failed');
      return null;
    }
  }

  private async loadSubscription(req: AuthRequest) {
    try {
      const result = await this.db.query(
        'SELECT tier, status FROM subscriptions WHERE user_id = $1',
        [req.user!.id]
      );

      req.subscription = result.rows[0] || { tier: 'free', status: 'active' };
    } catch (error) {
      this.logger.error({ error }, 'Failed to load subscription');
      req.subscription = { tier: 'free', status: 'active' };
    }
  }
} 