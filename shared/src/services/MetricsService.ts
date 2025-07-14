import { register, Registry, Counter, Histogram, Gauge, Summary } from 'prom-client';
import { Request, Response, NextFunction } from 'express';
import pino from 'pino';

export class MetricsService {
  private registry: Registry;
  private logger = pino({
    level: process.env.LOG_LEVEL || 'info',
    transport: {
      target: 'pino-pretty',
      options: { colorize: true }
    }
  });
  
  // HTTP metrics
  private httpRequestDuration: Histogram<string>;
  private httpRequestTotal: Counter<string>;
  private httpRequestsInFlight: Gauge<string>;
  private httpRequestSize: Summary<string>;
  private httpResponseSize: Summary<string>;
  
  // Business metrics
  private passagePlansCreated: Counter<string>;
  private weatherRequestsTotal: Counter<string>;
  private tideRequestsTotal: Counter<string>;
  private routeCalculationsTotal: Counter<string>;
  private apiCallsExternal: Counter<string>;
  
  // Agent metrics
  private agentRequestDuration: Histogram<string>;
  private agentRequestTotal: Counter<string>;
  private agentAvailability: Gauge<string>;
  private agentErrorRate: Counter<string>;
  
  // System metrics
  private databaseConnectionsActive: Gauge<string>;
  private databaseConnectionsIdle: Gauge<string>;
  private databaseQueryDuration: Histogram<string>;
  private redisOperationDuration: Histogram<string>;
  private cacheHitRate: Gauge<string>;
  
  // Authentication metrics
  private authLoginAttempts: Counter<string>;
  private authTokensIssued: Counter<string>;
  private authTokensRefreshed: Counter<string>;
  private activeUsers: Gauge<string>;
  
  constructor(serviceName: string = 'passage-planner') {
    this.registry = new Registry();
    this.registry.setDefaultLabels({
      service: serviceName,
      environment: process.env.NODE_ENV || 'development',
    });
    
    this.initializeMetrics();
    this.collectDefaultMetrics();
  }
  
  private initializeMetrics() {
    // HTTP metrics
    this.httpRequestDuration = new Histogram({
      name: 'http_request_duration_seconds',
      help: 'Duration of HTTP requests in seconds',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5],
      registers: [this.registry],
    });
    
    this.httpRequestTotal = new Counter({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status_code'],
      registers: [this.registry],
    });
    
    this.httpRequestsInFlight = new Gauge({
      name: 'http_requests_in_flight',
      help: 'Number of HTTP requests currently being processed',
      labelNames: ['method', 'route'],
      registers: [this.registry],
    });
    
    this.httpRequestSize = new Summary({
      name: 'http_request_size_bytes',
      help: 'Size of HTTP requests in bytes',
      labelNames: ['method', 'route'],
      percentiles: [0.5, 0.9, 0.95, 0.99],
      registers: [this.registry],
    });
    
    this.httpResponseSize = new Summary({
      name: 'http_response_size_bytes',
      help: 'Size of HTTP responses in bytes',
      labelNames: ['method', 'route'],
      percentiles: [0.5, 0.9, 0.95, 0.99],
      registers: [this.registry],
    });
    
    // Business metrics
    this.passagePlansCreated = new Counter({
      name: 'passage_plans_created_total',
      help: 'Total number of passage plans created',
      labelNames: ['boat_type', 'status'],
      registers: [this.registry],
    });
    
    this.weatherRequestsTotal = new Counter({
      name: 'weather_requests_total',
      help: 'Total number of weather requests',
      labelNames: ['source', 'status'],
      registers: [this.registry],
    });
    
    this.tideRequestsTotal = new Counter({
      name: 'tide_requests_total',
      help: 'Total number of tide requests',
      labelNames: ['status'],
      registers: [this.registry],
    });
    
    this.routeCalculationsTotal = new Counter({
      name: 'route_calculations_total',
      help: 'Total number of route calculations',
      labelNames: ['type', 'status'],
      registers: [this.registry],
    });
    
    this.apiCallsExternal = new Counter({
      name: 'external_api_calls_total',
      help: 'Total number of external API calls',
      labelNames: ['api', 'endpoint', 'status'],
      registers: [this.registry],
    });
    
