import type { RedisClientType } from 'redis'
import type pino from 'pino'

import { BaseAgent, type AgentContext } from './BaseAgent'

class PortAgent extends BaseAgent {
  constructor() {
    super({
      agentId: 'port',
      name: 'Port Agent',
      description: 'Provides port facilities and contacts',
      version: '0.0.1',
      status: 'active',
      tools: [{ name: 'get_port_info', description: 'Fetch port information' }],
    })
  }

  getTools() {
    return this.summary.tools
  }

  async execute(_tool: string, args: any, _context?: AgentContext) {
    return {
      ports: {
        departure: {
          name: args.departure?.port ?? 'Departure Port',
          facilities: ['fuel', 'provisions'],
          contacts: [{ type: 'harbormaster', phone: 'VHF 16' }],
        },
        destination: {
          name: args.destination?.port ?? 'Destination Port',
          facilities: ['moorings', 'customs'],
          contacts: [{ type: 'marina', phone: '555-1234' }],
        },
      },
    }
  }
}

class RouteAgent extends BaseAgent {
  constructor() {
    super({
      agentId: 'route',
      name: 'Route Agent',
      description: 'Calculates sailing routes',
      version: '0.0.1',
      status: 'active',
      tools: [{ name: 'calculate_route', description: 'Plan optimal route' }],
    })
  }

  getTools() {
    return this.summary.tools
  }

  async execute(_tool: string, _args: any, _context?: AgentContext) {
    return {
      route: {
        totalDistance: 120,
        estimatedDuration: 20,
        waypoints: [
          { name: 'Start', latitude: 42, longitude: -71 },
          { name: 'Midpoint', latitude: 42.5, longitude: -70.5 },
          { name: 'Finish', latitude: 43, longitude: -70 },
        ],
      },
    }
  }
}

class WeatherAgent extends BaseAgent {
  constructor() {
    super({
      agentId: 'weather',
      name: 'Weather Agent',
      description: 'Provides marine weather forecast',
      version: '0.0.1',
      status: 'active',
      tools: [{ name: 'get_marine_forecast', description: 'Retrieve forecast' }],
    })
  }

  getTools() {
    return this.summary.tools
  }

  async execute(_tool: string, _args: any, _context?: AgentContext) {
    return {
      weather: {
        summary: 'Calm conditions',
        forecast: [
          { time: '2024-07-15T12:00:00Z', windSpeed: 12, windDirection: 'SW' },
        ],
      },
      recommendations: ['Monitor NOAA updates'],
    }
  }
}

class TidalAgent extends BaseAgent {
  constructor() {
    super({
      agentId: 'tidal',
      name: 'Tidal Agent',
      description: 'Provides tidal predictions',
      version: '0.0.1',
      status: 'active',
      tools: [{ name: 'get_tide_predictions', description: 'Get tides' }],
    })
  }

  getTools() {
    return this.summary.tools
  }

  async execute(_tool: string, _args: any, _context?: AgentContext) {
    return {
      tides: {
        high: '2024-07-15T06:00:00Z',
        low: '2024-07-15T12:30:00Z',
      },
      recommendations: ['Depart near high tide'],
    }
  }
}

class WindAgent extends BaseAgent {
  constructor() {
    super({
      agentId: 'wind',
      name: 'Wind Agent',
      description: 'Analyzes wind along route',
      version: '0.0.1',
      status: 'active',
      tools: [{ name: 'analyze_wind_route', description: 'Wind analysis' }],
    })
  }

  getTools() {
    return this.summary.tools
  }

  async execute(_tool: string, _args: any, _context?: AgentContext) {
    return {
      wind: {
        favorablePercentage: 75,
      },
      recommendations: ['Prepare to reef at 20 kts'],
    }
  }
}

class SafetyAgent extends BaseAgent {
  constructor() {
    super({
      agentId: 'safety',
      name: 'Safety Agent',
      description: 'Aggregates safety advisories',
      version: '0.0.1',
      status: 'active',
      tools: [{ name: 'check_route_safety', description: 'Safety advisories' }],
    })
  }

  getTools() {
    return this.summary.tools
  }

  async execute(_tool: string, _args: any, _context?: AgentContext) {
    return {
      safety: {
        warnings: ['Monitor thunderstorms offshore'],
        recommendations: ['Review safety checklist'],
      },
    }
  }
}

const mockAgents = [
  new PortAgent(),
  new RouteAgent(),
  new WeatherAgent(),
  new TidalAgent(),
  new WindAgent(),
  new SafetyAgent(),
]

export function getMockAgents(): BaseAgent[] {
  return mockAgents
}
