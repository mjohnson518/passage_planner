"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MetricsService = void 0;
const prom_client_1 = require("prom-client");
class MetricsService {
    registry;
    logger;
    // Business metrics
    subscriptionCounter;
    churnCounter;
    revenueGauge;
    activeUsersGauge;
    // Technical metrics
    requestCounter;
    requestDuration;
    errorCounter;
    agentLatency;
    // Usage metrics
    passagesCreated;
    apiCallsCounter;
    featureUsageCounter;
    constructor(logger) {
        this.logger = logger;
        this.registry = new prom_client_1.Registry();
        this.initializeMetrics();
    }
    initializeMetrics() {
        // Business metrics
        this.subscriptionCounter = new prom_client_1.Counter({
            name: 'subscriptions_total',
            help: 'Total number of subscriptions by action',
            labelNames: ['action', 'tier', 'period'],
            registers: [this.registry],
        });
        this.churnCounter = new prom_client_1.Counter({
            name: 'subscription_churn_total',
            help: 'Total number of churned subscriptions',
            labelNames: ['tier', 'reason'],
            registers: [this.registry],
        });
        this.revenueGauge = new prom_client_1.Gauge({
            name: 'mrr_dollars',
            help: 'Monthly recurring revenue in dollars',
            labelNames: ['tier'],
            registers: [this.registry],
        });
        this.activeUsersGauge = new prom_client_1.Gauge({
            name: 'active_users',
            help: 'Number of active users',
            labelNames: ['period', 'tier'],
            registers: [this.registry],
        });
        // Technical metrics
        this.requestCounter = new prom_client_1.Counter({
            name: 'http_requests_total',
            help: 'Total number of HTTP requests',
            labelNames: ['method', 'route', 'status'],
            registers: [this.registry],
        });
        this.requestDuration = new prom_client_1.Histogram({
            name: 'http_request_duration_seconds',
            help: 'HTTP request duration in seconds',
            labelNames: ['method', 'route', 'status'],
            buckets: [0.1, 0.5, 1, 2, 5, 10],
            registers: [this.registry],
        });
        this.errorCounter = new prom_client_1.Counter({
            name: 'errors_total',
            help: 'Total number of errors',
            labelNames: ['type', 'code'],
            registers: [this.registry],
        });
        this.agentLatency = new prom_client_1.Histogram({
            name: 'agent_latency_seconds',
            help: 'Agent response latency',
            labelNames: ['agent', 'operation'],
            buckets: [0.1, 0.25, 0.5, 1, 2.5, 5, 10],
            registers: [this.registry],
        });
        // Usage metrics
        this.passagesCreated = new prom_client_1.Counter({
            name: 'passages_created_total',
            help: 'Total passages created',
            labelNames: ['tier', 'type'],
            registers: [this.registry],
        });
        this.apiCallsCounter = new prom_client_1.Counter({
            name: 'api_calls_total',
            help: 'Total API calls',
            labelNames: ['endpoint', 'tier'],
            registers: [this.registry],
        });
        this.featureUsageCounter = new prom_client_1.Counter({
            name: 'feature_usage_total',
            help: 'Feature usage by tier',
            labelNames: ['feature', 'tier'],
            registers: [this.registry],
        });
    }
    // Business metric methods
    recordSubscription(action, tier, period) {
        this.subscriptionCounter.inc({ action, tier, period });
    }
    recordChurn(tier, reason) {
        this.churnCounter.inc({ tier, reason });
    }
    setMRR(tier, amount) {
        this.revenueGauge.set({ tier }, amount);
    }
    setActiveUsers(period, tier, count) {
        this.activeUsersGauge.set({ period, tier }, count);
    }
    // Technical metric methods
    recordRequest(method, route, status, duration) {
        const labels = { method, route, status: status.toString() };
        this.requestCounter.inc(labels);
        this.requestDuration.observe(labels, duration / 1000); // Convert to seconds
    }
    recordError(type, code) {
        this.errorCounter.inc({ type, code });
    }
    recordAgentLatency(agent, operation, latency) {
        this.agentLatency.observe({ agent, operation }, latency / 1000);
    }
    // Usage metric methods
    recordPassageCreated(tier, type = 'standard') {
        this.passagesCreated.inc({ tier, type });
    }
    recordApiCall(endpoint, tier) {
        this.apiCallsCounter.inc({ endpoint, tier });
    }
    recordFeatureUsage(feature, tier) {
        this.featureUsageCounter.inc({ feature, tier });
    }
    // Get metrics in Prometheus format
    async getMetrics() {
        return this.registry.metrics();
    }
    // Get content type for Prometheus
    getContentType() {
        return this.registry.contentType;
    }
    // Calculate business metrics
    async calculateBusinessMetrics(db) {
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
        }
        catch (error) {
            this.logger.error({ error }, 'Failed to calculate business metrics');
            return null;
        }
    }
}
exports.MetricsService = MetricsService;
//# sourceMappingURL=MetricsService.js.map