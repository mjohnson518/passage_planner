import { Subscription, SubscriptionTier, SubscriptionLimits } from '../types/core';
import { Pool } from 'pg';

// Database pool - must be initialized before use
let dbPool: Pool | null = null;

export class FeatureGate {
  /**
   * Initialize the FeatureGate with a database connection
   * MUST be called before any usage tracking methods
   */
  static initialize(pool: Pool): void {
    dbPool = pool;
  }

  /**
   * Check if FeatureGate has been initialized with a database connection
   */
  static isInitialized(): boolean {
    return dbPool !== null;
  }

  private static readonly LIMITS: Record<SubscriptionTier, SubscriptionLimits> = {
    free: {
      passagesPerMonth: 2,
      apiCallsPerDay: 0,
      exportFormats: ['basic'],
      forecastDays: 3,
      agents: ['weather', 'tidal', 'basic_route'],
      support: 'community',
    },
    premium: {
      passagesPerMonth: -1, // unlimited
      apiCallsPerDay: 100,
      exportFormats: ['gpx', 'pdf', 'kml'],
      forecastDays: 7,
      agents: '*', // all agents
      support: 'email',
    },
    pro: {
      passagesPerMonth: -1,
      apiCallsPerDay: 1000,
      exportFormats: ['gpx', 'pdf', 'kml', 'api'],
      forecastDays: 10,
      agents: '*',
      support: 'priority',
      customAgents: true,
      fleetManagement: true,
    },
    enterprise: {
      passagesPerMonth: -1,
      apiCallsPerDay: -1,
      exportFormats: ['*'],
      forecastDays: 14,
      agents: '*',
      support: 'dedicated',
      customAgents: true,
      fleetManagement: true,
      whiteLabel: true,
      sla: true,
    },
  };
  
  static async canUseFeature(
    userId: string, 
    feature: string, 
    subscription?: Subscription
  ): Promise<boolean> {
    const tier = subscription?.tier || 'free';
    const limits = this.LIMITS[tier];
    
    // Check specific features
    switch (feature) {
      case 'create_passage':
        if (limits.passagesPerMonth === -1) return true;
        const usageThisMonth = await this.getMonthlyUsage(userId, 'passage_planned');
        return usageThisMonth < limits.passagesPerMonth;
        
      case 'api_access':
        return limits.apiCallsPerDay > 0;
        
      case 'export_gpx':
        return limits.exportFormats.includes('gpx') || limits.exportFormats.includes('*');
        
      case 'export_pdf':
        return limits.exportFormats.includes('pdf') || limits.exportFormats.includes('*');
        
      case 'export_kml':
        return limits.exportFormats.includes('kml') || limits.exportFormats.includes('*');
        
      case 'fleet_management':
        return limits.fleetManagement || false;
        
      case 'custom_agents':
        return limits.customAgents || false;
        
      case 'white_label':
        return limits.whiteLabel || false;
        
      default:
        return false;
    }
  }
  
  static async enforceRateLimit(
    userId: string, 
    action: string, 
    subscription?: Subscription
  ): Promise<{ allowed: boolean; remainingCalls?: number; resetAt?: Date }> {
    const tier = subscription?.tier || 'free';
    const limits = this.LIMITS[tier];
    
    if (action === 'api_call') {
      const dailyLimit = limits.apiCallsPerDay;
      if (dailyLimit === -1) return { allowed: true };
      
      const todayUsage = await this.getDailyUsage(userId, 'api_call');
      const allowed = todayUsage < dailyLimit;
      
      return {
        allowed,
        remainingCalls: Math.max(0, dailyLimit - todayUsage),
        resetAt: this.getNextResetTime(),
      };
    }
    
    return { allowed: true };
  }
  
  static getLimits(tier: SubscriptionTier): SubscriptionLimits {
    return this.LIMITS[tier];
  }
  
  static canUseAgent(agentId: string, subscription?: Subscription): boolean {
    const tier = subscription?.tier || 'free';
    const limits = this.LIMITS[tier];
    
    if (limits.agents === '*') return true;
    if (Array.isArray(limits.agents)) {
      return limits.agents.includes(agentId);
    }
    return false;
  }
  
  static getForecastDays(subscription?: Subscription): number {
    const tier = subscription?.tier || 'free';
    return this.LIMITS[tier].forecastDays;
  }
  
  /**
   * Get usage count for the current month
   * Queries the usage_events table for actions within the current calendar month
   */
  private static async getMonthlyUsage(userId: string, action: string): Promise<number> {
    if (!dbPool) {
      console.warn('FeatureGate: Database not initialized, cannot track usage. Returning 0.');
      return 0;
    }

    try {
      const result = await dbPool.query(
        `SELECT COUNT(*) as count
         FROM usage_events
         WHERE user_id = $1
           AND action = $2
           AND created_at >= date_trunc('month', CURRENT_DATE)`,
        [userId, action]
      );
      return parseInt(result.rows[0]?.count || '0', 10);
    } catch (error) {
      console.error('FeatureGate: Failed to get monthly usage:', error);
      // Fail open - if we can't track, allow the action
      // but log for monitoring
      return 0;
    }
  }

  /**
   * Get usage count for the current day (UTC)
   * Queries the usage_events table for actions within the current calendar day
   */
  private static async getDailyUsage(userId: string, action: string): Promise<number> {
    if (!dbPool) {
      console.warn('FeatureGate: Database not initialized, cannot track usage. Returning 0.');
      return 0;
    }

    try {
      const result = await dbPool.query(
        `SELECT COUNT(*) as count
         FROM usage_events
         WHERE user_id = $1
           AND action = $2
           AND created_at >= date_trunc('day', CURRENT_DATE)`,
        [userId, action]
      );
      return parseInt(result.rows[0]?.count || '0', 10);
    } catch (error) {
      console.error('FeatureGate: Failed to get daily usage:', error);
      // Fail open - if we can't track, allow the action
      return 0;
    }
  }

  /**
   * Record a usage event for tracking against subscription limits
   * Call this after a user successfully performs a billable action
   */
  static async incrementUsage(
    userId: string,
    action: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    if (!dbPool) {
      console.warn('FeatureGate: Database not initialized, cannot record usage.');
      return;
    }

    try {
      await dbPool.query(
        `INSERT INTO usage_events (user_id, action, metadata, created_at)
         VALUES ($1, $2, $3, NOW())`,
        [userId, action, metadata ? JSON.stringify(metadata) : null]
      );
    } catch (error) {
      console.error('FeatureGate: Failed to record usage:', error);
      // Don't throw - usage tracking failure shouldn't break the user's action
    }
  }

  /**
   * Get detailed usage summary for a user
   * Useful for displaying in user dashboard
   */
  static async getUsageSummary(
    userId: string,
    subscription?: Subscription
  ): Promise<{
    passagesThisMonth: number;
    passagesLimit: number;
    apiCallsToday: number;
    apiCallsLimit: number;
    resetAt: Date;
  }> {
    const tier = subscription?.tier || 'free';
    const limits = this.LIMITS[tier];

    const [passagesThisMonth, apiCallsToday] = await Promise.all([
      this.getMonthlyUsage(userId, 'passage_planned'),
      this.getDailyUsage(userId, 'api_call'),
    ]);

    return {
      passagesThisMonth,
      passagesLimit: limits.passagesPerMonth,
      apiCallsToday,
      apiCallsLimit: limits.apiCallsPerDay,
      resetAt: this.getNextResetTime(),
    };
  }

  private static getNextResetTime(): Date {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    return tomorrow;
  }
} 