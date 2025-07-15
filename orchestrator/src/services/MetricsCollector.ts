import { Logger } from 'pino';

export class MetricsCollector {
  private requestCounts = new Map<string, number>();
  private responseTimes = new Map<string, number[]>();
  private errorCounts = new Map<string, number>();
  
  constructor(private logger: Logger) {}
  
  recordRequest(method: string, duration: number, success: boolean): void {
    // Update request count
    const currentCount = this.requestCounts.get(method) || 0;
    this.requestCounts.set(method, currentCount + 1);
    
    // Update response times
    const times = this.responseTimes.get(method) || [];
    times.push(duration);
    if (times.length > 100) {
      times.shift(); // Keep only last 100
    }
    this.responseTimes.set(method, times);
    
    // Update error count if failed
    if (!success) {
      const errorCount = this.errorCounts.get(method) || 0;
      this.errorCounts.set(method, errorCount + 1);
    }
    
    this.logger.debug({ method, duration, success }, 'Request recorded');
  }
  
  getAverageResponseTime(method?: string): number {
    if (method) {
      const times = this.responseTimes.get(method) || [];
      return times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 0;
    }
    
    // Overall average
    let totalTime = 0;
    let totalCount = 0;
    
    for (const times of this.responseTimes.values()) {
      totalTime += times.reduce((a, b) => a + b, 0);
      totalCount += times.length;
    }
    
    return totalCount > 0 ? totalTime / totalCount : 0;
  }
  
  getMetrics(): Record<string, any> {
    const metrics: Record<string, any> = {
      requests: {},
      responseTimes: {},
      errorRates: {},
      overall: {
        totalRequests: 0,
        averageResponseTime: this.getAverageResponseTime(),
        errorRate: 0
      }
    };
    
    let totalRequests = 0;
    let totalErrors = 0;
    
    for (const [method, count] of this.requestCounts.entries()) {
      metrics.requests[method] = count;
      totalRequests += count;
      
      const times = this.responseTimes.get(method) || [];
      metrics.responseTimes[method] = {
        average: times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 0,
        min: times.length > 0 ? Math.min(...times) : 0,
        max: times.length > 0 ? Math.max(...times) : 0,
        p95: this.calculatePercentile(times, 0.95),
        p99: this.calculatePercentile(times, 0.99)
      };
      
      const errors = this.errorCounts.get(method) || 0;
      totalErrors += errors;
      metrics.errorRates[method] = count > 0 ? errors / count : 0;
    }
    
    metrics.overall.totalRequests = totalRequests;
    metrics.overall.errorRate = totalRequests > 0 ? totalErrors / totalRequests : 0;
    
    return metrics;
  }
  
  private calculatePercentile(values: number[], percentile: number): number {
    if (values.length === 0) return 0;
    
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil(sorted.length * percentile) - 1;
    return sorted[index] || 0;
  }
  
  reset(): void {
    this.requestCounts.clear();
    this.responseTimes.clear();
    this.errorCounts.clear();
    this.logger.info('Metrics reset');
  }
} 