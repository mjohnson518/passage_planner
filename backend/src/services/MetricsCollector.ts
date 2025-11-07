import { Logger } from 'pino'

interface MetricEntry {
  method: string
  success: boolean
  duration: number
  timestamp: number
}

interface EventEntry {
  event: string
  metadata: Record<string, any>
  timestamp: number
}

export class MetricsCollector {
  private entries: MetricEntry[] = []
  private events: EventEntry[] = []

  constructor(private logger: Logger) {}

  async record(event: string, metadata: Record<string, any>) {
    this.logger.debug({ event, metadata }, 'Metric recorded')
    this.events.push({ event, metadata, timestamp: Date.now() })
    if (this.events.length > 100) {
      this.events.shift()
    }
  }

  recordRequest(method: string, duration: number, success: boolean): void {
    this.entries.push({ method, duration, success, timestamp: Date.now() })

    if (this.entries.length > 1000) {
      this.entries.shift()
    }

    this.logger.debug({ method, duration, success }, 'Request recorded')
  }

  getAverageResponseTime(method?: string): number {
    const filtered = method ? this.entries.filter((e) => e.method === method) : this.entries
    if (filtered.length === 0) return 0
    return filtered.reduce((sum, entry) => sum + entry.duration, 0) / filtered.length
  }

  getMetrics(): Record<string, any> {
    const metrics: Record<string, any> = {
      requests: {},
      responseTimes: {},
      errorRates: {},
      overall: {
        totalRequests: this.entries.length,
        averageResponseTime: this.getAverageResponseTime(),
        errorRate: 0,
      },
      recentEvents: this.events,
    }

    const grouped = new Map<string, MetricEntry[]>()
    for (const entry of this.entries) {
      if (!grouped.has(entry.method)) {
        grouped.set(entry.method, [])
      }
      grouped.get(entry.method)!.push(entry)
    }

    let totalErrors = 0
    for (const [method, entries] of grouped.entries()) {
      const requestCount = entries.length
      const errorCount = entries.filter((e) => !e.success).length
      totalErrors += errorCount

      metrics.requests[method] = requestCount
      metrics.responseTimes[method] = {
        average: entries.reduce((sum, entry) => sum + entry.duration, 0) / requestCount,
      }
      metrics.errorRates[method] = requestCount > 0 ? errorCount / requestCount : 0
    }

    metrics.overall.errorRate = this.entries.length > 0 ? totalErrors / this.entries.length : 0
    return metrics
  }

  reset(): void {
    this.entries = []
    this.events = []
    this.logger.info('Metrics reset')
  }
}