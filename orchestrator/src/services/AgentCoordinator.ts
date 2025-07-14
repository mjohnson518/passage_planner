// orchestrator/src/services/AgentCoordinator.ts
// Agent Coordinator - Manages complex multi-agent workflows with dependencies

import { EventEmitter } from 'events';
import pino, { Logger } from 'pino';
import { 
  AgentRequest, 
  AgentResponse, 
  OrchestrationPlan, 
  OrchestrationStep,
  AgentCapabilitySummary 
} from '@passage-planner/shared/types/core';
import { AgentRegistry } from './AgentRegistry';
import axios from 'axios';

export interface WorkflowDefinition {
  id: string;
  name: string;
  description: string;
  steps: WorkflowStep[];
  timeout?: number;
  retryPolicy?: RetryPolicy;
}

export interface WorkflowStep {
  id: string;
  agentId: string;
  operation: string;
  dependencies: string[]; // Step IDs this step depends on
  inputs: Record<string, any>;
  transform?: (data: any) => any; // Transform function for output
  fallback?: WorkflowStep; // Fallback step if this fails
  parallel?: boolean; // Can run in parallel with dependencies met
  condition?: (context: WorkflowContext) => boolean; // Conditional execution
}

export interface RetryPolicy {
  maxAttempts: number;
  backoffMultiplier: number;
  initialDelay: number;
  maxDelay: number;
}

export interface WorkflowContext {
  workflowId: string;
  startTime: Date;
  results: Map<string, any>;
  errors: Map<string, Error>;
  metadata: Record<string, any>;
}

export class AgentCoordinator extends EventEmitter {
  private logger: Logger;
  private agentRegistry: AgentRegistry;
  private activeWorkflows = new Map<string, WorkflowContext>();
  private workflowDefinitions = new Map<string, WorkflowDefinition>();
  
  constructor(agentRegistry: AgentRegistry, logger: Logger) {
    super();
    this.agentRegistry = agentRegistry;
    this.logger = logger.child({ service: 'AgentCoordinator' });
    this.initializeWorkflows();
  }
  
  /**
   * Initialize predefined workflows
   */
  private initializeWorkflows() {
    // Passage Planning Workflow
    this.registerWorkflow({
      id: 'passage-planning',
      name: 'Passage Planning',
      description: 'Complete passage planning workflow',
      steps: [
        {
          id: 'get-ports',
          agentId: 'port-agent',
          operation: 'get_port_info',
          dependencies: [],
          inputs: {},
          parallel: true
        },
        {
          id: 'calculate-route',
          agentId: 'route-agent',
          operation: 'calculate_route',
          dependencies: ['get-ports'],
          inputs: {},
          transform: (data) => ({
            ...data,
            optimized: true
          })
        },
        {
          id: 'get-weather',
          agentId: 'weather-agent',
          operation: 'get_marine_forecast',
          dependencies: ['calculate-route'],
          inputs: {},
          parallel: true
        },
        {
          id: 'get-wind',
          agentId: 'wind-agent',
          operation: 'get_wind_forecast',
          dependencies: ['calculate-route'],
          inputs: {},
          parallel: true
        },
        {
          id: 'get-tides',
          agentId: 'tidal-agent',
          operation: 'get_tide_predictions',
          dependencies: ['get-ports'],
          inputs: {},
          parallel: true
        },
        {
          id: 'safety-check',
          agentId: 'safety-agent',
          operation: 'get_safety_warnings',
          dependencies: ['calculate-route'],
          inputs: {},
          parallel: true
        }
      ],
      timeout: 30000,
      retryPolicy: {
        maxAttempts: 3,
        backoffMultiplier: 2,
        initialDelay: 1000,
        maxDelay: 10000
      }
    });
    
    // Weather Briefing Workflow
    this.registerWorkflow({
      id: 'weather-briefing',
      name: 'Weather Briefing',
      description: 'Comprehensive weather analysis',
      steps: [
        {
          id: 'current-weather',
          agentId: 'weather-agent',
          operation: 'get_current_weather',
          dependencies: [],
          inputs: {},
          parallel: true
        },
        {
          id: 'marine-forecast',
          agentId: 'weather-agent',
          operation: 'get_marine_forecast',
          dependencies: [],
          inputs: {},
          parallel: true
        },
        {
          id: 'wind-analysis',
          agentId: 'wind-agent',
          operation: 'get_wind_patterns',
          dependencies: [],
          inputs: {},
          parallel: true
        },
        {
          id: 'storm-check',
          agentId: 'weather-agent',
          operation: 'get_storm_warnings',
          dependencies: [],
          inputs: {},
          parallel: true
        }
      ]
    });
  }
  
