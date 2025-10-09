/**
 * Feature Flags Service
 * 
 * Enable/disable features without deployment.
 * Supports gradual rollout and per-user access control.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Logger } from 'pino';

export interface FeatureFlag {
  flag_name: string;
  enabled: boolean;
  rollout_percentage: number;
  allowed_user_ids: string[];
  blocked_user_ids: string[];
  description?: string;
}

export class FeatureFlagsService {
  private supabase: SupabaseClient;
  private logger?: Logger;
  private flagsCache: Map<string, FeatureFlag> = new Map();
  private cacheExpiry: number = 0;
  private readonly CACHE_TTL_MS = 60000; // 1 minute

  constructor(supabaseUrl: string, supabaseKey: string, logger?: Logger) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.logger = logger;
  }

  /**
   * Check if feature is enabled for a user
   */
  async isEnabled(flagName: string, userId?: string): Promise<boolean> {
    const flag = await this.getFlag(flagName);

    if (!flag) {
      // Feature flag doesn't exist - default to disabled
      this.logger?.warn({ flagName }, 'Feature flag not found - defaulting to disabled');
      return false;
    }

    // Check if globally disabled
    if (!flag.enabled) {
      return false;
    }

    // If no user ID, return global enabled state
    if (!userId) {
      return flag.enabled;
    }

    // Check if user is in blocked list
    if (flag.blocked_user_ids.includes(userId)) {
      return false;
    }

    // Check if user is in allowed list
    if (flag.allowed_user_ids.length > 0) {
      return flag.allowed_user_ids.includes(userId);
    }

    // Check rollout percentage
    if (flag.rollout_percentage < 100) {
      const userHash = this.hashUserId(userId);
      return userHash < flag.rollout_percentage;
    }

    return true;
  }

  /**
   * Get feature flag
   */
  private async getFlag(flagName: string): Promise<FeatureFlag | null> {
    // Check cache first
    const now = Date.now();
    if (this.cacheExpiry > now) {
      const cached = this.flagsCache.get(flagName);
      if (cached) return cached;
    }

    // Fetch from database
    const { data, error } = await this.supabase
      .from('feature_flags')
      .select('*')
      .eq('flag_name', flagName)
      .single();

    if (error || !data) {
      return null;
    }

    const flag: FeatureFlag = {
      flag_name: data.flag_name,
      enabled: data.enabled,
      rollout_percentage: data.rollout_percentage || 0,
      allowed_user_ids: data.allowed_user_ids || [],
      blocked_user_ids: data.blocked_user_ids || [],
      description: data.description,
    };

    // Update cache
    this.flagsCache.set(flagName, flag);
    this.cacheExpiry = now + this.CACHE_TTL_MS;

    return flag;
  }

  /**
   * Hash user ID to percentage (0-99)
   */
  private hashUserId(userId: string): number {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      const char = userId.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash) % 100;
  }

  /**
   * Get all enabled flags for a user
   */
  async getEnabledFlags(userId?: string): Promise<string[]> {
    const { data: flags } = await this.supabase
      .from('feature_flags')
      .select('*')
      .eq('enabled', true);

    if (!flags) return [];

    const enabled: string[] = [];

    for (const flag of flags) {
      const isEnabled = await this.isEnabled(flag.flag_name, userId);
      if (isEnabled) {
        enabled.push(flag.flag_name);
      }
    }

    return enabled;
  }

  /**
   * Clear cache (force refresh)
   */
  clearCache(): void {
    this.flagsCache.clear();
    this.cacheExpiry = 0;
  }
}

