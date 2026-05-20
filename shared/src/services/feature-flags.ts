/**
 * Feature Flags Service
 *
 * Enable/disable features without deployment.
 * Supports gradual rollout and per-user access control.
 *
 * The Supabase client is injected so this package does not take a hard
 * dependency on `@supabase/supabase-js` — orchestrator/frontend hand in
 * their already-configured client.
 */

import { Logger } from "pino";

export interface FeatureFlag {
  flag_name: string;
  enabled: boolean;
  rollout_percentage: number;
  allowed_user_ids: string[];
  blocked_user_ids: string[];
  description?: string;
}

/**
 * Minimal slice of the Supabase client surface that FeatureFlagsService needs.
 * Defined locally so this package compiles without importing @supabase/supabase-js.
 */
export interface FeatureFlagsClient {
  from(table: string): {
    select(columns: string): {
      eq(
        column: string,
        value: unknown,
      ): {
        single(): Promise<{ data: unknown; error: unknown }>;
      } & Promise<{ data: unknown[] | null; error: unknown }>;
    };
  };
}

export class FeatureFlagsService {
  private supabase: FeatureFlagsClient;
  private logger?: Logger;
  private flagsCache: Map<string, FeatureFlag> = new Map();
  private cacheExpiry: number = 0;
  private readonly CACHE_TTL_MS = 60000; // 1 minute

  constructor(client: FeatureFlagsClient, logger?: Logger) {
    this.supabase = client;
    this.logger = logger;
  }

  /**
   * Check if feature is enabled for a user
   */
  async isEnabled(flagName: string, userId?: string): Promise<boolean> {
    const flag = await this.getFlag(flagName);

    if (!flag) {
      this.logger?.warn(
        { flagName },
        "Feature flag not found - defaulting to disabled",
      );
      return false;
    }

    if (!flag.enabled) {
      return false;
    }

    if (!userId) {
      return flag.enabled;
    }

    if (flag.blocked_user_ids.includes(userId)) {
      return false;
    }

    if (flag.allowed_user_ids.length > 0) {
      return flag.allowed_user_ids.includes(userId);
    }

    if (flag.rollout_percentage < 100) {
      const userHash = this.hashUserId(userId);
      return userHash < flag.rollout_percentage;
    }

    return true;
  }

  private async getFlag(flagName: string): Promise<FeatureFlag | null> {
    const now = Date.now();
    if (this.cacheExpiry > now) {
      const cached = this.flagsCache.get(flagName);
      if (cached) return cached;
    }

    const { data, error } = await this.supabase
      .from("feature_flags")
      .select("*")
      .eq("flag_name", flagName)
      .single();

    if (error || !data) {
      return null;
    }

    const row = data as Partial<FeatureFlag> & {
      flag_name: string;
      enabled: boolean;
    };
    const flag: FeatureFlag = {
      flag_name: row.flag_name,
      enabled: row.enabled,
      rollout_percentage: row.rollout_percentage ?? 0,
      allowed_user_ids: row.allowed_user_ids ?? [],
      blocked_user_ids: row.blocked_user_ids ?? [],
      description: row.description,
    };

    this.flagsCache.set(flagName, flag);
    this.cacheExpiry = now + this.CACHE_TTL_MS;

    return flag;
  }

  private hashUserId(userId: string): number {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      const char = userId.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash) % 100;
  }

  async getEnabledFlags(userId?: string): Promise<string[]> {
    const { data: flags } = await this.supabase
      .from("feature_flags")
      .select("*")
      .eq("enabled", true);

    if (!flags) return [];

    const enabled: string[] = [];

    for (const flag of flags as FeatureFlag[]) {
      const isEnabled = await this.isEnabled(flag.flag_name, userId);
      if (isEnabled) {
        enabled.push(flag.flag_name);
      }
    }

    return enabled;
  }

  clearCache(): void {
    this.flagsCache.clear();
    this.cacheExpiry = 0;
  }
}
