import { EventEmitter } from 'events'
import pino from 'pino'

import { PassagePlanner } from '../../services/PassagePlanner'
import type { OrchestrationPlan } from '../../services/RequestRouter'

const noopLogger = pino({ enabled: false })

describe('PassagePlanner', () => {
  const requestArgs = {
    userId: 'user-1',
    departure: {
      port: 'Boston, MA',
      latitude: 42.3601,
      longitude: -71.0589,
      time: new Date('2024-06-01T12:00:00Z'),
    },
    destination: {
      port: 'Portland, ME',
      latitude: 43.6591,
      longitude: -70.2568,
    },
    vessel: {
      type: 'sailboat',
      cruiseSpeed: 6,
    },
    preferences: {
      avoidNight: true,
      maxWindSpeed: 25,
      maxWaveHeight: 2,
    },
  }

  const plan: OrchestrationPlan = {
    id: 'plan-1',
    requestId: 'req-1',
    userId: 'user-1',
    createdAt: new Date('2024-06-01T11:00:00Z'),
    steps: [
      { id: 'port', agent: 'port', tool: 'get_port_info', dependsOn: [] },
      { id: 'route', agent: 'route', tool: 'calculate_route', dependsOn: ['port'] },
      { id: 'weather', agent: 'weather', tool: 'get_marine_forecast', dependsOn: ['route'] },
      { id: 'tides', agent: 'tidal', tool: 'get_tide_predictions', dependsOn: ['port'] },
      { id: 'wind', agent: 'wind', tool: 'analyze_wind_route', dependsOn: ['route'] },
      { id: 'safety', agent: 'safety', tool: 'check_route_safety', dependsOn: ['route', 'weather', 'tides'] },
    ],
  }

  const makePlanner = () => {
    const agentRegistry = {
      execute: jest.fn()
        .mockResolvedValueOnce({ ports: { departure: {}, destination: {} } })
        .mockResolvedValueOnce({ route: { totalDistance: 98, estimatedDuration: 18, waypoints: [] } })
        .mockResolvedValueOnce({ weather: { summary: 'Calm' } })
        .mockResolvedValueOnce({ tides: { high: '06:00' } })
        .mockResolvedValueOnce({ wind: { favorablePercentage: 80 } })
        .mockResolvedValueOnce({ safety: { warnings: [] } }),
    }

    const aggregator = {
      addStepResult: jest.fn(),
      buildSummary: jest.fn().mockReturnValue({
        route: { totalDistance: 98 },
        weather: { summary: 'Calm' },
        tides: { high: '06:00' },
        safety: { warnings: [] },
        wind: { favorablePercentage: 80 },
        recommendations: ['Reef early at 18 kts'],
        estimatedDuration: 18,
      }),
    }

    const persistence = {
      savePassagePlan: jest.fn().mockResolvedValue({ id: 'plan-123' }),
    }

    const metrics = {
      record: jest.fn(),
    }

    const emitter = new EventEmitter()
    const emitSpy = jest.spyOn(emitter, 'emit')

    const planner = new PassagePlanner({
      agentRegistry: agentRegistry as any,
      aggregator: aggregator as any,
      persistence: persistence as any,
      metrics: metrics as any,
      emitter,
      logger: noopLogger,
    })

    return {
      planner,
      agentRegistry,
      aggregator,
      persistence,
      metrics,
      emitSpy,
    }
  }

  it('executes planning pipeline in correct order and persists summary', async () => {
    const { planner, agentRegistry, aggregator, persistence, metrics, emitSpy } = makePlanner()

    const result = await planner.run(plan, requestArgs)

    expect(agentRegistry.execute).toHaveBeenNthCalledWith(1, 'port', 'get_port_info', expect.any(Object))
    expect(agentRegistry.execute).toHaveBeenNthCalledWith(2, 'route', 'calculate_route', expect.any(Object))
    expect(agentRegistry.execute).toHaveBeenNthCalledWith(3, 'weather', 'get_marine_forecast', expect.any(Object))
    expect(agentRegistry.execute).toHaveBeenNthCalledWith(4, 'tidal', 'get_tide_predictions', expect.any(Object))
    expect(agentRegistry.execute).toHaveBeenNthCalledWith(5, 'wind', 'analyze_wind_route', expect.any(Object))
    expect(agentRegistry.execute).toHaveBeenNthCalledWith(6, 'safety', 'check_route_safety', expect.any(Object))

    expect(aggregator.addStepResult).toHaveBeenCalledTimes(6)
    expect(aggregator.buildSummary).toHaveBeenCalledWith(requestArgs, plan.steps.map((s) => ({ key: s.agent })))

    expect(persistence.savePassagePlan).toHaveBeenCalledWith(expect.objectContaining({
      requestId: plan.requestId,
      userId: plan.userId,
      summary: expect.objectContaining({ estimatedDuration: 18 }),
    }))

    expect(metrics.record).toHaveBeenCalledWith('passage_planned', expect.objectContaining({ userId: plan.userId }))

    expect(emitSpy).toHaveBeenCalledWith('request:progress', expect.objectContaining({
      requestId: plan.requestId,
      step: 'port',
      status: 'completed',
    }))

    expect(result).toEqual(expect.objectContaining({
      success: true,
      planId: 'plan-123',
      summary: expect.objectContaining({
        route: expect.objectContaining({ totalDistance: 98 }),
        tides: expect.any(Object),
        wind: expect.any(Object),
        safety: expect.any(Object),
      }),
    }))
  })

  it('marks plan as failed when an agent throws', async () => {
    const plannerDeps = makePlanner()
    const executeMock = plannerDeps.agentRegistry.execute as jest.Mock
    executeMock.mockReset()
    executeMock.mockRejectedValueOnce(new Error('Agent failure'))

    const response = await plannerDeps.planner.run(plan, requestArgs)
    expect(response).toEqual({ success: false, planId: plan.id, summary: { error: 'Agent failure' } })
    expect(plannerDeps.persistence.savePassagePlan).not.toHaveBeenCalled()
    expect(plannerDeps.metrics.record).toHaveBeenCalledWith('passage_failed', expect.objectContaining({
      userId: plan.userId,
      reason: 'Agent failure',
    }))
  })
})

