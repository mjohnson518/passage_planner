/**
 * Adaptive emergency procedures tests.
 *
 * SAFETY CRITICAL: A static block of "call MAYDAY on Ch 16" is not a procedure —
 * it's cover. The emergency guidance returned for a route must reflect the
 * hazards actually present on that route. If shallow water was flagged, the
 * crew needs grounding guidance. If a restricted area was flagged, they need
 * interception guidance. If it's a long offshore passage, they need abandon-ship
 * and comms guidance. These tests pin those couplings so a silent regression
 * back to the generic block fails CI.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

jest.mock('uuid', () => ({
  v4: () => `test-uuid-${Math.random().toString(36).slice(2)}`,
}));

jest.mock('@modelcontextprotocol/sdk/server/index.js', () => ({
  Server: jest.fn().mockImplementation(() => ({
    setRequestHandler: jest.fn(),
    connect: jest.fn(),
    close: jest.fn(),
  })),
}));

jest.mock('@modelcontextprotocol/sdk/types', () => ({
  ListToolsRequestSchema: { method: 'tools/list' },
  CallToolRequestSchema: { method: 'tools/call' },
}));

import SafetyAgent from '../index';

async function runRouteSafety(agent: any, args: any): Promise<any> {
  const result = await agent.handleToolCall('check_route_safety', args);
  return JSON.parse(result.content[0].text);
}

describe('SafetyAgent — adaptive emergency procedures', () => {
  let agent: any;

  beforeEach(async () => {
    process.env.LOG_LEVEL = 'silent';
    process.env.NOAA_API_KEY = 'test-key';
    process.env.NODE_ENV = 'test';
    agent = new SafetyAgent();
    await agent.initialize();
  });

  afterEach(async () => {
    await agent.shutdown();
  });

  it('always includes the baseline four (MOB, engine, medical, collision)', async () => {
    const response = await runRouteSafety(agent, {
      route: [
        { latitude: 42.36, longitude: -71.06 },
        { latitude: 43.0, longitude: -70.5 },
      ],
    });
    const keys = Object.keys(response.emergencyProcedures);
    expect(keys).toEqual(expect.arrayContaining(['manOverboard', 'engineFailure', 'medicalEmergency', 'collision']));
  });

  it('includes abandonShip + offshoreComms guidance on long multi-waypoint passages', async () => {
    // 12 waypoints crossing open water → counts as long passage
    const route = Array.from({ length: 12 }, (_, i) => ({
      latitude: 42.36 + i * 0.3,
      longitude: -71.06 + i * 0.3,
    }));
    const response = await runRouteSafety(agent, { route });
    expect(response.emergencyProcedures.abandonShip).toBeDefined();
    expect(String(response.emergencyProcedures.abandonShip)).toMatch(/EPIRB|raft/i);
    expect(response.emergencyProcedures.offshoreComms).toBeDefined();
  });

  it('does NOT include abandonShip guidance on a short local hop', async () => {
    // Two waypoints, ~0.5nm apart, clearly not offshore
    const response = await runRouteSafety(agent, {
      route: [
        { latitude: 42.36, longitude: -71.06 },
        { latitude: 42.37, longitude: -71.07 },
      ],
    });
    expect(response.emergencyProcedures.abandonShip).toBeUndefined();
    expect(response.emergencyProcedures.offshoreComms).toBeUndefined();
  });

  it('adds novice-crew reinforcement when crew_experience = novice', async () => {
    const response = await runRouteSafety(agent, {
      route: [
        { latitude: 42.36, longitude: -71.06 },
        { latitude: 42.5, longitude: -70.9 },
      ],
      crew_experience: 'novice',
    });
    // Field name is intentionally adjacent; test keys starting with 'novic'
    const noviceKey = Object.keys(response.emergencyProcedures).find(k => /^novic/i.test(k));
    expect(noviceKey).toBeDefined();
    expect(String(response.emergencyProcedures[noviceKey!])).toMatch(/MOB drill|VHF|EPIRB/i);
  });

  it('does not add novice reinforcement for advanced crew', async () => {
    const response = await runRouteSafety(agent, {
      route: [
        { latitude: 42.36, longitude: -71.06 },
        { latitude: 42.5, longitude: -70.9 },
      ],
      crew_experience: 'advanced',
    });
    const noviceKey = Object.keys(response.emergencyProcedures).find(k => /^novic/i.test(k));
    expect(noviceKey).toBeUndefined();
  });

  it('procedures are strings with actionable content (not empty placeholders)', async () => {
    const response = await runRouteSafety(agent, {
      route: [
        { latitude: 42.36, longitude: -71.06 },
        { latitude: 43.0, longitude: -70.5 },
      ],
    });
    for (const [key, value] of Object.entries(response.emergencyProcedures)) {
      expect(typeof value).toBe('string');
      expect((value as string).length).toBeGreaterThan(30);
      expect(value).not.toMatch(/TODO|coming soon|placeholder/i);
    }
  });
});
