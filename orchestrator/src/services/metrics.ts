/**
 * Metrics Service
 * 
 * Tracks performance metrics, API health, and business metrics for Helm wise.
 * Provides data for monitoring dashboards and alerting.
 */

import { Logger } from 'pino';
import { EventEmitter } from 'events';

export interface Metric {
  name: string;
  value: number;
  labels?: Record<string, string>;
  timestamp: Date;
  type: 'counter' | 'gauge' | 'histogram';
}

export interface PassagePlanningMetrics {
  totalPlans: number;
  successfulPlans: number;
  failedPlans: number;
  averagePlanningTimeMs: number;
  plansByComplexity: {
    simple: number;    // <50nm
    moderate: number;  // 50-200nm
    complex: number;   // >200nm
  };
}

export interface AgentPerformanceMetrics {
  agentName: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTimeMs: number;
  p50ResponseTimeMs: number;
  p95ResponseTimeMs: number;
  p99ResponseTimeMs: number;
  circuitBreakerState: string;
  lastHealthCheck: Date;
  healthStatus: 'healthy' | 'degraded' | 'unhealthy';
}

export interface APIHealthMetrics {
  apiName: string;
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  averageLatencyMs: number;
  errorRate: number; // percentage
  quotaUsed: number;
  quotaLimit: number;
  quotaRemaining: number;
  circuitBreakerState: string;
  lastCallTime?: Date;
}

export interface SafetyWarningMetrics {
  totalWarningsGenerated: number;
  warningsByType: Record<string, number>;
  warningsBySeverity: Record<string, number>;
  overridesApplied: number;
  criticalWarningsIgnored: number;
}

export class MetricsService extends EventEmitter {
  private logger: Logger;
  private metrics: Map<string, Metric[]> = new Map();
  private readonly maxMetricsPerName = 1000; // Prevent memory leaks

  // Business metrics
  private passagePlanningMetrics: PassagePlanningMetrics = {
    totalPlans: 0,
    successfulPlans: 0,
    failedPlans: 0,
    averagePlanningTimeMs: 0,
    plansByComplexity: {
      simple: 0,
      moderate: 0,
      complex: 0,
    },
  };

  private agentMetrics: Map<string, AgentPerformanceMetrics> = new Map();
  private apiHealthMetrics: Map<string, APIHealthMetrics> = new Map();
  private safetyMetrics: SafetyWarningMetrics = {
    totalWarningsGenerated: 0,
    warningsByType: {},
    warningsBySeverity: {},
    overridesApplied: 0,
    criticalWarningsIgnored: 0,
  };

  // Response time tracking for percentiles
  private responseTimes: Map<string, number[]> = new Map();

  constructor(logger: Logger) {
    super();
    this.logger = logger;
  }

  /**
   * Record a metric
   */
  recordMetric(
    name: string,
    value: number,
    type: 'counter' | 'gauge' | 'histogram' = 'gauge',
    labels?: Record<string, string>
  ): void {
    const metric: Metric = {
      name,
      value,
      labels,
      timestamp: new Date(),
      type,
    };

    // Get existing metrics for this name
    const existing = this.metrics.get(name) || [];
    existing.push(metric);

    // Limit size to prevent memory leaks
    if (existing.length > this.maxMetricsPerName) {
      existing.shift();
    }

    this.metrics.set(name, existing);
    this.emit('metric', metric);
  }

