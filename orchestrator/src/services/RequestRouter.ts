// orchestrator/src/services/RequestRouter.ts

import { Logger } from 'pino';
import { AgentRegistry } from './AgentRegistry';
import { 
  OrchestrationPlan, 
  OrchestrationStep,
  FallbackStrategy,
  AgentCapabilitySummary 
} from '@passage-planner/shared/types/core';

interface RequestAnalysis {
  prompt: string;
  context: any;
}

export class RequestRouter {
  constructor(
    private agentRegistry: AgentRegistry,
    private logger: Logger
  ) {}
  
  async analyzeRequest(analysis: RequestAnalysis): Promise<OrchestrationPlan> {
    const { prompt, context } = analysis;
    
    this.logger.info({ prompt }, 'Analyzing request');
    
    // Determine required capabilities based on the request
    const requiredCapabilities = this.extractRequiredCapabilities(prompt, context);
    
    // Find agents that can fulfill these capabilities
    const availableAgents = await this.findAvailableAgents(requiredCapabilities);
    
    // Create orchestration plan
    const plan = this.createOrchestrationPlan(
      prompt,
      requiredCapabilities,
      availableAgents,
      context
    );
    
    this.logger.info({ planId: plan.id, steps: plan.steps.length }, 'Orchestration plan created');
    
    return plan;
  }
  
  private extractRequiredCapabilities(prompt: string, context: any): string[] {
    const capabilities: string[] = [];
    
    // Analyze prompt for passage planning
    if (prompt.includes('passage') || prompt.includes('route') || prompt.includes('sail')) {
      capabilities.push('route_calculation');
      capabilities.push('get_port_info');
      capabilities.push('get_marine_forecast');
      capabilities.push('get_tidal_predictions');
      capabilities.push('get_wind_forecast');
      capabilities.push('get_safety_warnings');
    }
    
    // Weather-specific requests
    if (prompt.includes('weather') || prompt.includes('forecast')) {
      capabilities.push('get_current_weather');
      capabilities.push('get_marine_forecast');
      capabilities.push('get_wind_forecast');
    }
    
    // Tide-specific requests
    if (prompt.includes('tide') || prompt.includes('tidal')) {
      capabilities.push('get_tidal_predictions');
      capabilities.push('get_current_predictions');
    }
    
    // Port-specific requests
    if (prompt.includes('port') || prompt.includes('marina') || prompt.includes('harbor')) {
      capabilities.push('get_port_info');
      capabilities.push('get_marina_facilities');
    }
    
    // Safety-specific requests
    if (prompt.includes('safety') || prompt.includes('emergency')) {
      capabilities.push('get_safety_warnings');
      capabilities.push('get_emergency_contacts');
    }
    
    return [...new Set(capabilities)]; // Remove duplicates
  }
  
  private async findAvailableAgents(capabilities: string[]): Promise<Map<string, AgentCapabilitySummary[]>> {
    const agentMap = new Map<string, AgentCapabilitySummary[]>();
    
    for (const capability of capabilities) {
      const agents = await this.agentRegistry.getAgentsByCapability(capability);
      agentMap.set(capability, agents);
    }
    
    return agentMap;
  }
  
