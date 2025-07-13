// orchestrator/src/services/SessionManager.ts

import { RedisClientType } from 'redis';
import { Logger } from 'pino';

interface SessionData {
  requestId: string;
  userId?: string;
  startTime: Date;
  lastActivity?: Date;
  completedSteps?: number;
  totalSteps?: number;
  metadata?: Record<string, any>;
}

export class SessionManager {
  private sessionTTL = 3600; // 1 hour in seconds
  
  constructor(
    private redis: RedisClientType,
    private logger: Logger
  ) {}
  
  async createSession(data: SessionData): Promise<string> {
    const sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const sessionData = {
      ...data,
      sessionId,
      createdAt: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
    };
    
    // Store session in Redis
    await this.redis.setEx(
      `sessions:${sessionId}`,
      this.sessionTTL,
      JSON.stringify(sessionData)
    );
    
    // Add to user's session list if userId is provided
    if (data.userId) {
      await this.redis.sAdd(`user:${data.userId}:sessions`, sessionId);
      await this.redis.expire(`user:${data.userId}:sessions`, this.sessionTTL);
    }
    
    // Track active sessions
    await this.redis.sAdd('sessions:active', sessionId);
    
    this.logger.info({ sessionId, userId: data.userId }, 'Session created');
    
    return sessionId;
  }
  
  async getSession(sessionId: string): Promise<SessionData | null> {
    const data = await this.redis.get(`sessions:${sessionId}`);
    
    if (!data) {
      return null;
    }
    
    return JSON.parse(data);
  }
  
  async updateSession(sessionId: string, updates: Partial<SessionData>): Promise<void> {
    const session = await this.getSession(sessionId);
    
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }
    
    const updatedSession = {
      ...session,
      ...updates,
      lastActivity: new Date().toISOString(),
    };
    
    // Update session with new TTL
    await this.redis.setEx(
      `sessions:${sessionId}`,
      this.sessionTTL,
      JSON.stringify(updatedSession)
    );
    
    this.logger.debug({ sessionId, updates }, 'Session updated');
  }
  
  async endSession(sessionId: string): Promise<void> {
    const session = await this.getSession(sessionId);
    
    if (!session) {
      return;
    }
    
    // Remove from active sessions
    await this.redis.sRem('sessions:active', sessionId);
    
    // Remove from user's session list
    if (session.userId) {
      await this.redis.sRem(`user:${session.userId}:sessions`, sessionId);
    }
    
    // Archive session data (keep for analytics)
    const archiveData = {
      ...session,
      endTime: new Date().toISOString(),
      duration: Date.now() - new Date(session.startTime).getTime(),
    };
    
    await this.redis.setEx(
      `sessions:archive:${sessionId}`,
      86400 * 7, // Keep for 7 days
      JSON.stringify(archiveData)
    );
    
    // Delete active session
    await this.redis.del(`sessions:${sessionId}`);
    
    this.logger.info({ sessionId }, 'Session ended');
  }
  
  async getUserSessions(userId: string): Promise<SessionData[]> {
    const sessionIds = await this.redis.sMembers(`user:${userId}:sessions`);
    const sessions: SessionData[] = [];
    
    for (const sessionId of sessionIds) {
      const session = await this.getSession(sessionId);
      if (session) {
        sessions.push(session);
      }
    }
    
    return sessions;
  }
  
  async getActiveSessions(): Promise<string[]> {
    return this.redis.sMembers('sessions:active');
  }
  
  async cleanupExpiredSessions(): Promise<void> {
    const activeSessions = await this.getActiveSessions();
    let cleaned = 0;
    
    for (const sessionId of activeSessions) {
      const exists = await this.redis.exists(`sessions:${sessionId}`);
      if (!exists) {
        await this.redis.sRem('sessions:active', sessionId);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      this.logger.info({ cleaned }, 'Cleaned up expired sessions');
    }
  }
  
  async getSessionMetrics(): Promise<{
    activeSessions: number;
    averageDuration: number;
    completionRate: number;
  }> {
    const activeSessions = await this.redis.sCard('sessions:active');
    
    // Get archived sessions for metrics
    const archiveKeys = await this.redis.keys('sessions:archive:*');
    let totalDuration = 0;
    let completedSessions = 0;
    let totalSessions = archiveKeys.length;
    
    for (const key of archiveKeys.slice(0, 100)) { // Sample last 100
      const data = await this.redis.get(key);
      if (data) {
        const session = JSON.parse(data);
        totalDuration += session.duration || 0;
        
        if (session.completedSteps === session.totalSteps) {
          completedSessions++;
        }
      }
    }
    
    return {
      activeSessions,
      averageDuration: totalSessions > 0 ? totalDuration / totalSessions : 0,
      completionRate: totalSessions > 0 ? completedSessions / totalSessions : 0,
    };
  }
  
  // Store intermediate results for a session
  async storeIntermediateResult(
    sessionId: string, 
    stepId: string, 
    result: any
  ): Promise<void> {
    const key = `sessions:${sessionId}:results:${stepId}`;
    
    await this.redis.setEx(
      key,
      this.sessionTTL,
      JSON.stringify({
        stepId,
        result,
        timestamp: new Date().toISOString(),
      })
    );
  }
  
  // Get all intermediate results for a session
  async getIntermediateResults(sessionId: string): Promise<Record<string, any>> {
    const pattern = `sessions:${sessionId}:results:*`;
    const keys = await this.redis.keys(pattern);
    const results: Record<string, any> = {};
    
    for (const key of keys) {
      const data = await this.redis.get(key);
      if (data) {
        const parsed = JSON.parse(data);
        results[parsed.stepId] = parsed.result;
      }
    }
    
    return results;
  }
} 