// orchestrator/src/services/FallbackManager.ts
// Fallback Manager - Handles agent failures and provides alternative strategies

import { EventEmitter } from 'events';
import pino, { Logger } from 'pino';
import { AgentCapabilitySummary, AgentError } from '@passage-planner/shared/types/core';
import { AgentRegistry } from './AgentRegistry';

export interface FallbackStrategy {
  id: string;
  name: string;
  description: string;
  condition: (error: AgentError) => boolean;
  execute: (context: FallbackContext) => Promise<any>;
  priority: number;
}

export interface FallbackContext {
  originalAgent: string;
  operation: string;
  inputs: Record<string, any>;
  error: AgentError;
  attemptNumber: number;
  metadata?: Record<string, any>;
}

export interface CircuitBreakerConfig {
  failureThreshold: number;
  resetTimeout: number;
  halfOpenRequests: number;
}

enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN'
}

interface CircuitBreaker {
  state: CircuitState;
  failureCount: number;
  lastFailureTime: Date;
  successCount: number;
}

export class FallbackManager extends EventEmitter {
  private logger: Logger;
  private agentRegistry: AgentRegistry;
  private strategies = new Map<string, FallbackStrategy[]>();
  private circuitBreakers = new Map<string, CircuitBreaker>();
  private cachedResponses = new Map<string, { data: any; expiry: number }>();
  private config: CircuitBreakerConfig;
  
  constructor(agentRegistry: AgentRegistry, logger: Logger) {
    super();
    this.agentRegistry = agentRegistry;
    this.logger = logger.child({ service: 'FallbackManager' });
    
    this.config = {
      failureThreshold: 5,
      resetTimeout: 60000, // 1 minute
      halfOpenRequests: 3
    };
    
    this.initializeStrategies();
  }
  
  /**
   * Initialize default fallback strategies
   */
  private initializeStrategies() {
    // Use alternative agent strategy
    this.registerStrategy({
      id: 'alternative-agent',
      name: 'Use Alternative Agent',
      description: 'Try another agent with similar capabilities',
      priority: 1,
      condition: (error) => error.retryable && error.code !== 'CAPABILITY_NOT_FOUND',
      execute: async (context) => {
        const alternativeAgent = await this.findAlternativeAgent(
          context.originalAgent,
          context.operation
        );
        
        if (alternativeAgent) {
          this.logger.info({
            original: context.originalAgent,
            alternative: alternativeAgent.agentId
          }, 'Using alternative agent');
          
          // Call alternative agent
          return this.callAlternativeAgent(alternativeAgent, context);
        }
        
        throw new Error('No alternative agent available');
      }
    });
    
    // Use cached response strategy
    this.registerStrategy({
      id: 'use-cache',
      name: 'Use Cached Response',
      description: 'Return previously cached response if available',
      priority: 2,
      condition: (error) => true, // Always applicable
      execute: async (context) => {
        const cacheKey = this.getCacheKey(context);
        const cached = this.cachedResponses.get(cacheKey);
        
        if (cached && cached.expiry > Date.now()) {
          this.logger.info({ cacheKey }, 'Using cached response');
          return cached.data;
        }
        
        throw new Error('No cached response available');
      }
    });
    
    // Degraded response strategy
    this.registerStrategy({
      id: 'degraded-response',
      name: 'Provide Degraded Response',
      description: 'Return partial or estimated data',
      priority: 3,
      condition: (error) => error.code !== 'INVALID_INPUT',
      execute: async (context) => {
        this.logger.warn({ context }, 'Providing degraded response');
        
        // Generate degraded response based on operation
        return this.generateDegradedResponse(context);
      }
    });
    
    // Retry with exponential backoff
    this.registerStrategy({
      id: 'retry-backoff',
      name: 'Retry with Backoff',
      description: 'Retry the operation with exponential backoff',
      priority: 0,
      condition: (error) => error.retryable && error.code === 'TIMEOUT',
      execute: async (context) => {
        const delay = Math.min(1000 * Math.pow(2, context.attemptNumber - 1), 30000);
        
        this.logger.info({ delay, attempt: context.attemptNumber }, 'Retrying with backoff');
        
        await this.sleep(delay);
        
        // Retry original operation
        throw new Error('Retry original operation');
      }
    });
    
    // Queue for later strategy
    this.registerStrategy({
      id: 'queue-later',
      name: 'Queue for Later',
      description: 'Queue the request for later processing',
      priority: 4,
      condition: (error) => error.code === 'RATE_LIMIT' || error.code === 'OVERLOADED',
      execute: async (context) => {
        this.logger.info({ context }, 'Queueing request for later');
        
        // In a real implementation, this would queue to Redis or similar
        this.emit('request:queued', {
          agent: context.originalAgent,
          operation: context.operation,
          inputs: context.inputs
        });
        
        return {
          status: 'queued',
          message: 'Request queued for later processing',
          queueId: `queue-${Date.now()}`
        };
      }
    });
  }
  
