// orchestrator/src/services/ResponseAggregator.ts

import { Logger } from 'pino';
import { 
  AgentResponse, 
  OrchestrationPlan,
  PassagePlan,
  Port,
  Route,
  WeatherSummary,
  TidalSummary,
  SafetyBriefing,
  Waypoint
} from '@passage-planner/shared/types/core';

export class ResponseAggregator {
  constructor(private logger: Logger) {}
  
  async aggregate(responses: AgentResponse[], plan: OrchestrationPlan): Promise<any> {
    this.logger.info({ responseCount: responses.length }, 'Aggregating responses');
    
    // Group responses by step ID
    const responseMap = new Map<string, AgentResponse>();
    for (const response of responses) {
      const stepId = response.requestId.split('-').slice(-1)[0];
      responseMap.set(stepId, response);
    }
    
    // Check if this is a passage planning request
    if (plan.userPrompt.includes('passage') || plan.userPrompt.includes('route')) {
      return this.aggregatePassagePlan(responseMap, plan);
    }
    
    // Generic aggregation for other request types
    return this.genericAggregation(responseMap, plan);
  }
  
  private aggregatePassagePlan(
    responses: Map<string, AgentResponse>, 
    plan: OrchestrationPlan
  ): PassagePlan {
    // Extract data from responses
    const departurePortResponse = this.findResponse(responses, 'departure-port');
    const destinationPortResponse = this.findResponse(responses, 'destination-port');
    const routeResponse = this.findResponse(responses, 'route');
    const weatherResponse = this.findResponse(responses, 'weather');
    const windResponse = this.findResponse(responses, 'wind');
    const tidalResponse = this.findResponse(responses, 'tides');
    const safetyResponse = this.findResponse(responses, 'safety');
    
    // Build departure port
    const departurePort: Port = departurePortResponse?.data || {
      id: 'unknown',
      name: plan.steps[0]?.arguments.portName || 'Unknown',
      coordinates: { latitude: 0, longitude: 0 },
      country: 'Unknown',
      facilities: [],
      contacts: [],
    };
    
    // Build destination port
    const destinationPort: Port = destinationPortResponse?.data || {
      id: 'unknown',
      name: plan.steps[1]?.arguments.portName || 'Unknown',
      coordinates: { latitude: 0, longitude: 0 },
      country: 'Unknown',
      facilities: [],
      contacts: [],
    };
    
    // Build route
    const routeData = routeResponse?.data || {};
    const waypoints: Waypoint[] = routeData.waypoints || [];
    const distance = routeData.distance || { total: 0, unit: 'nm' };
    const estimatedDuration = routeData.estimatedDuration || 0;
    
    // Build weather summary
    const weatherSummary: WeatherSummary = this.buildWeatherSummary(
      weatherResponse?.data,
      windResponse?.data
    );
    
    // Build tidal summaries
    const tidalSummaries: TidalSummary[] = tidalResponse?.data || [];
    
    // Build safety briefing
    const safetyBriefing: SafetyBriefing = safetyResponse?.data || {
      emergencyContacts: [],
      hazards: [],
      requiredEquipment: this.getRequiredEquipment(distance.total),
      weatherWindows: [],
    };
    
    // Calculate arrival time
    const departureTime = new Date(routeData.departureTime || Date.now());
    const estimatedArrivalTime = new Date(departureTime.getTime() + estimatedDuration * 3600 * 1000);
    
    // Build alternative routes if available
    const alternativeRoutes: Route[] = routeData.alternatives || [];
    
    // Create passage plan
    const passagePlan: PassagePlan = {
      id: `passage-${Date.now()}`,
      departure: departurePort,
      destination: destinationPort,
      waypoints,
      departureTime,
      estimatedArrivalTime,
      distance,
      weather: weatherSummary,
      tides: tidalSummaries,
      safety: safetyBriefing,
      alternativeRoutes,
    };
    
    this.logger.info({ planId: passagePlan.id }, 'Passage plan aggregated');
    
    return passagePlan;
  }
  
  private findResponse(responses: Map<string, AgentResponse>, keyword: string): AgentResponse | undefined {
    for (const [stepId, response] of responses) {
      if (stepId.includes(keyword)) {
        return response;
      }
    }
    return undefined;
  }
  