  /**
   * Record passage planning success
   */
  recordPassagePlanSuccess(distanceNm: number, durationMs: number): void {
    this.passagePlanningMetrics.totalPlans++;
    this.passagePlanningMetrics.successfulPlans++;

    // Update average planning time
    const total = this.passagePlanningMetrics.totalPlans;
    this.passagePlanningMetrics.averagePlanningTimeMs =
      (this.passagePlanningMetrics.averagePlanningTimeMs * (total - 1) + durationMs) / total;

    // Categorize by complexity
    if (distanceNm < 50) {
      this.passagePlanningMetrics.plansByComplexity.simple++;
    } else if (distanceNm < 200) {
      this.passagePlanningMetrics.plansByComplexity.moderate++;
    } else {
      this.passagePlanningMetrics.plansByComplexity.complex++;
    }

    this.recordMetric('passage_planning_success', 1, 'counter', {
      distance: distanceNm.toFixed(0),
      complexity: distanceNm < 50 ? 'simple' : distanceNm < 200 ? 'moderate' : 'complex',
    });
  }

  /**
   * Record passage planning failure
   */
  recordPassagePlanFailure(reason: string): void {
    this.passagePlanningMetrics.totalPlans++;
    this.passagePlanningMetrics.failedPlans++;

    this.recordMetric('passage_planning_failure', 1, 'counter', { reason });
  }

  /**
   * Record agent performance
   */
  recordAgentRequest(
    agentName: string,
    success: boolean,
    responseTimeMs: number,
    healthStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy'
  ): void {
    // Get or create agent metrics
    let metrics = this.agentMetrics.get(agentName);
    if (!metrics) {
      metrics = {
        agentName,
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        averageResponseTimeMs: 0,
        p50ResponseTimeMs: 0,
        p95ResponseTimeMs: 0,
        p99ResponseTimeMs: 0,
        circuitBreakerState: 'CLOSED',
        lastHealthCheck: new Date(),
        healthStatus,
      };
      this.agentMetrics.set(agentName, metrics);
    }

    // Update metrics
    metrics.totalRequests++;
    if (success) {
      metrics.successfulRequests++;
    } else {
      metrics.failedRequests++;
    }

    // Update average response time
    metrics.averageResponseTimeMs =
      (metrics.averageResponseTimeMs * (metrics.totalRequests - 1) + responseTimeMs) / metrics.totalRequests;

    // Track response times for percentile calculations
    const responseTimes = this.responseTimes.get(agentName) || [];
    responseTimes.push(responseTimeMs);

    // Keep only last 1000 response times
    if (responseTimes.length > 1000) {
      responseTimes.shift();
    }

    this.responseTimes.set(agentName, responseTimes);

    // Calculate percentiles
    const sorted = [...responseTimes].sort((a, b) => a - b);
    metrics.p50ResponseTimeMs = sorted[Math.floor(sorted.length * 0.50)] || 0;
    metrics.p95ResponseTimeMs = sorted[Math.floor(sorted.length * 0.95)] || 0;
    metrics.p99ResponseTimeMs = sorted[Math.floor(sorted.length * 0.99)] || 0;

    this.recordMetric(`agent_request_${agentName}`, 1, 'counter', {
      success: success.toString(),
    });
  }

  /**
   * Record API health metrics
   */
  recordAPICall(
    apiName: string,
    success: boolean,
    latencyMs: number,
    quotaUsed?: number,
    quotaLimit?: number
  ): void {
    // Get or create API metrics
    let metrics = this.apiHealthMetrics.get(apiName);
    if (!metrics) {
      metrics = {
        apiName,
        totalCalls: 0,
        successfulCalls: 0,
        failedCalls: 0,
        averageLatencyMs: 0,
        errorRate: 0,
        quotaUsed: quotaUsed || 0,
        quotaLimit: quotaLimit || 0,
        quotaRemaining: (quotaLimit || 0) - (quotaUsed || 0),
        circuitBreakerState: 'CLOSED',
      };
      this.apiHealthMetrics.set(apiName, metrics);
    }

    // Update metrics
    metrics.totalCalls++;
    if (success) {
      metrics.successfulCalls++;
    } else {
      metrics.failedCalls++;
    }

    metrics.lastCallTime = new Date();

    // Update average latency
    metrics.averageLatencyMs =
      (metrics.averageLatencyMs * (metrics.totalCalls - 1) + latencyMs) / metrics.totalCalls;

    // Update error rate
    metrics.errorRate = (metrics.failedCalls / metrics.totalCalls) * 100;

    // Update quota
    if (quotaUsed !== undefined && quotaLimit !== undefined) {
      metrics.quotaUsed = quotaUsed;
      metrics.quotaLimit = quotaLimit;
      metrics.quotaRemaining = quotaLimit - quotaUsed;
    }

    this.recordMetric(`api_call_${apiName}`, 1, 'counter', {
      success: success.toString(),
    });

    // Alert on high error rate
    if (metrics.errorRate > 20) {
      this.logger.warn({
        apiName,
        errorRate: metrics.errorRate,
        totalCalls: metrics.totalCalls,
      }, `High error rate detected for ${apiName}: ${metrics.errorRate.toFixed(1)}%`);
    }
  }