  /**
   * Register a fallback strategy
   */
  registerStrategy(strategy: FallbackStrategy) {
    const agentStrategies = this.strategies.get('global') || [];
    agentStrategies.push(strategy);
    agentStrategies.sort((a, b) => a.priority - b.priority);
    this.strategies.set('global', agentStrategies);
  }
  
  /**
   * Register agent-specific strategy
   */
  registerAgentStrategy(agentId: string, strategy: FallbackStrategy) {
    const agentStrategies = this.strategies.get(agentId) || [];
    agentStrategies.push(strategy);
    agentStrategies.sort((a, b) => a.priority - b.priority);
    this.strategies.set(agentId, agentStrategies);
  }
  
  /**
   * Handle agent failure with fallback
   */
  async handleFailure(context: FallbackContext): Promise<any> {
    // Check circuit breaker
    const circuitKey = `${context.originalAgent}:${context.operation}`;
    if (this.isCircuitOpen(circuitKey)) {
      throw new Error(`Circuit breaker open for ${circuitKey}`);
    }
    
    // Record failure
    this.recordFailure(circuitKey);
    
    // Get applicable strategies
    const strategies = this.getApplicableStrategies(context);
    
    // Try strategies in order
    for (const strategy of strategies) {
      try {
        this.logger.info({ 
          strategy: strategy.id,
          agent: context.originalAgent 
        }, 'Attempting fallback strategy');
        
        const result = await strategy.execute(context);
        
        // Record success
        this.recordSuccess(circuitKey);
        
        // Cache successful response
        this.cacheResponse(context, result);
        
        this.emit('fallback:success', {
          strategy: strategy.id,
          context
        });
        
        return result;
        
      } catch (error) {
        this.logger.warn({ 
          error,
          strategy: strategy.id 
        }, 'Fallback strategy failed');
        
        if (error instanceof Error && error.message === 'Retry original operation') {
          throw error; // Special case for retry strategy
        }
      }
    }
    
    // All strategies failed
    this.emit('fallback:exhausted', { context });
    throw new Error('All fallback strategies exhausted');
  }
  
  /**
   * Get applicable strategies for a context
   */
  private getApplicableStrategies(context: FallbackContext): FallbackStrategy[] {
    const strategies: FallbackStrategy[] = [];
    
    // Add agent-specific strategies
    const agentStrategies = this.strategies.get(context.originalAgent) || [];
    strategies.push(...agentStrategies.filter(s => s.condition(context.error)));
    
    // Add global strategies
    const globalStrategies = this.strategies.get('global') || [];
    strategies.push(...globalStrategies.filter(s => s.condition(context.error)));
    
    // Sort by priority
    return strategies.sort((a, b) => a.priority - b.priority);
  }
  
  /**
   * Find alternative agent with similar capabilities
   */
  private async findAlternativeAgent(
    originalAgentId: string,
    operation: string
  ): Promise<AgentCapabilitySummary | null> {
    const agents = await this.agentRegistry.getAllAgents();
    
    // Find agents with the required capability
    const capableAgents = agents.filter(agent => 
      agent.agentId !== originalAgentId &&
      agent.status === 'active' &&
      agent.tools.some(tool => tool.name === operation)
    );
    
    if (capableAgents.length === 0) {
      return null;
    }
    
    // Sort by performance
    capableAgents.sort((a, b) => 
      b.performance.successRate - a.performance.successRate
    );
    
    return capableAgents[0];
  }
  
  /**
   * Call alternative agent
   */
  private async callAlternativeAgent(
    agent: AgentCapabilitySummary,
    context: FallbackContext
  ): Promise<any> {
    // In a real implementation, this would call the agent
    // For now, we'll simulate it
    this.logger.info({ 
      agent: agent.agentId,
      operation: context.operation 
    }, 'Calling alternative agent');
    
    // Simulate agent call
    return {
      source: agent.agentId,
      fallback: true,
      data: context.inputs
    };
  }
  