  private buildWeatherSummary(weatherData: any, windData: any): WeatherSummary {
    const conditions = [];
    const warnings = [];
    
    // Process weather data
    if (weatherData?.periods) {
      for (const period of weatherData.periods) {
        conditions.push({
          timeWindow: {
            start: new Date(period.startTime),
            end: new Date(period.endTime),
          },
          description: period.shortForecast || period.detailedForecast,
          windSpeed: this.parseWindSpeed(period.windSpeed),
          windDirection: period.windDirection,
          waveHeight: this.parseWaveHeight(period.waveHeight),
          visibility: period.visibility || 10,
          precipitation: period.precipitationProbability || 0,
        });
        
        // Extract warnings
        if (period.hazards) {
          warnings.push(...period.hazards);
        }
      }
    }
    
    // Merge wind data if available
    if (windData?.forecasts) {
      // Enhance weather conditions with detailed wind data
      for (const windForecast of windData.forecasts) {
        const matchingCondition = conditions.find(c => 
          c.timeWindow.start <= new Date(windForecast.time) &&
          c.timeWindow.end >= new Date(windForecast.time)
        );
        
        if (matchingCondition) {
          matchingCondition.windSpeed = windForecast.speed || matchingCondition.windSpeed;
          matchingCondition.windDirection = windForecast.direction || matchingCondition.windDirection;
          
          if (windForecast.gusts > 30) {
            warnings.push(`High wind gusts up to ${windForecast.gusts} knots`);
          }
        }
      }
    }
    
    return {
      conditions,
      warnings: [...new Set(warnings)], // Remove duplicates
      lastUpdated: new Date(),
    };
  }
  
  private parseWindSpeed(windString: string): number {
    if (!windString) return 0;
    
    // Extract numeric value from strings like "10 to 15 kt" or "15 knots"
    const match = windString.match(/(\d+)/);
    return match ? parseInt(match[1]) : 0;
  }
  
  private parseWaveHeight(waveString: string): number {
    if (!waveString) return 0;
    
    // Extract numeric value from strings like "3 to 5 ft" or "2 feet"
    const match = waveString.match(/(\d+)/);
    return match ? parseInt(match[1]) : 0;
  }
  
  private getRequiredEquipment(distance: number): string[] {
    const equipment = [
      'Life jackets for all crew',
      'VHF radio',
      'GPS/Chart plotter',
      'First aid kit',
      'Fire extinguisher',
      'Sound signaling device',
      'Visual distress signals',
      'Anchor with rode',
      'Navigation lights',
    ];
    
    // Add equipment based on distance
    if (distance > 20) {
      equipment.push(
        'EPIRB or PLB',
        'Life raft',
        'Offshore flares',
        'Storm sails',
        'Sea anchor',
        'Emergency water',
        'Emergency food'
      );
    }
    
    if (distance > 100) {
      equipment.push(
        'SSB radio or satellite communicator',
        'Radar reflector',
        'AIS transponder',
        'Weather routing service',
        'Spare parts kit',
        'Tools and repair materials'
      );
    }
    
    return equipment;
  }
  
  private genericAggregation(
    responses: Map<string, AgentResponse>, 
    plan: OrchestrationPlan
  ): any {
    const result: any = {
      planId: plan.id,
      prompt: plan.userPrompt,
      responses: {},
      summary: {},
      errors: [],
    };
    
    // Collect all responses
    for (const [stepId, response] of responses) {
      const step = plan.steps.find(s => s.id.includes(stepId));
      if (step) {
        result.responses[step.operation] = response.data;
        
        if (response.status === 'error') {
          result.errors.push({
            step: step.operation,
            error: response.error,
          });
        }
      }
    }
    
    // Create summary based on available data
    if (result.responses.get_current_weather) {
      result.summary.currentWeather = result.responses.get_current_weather;
    }
    
    if (result.responses.get_marine_forecast) {
      result.summary.forecast = result.responses.get_marine_forecast;
    }
    
    if (result.responses.get_port_info) {
      result.summary.portInfo = result.responses.get_port_info;
    }
    
    return result;
  }
} 