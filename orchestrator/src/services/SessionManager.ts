import { RedisClientType } from 'redis';
import { Logger } from 'pino';
import { v4 as uuidv4 } from 'uuid';

export interface SessionData {
  sessionId: string;
  userId?: string;
  requestId: string;
  startTime: Date;
  lastActivity?: Date;
  completedSteps?: number;
  totalSteps?: number;
  metadata?: Record<string, any>;
}

export class SessionManager {
  private static readonly SESSION_KEY_PREFIX = 'session:';
  private static readonly SESSION_TTL = 3600; // 1 hour
  
  constructor(
    private redis: RedisClientType,
    private logger: Logger
  ) {}
  
  async createSession(data: Omit<SessionData, 'sessionId'>): Promise<string> {
    const sessionId = uuidv4();
    const sessionData: SessionData = {
      sessionId,
      ...data
    };
    
    try {
      await this.redis.set(
        `${SessionManager.SESSION_KEY_PREFIX}${sessionId}`,
        JSON.stringify(sessionData),
        { EX: SessionManager.SESSION_TTL }
      );
      
      this.logger.info({ sessionId, userId: data.userId }, 'Session created');
      return sessionId;
    } catch (error) {
      this.logger.error({ error, sessionId }, 'Failed to create session');
      throw error;
    }
  }
  
  async getSession(sessionId: string): Promise<SessionData | null> {
    try {
      const data = await this.redis.get(`${SessionManager.SESSION_KEY_PREFIX}${sessionId}`);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      this.logger.error({ error, sessionId }, 'Failed to get session');
      return null;
    }
  }
  
  async updateSession(sessionId: string, updates: Partial<SessionData>): Promise<void> {
    try {
      const current = await this.getSession(sessionId);
      if (!current) {
        throw new Error('Session not found');
      }
      
      const updated = { ...current, ...updates };
      await this.redis.set(
        `${SessionManager.SESSION_KEY_PREFIX}${sessionId}`,
        JSON.stringify(updated),
        { EX: SessionManager.SESSION_TTL }
      );
      
      this.logger.debug({ sessionId, updates }, 'Session updated');
    } catch (error) {
      this.logger.error({ error, sessionId }, 'Failed to update session');
      throw error;
    }
  }
  
  async endSession(sessionId: string): Promise<void> {
    try {
      await this.redis.del(`${SessionManager.SESSION_KEY_PREFIX}${sessionId}`);
      this.logger.info({ sessionId }, 'Session ended');
    } catch (error) {
      this.logger.error({ error, sessionId }, 'Failed to end session');
    }
  }
  
  async getActiveSessions(): Promise<SessionData[]> {
    try {
      const keys = await this.redis.keys(`${SessionManager.SESSION_KEY_PREFIX}*`);
      const sessions: SessionData[] = [];
      
      for (const key of keys) {
        const data = await this.redis.get(key);
        if (data) {
          sessions.push(JSON.parse(data));
        }
      }
      
      return sessions;
    } catch (error) {
      this.logger.error({ error }, 'Failed to get active sessions');
      return [];
    }
  }
  
  async cleanupExpiredSessions(): Promise<number> {
    // Redis handles TTL automatically, but this method can be used for additional cleanup
    const sessions = await this.getActiveSessions();
    const now = new Date();
    let cleaned = 0;
    
    for (const session of sessions) {
      const lastActivity = session.lastActivity || session.startTime;
      const age = now.getTime() - new Date(lastActivity).getTime();
      
      if (age > SessionManager.SESSION_TTL * 1000) {
        await this.endSession(session.sessionId);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      this.logger.info({ count: cleaned }, 'Cleaned up expired sessions');
    }
    
    return cleaned;
  }
} 