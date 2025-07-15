import { Logger } from 'pino';
import { AgentRegistry } from './AgentRegistry';
import { OrchestrationPlan, OrchestrationStep, FallbackStrategy } from '@passage-planner/shared';

export class RequestRouter {
  constructor(
    private agentRegistry: AgentRegistry,
    private logger: Logger
  ) {}
  
  async analyzeRequest(request: { prompt: string; context?: any }): Promise<OrchestrationPlan> {
    this.logger.info({ prompt: request.prompt }, 'Analyzing request');
    
    // Analyze the prompt to determine required agents
    const requiredAgents = this.determineRequiredAgents(request.prompt);
    
    // Create orchestration steps
    const steps = await this.createOrchestrationSteps(requiredAgents, request);
    
    // Define fallback strategies
    const fallbackStrategies = this.createFallbackStrategies(requiredAgents);
    
    const plan: OrchestrationPlan = {
      id: `plan-${Date.now()}`,
      userPrompt: request.prompt,
      requiredAgents,
      steps,
      estimatedDuration: this.estimateDuration(steps),
      fallbackStrategies
    };
    
    this.logger.info({ planId: plan.id, agentCount: requiredAgents.length }, 'Orchestration plan created');
    
    return plan;
  }
  
  private determineRequiredAgents(prompt: string): string[] {
    const agents: string[] = [];
    const promptLower = prompt.toLowerCase();
    
    // Always need route agent for passage planning
    if (promptLower.includes('passage') || promptLower.includes('route') || promptLower.includes('sail')) {
      agents.push('route-agent');
    }
    
    // Weather is almost always needed
    if (promptLower.includes('weather') || promptLower.includes('forecast') || agents.includes('route-agent')) {
      agents.push('weather-agent');
    }
    
    // Wind for sailing
    if (promptLower.includes('wind') || promptLower.includes('sail')) {
      agents.push('wind-agent');
    }
    
    // Tidal information
    if (promptLower.includes('tide') || promptLower.includes('current') || agents.includes('route-agent')) {
      agents.push('tidal-agent');
    }
    
    // Port information
    if (promptLower.includes('port') || promptLower.includes('harbor') || promptLower.includes('marina') || agents.includes('route-agent')) {
      agents.push('port-agent');
    }
    
    // Safety briefing
    if (promptLower.includes('safety') || promptLower.includes('emergency') || agents.includes('route-agent')) {
      agents.push('safety-agent');
    }
    
    return [...new Set(agents)]; // Remove duplicates
  }
  
  private async createOrchestrationSteps(
    requiredAgents: string[], 
    request: { prompt: string; context?: any }
  ): Promise<OrchestrationStep[]> {
    const steps: OrchestrationStep[] = [];
    let stepIndex = 0;
    
    // Port information first (needed for coordinates)
    if (requiredAgents.includes('port-agent')) {
      steps.push({
        id: `step-${stepIndex++}`,
        agentId: 'port-agent',
        operation: 'get_port_info',
        dependencies: [],
        arguments: {
          departure: request.context?.departure,
          destination: request.context?.destination
        },
        timeout: 10000,
        retries: 2
      });
    }
    
    // Route calculation (depends on ports)
    if (requiredAgents.includes('route-agent')) {
      steps.push({
        id: `step-${stepIndex++}`,
        agentId: 'route-agent',
        operation: 'calculate_route',
        dependencies: requiredAgents.includes('port-agent') ? ['step-0'] : [],
        arguments: {
          departure: request.context?.departure,
          destination: request.context?.destination,
          departureTime: request.context?.departure_time,
          boatType: request.context?.boat_type
        },
        timeout: 15000,
        retries: 2
      });
    }
    
    // Weather along route (depends on route)
    if (requiredAgents.includes('weather-agent')) {
      steps.push({
        id: `step-${stepIndex++}`,
        agentId: 'weather-agent',
        operation: 'get_route_weather',
        dependencies: requiredAgents.includes('route-agent') ? [`step-${stepIndex-2}`] : [],
        arguments: {
          routeId: 'from-previous-step',
          days: 7
        },
        timeout: 20000,
        retries: 3
      });
    }
    
    // Wind conditions (can run in parallel with weather)
    if (requiredAgents.includes('wind-agent')) {
      steps.push({
        id: `step-${stepIndex++}`,
        agentId: 'wind-agent',
        operation: 'get_wind_forecast',
        dependencies: requiredAgents.includes('route-agent') ? [`step-1`] : [],
        arguments: {
          routeId: 'from-previous-step',
          days: 7
        },
        timeout: 15000,
        retries: 2
      });
    }
    
    // Tidal information (can run in parallel)
    if (requiredAgents.includes('tidal-agent')) {
      steps.push({
        id: `step-${stepIndex++}`,
        agentId: 'tidal-agent',
        operation: 'get_tide_predictions',
        dependencies: requiredAgents.includes('port-agent') ? ['step-0'] : [],
        arguments: {
          locations: 'from-route',
          days: 7
        },
        timeout: 15000,
        retries: 2
      });
    }
    
    // Safety briefing (depends on everything)
    if (requiredAgents.includes('safety-agent')) {
      const dependencies = steps.map(s => s.id);
      steps.push({
        id: `step-${stepIndex++}`,
        agentId: 'safety-agent',
        operation: 'generate_safety_briefing',
        dependencies: dependencies.slice(0, -1), // All previous steps
        arguments: {
          route: 'from-route-agent',
          weather: 'from-weather-agent',
          ports: 'from-port-agent'
        },
        timeout: 10000,
        retries: 2
      });
    }
    
    return steps;
  }
  
  private createFallbackStrategies(requiredAgents: string[]): FallbackStrategy[] {
    const strategies: FallbackStrategy[] = [];
    
    // Weather fallbacks
    if (requiredAgents.includes('weather-agent')) {
      strategies.push({
        condition: 'agent_unavailable',
        agentId: 'weather-agent',
        alternativeAgent: 'wind-agent', // Wind agent can provide basic weather
        degradedResponse: {
          warning: 'Detailed weather unavailable, using basic forecast'
        }
      });
    }
    
    // Tidal fallbacks
    if (requiredAgents.includes('tidal-agent')) {
      strategies.push({
        condition: 'error',
        agentId: 'tidal-agent',
        degradedResponse: {
          warning: 'Tidal data unavailable, plan for all tide conditions'
        }
      });
    }
    
    // General timeout strategy
    strategies.push({
      condition: 'timeout',
      agentId: '*',
      degradedResponse: {
        warning: 'Some data may be incomplete due to timeout'
      }
    });
    
    return strategies;
  }
  
  private estimateDuration(steps: OrchestrationStep[]): number {
    // Sum of all timeouts plus some overhead
    const totalTimeout = steps.reduce((sum, step) => sum + step.timeout, 0);
    return totalTimeout + 5000; // Add 5 seconds overhead
  }
} 