    // Agent metrics
    this.agentRequestDuration = new Histogram({
      name: 'agent_request_duration_seconds',
      help: 'Duration of agent requests in seconds',
      labelNames: ['agent', 'operation'],
      buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10],
      registers: [this.registry],
    });
    
    this.agentRequestTotal = new Counter({
      name: 'agent_requests_total',
      help: 'Total number of agent requests',
      labelNames: ['agent', 'operation', 'status'],
      registers: [this.registry],
    });
    
    this.agentAvailability = new Gauge({
      name: 'agent_availability',
      help: 'Agent availability (1=available, 0=unavailable)',
      labelNames: ['agent'],
      registers: [this.registry],
    });
    
    this.agentErrorRate = new Counter({
      name: 'agent_errors_total',
      help: 'Total number of agent errors',
      labelNames: ['agent', 'error_type'],
      registers: [this.registry],
    });
    
    // System metrics
    this.databaseConnectionsActive = new Gauge({
      name: 'database_connections_active',
      help: 'Number of active database connections',
      registers: [this.registry],
    });
    
    this.databaseConnectionsIdle = new Gauge({
      name: 'database_connections_idle',
      help: 'Number of idle database connections',
      registers: [this.registry],
    });
    
    this.databaseQueryDuration = new Histogram({
      name: 'database_query_duration_seconds',
      help: 'Duration of database queries in seconds',
      labelNames: ['query_type', 'table'],
      buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
      registers: [this.registry],
    });
    
    this.redisOperationDuration = new Histogram({
      name: 'redis_operation_duration_seconds',
      help: 'Duration of Redis operations in seconds',
      labelNames: ['operation', 'key_type'],
      buckets: [0.0001, 0.0005, 0.001, 0.005, 0.01, 0.05],
      registers: [this.registry],
    });
    
    this.cacheHitRate = new Gauge({
      name: 'cache_hit_rate',
      help: 'Cache hit rate percentage',
      labelNames: ['cache_type'],
      registers: [this.registry],
    });
    
    // Authentication metrics
    this.authLoginAttempts = new Counter({
      name: 'auth_login_attempts_total',
      help: 'Total number of login attempts',
      labelNames: ['status', 'method'],
      registers: [this.registry],
    });
    
    this.authTokensIssued = new Counter({
      name: 'auth_tokens_issued_total',
      help: 'Total number of auth tokens issued',
      labelNames: ['token_type'],
      registers: [this.registry],
    });
    
    this.authTokensRefreshed = new Counter({
      name: 'auth_tokens_refreshed_total',
      help: 'Total number of auth tokens refreshed',
      registers: [this.registry],
    });
    
    this.activeUsers = new Gauge({
      name: 'active_users',
      help: 'Number of active users',
      labelNames: ['subscription_tier'],
      registers: [this.registry],
    });
  }
  
  private collectDefaultMetrics() {
    // Collect default Node.js metrics
    register.collectDefaultMetrics({
      register: this.registry,
      prefix: 'nodejs_',
      gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5],
    });
  }
  
  /**
   * Express middleware for HTTP metrics
   */
  httpMetricsMiddleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      const start = Date.now();
      const route = req.route?.path || req.path;
      
      // Increment in-flight requests
      this.httpRequestsInFlight.inc({ method: req.method, route });
      
      // Measure request size
      const requestSize = parseInt(req.get('content-length') || '0', 10);
      if (requestSize > 0) {
        this.httpRequestSize.observe({ method: req.method, route }, requestSize);
      }
      
      // Intercept response to collect metrics
      const originalSend = res.send;
      res.send = function(data: any) {
        // Measure response time
        const duration = (Date.now() - start) / 1000;
        const statusCode = res.statusCode.toString();
        
        // Record metrics
        this.httpRequestDuration.observe(
          { method: req.method, route, status_code: statusCode },
          duration
        );
        
        this.httpRequestTotal.inc({
          method: req.method,
          route,
          status_code: statusCode,
        });
        
        // Decrement in-flight requests
        this.httpRequestsInFlight.dec({ method: req.method, route });
        
        // Measure response size
        const responseSize = Buffer.byteLength(data);
        this.httpResponseSize.observe({ method: req.method, route }, responseSize);
        
        // Call original send
        return originalSend.call(this, data);
      }.bind(this);
      
      next();
    };
  }
  
  // Business metric methods
  recordPassagePlan(boatType: string, success: boolean) {
    this.passagePlansCreated.inc({
      boat_type: boatType || 'unknown',
      status: success ? 'success' : 'failed',
    });
  }
  
  recordWeatherRequest(source: string, success: boolean) {
    this.weatherRequestsTotal.inc({
      source,
      status: success ? 'success' : 'failed',
    });
  }
  
  recordTideRequest(success: boolean) {
    this.tideRequestsTotal.inc({
      status: success ? 'success' : 'failed',
    });
  }
  
  recordRouteCalculation(type: string, success: boolean) {
    this.routeCalculationsTotal.inc({
      type,
      status: success ? 'success' : 'failed',
    });
  }
  
  recordExternalAPICall(api: string, endpoint: string, success: boolean) {
    this.apiCallsExternal.inc({
      api,
      endpoint,
      status: success ? 'success' : 'failed',
    });
  }
  
  // Agent metric methods
  recordAgentRequest(agent: string, operation: string, duration: number, success: boolean) {
    this.agentRequestDuration.observe({ agent, operation }, duration / 1000);
    this.agentRequestTotal.inc({
      agent,
      operation,
      status: success ? 'success' : 'failed',
    });
  }
  
  setAgentAvailability(agent: string, available: boolean) {
    this.agentAvailability.set({ agent }, available ? 1 : 0);
  }
  
  recordAgentError(agent: string, errorType: string) {
    this.agentErrorRate.inc({ agent, error_type: errorType });
  }
  
  // System metric methods
  updateDatabaseConnections(active: number, idle: number) {
    this.databaseConnectionsActive.set(active);
    this.databaseConnectionsIdle.set(idle);
  }
  
  recordDatabaseQuery(queryType: string, table: string, duration: number) {
    this.databaseQueryDuration.observe({ query_type: queryType, table }, duration / 1000);
  }
  
  recordRedisOperation(operation: string, keyType: string, duration: number) {
    this.redisOperationDuration.observe({ operation, key_type: keyType }, duration / 1000);
  }
  
  updateCacheHitRate(cacheType: string, hitRate: number) {
    this.cacheHitRate.set({ cache_type: cacheType }, hitRate);
  }
  
  // Authentication metric methods
  recordLoginAttempt(success: boolean, method: string = 'password') {
    this.authLoginAttempts.inc({
      status: success ? 'success' : 'failed',
      method,
    });
  }
  
  recordTokenIssued(tokenType: 'access' | 'refresh' | 'api_key') {
    this.authTokensIssued.inc({ token_type: tokenType });
  }
  
  recordTokenRefreshed() {
    this.authTokensRefreshed.inc();
  }
  
  updateActiveUsers(counts: Record<string, number>) {
    for (const [tier, count] of Object.entries(counts)) {
      this.activeUsers.set({ subscription_tier: tier }, count);
    }
  }
  
  /**
   * Get metrics for Prometheus scraping
   */
  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }
  
  /**
   * Get content type for metrics
   */
  getContentType(): string {
    return this.registry.contentType;
  }
  
  /**
   * Express endpoint for metrics
   */
  metricsEndpoint() {
    return async (req: Request, res: Response) => {
      try {
        res.set('Content-Type', this.getContentType());
        const metrics = await this.getMetrics();
        res.end(metrics);
      } catch (error) {
        this.logger.error({ error }, 'Error collecting metrics');
        res.status(500).end();
      }
    };
  }
  
  /**
   * Create custom metric
   */
  createCustomMetric(options: {
    type: 'counter' | 'gauge' | 'histogram' | 'summary';
    name: string;
    help: string;
    labelNames?: string[];
    buckets?: number[];
    percentiles?: number[];
  }) {
    const { type, name, help, labelNames = [], buckets, percentiles } = options;
    
    switch (type) {
      case 'counter':
        return new Counter({
          name,
          help,
          labelNames,
          registers: [this.registry],
        });
        
      case 'gauge':
        return new Gauge({
          name,
          help,
          labelNames,
          registers: [this.registry],
        });
        
      case 'histogram':
        return new Histogram({
          name,
          help,
          labelNames,
          buckets: buckets || [0.1, 0.5, 1, 2, 5, 10],
          registers: [this.registry],
        });
        
      case 'summary':
        return new Summary({
          name,
          help,
          labelNames,
          percentiles: percentiles || [0.5, 0.9, 0.95, 0.99],
          registers: [this.registry],
        });
        
      default:
        throw new Error(`Unknown metric type: ${type}`);
    }
  }
  
  /**
   * Reset all metrics (useful for testing)
   */
  reset() {
    this.registry.clear();
    this.initializeMetrics();
  }
} 