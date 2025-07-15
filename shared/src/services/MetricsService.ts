import { Counter, Histogram, Gauge, Registry } from 'prom-client';
import { Logger } from 'pino';

export interface MetricLabels {
  [key: string]: string | number;
}

export class MetricsService {
  private registry: Registry;
  private logger: Logger;
  
  // Business metrics
  private subscriptionCounter: Counter<string>;
  private churnCounter: Counter<string>;
  private revenueGauge: Gauge<string>;
  private activeUsersGauge: Gauge<string>;
  
  // Technical metrics
  private requestCounter: Counter<string>;
  private requestDuration: Histogram<string>;
  private errorCounter: Counter<string>;
  private agentLatency: Histogram<string>;
  
  // Usage metrics
  private passagesCreated: Counter<string>;
  private apiCallsCounter: Counter<string>;
  private featureUsageCounter: Counter<string>;
  
  constructor(logger: Logger) {
    this.logger = logger;
    this.registry = new Registry();
    
    this.initializeMetrics();
  }
  
  private initializeMetrics() {
    // Business metrics
    this.subscriptionCounter = new Counter({
      name: 'subscriptions_total',
      help: 'Total number of subscriptions by action',
      labelNames: ['action', 'tier', 'period'],
      registers: [this.registry],
    });
    
    this.churnCounter = new Counter({
      name: 'subscription_churn_total',
      help: 'Total number of churned subscriptions',
      labelNames: ['tier', 'reason'],
      registers: [this.registry],
    });
    
    this.revenueGauge = new Gauge({
      name: 'mrr_dollars',
      help: 'Monthly recurring revenue in dollars',
      labelNames: ['tier'],
      registers: [this.registry],
    });
    
    this.activeUsersGauge = new Gauge({
      name: 'active_users',
      help: 'Number of active users',
      labelNames: ['period', 'tier'],
      registers: [this.registry],
    });
    
    // Technical metrics
    this.requestCounter = new Counter({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status'],
      registers: [this.registry],
    });
    
    this.requestDuration = new Histogram({
      name: 'http_request_duration_seconds',
      help: 'HTTP request duration in seconds',
      labelNames: ['method', 'route', 'status'],
      buckets: [0.1, 0.5, 1, 2, 5, 10],
      registers: [this.registry],
    });
    
    this.errorCounter = new Counter({
      name: 'errors_total',
      help: 'Total number of errors',
      labelNames: ['type', 'code'],
      registers: [this.registry],
    });
    
    this.agentLatency = new Histogram({
      name: 'agent_latency_seconds',
      help: 'Agent response latency',
      labelNames: ['agent', 'operation'],
      buckets: [0.1, 0.25, 0.5, 1, 2.5, 5, 10],
      registers: [this.registry],
    });
    
    // Usage metrics
    this.passagesCreated = new Counter({
      name: 'passages_created_total',
      help: 'Total passages created',
      labelNames: ['tier', 'type'],
      registers: [this.registry],
    });
    
    this.apiCallsCounter = new Counter({
      name: 'api_calls_total',
      help: 'Total API calls',
      labelNames: ['endpoint', 'tier'],
      registers: [this.registry],
    });
    
    this.featureUsageCounter = new Counter({
      name: 'feature_usage_total',
      help: 'Feature usage by tier',
      labelNames: ['feature', 'tier'],
      registers: [this.registry],
    });
  }
  
  // Business metric methods
  recordSubscription(action: 'created' | 'upgraded' | 'downgraded', tier: string, period: 'monthly' | 'yearly') {
    this.subscriptionCounter.inc({ action, tier, period });
  }
  
  recordChurn(tier: string, reason: string) {
    this.churnCounter.inc({ tier, reason });
  }
  
  setMRR(tier: string, amount: number) {
    this.revenueGauge.set({ tier }, amount);
  }
  
  setActiveUsers(period: 'daily' | 'weekly' | 'monthly', tier: string, count: number) {
    this.activeUsersGauge.set({ period, tier }, count);
  }
  
  // Technical metric methods
  recordRequest(method: string, route: string, status: number, duration: number) {
    const labels = { method, route, status: status.toString() };
    this.requestCounter.inc(labels);
    this.requestDuration.observe(labels, duration / 1000); // Convert to seconds
  }
  
  recordError(type: string, code: string) {
    this.errorCounter.inc({ type, code });
  }
  
  recordAgentLatency(agent: string, operation: string, latency: number) {
    this.agentLatency.observe({ agent, operation }, latency / 1000);
  }
  
  // Usage metric methods
  recordPassageCreated(tier: string, type: string = 'standard') {
    this.passagesCreated.inc({ tier, type });
  }
  
  recordApiCall(endpoint: string, tier: string) {
    this.apiCallsCounter.inc({ endpoint, tier });
  }
  
  recordFeatureUsage(feature: string, tier: string) {
    this.featureUsageCounter.inc({ feature, tier });
  }
  
  // Get metrics in Prometheus format
  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }
  
  // Get content type for Prometheus
  getContentType(): string {
    return this.registry.contentType;
  }
  
  // Calculate business metrics
  async calculateBusinessMetrics(db: any): Promise<any> {
    try {
      // MRR calculation
      const mrrResult = await db.query(`
        SELECT 
          tier,
          COUNT(*) as count,
          SUM(CASE 
            WHEN tier = 'premium' THEN 19
            WHEN tier = 'pro' THEN 49
            ELSE 0
          END) as mrr
        FROM subscriptions
        WHERE status = 'active'
        GROUP BY tier
      `);
      
      let totalMRR = 0;
      for (const row of mrrResult.rows) {
        this.setMRR(row.tier, row.mrr);
        totalMRR += row.mrr;
      }
      
      // Active users
      const activeUsersResult = await db.query(`
        SELECT 
          s.tier,
          COUNT(DISTINCT u.user_id) as count
        FROM usage_metrics u
        JOIN subscriptions s ON u.user_id = s.user_id
        WHERE u.created_at >= NOW() - INTERVAL '30 days'
        GROUP BY s.tier
      `);
      
      for (const row of activeUsersResult.rows) {
        this.setActiveUsers('monthly', row.tier, row.count);
      }
      
      // Churn rate
      const churnResult = await db.query(`
        SELECT 
          COUNT(*) as churned,
          COUNT(*) * 100.0 / NULLIF(
            (SELECT COUNT(*) FROM subscriptions WHERE created_at < NOW() - INTERVAL '30 days'),
            0
          ) as churn_rate
        FROM subscriptions
        WHERE status = 'canceled'
        AND updated_at >= NOW() - INTERVAL '30 days'
      `);
      
      return {
        mrr: totalMRR,
        activeUsers: activeUsersResult.rows.reduce((sum, row) => sum + row.count, 0),
        churnRate: churnResult.rows[0]?.churn_rate || 0,
      };
      
    } catch (error) {
      this.logger.error({ error }, 'Failed to calculate business metrics');
      return null;
    }
  }
} 