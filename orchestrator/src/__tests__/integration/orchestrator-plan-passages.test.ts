import { OrchestratorService } from '../../index'

describe('Plan Passage orchestration flow (integration)', () => {
  it('creates hierarchical plan and delegates to specialized agents (RED: implement orchestrator + agents)', async () => {
    const orchestrator = new OrchestratorService()

    const request = {
      tool: 'plan_passage',
      arguments: {
        userId: 'user-123',
        departure: {
          port: 'Boston, MA',
          latitude: 42.3601,
          longitude: -71.0589,
          time: '2024-07-15T10:00:00Z',
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
      },
    }

    const response = await orchestrator.handleRequest(request)

    expect(response.success).toBe(true)
    expect(response.result.planId).toEqual(expect.any(String))
    const summary = response.result.summary as any
    expect(summary.route).toBeDefined()
    expect(summary.weather).toBeDefined()
    expect(summary.tides).toBeDefined()
    expect(summary.safety).toBeDefined()
    expect(summary.wind).toBeDefined()
    expect(summary.ports).toBeDefined()
    expect(Array.isArray(summary.recommendations ?? [])).toBe(true)
    expect((summary.recommendations ?? []).length).toBeGreaterThan(0)
  })
})

