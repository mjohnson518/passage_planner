// orchestrator/src/services/MetricsCollector.ts

import { Logger } from 'pino';

interface RequestMetrics {
  method: string;
  duration: number;
  success: boolean;
  timestamp: Date;
}

interface AgentMetrics {
  agentId: string;
  requestCount: number;
  totalDuration: number;
  errorCount: number;
  lastError?: string;
  lastRequestTime?: Date;
}

export class MetricsCollector {
  private requestMetrics: RequestMetrics[] = [];
  private agentMetrics = new Map<string, AgentMetrics>();
  private metricsRetentionMs = 3600000; // 1 hour
  
  constructor(private logger: Logger) {
    // Clean up old metrics periodically
    setInterval(() => this.cleanupOldMetrics(), 60000); // Every minute
  }
  
  recordRequest(method: string, duration: number, success: boolean): void {
    const metric: RequestMetrics = {
      method,
      duration,
      success,
      timestamp: new Date(),
    };
    
    this.requestMetrics.push(metric);
    
    this.logger.debug({ method, duration, success }, 'Request metric recorded');
  }
  
  recordAgentRequest(
    agentId: string, 
    duration: number, 
    success: boolean, 
    error?: string
  ): void {
    let metrics = this.agentMetrics.get(agentId);
    
    if (!metrics) {
      metrics = {
        agentId,
        requestCount: 0,
        totalDuration: 0,
        errorCount: 0,
      };
      this.agentMetrics.set(agentId, metrics);
    }
    
    metrics.requestCount++;
    metrics.totalDuration += duration;
    metrics.lastRequestTime = new Date();
    
    if (!success) {
      metrics.errorCount++;
      if (error) {
        metrics.lastError = error;
      }
    }
    
    this.logger.debug({ agentId, duration, success }, 'Agent metric recorded');
  }
  
  getAverageResponseTime(method?: string): number {
    const relevantMetrics = method
      ? this.requestMetrics.filter(m => m.method === method)
      : this.requestMetrics;
    
    if (relevantMetrics.length === 0) {
      return 0;
    }
    
    const totalDuration = relevantMetrics.reduce((sum, m) => sum + m.duration, 0);
    return totalDuration / relevantMetrics.length;
  }
  
  getSuccessRate(method?: string): number {
    const relevantMetrics = method
      ? this.requestMetrics.filter(m => m.method === method)
      : this.requestMetrics;
    
    if (relevantMetrics.length === 0) {
      return 1;
    }
    
    const successCount = relevantMetrics.filter(m => m.success).length;
    return successCount / relevantMetrics.length;
  }
  
  getRequestsPerMinute(method?: string): number {
    const oneMinuteAgo = new Date(Date.now() - 60000);
    
    const relevantMetrics = this.requestMetrics.filter(m => 
      m.timestamp > oneMinuteAgo && (!method || m.method === method)
    );
    
    return relevantMetrics.length;
  }
  
  getAgentMetrics(agentId: string): AgentMetrics | undefined {
    return this.agentMetrics.get(agentId);
  }
  
  getAllAgentMetrics(): Map<string, AgentMetrics> {
    return new Map(this.agentMetrics);
  }
  
  getAgentSuccessRate(agentId: string): number {
    const metrics = this.agentMetrics.get(agentId);
    
    if (!metrics || metrics.requestCount === 0) {
      return 1;
    }
    
    return (metrics.requestCount - metrics.errorCount) / metrics.requestCount;
  }
  
  getAgentAverageResponseTime(agentId: string): number {
    const metrics = this.agentMetrics.get(agentId);
    
    if (!metrics || metrics.requestCount === 0) {
      return 0;
    }
    
    return metrics.totalDuration / metrics.requestCount;
  }
  
  getSystemMetrics(): {
    totalRequests: number;
    averageResponseTime: number;
    successRate: number;
    requestsPerMinute: number;
    activeAgents: number;
    topErrors: Array<{ method: string; count: number }>;
  } {
    const errorCounts = new Map<string, number>();
    
    // Count errors by method
    this.requestMetrics
      .filter(m => !m.success)
      .forEach(m => {
        errorCounts.set(m.method, (errorCounts.get(m.method) || 0) + 1);
      });
    
    const topErrors = Array.from(errorCounts.entries())
      .map(([method, count]) => ({ method, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
    
    return {
      totalRequests: this.requestMetrics.length,
      averageResponseTime: this.getAverageResponseTime(),
      successRate: this.getSuccessRate(),
      requestsPerMinute: this.getRequestsPerMinute(),
      activeAgents: this.agentMetrics.size,
      topErrors,
    };
  }
  
  getMethodMetrics(): Map<string, {
    count: number;
    averageTime: number;
    successRate: number;
  }> {
    const methodMetrics = new Map<string, any>();
    
    // Group metrics by method
    const methodGroups = new Map<string, RequestMetrics[]>();
    
    this.requestMetrics.forEach(metric => {
      const group = methodGroups.get(metric.method) || [];
      group.push(metric);
      methodGroups.set(metric.method, group);
    });
    
    // Calculate metrics for each method
    methodGroups.forEach((metrics, method) => {
      const successCount = metrics.filter(m => m.success).length;
      const totalTime = metrics.reduce((sum, m) => sum + m.duration, 0);
      
      methodMetrics.set(method, {
        count: metrics.length,
        averageTime: totalTime / metrics.length,
        successRate: successCount / metrics.length,
      });
    });
    
    return methodMetrics;
  }
  
  exportMetrics(): {
    requests: RequestMetrics[];
    agents: Record<string, AgentMetrics>;
    system: {
      totalRequests: number;
      averageResponseTime: number;
      successRate: number;
      requestsPerMinute: number;
      activeAgents: number;
      topErrors: Array<{ method: string; count: number }>;
    };
    methods: Record<string, any>;
  } {
    return {
      requests: this.requestMetrics,
      agents: Object.fromEntries(this.agentMetrics),
      system: this.getSystemMetrics(),
      methods: Object.fromEntries(this.getMethodMetrics()),
    };
  }
  
  private cleanupOldMetrics(): void {
    const cutoffTime = new Date(Date.now() - this.metricsRetentionMs);
    
    // Remove old request metrics
    const oldLength = this.requestMetrics.length;
    this.requestMetrics = this.requestMetrics.filter(
      m => m.timestamp > cutoffTime
    );
    
    const removed = oldLength - this.requestMetrics.length;
    if (removed > 0) {
      this.logger.debug({ removed }, 'Cleaned up old request metrics');
    }
  }
  
  reset(): void {
    this.requestMetrics = [];
    this.agentMetrics.clear();
    this.logger.info('Metrics reset');
  }
} 