  /**
   * Record safety warning generation
   */
  recordSafetyWarning(type: string, severity: string): void {
    this.safetyMetrics.totalWarningsGenerated++;
    
    // Track by type
    this.safetyMetrics.warningsByType[type] = 
      (this.safetyMetrics.warningsByType[type] || 0) + 1;

    // Track by severity
    this.safetyMetrics.warningsBySeverity[severity] = 
      (this.safetyMetrics.warningsBySeverity[severity] || 0) + 1;

    this.recordMetric('safety_warning', 1, 'counter', { type, severity });
  }

  /**
   * Record safety override
   */
  recordSafetyOverride(warningType: string, critical: boolean): void {
    this.safetyMetrics.overridesApplied++;

    if (critical) {
      this.safetyMetrics.criticalWarningsIgnored++;
      
      this.logger.warn({
        warningType,
        critical,
        totalOverrides: this.safetyMetrics.overridesApplied,
        criticalOverrides: this.safetyMetrics.criticalWarningsIgnored,
      }, '⚠️ Critical safety warning overridden by user');
    }

    this.recordMetric('safety_override', 1, 'counter', {
      warningType,
      critical: critical.toString(),
    });
  }

  /**
   * Get passage planning metrics
   */
  getPassagePlanningMetrics(): PassagePlanningMetrics {
    return { ...this.passagePlanningMetrics };
  }

  /**
   * Get agent performance metrics
   */
  getAgentMetrics(agentName?: string): AgentPerformanceMetrics | AgentPerformanceMetrics[] {
    if (agentName) {
      const metrics = this.agentMetrics.get(agentName);
      if (!metrics) {
        throw new Error(`No metrics found for agent: ${agentName}`);
      }
      return metrics;
    }

    return Array.from(this.agentMetrics.values());
  }

  /**
   * Get API health metrics
   */
  getAPIHealthMetrics(apiName?: string): APIHealthMetrics | APIHealthMetrics[] {
    if (apiName) {
      const metrics = this.apiHealthMetrics.get(apiName);
      if (!metrics) {
        throw new Error(`No metrics found for API: ${apiName}`);
      }
      return metrics;
    }

    return Array.from(this.apiHealthMetrics.values());
  }

  /**
   * Get safety warning metrics
   */
  getSafetyMetrics(): SafetyWarningMetrics {
    return { ...this.safetyMetrics };
  }