  private createOrchestrationPlan(
    prompt: string,
    capabilities: string[],
    availableAgents: Map<string, AgentCapabilitySummary[]>,
    context: any
  ): OrchestrationPlan {
    const planId = `plan-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const steps: OrchestrationStep[] = [];
    const requiredAgents: string[] = [];
    const fallbackStrategies: FallbackStrategy[] = [];
    
    // For passage planning, create a specific sequence of steps
    if (capabilities.includes('route_calculation')) {
      // Step 1: Get port information
      const portAgents = availableAgents.get('get_port_info') || [];
      if (portAgents.length > 0) {
        const portAgent = portAgents[0];
        requiredAgents.push(portAgent.agentId);
        
        steps.push({
          id: 'step-1-departure-port',
          agentId: portAgent.agentId,
          operation: 'get_port_info',
          dependencies: [],
          arguments: {
            portName: context.departure,
          },
          timeout: 10000,
          retries: 2,
        });
        
        steps.push({
          id: 'step-2-destination-port',
          agentId: portAgent.agentId,
          operation: 'get_port_info',
          dependencies: [],
          arguments: {
            portName: context.destination,
          },
          timeout: 10000,
          retries: 2,
        });
      }
      
      // Step 2: Calculate route
      const routeAgents = availableAgents.get('route_calculation') || [];
      if (routeAgents.length > 0) {
        const routeAgent = routeAgents[0];
        requiredAgents.push(routeAgent.agentId);
        
        steps.push({
          id: 'step-3-route',
          agentId: routeAgent.agentId,
          operation: 'route_calculation',
          dependencies: ['step-1-departure-port', 'step-2-destination-port'],
          arguments: {
            departure: context.departure,
            destination: context.destination,
            departureTime: context.departure_time,
            boatType: context.boat_type,
            preferences: context.preferences,
          },
          timeout: 20000,
          retries: 2,
        });
      }
      
      // Step 3: Get weather along route
      const weatherAgents = availableAgents.get('get_marine_forecast') || [];
      if (weatherAgents.length > 0) {
        const weatherAgent = weatherAgents[0];
        requiredAgents.push(weatherAgent.agentId);
        
        steps.push({
          id: 'step-4-weather',
          agentId: weatherAgent.agentId,
          operation: 'get_marine_forecast',
          dependencies: ['step-3-route'],
          arguments: {
            routeId: '${step-3-route.result.id}',
            days: 7,
          },
          timeout: 15000,
          retries: 2,
        });
        
        // Add fallback for weather
        if (weatherAgents.length > 1) {
          fallbackStrategies.push({
            condition: 'error',
            agentId: weatherAgent.agentId,
            alternativeAgent: weatherAgents[1].agentId,
          });
        }
      }
      
      // Step 4: Get wind forecast
      const windAgents = availableAgents.get('get_wind_forecast') || [];
      if (windAgents.length > 0) {
        const windAgent = windAgents[0];
        requiredAgents.push(windAgent.agentId);
        
        steps.push({
          id: 'step-5-wind',
          agentId: windAgent.agentId,
          operation: 'get_wind_forecast',
          dependencies: ['step-3-route'],
          arguments: {
            routeId: '${step-3-route.result.id}',
            days: 7,
          },
          timeout: 10000,
          retries: 2,
        });
      }
      
      // Step 5: Get tidal information
      const tidalAgents = availableAgents.get('get_tidal_predictions') || [];
      if (tidalAgents.length > 0) {
        const tidalAgent = tidalAgents[0];
        requiredAgents.push(tidalAgent.agentId);
        
        steps.push({
          id: 'step-6-tides',
          agentId: tidalAgent.agentId,
          operation: 'get_tidal_predictions',
          dependencies: ['step-1-departure-port', 'step-2-destination-port'],
          arguments: {
            locations: ['${step-1-departure-port.result}', '${step-2-destination-port.result}'],
            timeRange: {
              start: context.departure_time,
              days: 7,
            },
          },
          timeout: 10000,
          retries: 2,
        });
      }
      
      // Step 6: Get safety information
      const safetyAgents = availableAgents.get('get_safety_warnings') || [];
      if (safetyAgents.length > 0) {
        const safetyAgent = safetyAgents[0];
        requiredAgents.push(safetyAgent.agentId);
        
        steps.push({
          id: 'step-7-safety',
          agentId: safetyAgent.agentId,
          operation: 'get_safety_warnings',
          dependencies: ['step-3-route'],
          arguments: {
            routeId: '${step-3-route.result.id}',
            region: '${step-3-route.result.region}',
          },
          timeout: 10000,
          retries: 2,
        });
      }
    }
    
    // Calculate estimated duration
    const estimatedDuration = steps.reduce((total, step) => total + step.timeout, 0);
    
    return {
      id: planId,
      userPrompt: prompt,
      requiredAgents: [...new Set(requiredAgents)],
      steps,
      estimatedDuration,
      fallbackStrategies,
    };
  }
  
  async routeToAgent(agentId: string, operation: string): Promise<AgentCapabilitySummary | null> {
    const agent = await this.agentRegistry.getAgent(agentId);
    
    if (!agent) {
      this.logger.warn({ agentId }, 'Agent not found');
      return null;
    }
    
    // Verify agent has the requested capability
    const hasCapability = 
      agent.tools.some(t => t.name === operation) ||
      agent.resources.some(r => r.name === operation) ||
      agent.prompts.some(p => p.name === operation);
    
    if (!hasCapability) {
      this.logger.warn({ agentId, operation }, 'Agent does not have requested capability');
      return null;
    }
    
    if (agent.status !== 'active' && agent.status !== 'idle') {
      this.logger.warn({ agentId, status: agent.status }, 'Agent is not available');
      return null;
    }
    
    return agent;
  }
  
  async handleFailure(agentId: string, error: Error): Promise<void> {
    this.logger.error({ agentId, error }, 'Agent request failed');
    
    // Update agent metrics
    await this.agentRegistry.updateAgentHealth(agentId, {
      healthy: false,
      lastError: error.message,
      successRate: 0.9, // Decrease success rate
    });
    
    // If multiple failures, mark agent as error
    // This would be more sophisticated in production
    const agent = await this.agentRegistry.getAgent(agentId);
    if (agent && agent.performance.successRate < 0.5) {
      await this.agentRegistry.updateAgentStatus(agentId, 'error');
    }
  }
} 