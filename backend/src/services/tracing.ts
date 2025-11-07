/**
 * Distributed Tracing Service
 * 
 * Provides end-to-end request tracing across all agents and services.
 * Enables visualization of request flow and performance bottleneck identification.
 */

import { Logger } from 'pino';
import { EventEmitter } from 'events';

export interface TraceSpan {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  serviceName: string;
  operationName: string;
  startTime: Date;
  endTime?: Date;
  durationMs?: number;
  status: 'in_progress' | 'success' | 'error';
  tags: Record<string, string | number | boolean>;
  logs: TraceLog[];
  error?: {
    message: string;
    stack?: string;
  };
}

export interface TraceLog {
  timestamp: Date;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  fields?: Record<string, any>;
}

export interface Trace {
  traceId: string;
  rootSpan: TraceSpan;
  spans: Map<string, TraceSpan>;
  startTime: Date;
  endTime?: Date;
  totalDurationMs?: number;
  status: 'in_progress' | 'success' | 'error';
}

export class TracingService extends EventEmitter {
  private logger: Logger;
  private traces: Map<string, Trace> = new Map();
  private activeSpans: Map<string, TraceSpan> = new Map();
  private readonly maxTraces = 1000; // Prevent memory leaks

  constructor(logger: Logger) {
    super();
    this.logger = logger;
  }

  /**
   * Start a new trace (root span)
   */
  startTrace(
    traceId: string,
    serviceName: string,
    operationName: string,
    tags: Record<string, string | number | boolean> = {}
  ): TraceSpan {
    const span: TraceSpan = {
      traceId,
      spanId: this.generateSpanId(),
      serviceName,
      operationName,
      startTime: new Date(),
      status: 'in_progress',
      tags,
      logs: [],
    };

    const trace: Trace = {
      traceId,
      rootSpan: span,
      spans: new Map([[span.spanId, span]]),
      startTime: span.startTime,
      status: 'in_progress',
    };

    this.traces.set(traceId, trace);
    this.activeSpans.set(span.spanId, span);

    this.logger.debug({
      traceId,
      spanId: span.spanId,
      serviceName,
      operationName,
    }, 'Trace started');

    this.emit('traceStarted', { traceId, span });

    return span;
  }

  /**
   * Start a child span within a trace
   */
  startSpan(
    traceId: string,
    parentSpanId: string,
    serviceName: string,
    operationName: string,
    tags: Record<string, string | number | boolean> = {}
  ): TraceSpan {
    const trace = this.traces.get(traceId);
    if (!trace) {
      throw new Error(`Trace not found: ${traceId}`);
    }

    const span: TraceSpan = {
      traceId,
      spanId: this.generateSpanId(),
      parentSpanId,
      serviceName,
      operationName,
      startTime: new Date(),
      status: 'in_progress',
      tags,
      logs: [],
    };

    trace.spans.set(span.spanId, span);
    this.activeSpans.set(span.spanId, span);

    this.logger.debug({
      traceId,
      spanId: span.spanId,
      parentSpanId,
      serviceName,
      operationName,
    }, 'Span started');

    this.emit('spanStarted', { traceId, span });

    return span;
  }

  /**
   * End a span
   */
  endSpan(
    spanId: string,
    status: 'success' | 'error' = 'success',
    error?: Error
  ): void {
    const span = this.activeSpans.get(spanId);
    if (!span) {
      this.logger.warn({ spanId }, 'Attempted to end unknown span');
      return;
    }

    span.endTime = new Date();
    span.durationMs = span.endTime.getTime() - span.startTime.getTime();
    span.status = status;

    if (error) {
      span.error = {
        message: error.message,
        stack: error.stack,
      };
    }

    this.activeSpans.delete(spanId);

    this.logger.debug({
      traceId: span.traceId,
      spanId,
      durationMs: span.durationMs,
      status,
    }, 'Span ended');

    this.emit('spanEnded', { span });

    // If this is the root span, end the trace
    const trace = this.traces.get(span.traceId);
    if (trace && span.spanId === trace.rootSpan.spanId) {
      this.endTrace(span.traceId, status);
    }
  }

