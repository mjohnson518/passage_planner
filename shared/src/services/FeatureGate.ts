import { Subscription, SubscriptionTier, SubscriptionLimits } from '../types/core';
import { PLANS, getPassageLimit, PlanTier } from '../plans';
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

  static async canUseFeature(
    userId: string,
    feature: string,
    subscription?: Subscription
  ): Promise<boolean> {
    const tier = (subscription?.tier || 'free') as PlanTier;
    const plan = PLANS[tier] ?? PLANS.free;
    const limits = plan.limits;
    const features = plan.features;

    switch (feature) {
      case 'create_passage': {
        const passageLimit = limits.passagesPerMonth;
        if (passageLimit === -1) return true;

        // Check whitelist first
        const whitelisted = await this.isWhitelisted(userId);
        if (whitelisted) return true;

        const [usageThisMonth, bonusPassages] = await Promise.all([
          this.getMonthlyUsage(userId, 'passage_planned'),
          this.getBonusPassages(userId),
        ]);

        if (usageThisMonth < passageLimit) return true;
        // Over monthly limit — check bonus passages
        return bonusPassages > 0;
      }

      case 'api_access':
        return limits.apiCallsPerDay > 0;

      case 'export_gpx':
        return (features.exportFormats as string[]).includes('gpx') ||
          (features.exportFormats as string[]).includes('*');

      case 'export_pdf':
        return (features.exportFormats as string[]).includes('pdf') ||
          (features.exportFormats as string[]).includes('*');

      case 'export_kml':
        return (features.exportFormats as string[]).includes('kml') ||
          (features.exportFormats as string[]).includes('*');

      case 'fleet_management':
        return features.fleetManagement;

      case 'custom_agents':
        return features.customAgents;

      case 'white_label':
        return features.whiteLabel;

      default:
        return false;
    }
  }

  static async enforceRateLimit(
    userId: string,
    action: string,
    subscription?: Subscription
  ): Promise<{ allowed: boolean; remainingCalls?: number; resetAt?: Date }> {
    const tier = (subscription?.tier || 'free') as PlanTier;
    const plan = PLANS[tier] ?? PLANS.free;

    if (action === 'api_call') {
      const dailyLimit = plan.limits.apiCallsPerDay;
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
    const plan = PLANS[tier] ?? PLANS.free;
    return {
      passagesPerMonth: plan.limits.passagesPerMonth,
      apiCallsPerDay: plan.limits.apiCallsPerDay,
      exportFormats: plan.features.exportFormats as string[],
      forecastDays: plan.limits.forecastDays,
      agents: plan.features.agents as string[] | '*',
      support: plan.features.support,
      customAgents: plan.features.customAgents,
      fleetManagement: plan.features.fleetManagement,
      whiteLabel: plan.features.whiteLabel,
    };
  }

  static canUseAgent(agentId: string, subscription?: Subscription): boolean {
    const tier = (subscription?.tier || 'free') as PlanTier;
    const plan = PLANS[tier] ?? PLANS.free;
    const agents = plan.features.agents;

    if (agents === '*') return true;
    if (Array.isArray(agents)) {
      return (agents as string[]).includes(agentId);
    }
    return false;
  }

  static getForecastDays(subscription?: Subscription): number {
    const tier = (subscription?.tier || 'free') as PlanTier;
    const plan = PLANS[tier] ?? PLANS.free;
    return plan.limits.forecastDays;
  }

  /**
   * Consume one bonus passage if available.
   * Returns true if a bonus was consumed, false if none available.
   */
  static async consumeBonusPassage(userId: string): Promise<boolean> {
    if (!dbPool) return false;
    try {
      const result = await dbPool.query(
        `UPDATE profiles
         SET bonus_passages = bonus_passages - 1
         WHERE id = $1 AND bonus_passages > 0
         RETURNING bonus_passages`,
        [userId]
      );
      return result.rowCount !== null && result.rowCount > 0;
    } catch (error) {
      console.error('FeatureGate: Failed to consume bonus passage:', error);
      return false;
    }
  }

  /**
   * Get current bonus passage count for a user.
   */
  private static async getBonusPassages(userId: string): Promise<number> {
    if (!dbPool) return 0;
    try {
      const result = await dbPool.query(
        'SELECT bonus_passages FROM profiles WHERE id = $1',
        [userId]
      );
      return parseInt(result.rows[0]?.bonus_passages || '0', 10);
    } catch {
      return 0;
    }
  }

  /**
   * Check if a user is whitelisted (bypasses all quotas).
   */
  private static async isWhitelisted(userId: string): Promise<boolean> {
    if (!dbPool) return false;
    try {
      const result = await dbPool.query(
        'SELECT is_whitelisted FROM profiles WHERE id = $1',
        [userId]
      );
      return result.rows[0]?.is_whitelisted === true;
    } catch {
      return false;
    }
  }

  /**
   * Get usage count for the current month.
   * Fails closed: returns Infinity on DB failure so free-tier limits are respected.
   */
  private static async getMonthlyUsage(userId: string, action: string): Promise<number> {
    if (!dbPool) {
      console.warn('FeatureGate: Database not initialized — failing closed (returning Infinity).');
      return Infinity;
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
      console.error('FeatureGate: Failed to get monthly usage — failing closed:', error);
      // Fail closed: returning Infinity ensures free-tier limit is exceeded
      // Paid tiers bypass this method (passagesPerMonth === -1 returns true early)
      return Infinity;
    }
  }

  /**
   * Get usage count for the current day (UTC).
   * Fails closed: returns Infinity on DB failure.
   */
  private static async getDailyUsage(userId: string, action: string): Promise<number> {
    if (!dbPool) {
      console.warn('FeatureGate: Database not initialized — failing closed (returning Infinity).');
      return Infinity;
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
      console.error('FeatureGate: Failed to get daily usage — failing closed:', error);
      return Infinity;
    }
  }

  /**
   * Record a usage event for tracking against subscription limits.
   * Call this after a user successfully performs a billable action.
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
   * Get detailed usage summary for a user.
   * Useful for displaying in user dashboard.
   */
  static async getUsageSummary(
    userId: string,
    subscription?: Subscription
  ): Promise<{
    passagesThisMonth: number;
    passagesLimit: number;
    bonusPassages: number;
    apiCallsToday: number;
    apiCallsLimit: number;
    resetAt: Date;
    tier: string;
  }> {
    const tier = (subscription?.tier || 'free') as PlanTier;
    const plan = PLANS[tier] ?? PLANS.free;

    const [passagesThisMonth, apiCallsToday, bonusPassages] = await Promise.all([
      this.getMonthlyUsage(userId, 'passage_planned'),
      this.getDailyUsage(userId, 'api_call'),
      this.getBonusPassages(userId),
    ]);

    return {
      passagesThisMonth: passagesThisMonth === Infinity ? 0 : passagesThisMonth,
      passagesLimit: plan.limits.passagesPerMonth,
      bonusPassages,
      apiCallsToday: apiCallsToday === Infinity ? 0 : apiCallsToday,
      apiCallsLimit: plan.limits.apiCallsPerDay,
      resetAt: this.getNextResetTime(),
      tier,
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
