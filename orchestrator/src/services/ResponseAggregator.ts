import { Logger } from 'pino'

interface AggregationStepResult {
  key: string
  status: 'success' | 'error'
  payload?: any
  error?: string
}

interface AggregationSummary {
  route?: any
  weather?: any
  tides?: any
  safety?: any
  wind?: any
  ports?: any
  departure?: any
  destination?: any
  totalDistance?: number
  recommendations: string[]
  estimatedDuration?: number
  preferences?: any
}

export class ResponseAggregator {
  private steps: AggregationStepResult[] = []
  private summary: AggregationSummary = { recommendations: [] }

  constructor(private logger: Logger) {
    this.reset()
  }

  reset() {
    this.steps = []
    this.summary = { recommendations: [] }
  }

  addStepResult(step: string, result: any) {
    this.steps.push({ key: step, status: 'success', payload: result })

    switch (step) {
      case 'route': {
        const route = result.route || result
        this.summary.route = route
        if (typeof route?.totalDistance === 'number') {
          this.summary.totalDistance = route.totalDistance
        }
        if (typeof route?.estimatedDuration === 'number') {
          this.summary.estimatedDuration = route.estimatedDuration
        }
        this.summary.departure = route.departure || result.departure || this.summary.departure
        this.summary.destination = route.destination || result.destination || this.summary.destination
        break
      }
      case 'weather': {
        this.summary.weather = result.weather || result
        if (result.recommendations) {
          this.summary.recommendations.push(...result.recommendations)
        }
        break
      }
      case 'tides':
        this.summary.tides = result.tides || result
        break
      case 'safety':
        this.summary.safety = result.safety || result
        if (result.recommendations) {
          this.summary.recommendations.push(...result.recommendations)
        }
        break
      case 'wind':
        this.summary.wind = result.wind || result
        if (result.recommendations) {
          this.summary.recommendations.push(...result.recommendations)
        }
        break
       case 'port':
        this.summary.ports = result.ports || result
        this.summary.departure = result.ports?.departure || this.summary.departure
        this.summary.destination = result.ports?.destination || this.summary.destination
        break
      case 'ports':
        this.summary.ports = result
        this.summary.departure = result.departure || this.summary.departure
        this.summary.destination = result.destination || this.summary.destination
        break
      default:
        this.logger.warn({ step }, 'Unknown aggregation step result')
    }
  }

  buildSummary(request: any, orderedSteps: any[]) {
    this.summary.preferences = request.preferences

    if (!this.summary.departure) {
      this.summary.departure = {
        port: request.departure?.port,
        latitude: request.departure?.latitude,
        longitude: request.departure?.longitude,
        time: request.departure?.time,
      }
    }

    if (!this.summary.destination) {
      this.summary.destination = {
        port: request.destination?.port,
        latitude: request.destination?.latitude,
        longitude: request.destination?.longitude,
      }
    }

    const steps = orderedSteps.map((step: any) => {
      const recorded = this.steps.find((s) => s.key === step.key)
      return recorded || { key: step.key, status: 'missing' }
    })

    const summary = {
      ...this.summary,
      tides: this.summary.tides ?? {},
      safety: this.summary.safety ?? {},
      wind: this.summary.wind ?? {},
      weather: this.summary.weather ?? {},
      ports: this.summary.ports ?? {},
      recommendations: this.summary.recommendations,
      steps,
    }

    this.reset()
    return summary
  }
}