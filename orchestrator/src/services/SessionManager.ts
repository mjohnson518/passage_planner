import { RedisClientType } from 'redis'
import { Logger } from 'pino'
import { v4 as uuidv4 } from 'uuid'

export interface SessionData {
  sessionId: string
  userId?: string
  requestId: string
  createdAt: string
  lastActivity?: string
  completedSteps?: number
  totalSteps?: number
  metadata?: Record<string, any>
}

export class SessionManager {
  private static readonly SESSION_KEY_PREFIX = 'session:'
  private static readonly SESSION_TTL = 3600 // 1 hour
  private memoryStore = new Map<string, SessionData>()

  constructor(
    private redis: RedisClientType | null,
    private logger: Logger
  ) {}

  private isRedisReady() {
    return Boolean(this.redis && (this.redis as any).isOpen)
  }

  async createSession(data: Omit<SessionData, 'sessionId'>): Promise<string> {
    const sessionId = uuidv4()
    const sessionData: SessionData = {
      sessionId,
      ...data,
      createdAt: data.createdAt ?? new Date().toISOString(),
      lastActivity: new Date().toISOString(),
    }

    try {
      if (this.isRedisReady()) {
        await this.redis!.set(
          `${SessionManager.SESSION_KEY_PREFIX}${sessionId}`,
          JSON.stringify(sessionData),
          { EX: SessionManager.SESSION_TTL }
        )
      } else {
        this.memoryStore.set(sessionId, sessionData)
      }

      this.logger.info({ sessionId, userId: data.userId }, 'Session created')
      return sessionId
    } catch (error) {
      this.logger.error({ error, sessionId }, 'Failed to create session')
      throw error
    }
  }

  async getSession(sessionId: string): Promise<SessionData | null> {
    try {
      if (this.isRedisReady()) {
        const data = await this.redis!.get(`${SessionManager.SESSION_KEY_PREFIX}${sessionId}`)
        return data ? JSON.parse(data) : null
      }
      return this.memoryStore.get(sessionId) ?? null
    } catch (error) {
      this.logger.error({ error, sessionId }, 'Failed to get session')
      return null
    }
  }

  async updateSession(sessionId: string, updates: Partial<SessionData>): Promise<void> {
    try {
      const current = await this.getSession(sessionId)
      if (!current) {
        throw new Error('Session not found')
      }

      const updated: SessionData = {
        ...current,
        ...updates,
        lastActivity: updates.lastActivity ?? new Date().toISOString(),
      }

      if (this.isRedisReady()) {
        await this.redis!.set(
          `${SessionManager.SESSION_KEY_PREFIX}${sessionId}`,
          JSON.stringify(updated),
          { EX: SessionManager.SESSION_TTL }
        )
      } else {
        this.memoryStore.set(sessionId, updated)
      }

      this.logger.debug({ sessionId, updates }, 'Session updated')
    } catch (error) {
      this.logger.error({ error, sessionId }, 'Failed to update session')
      throw error
    }
  }

  async endSession(sessionId: string): Promise<void> {
    try {
      if (this.isRedisReady()) {
        await this.redis!.del(`${SessionManager.SESSION_KEY_PREFIX}${sessionId}`)
      } else {
        this.memoryStore.delete(sessionId)
      }
      this.logger.info({ sessionId }, 'Session ended')
    } catch (error) {
      this.logger.error({ error, sessionId }, 'Failed to end session')
    }
  }

  async getActiveSessions(): Promise<SessionData[]> {
    try {
      if (this.isRedisReady()) {
        const keys = await this.redis!.keys(`${SessionManager.SESSION_KEY_PREFIX}*`)
        const sessions: SessionData[] = []

        for (const key of keys) {
          const data = await this.redis!.get(key)
          if (data) {
            sessions.push(JSON.parse(data))
          }
        }

        return sessions
      }

      return Array.from(this.memoryStore.values())
    } catch (error) {
      this.logger.error({ error }, 'Failed to get active sessions')
      return []
    }
  }

  async cleanupExpiredSessions(): Promise<number> {
    const sessions = await this.getActiveSessions()
    const now = new Date()
    let cleaned = 0

    for (const session of sessions) {
      const lastActivity = session.lastActivity || session.createdAt
      const age = now.getTime() - new Date(lastActivity).getTime()

      if (age > SessionManager.SESSION_TTL * 1000) {
        await this.endSession(session.sessionId)
        cleaned++
      }
    }

    if (cleaned > 0) {
      this.logger.info({ count: cleaned }, 'Cleaned up expired sessions')
    }

    return cleaned
  }
} 