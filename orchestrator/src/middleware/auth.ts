import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { createClient } from '@supabase/supabase-js';
import { Logger } from '../../../shared/src/services/logger';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        subscription?: {
          tier: string;
          status: string;
        };
      };
    }
  }
}

const logger = new Logger('AuthMiddleware');

// Initialize Supabase client for token verification
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

/**
 * Verify JWT token from Authorization header
 */
export async function authenticateToken(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      res.status(401).json({ error: 'No token provided' });
      return;
    }

    // Verify token with Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      logger.warn({ error, ip: req.ip }, 'Invalid token');
      res.status(403).json({ error: 'Invalid token' });
      return;
    }

    // Attach user to request
    req.user = {
      id: user.id,
      email: user.email!,
    };

    // Load subscription info
    const { pool } = req.app.locals;
    const subResult = await pool.query(
      'SELECT tier, status FROM subscriptions WHERE user_id = $1',
      [user.id]
    );

    if (subResult.rows[0]) {
      req.user.subscription = subResult.rows[0];
    }

    next();
  } catch (error) {
    logger.error({ error }, 'Authentication error');
    res.status(500).json({ error: 'Authentication error' });
  }
}

/**
 * Verify API key from X-API-Key header
 */
export async function authenticateApiKey(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const apiKey = req.headers['x-api-key'] as string;

    if (!apiKey) {
      res.status(401).json({ error: 'No API key provided' });
      return;
    }

    // Extract key hash (keys are prefixed with pp_)
    if (!apiKey.startsWith('pp_')) {
      res.status(403).json({ error: 'Invalid API key format' });
      return;
    }

    const { pool } = req.app.locals;
    
    // Look up API key (comparing hashed version)
    const result = await pool.query(
      `SELECT ak.user_id, ak.name, ak.scopes, u.email, s.tier, s.status
       FROM api_keys ak
       JOIN users u ON ak.user_id = u.id
       LEFT JOIN subscriptions s ON u.id = s.user_id
       WHERE ak.key_hash = crypt($1, ak.key_hash) 
       AND (ak.expires_at IS NULL OR ak.expires_at > NOW())`,
      [apiKey]
    );

    if (result.rows.length === 0) {
      logger.warn({ ip: req.ip }, 'Invalid API key');
      res.status(403).json({ error: 'Invalid API key' });
      return;
    }

    const keyData = result.rows[0];

    // Update last used timestamp
    await pool.query(
      'UPDATE api_keys SET last_used_at = NOW() WHERE key_hash = crypt($1, key_hash)',
      [apiKey]
    );

    // Attach user to request
    req.user = {
      id: keyData.user_id,
      email: keyData.email,
      subscription: {
        tier: keyData.tier || 'free',
        status: keyData.status || 'active',
      },
    };

    next();
  } catch (error) {
    logger.error({ error }, 'API key authentication error');
    res.status(500).json({ error: 'Authentication error' });
  }
}

/**
 * Combined authentication - accepts either JWT or API key
 */
export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (req.headers.authorization) {
    return authenticateToken(req, res, next);
  } else if (req.headers['x-api-key']) {
    return authenticateApiKey(req, res, next);
  } else {
    res.status(401).json({ error: 'No authentication provided' });
  }
}

/**
 * Require specific subscription tier
 */
export function requireSubscription(minTier: 'free' | 'premium' | 'pro' | 'enterprise') {
  const tierRank = { free: 0, premium: 1, pro: 2, enterprise: 3 };

  return (req: Request, res: Response, next: NextFunction) => {
    const userTier = req.user?.subscription?.tier || 'free';
    
    if (tierRank[userTier as keyof typeof tierRank] < tierRank[minTier]) {
      res.status(403).json({
        error: 'Insufficient subscription tier',
        required: minTier,
        current: userTier,
        upgradeUrl: `${process.env.FRONTEND_URL}/pricing`,
      });
      return;
    }

    next();
  };
}

/**
 * Rate limiting based on subscription tier
 */
export function rateLimitByTier() {
  const limits = {
    free: { requests: 10, window: 60 }, // 10 per minute
    premium: { requests: 60, window: 60 }, // 60 per minute
    pro: { requests: 300, window: 60 }, // 300 per minute
    enterprise: { requests: -1, window: 60 }, // unlimited
  };

  // Track requests per user
  const requestCounts = new Map<string, { count: number; resetAt: number }>();

  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      next();
      return;
    }

    const tier = req.user.subscription?.tier || 'free';
    const limit = limits[tier as keyof typeof limits];

    if (limit.requests === -1) {
      next();
      return;
    }

    const now = Date.now();
    const userId = req.user.id;
    const userRequests = requestCounts.get(userId);

    if (!userRequests || userRequests.resetAt < now) {
      requestCounts.set(userId, {
        count: 1,
        resetAt: now + (limit.window * 1000),
      });
      next();
      return;
    }

    if (userRequests.count >= limit.requests) {
      const retryAfter = Math.ceil((userRequests.resetAt - now) / 1000);
      res.status(429)
        .set('Retry-After', retryAfter.toString())
        .json({
          error: 'Rate limit exceeded',
          retryAfter,
          limit: limit.requests,
          window: limit.window,
          tier,
        });
      return;
    }

    userRequests.count++;
    next();
  };
} 