  /**
   * Register a workflow definition
   */
  registerWorkflow(workflow: WorkflowDefinition) {
    this.workflowDefinitions.set(workflow.id, workflow);
    this.logger.info({ workflowId: workflow.id }, 'Registered workflow');
  }
  
  /**
   * Execute a workflow
   */
  async executeWorkflow(workflowId: string, inputs: Record<string, any>): Promise<WorkflowContext> {
    const workflow = this.workflowDefinitions.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow ${workflowId} not found`);
    }
    
    const context: WorkflowContext = {
      workflowId: `${workflowId}-${Date.now()}`,
      startTime: new Date(),
      results: new Map(),
      errors: new Map(),
      metadata: { inputs }
    };
    
    this.activeWorkflows.set(context.workflowId, context);
    this.emit('workflow:started', { workflowId: context.workflowId });
    
    try {
      // Build execution plan
      const executionPlan = this.buildExecutionPlan(workflow, context);
      
      // Execute steps according to plan
      await this.executeSteps(executionPlan, context, workflow);
      
      this.emit('workflow:completed', { 
        workflowId: context.workflowId,
        duration: Date.now() - context.startTime.getTime()
      });
      
      return context;
      
    } catch (error) {
      this.logger.error({ error, workflowId: context.workflowId }, 'Workflow execution failed');
      this.emit('workflow:failed', { 
        workflowId: context.workflowId,
        error 
      });
      throw error;
    } finally {
      this.activeWorkflows.delete(context.workflowId);
    }
  }
  
  /**
   * Build execution plan with dependency resolution
   */
  private buildExecutionPlan(workflow: WorkflowDefinition, context: WorkflowContext): WorkflowStep[][] {
    const plan: WorkflowStep[][] = [];
    const completed = new Set<string>();
    const remaining = new Set(workflow.steps.map(s => s.id));
    
    while (remaining.size > 0) {
      const batch: WorkflowStep[] = [];
      
      for (const step of workflow.steps) {
        if (remaining.has(step.id)) {
          // Check if all dependencies are completed
          const depsCompleted = step.dependencies.every(dep => completed.has(dep));
          
          // Check condition if exists
          const conditionMet = !step.condition || step.condition(context);
          
          if (depsCompleted && conditionMet) {
            batch.push(step);
            if (!step.parallel) {
              // Non-parallel steps go alone in their batch
              break;
            }
          }
        }
      }
      
      if (batch.length === 0 && remaining.size > 0) {
        throw new Error('Circular dependency detected in workflow');
      }
      
      // Mark batch as completed for next iteration
      batch.forEach(step => {
        completed.add(step.id);
        remaining.delete(step.id);
      });
      
      if (batch.length > 0) {
        plan.push(batch);
      }
    }
    
    return plan;
  }
  
  /**
   * Execute steps according to plan
   */
  private async executeSteps(
    plan: WorkflowStep[][], 
    context: WorkflowContext,
    workflow: WorkflowDefinition
  ) {
    for (const batch of plan) {
      this.logger.info({ 
        steps: batch.map(s => s.id),
        parallel: batch.length > 1 
      }, 'Executing step batch');
      
      if (batch.length === 1) {
        // Execute single step
        await this.executeStep(batch[0], context, workflow.retryPolicy);
      } else {
        // Execute parallel steps
        await Promise.all(
          batch.map(step => this.executeStep(step, context, workflow.retryPolicy))
        );
      }
    }
  }
  
  /**
   * Execute a single workflow step
   */
  private async executeStep(
    step: WorkflowStep, 
    context: WorkflowContext,
    retryPolicy?: RetryPolicy
  ) {
    this.emit('step:started', { 
      workflowId: context.workflowId,
      stepId: step.id 
    });
    
    try {
      // Get agent info
      const agent = await this.agentRegistry.getAgent(step.agentId);
      if (!agent) {
        throw new Error(`Agent ${step.agentId} not found`);
      }
      
      // Prepare inputs with dependency results
      const inputs = this.prepareStepInputs(step, context);
      
      // Execute with retry
      const result = await this.executeWithRetry(
        () => this.callAgent(agent, step.operation, inputs),
        retryPolicy
      );
      
      // Transform result if needed
      const finalResult = step.transform ? step.transform(result) : result;
      
      // Store result
      context.results.set(step.id, finalResult);
      
      this.emit('step:completed', { 
        workflowId: context.workflowId,
        stepId: step.id,
        result: finalResult
      });
      
    } catch (error) {
      this.logger.error({ error, stepId: step.id }, 'Step execution failed');
      context.errors.set(step.id, error as Error);
      
      // Try fallback if available
      if (step.fallback) {
        this.logger.info({ stepId: step.id }, 'Executing fallback step');
        await this.executeStep(step.fallback, context, retryPolicy);
      } else {
        this.emit('step:failed', { 
          workflowId: context.workflowId,
          stepId: step.id,
          error 
        });
        throw error;
      }
    }
  }
  
  /**
   * Prepare inputs for a step using dependency results
   */
  private prepareStepInputs(step: WorkflowStep, context: WorkflowContext): Record<string, any> {
    const inputs = { ...step.inputs };
    
    // Add results from dependencies
    for (const depId of step.dependencies) {
      const depResult = context.results.get(depId);
      if (depResult) {
        inputs[`${depId}_result`] = depResult;
      }
    }
    
    // Add original workflow inputs
    if (context.metadata.inputs) {
      inputs.workflow_inputs = context.metadata.inputs;
    }
    
    return inputs;
  }
  
  /**
   * Call an agent with operation
   */
  private async callAgent(
    agent: AgentCapabilitySummary,
    operation: string,
    inputs: Record<string, any>
  ): Promise<any> {
    // Extract base URL from health endpoint
    const baseUrl = agent.healthEndpoint.replace('/health', '');
    
    const response = await axios.post(
      `${baseUrl}/tools/${operation}`,
      inputs,
      {
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
    
    return response.data;
  }
  
  /**
   * Execute with retry policy
   */
  private async executeWithRetry<T>(
    fn: () => Promise<T>,
    retryPolicy?: RetryPolicy
  ): Promise<T> {
    const policy = retryPolicy || {
      maxAttempts: 3,
      backoffMultiplier: 2,
      initialDelay: 1000,
      maxDelay: 10000
    };
    
    let lastError: Error | undefined;
    let delay = policy.initialDelay;
    
    for (let attempt = 1; attempt <= policy.maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;
        
        if (attempt < policy.maxAttempts) {
          this.logger.warn({ 
            error, 
            attempt, 
            nextDelay: delay 
          }, 'Retrying after error');
          
          await this.sleep(delay);
          delay = Math.min(delay * policy.backoffMultiplier, policy.maxDelay);
        }
      }
    }
    
    throw lastError;
  }
  
  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * Get active workflows
   */
  getActiveWorkflows(): WorkflowContext[] {
    return Array.from(this.activeWorkflows.values());
  }
  
  /**
   * Cancel a workflow
   */
  cancelWorkflow(workflowId: string) {
    const context = this.activeWorkflows.get(workflowId);
    if (context) {
      this.activeWorkflows.delete(workflowId);
      this.emit('workflow:cancelled', { workflowId });
    }
  }
} 