  /**
   * End a trace
   */
  private endTrace(traceId: string, status: 'success' | 'error'): void {
    const trace = this.traces.get(traceId);
    if (!trace) return;

    trace.endTime = new Date();
    trace.totalDurationMs = trace.endTime.getTime() - trace.startTime.getTime();
    trace.status = status;

    this.logger.info({
      traceId,
      totalDurationMs: trace.totalDurationMs,
      totalSpans: trace.spans.size,
      status,
    }, 'Trace completed');

    this.emit('traceEnded', { trace });

    // Clean up old traces
    this.cleanupOldTraces();
  }

  /**
   * Add log entry to span
   */
  logToSpan(
    spanId: string,
    level: 'debug' | 'info' | 'warn' | 'error',
    message: string,
    fields?: Record<string, any>
  ): void {
    const span = this.activeSpans.get(spanId);
    if (!span) return;

    span.logs.push({
      timestamp: new Date(),
      level,
      message,
      fields,
    });
  }

  /**
   * Add tags to span
   */
  addTags(spanId: string, tags: Record<string, string | number | boolean>): void {
    const span = this.activeSpans.get(spanId);
    if (!span) return;

    span.tags = { ...span.tags, ...tags };
  }

  /**
   * Get trace by ID
   */
  getTrace(traceId: string): Trace | undefined {
    return this.traces.get(traceId);
  }

  /**
   * Get all active traces
   */
  getActiveTraces(): Trace[] {
    return Array.from(this.traces.values()).filter(t => t.status === 'in_progress');
  }

  /**
   * Get trace visualization (for debugging)
   */
  visualizeTrace(traceId: string): string {
    const trace = this.traces.get(traceId);
    if (!trace) {
      return `Trace ${traceId} not found`;
    }

    const lines: string[] = [];
    lines.push(`Trace: ${traceId}`);
    lines.push(`Status: ${trace.status}`);
    lines.push(`Duration: ${trace.totalDurationMs || '(in progress)'}ms`);
    lines.push(`Spans: ${trace.spans.size}`);
    lines.push('');

    // Build tree structure
    this.buildSpanTree(trace.rootSpan, trace, lines, 0);

    return lines.join('\n');
  }

  /**
   * Build hierarchical span tree for visualization
   */
  private buildSpanTree(
    span: TraceSpan,
    trace: Trace,
    lines: string[],
    depth: number
  ): void {
    const indent = '  '.repeat(depth);
    const duration = span.durationMs ? `${span.durationMs}ms` : 'in progress';
    const status = span.status === 'success' ? '✓' : span.status === 'error' ? '✗' : '○';

    lines.push(`${indent}${status} ${span.serviceName}.${span.operationName} (${duration})`);

    if (span.error) {
      lines.push(`${indent}  Error: ${span.error.message}`);
    }

    // Find child spans
    const children = Array.from(trace.spans.values())
      .filter(s => s.parentSpanId === span.spanId);

    for (const child of children) {
      this.buildSpanTree(child, trace, lines, depth + 1);
    }
  }

  /**
   * Generate unique span ID
   */
  private generateSpanId(): string {
    return `span-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Clean up old traces to prevent memory leaks
   */
  private cleanupOldTraces(): void {
    if (this.traces.size <= this.maxTraces) return;

    // Sort traces by start time
    const sortedTraces = Array.from(this.traces.entries())
      .sort(([, a], [, b]) => a.startTime.getTime() - b.startTime.getTime());

    // Remove oldest completed traces
    const toRemove = sortedTraces.length - this.maxTraces;
    for (let i = 0; i < toRemove; i++) {
      const [traceId, trace] = sortedTraces[i];
      if (trace.status !== 'in_progress') {
        this.traces.delete(traceId);
      }
    }
  }
}