  /**
   * Get all metrics in Prometheus format
   */
  getPrometheusMetrics(): string {
    const lines: string[] = [];

    // Passage planning metrics
    lines.push(`# HELP passage_planning_total Total passage plans created`);
    lines.push(`# TYPE passage_planning_total counter`);
    lines.push(`passage_planning_total ${this.passagePlanningMetrics.totalPlans}`);

    lines.push(`# HELP passage_planning_success Successful passage plans`);
    lines.push(`# TYPE passage_planning_success counter`);
    lines.push(`passage_planning_success ${this.passagePlanningMetrics.successfulPlans}`);

    lines.push(`# HELP passage_planning_failed Failed passage plans`);
    lines.push(`# TYPE passage_planning_failed counter`);
    lines.push(`passage_planning_failed ${this.passagePlanningMetrics.failedPlans}`);

    // Agent metrics
    for (const [agentName, metrics] of this.agentMetrics) {
      lines.push(`# HELP agent_requests_total Total requests per agent`);
      lines.push(`# TYPE agent_requests_total counter`);
      lines.push(`agent_requests_total{agent="${agentName}"} ${metrics.totalRequests}`);

      lines.push(`# HELP agent_response_time_ms Average response time per agent`);
      lines.push(`# TYPE agent_response_time_ms gauge`);
      lines.push(`agent_response_time_ms{agent="${agentName}"} ${metrics.averageResponseTimeMs}`);

      lines.push(`# HELP agent_success_rate Success rate per agent`);
      lines.push(`# TYPE agent_success_rate gauge`);
      const successRate = metrics.totalRequests > 0
        ? (metrics.successfulRequests / metrics.totalRequests) * 100
        : 100;
      lines.push(`agent_success_rate{agent="${agentName}"} ${successRate.toFixed(2)}`);
    }

    // Safety metrics
    lines.push(`# HELP safety_warnings_total Total safety warnings generated`);
    lines.push(`# TYPE safety_warnings_total counter`);
    lines.push(`safety_warnings_total ${this.safetyMetrics.totalWarningsGenerated}`);

    lines.push(`# HELP safety_overrides_total Total safety overrides applied`);
    lines.push(`# TYPE safety_overrides_total counter`);
    lines.push(`safety_overrides_total ${this.safetyMetrics.overridesApplied}`);

    return lines.join('\n');
  }

  /**
   * Check for alerting conditions
   */
  checkAlerts(): string[] {
    const alerts: string[] = [];

    // Check agent failure rates
    for (const [agentName, metrics] of this.agentMetrics) {
      const failureRate = metrics.totalRequests > 0
        ? (metrics.failedRequests / metrics.totalRequests) * 100
        : 0;

      if (failureRate > 5) {
        alerts.push(`ALERT: ${agentName} failure rate is ${failureRate.toFixed(1)}% (threshold: 5%)`);
      }

      if (metrics.p95ResponseTimeMs > 5000) {
        alerts.push(`ALERT: ${agentName} p95 response time is ${metrics.p95ResponseTimeMs}ms (threshold: 5000ms)`);
      }
    }

    // Check API health
    for (const [apiName, metrics] of this.apiHealthMetrics) {
      if (metrics.errorRate > 10) {
        alerts.push(`ALERT: ${apiName} API error rate is ${metrics.errorRate.toFixed(1)}% (threshold: 10%)`);
      }

      if (metrics.quotaRemaining < metrics.quotaLimit * 0.1) {
        alerts.push(`ALERT: ${apiName} API quota low: ${metrics.quotaRemaining} remaining of ${metrics.quotaLimit}`);
      }
    }

    // Check safety overrides
    if (this.safetyMetrics.criticalWarningsIgnored > 0) {
      alerts.push(`ALERT: ${this.safetyMetrics.criticalWarningsIgnored} critical safety warnings have been overridden`);
    }

    return alerts;
  }

  /**
   * Reset all metrics (for testing)
   */
  reset(): void {
    this.metrics.clear();
    this.agentMetrics.clear();
    this.apiHealthMetrics.clear();
    this.responseTimes.clear();

    this.passagePlanningMetrics = {
      totalPlans: 0,
      successfulPlans: 0,
      failedPlans: 0,
      averagePlanningTimeMs: 0,
      plansByComplexity: { simple: 0, moderate: 0, complex: 0 },
    };

    this.safetyMetrics = {
      totalWarningsGenerated: 0,
      warningsByType: {},
      warningsBySeverity: {},
      overridesApplied: 0,
      criticalWarningsIgnored: 0,
    };

    this.logger.info('Metrics reset');
  }
}

