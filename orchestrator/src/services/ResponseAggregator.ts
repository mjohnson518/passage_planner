import { Logger } from 'pino';
import { AgentResponse, OrchestrationPlan, PassagePlan } from '@passage-planner/shared';

export class ResponseAggregator {
  constructor(private logger: Logger) {}
  
  async aggregate(responses: AgentResponse[], plan: OrchestrationPlan): Promise<any> {
    this.logger.info({ responseCount: responses.length }, 'Aggregating responses');
    
    // Group responses by agent
    const responsesByAgent = new Map<string, AgentResponse>();
    for (const response of responses) {
      responsesByAgent.set(response.source, response);
    }
    
    // Extract data from each agent
    const portData = this.extractPortData(responsesByAgent.get('port-agent'));
    const routeData = this.extractRouteData(responsesByAgent.get('route-agent'));
    const weatherData = this.extractWeatherData(responsesByAgent.get('weather-agent'));
    const windData = this.extractWindData(responsesByAgent.get('wind-agent'));
    const tidalData = this.extractTidalData(responsesByAgent.get('tidal-agent'));
    const safetyData = this.extractSafetyData(responsesByAgent.get('safety-agent'));
    
    // Combine into passage plan
    const passagePlan: Partial<PassagePlan> = {
      id: `passage-${Date.now()}`,
      departure: portData?.departure || { id: '', name: plan.userPrompt.split('from')[1]?.split('to')[0]?.trim() || '', coordinates: { latitude: 0, longitude: 0 }, country: '', facilities: [], contacts: [] },
      destination: portData?.destination || { id: '', name: plan.userPrompt.split('to')[1]?.trim() || '', coordinates: { latitude: 0, longitude: 0 }, country: '', facilities: [], contacts: [] },
      waypoints: routeData?.waypoints || [],
      departureTime: new Date(),
      estimatedArrivalTime: routeData?.estimatedArrival || new Date(),
      distance: routeData?.distance || { total: 0, unit: 'nm' },
      weather: weatherData || { conditions: [], warnings: [], lastUpdated: new Date() },
      tides: tidalData || [],
      safety: safetyData || { emergencyContacts: [], hazards: [], requiredEquipment: [], weatherWindows: [] },
      alternativeRoutes: routeData?.alternatives || []
    };
    
    // Add performance metrics
    const performanceMetrics = {
      totalDuration: responses.reduce((sum, r) => sum + (r.performance?.duration || 0), 0),
      agentPerformance: responses.map(r => ({
        agent: r.source,
        duration: r.performance?.duration || 0,
        status: r.status
      }))
    };
    
    return {
      passagePlan,
      performanceMetrics,
      warnings: this.collectWarnings(responses)
    };
  }
  
  private extractPortData(response?: AgentResponse): any {
    if (!response || response.status !== 'success') return null;
    return response.data;
  }
  
  private extractRouteData(response?: AgentResponse): any {
    if (!response || response.status !== 'success') return null;
    return response.data;
  }
  
  private extractWeatherData(response?: AgentResponse): any {
    if (!response || response.status !== 'success') return null;
    return response.data;
  }
  
  private extractWindData(response?: AgentResponse): any {
    if (!response || response.status !== 'success') return null;
    return response.data;
  }
  
  private extractTidalData(response?: AgentResponse): any {
    if (!response || response.status !== 'success') return null;
    return response.data;
  }
  
  private extractSafetyData(response?: AgentResponse): any {
    if (!response || response.status !== 'success') return null;
    return response.data;
  }
  
  private collectWarnings(responses: AgentResponse[]): string[] {
    const warnings: string[] = [];
    
    for (const response of responses) {
      if (response.status === 'error' || response.status === 'partial') {
        warnings.push(`${response.source}: ${response.error?.message || 'Partial data available'}`);
      }
      
      // Extract warnings from successful responses too
      if (response.data?.warnings) {
        warnings.push(...response.data.warnings);
      }
    }
    
    return warnings;
  }
} 