  /**
   * Generate degraded response based on operation
   */
  private generateDegradedResponse(context: FallbackContext): any {
    const { operation, inputs } = context;
    
    // Operation-specific degraded responses
    switch (operation) {
      case 'get_current_weather':
        return {
          degraded: true,
          description: 'Weather data temporarily unavailable',
          temperature: 20,
          conditions: 'Unknown',
          lastKnown: new Date()
        };
        
      case 'get_tide_predictions':
        return {
          degraded: true,
          predictions: [],
          message: 'Tide data unavailable - check local sources'
        };
        
      case 'calculate_route':
        // Simple great circle route
        return {
          degraded: true,
          waypoints: [inputs.departure, inputs.destination],
          distance: this.estimateDistance(inputs.departure, inputs.destination),
          warning: 'Basic route only - verify with charts'
        };
        
      default:
        return {
          degraded: true,
          message: `${operation} temporarily unavailable`,
          timestamp: new Date()
        };
    }
  }
  
  /**
   * Estimate distance between two points
   */
  private estimateDistance(point1: any, point2: any): number {
    // Haversine formula
    const R = 3440.065; // Nautical miles
    const lat1 = point1.latitude * Math.PI / 180;
    const lat2 = point2.latitude * Math.PI / 180;
    const deltaLat = (point2.latitude - point1.latitude) * Math.PI / 180;
    const deltaLon = (point2.longitude - point1.longitude) * Math.PI / 180;
    
    const a = Math.sin(deltaLat/2) * Math.sin(deltaLat/2) +
              Math.cos(lat1) * Math.cos(lat2) *
              Math.sin(deltaLon/2) * Math.sin(deltaLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    
    return Math.round(R * c);
  }
  
  /**
   * Circuit breaker management
   */
  private isCircuitOpen(key: string): boolean {
    const breaker = this.circuitBreakers.get(key);
    if (!breaker) return false;
    
    if (breaker.state === CircuitState.OPEN) {
      // Check if reset timeout has passed
      const timeSinceFailure = Date.now() - breaker.lastFailureTime.getTime();
      if (timeSinceFailure > this.config.resetTimeout) {
        breaker.state = CircuitState.HALF_OPEN;
        breaker.successCount = 0;
      }
    }
    
    return breaker.state === CircuitState.OPEN;
  }
  
  private recordFailure(key: string) {
    let breaker = this.circuitBreakers.get(key);
    if (!breaker) {
      breaker = {
        state: CircuitState.CLOSED,
        failureCount: 0,
        lastFailureTime: new Date(),
        successCount: 0
      };
      this.circuitBreakers.set(key, breaker);
    }
    
    breaker.failureCount++;
    breaker.lastFailureTime = new Date();
    
    if (breaker.failureCount >= this.config.failureThreshold) {
      breaker.state = CircuitState.OPEN;
      this.logger.warn({ key }, 'Circuit breaker opened');
      this.emit('circuit:open', { key });
    }
  }
  
  private recordSuccess(key: string) {
    const breaker = this.circuitBreakers.get(key);
    if (!breaker) return;
    
    if (breaker.state === CircuitState.HALF_OPEN) {
      breaker.successCount++;
      if (breaker.successCount >= this.config.halfOpenRequests) {
        breaker.state = CircuitState.CLOSED;
        breaker.failureCount = 0;
        this.logger.info({ key }, 'Circuit breaker closed');
        this.emit('circuit:closed', { key });
      }
    } else if (breaker.state === CircuitState.CLOSED) {
      breaker.failureCount = Math.max(0, breaker.failureCount - 1);
    }
  }
  
  /**
   * Cache management
   */
  private getCacheKey(context: FallbackContext): string {
    return `${context.originalAgent}:${context.operation}:${JSON.stringify(context.inputs)}`;
  }
  
  private cacheResponse(context: FallbackContext, response: any) {
    const key = this.getCacheKey(context);
    const ttl = this.getCacheTTL(context.operation);
    
    this.cachedResponses.set(key, {
      data: response,
      expiry: Date.now() + ttl
    });
    
    // Clean old cache entries
    this.cleanCache();
  }
  
  private getCacheTTL(operation: string): number {
    // Operation-specific TTLs
    const ttls: Record<string, number> = {
      'get_current_weather': 300000, // 5 minutes
      'get_tide_predictions': 3600000, // 1 hour
      'get_port_info': 86400000, // 24 hours
      'calculate_route': 1800000, // 30 minutes
    };
    
    return ttls[operation] || 600000; // Default 10 minutes
  }
  
  private cleanCache() {
    const now = Date.now();
    for (const [key, value] of this.cachedResponses.entries()) {
      if (value.expiry < now) {
        this.cachedResponses.delete(key);
      }
    }
  }
  
  /**
   * Helper function
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * Get circuit breaker status
   */
  getCircuitStatus(): Map<string, CircuitBreaker> {
    return new Map(this.circuitBreakers);
  }
} 