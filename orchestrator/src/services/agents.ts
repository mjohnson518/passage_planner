import { Logger } from 'pino'

export interface OrchestratorAgent {
  id: string
  execute(tool: string, args: any): Promise<any>
}

abstract class BaseAgent implements OrchestratorAgent {
  constructor(public readonly id: string, protected readonly logger: Logger) {}

  abstract execute(tool: string, args: any): Promise<any>
}

class RouteAgent extends BaseAgent {
  constructor(logger: Logger) {
    super('route', logger)
  }

  async execute(tool: string, args: any): Promise<any> {
    if (tool !== 'calculate_route') {
      throw new Error(`RouteAgent cannot handle tool ${tool}`)
    }

    const departure = args.departure || {}
    const destination = args.destination || {}

    const totalDistance = 120
    const estimatedDuration = 20

    const waypoints = [
      {
        name: departure.port || 'Departure',
        latitude: departure.latitude,
        longitude: departure.longitude,
      },
      {
        name: 'Waypoint Alpha',
        latitude: (departure.latitude + destination.latitude) / 2,
        longitude: (departure.longitude + destination.longitude) / 2,
      },
      {
        name: destination.port || 'Destination',
        latitude: destination.latitude,
        longitude: destination.longitude,
      },
    ]

    return {
      route: {
        totalDistance,
        estimatedDuration,
        waypoints,
        departure,
        destination,
      },
      recommendations: ['Review route hazards along waypoint Alpha'],
    }
  }
}

class WeatherAgent extends BaseAgent {
  constructor(logger: Logger) {
    super('weather', logger)
  }

  async execute(tool: string, _args: any): Promise<any> {
    if (tool !== 'get_marine_forecast') {
      throw new Error(`WeatherAgent cannot handle tool ${tool}`)
    }

    return {
      weather: {
        summary: 'Calm conditions with light SW breeze',
        forecast: [
          { time: '2024-07-15T12:00:00Z', wind: '10kts SW', seaState: '1m' },
          { time: '2024-07-15T18:00:00Z', wind: '12kts SSW', seaState: '1.2m' },
        ],
        warnings: [],
      },
      recommendations: ['Monitor NOAA marine forecast every 6 hours'],
    }
  }
}

class TidalAgent extends BaseAgent {
  constructor(logger: Logger) {
    super('tidal', logger)
  }

  async execute(tool: string, args: any): Promise<any> {
    if (tool !== 'get_tide_predictions') {
      throw new Error(`TidalAgent cannot handle tool ${tool}`)
    }

    const departure = args.departure || args.locations?.departure || {}

    return {
      tides: {
        referencePort: departure.port || 'Boston, MA',
        highTide: '2024-07-15T06:12:00Z',
        lowTide: '2024-07-15T12:45:00Z',
      },
    }
  }
}

class SafetyAgent extends BaseAgent {
  constructor(logger: Logger) {
    super('safety', logger)
  }

  async execute(tool: string, _args: any): Promise<any> {
    if (tool !== 'check_route_safety') {
      throw new Error(`SafetyAgent cannot handle tool ${tool}`)
    }

    return {
      safety: {
        warnings: ['Potential thunderstorms north of Cape Ann'],
        emergencyContacts: {
          coastGuard: 'Channel 16 / +1-978-283-0707',
          towing: 'SeaTow New England +1-800-473-2869',
        },
      },
      recommendations: ['Inspect safety gear and review emergency procedures'],
    }
  }
}

class PortAgent extends BaseAgent {
  constructor(logger: Logger) {
    super('port', logger)
  }

  async execute(tool: string, args: any): Promise<any> {
    if (tool !== 'get_port_info') {
      throw new Error(`PortAgent cannot handle tool ${tool}`)
    }

    const departure = args.departure || {}
    const destination = args.destination || {}

    return {
      ports: {
        departure: {
          name: departure.port || 'Boston, MA',
          facilities: ['fuel', 'provisions', 'customs'],
          vhf: 'Channel 16',
        },
        destination: {
          name: destination.port || 'Portland, ME',
          facilities: ['fuel', 'mooring', 'harbormaster'],
          vhf: 'Channel 12',
        },
      },
    }
  }
}

class WindAgent extends BaseAgent {
  constructor(logger: Logger) {
    super('wind', logger)
  }

  async execute(tool: string, _args: any): Promise<any> {
    if (tool !== 'analyze_wind_route') {
      throw new Error(`WindAgent cannot handle tool ${tool}`)
    }

    return {
      wind: {
        favorablePercentage: 78,
        prevailingDirection: 'SW',
        averageSpeed: 12,
      },
      recommendations: ['Prepare to reef if winds exceed 20 knots'],
    }
  }
}

export function createDefaultAgents(logger: Logger): OrchestratorAgent[] {
  return [
    new PortAgent(logger),
    new RouteAgent(logger),
    new WeatherAgent(logger),
    new TidalAgent(logger),
    new SafetyAgent(logger),
    new WindAgent(logger),
  ]
}

