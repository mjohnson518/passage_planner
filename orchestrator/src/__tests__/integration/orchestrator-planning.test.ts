import { OrchestratorService } from '../../index'

jest.mock('../../services/PassagePlanner', () => {
  return {
    PassagePlanner: jest.fn().mockImplementation(() => ({
      run: jest.fn().mockImplementation(async () => ({
        success: true,
        planId: 'plan-123',
        summary: { totalDistance: 120 },
      })),
    })),
  }
})

describe('Orchestrator passage planning (integration)', () => {
  let orchestrator: OrchestratorService

  beforeAll(async () => {
    orchestrator = new OrchestratorService()
  })

  it('runs passage planning via tool handler', async () => {
    const response = await orchestrator.handleRequest({
      tool: 'plan_passage',
      arguments: {
        userId: 'user-1',
        departure: {
          port: 'Boston, MA',
          latitude: 42.3601,
          longitude: -71.0589,
          time: new Date().toISOString(),
        },
        destination: {
          port: 'Portland, ME',
          latitude: 43.6591,
          longitude: -70.2568,
        },
        vessel: { type: 'sailboat', cruiseSpeed: 6 },
      },
    })

    expect(response).toEqual({
      success: true,
      result: {
        success: true,
        planId: 'plan-123',
        summary: { totalDistance: 120 },
      },
    })
  })
})

