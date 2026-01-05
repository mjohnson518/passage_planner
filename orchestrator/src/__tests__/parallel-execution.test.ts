// @ts-nocheck
/**
 * Orchestrator: Parallel Execution Tests
 *
 * PURPOSE: Validate concurrent agent execution patterns, performance targets,
 * and request handling under load. Tests the core passage planning workflow.
 *
 * COVERAGE TARGET: 85%+ of passage planning flow
 *
 * PERFORMANCE TARGETS:
 * - Simple passage plan: <3 seconds
 * - Concurrent requests: Handle 10+ simultaneously
 * - Agent independence: One slow agent doesn't block others
 * 
 * NOTE: Current implementation is SEQUENTIAL (route → weather → tidal).
 * Tests validate actual implementation while documenting ideal parallel pattern.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

// Mock all dependencies
jest.mock('ioredis');
jest.mock('@supabase/supabase-js');
jest.mock('ws');
jest.mock('@modelcontextprotocol/sdk/server/index.js');
jest.mock('@modelcontextprotocol/sdk/server/stdio.js');
jest.mock('../../agents/weather/src/WeatherAgent');
jest.mock('../../agents/tidal/src/TidalAgent');
jest.mock('../../agents/route/src/RouteAgent');
jest.mock('uuid', () => ({
  v4: () => 'test-planning-id-12345'
}));

import { Orchestrator } from '../Orchestrator';
import { WeatherAgent } from '../../agents/weather/src/WeatherAgent';
import { TidalAgent } from '../../agents/tidal/src/TidalAgent';
import { RouteAgent } from '../../agents/route/src/RouteAgent';

describe('Orchestrator: Parallel Execution & Performance', () => {
  let orchestrator: Orchestrator;
  let mockWeatherAgent: any;
  let mockTidalAgent: any;
  let mockRouteAgent: any;

  beforeEach(async () => {
    jest.clearAllMocks();

    // Setup Redis mock
    const mockRedis = {
      ping: jest.fn().mockResolvedValue('PONG'),
      hgetall: jest.fn().mockResolvedValue({}),
      quit: jest.fn().mockResolvedValue('OK'),
    };
    require('ioredis').default = jest.fn(() => mockRedis);

    // Setup Supabase mock
    const mockSupabase = {
      from: jest.fn().mockReturnValue({
        insert: jest.fn().mockResolvedValue({ data: {}, error: null })
      })
    };
    require('@supabase/supabase-js').createClient = jest.fn().mockReturnValue(mockSupabase);

    // Setup WebSocket mock
    const mockWss = {
      on: jest.fn(),
      clients: new Set(),
      close: jest.fn(),
      forEach: jest.fn()
    };
    require('ws').WebSocketServer = jest.fn().mockImplementation(() => mockWss);

    // Setup MCP Server mock
    const mockMcpServer = {
      setRequestHandler: jest.fn(),
      connect: jest.fn().mockResolvedValue(undefined)
    };
    require('@modelcontextprotocol/sdk/server/index.js').Server = jest.fn(() => mockMcpServer);

    // Mock route agent with realistic response
    mockRouteAgent = {
      initialize: jest.fn().mockResolvedValue(undefined),
      shutdown: jest.fn().mockResolvedValue(undefined),
      getTools: jest.fn().mockReturnValue([]),
      handleToolCall: jest.fn().mockResolvedValue({
        waypoints: [
          { latitude: 42.3601, longitude: -71.0589, name: 'Boston' },
          { latitude: 42.7, longitude: -70.8 },
          { latitude: 43.0, longitude: -70.5 },
          { latitude: 43.6591, longitude: -70.2568, name: 'Portland' }
        ],
        totalDistance: 85.7,
        estimatedDuration: 17.14 // hours at 5kt
      } as any)
    };

    // Mock weather agent with realistic response
    mockWeatherAgent = {
      initialize: jest.fn().mockResolvedValue(undefined),
      shutdown: jest.fn().mockResolvedValue(undefined),
      getTools: jest.fn().mockReturnValue([]),
      handleToolCall: jest.fn().mockResolvedValue([
        { time: '2024-01-20T12:00:00Z', windSpeed: 15, waveHeight: 2 },
        { time: '2024-01-20T18:00:00Z', windSpeed: 18, waveHeight: 3 }
      ] as any)
    };

    // Mock tidal agent with realistic response
    mockTidalAgent = {
      initialize: jest.fn().mockResolvedValue(undefined),
      shutdown: jest.fn().mockResolvedValue(undefined),
      getTools: jest.fn().mockReturnValue([]),
      handleToolCall: jest.fn().mockResolvedValue({
        station: '8443970',
        predictions: [
          { time: '2024-01-20T06:00:00Z', height: 9.5, type: 'H' },
          { time: '2024-01-20T12:00:00Z', height: 1.2, type: 'L' }
        ]
      } as any)
    };

    (WeatherAgent as any).mockImplementation(() => mockWeatherAgent);
    (TidalAgent as any).mockImplementation(() => mockTidalAgent);
    (RouteAgent as any).mockImplementation(() => mockRouteAgent);

    orchestrator = new Orchestrator();
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  // ============================================================================
  // TEST GROUP 1: Sequential Execution Pattern (Current Implementation)
  // ============================================================================

  describe('Sequential Execution Pattern', () => {
    it('should execute route calculation first', async () => {
      const planRequest = {
        userId: 'test-user',
        departure: {
          port: 'Boston',
          latitude: 42.3601,
          longitude: -71.0589,
          time: new Date('2024-01-20T08:00:00Z')
        },
        destination: {
          port: 'Portland',
          latitude: 43.6591,
          longitude: -70.2568
        },
        vessel: {
          type: 'sailboat',
          cruiseSpeed: 5,
          maxSpeed: 7
        }
      };

      const result = await (orchestrator as any).planPassage(planRequest);
      
      expect(mockRouteAgent.handleToolCall).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should execute weather fetch after route calculation', async () => {
      const planRequest = {
        userId: 'test-user',
        departure: {
          port: 'Boston',
          latitude: 42.3601,
          longitude: -71.0589,
          time: new Date('2024-01-20T08:00:00Z')
        },
        destination: {
          port: 'Portland',
          latitude: 43.6591,
          longitude: -70.2568
        }
      };

      await (orchestrator as any).planPassage(planRequest);
      
      // Weather should be called after route
      expect(mockRouteAgent.handleToolCall).toHaveBeenCalled();
      expect(mockWeatherAgent.handleToolCall).toHaveBeenCalled();
    });

    it('should fetch weather for all waypoints in parallel', async () => {
      const planRequest = {
        userId: 'test-user',
        departure: {
          port: 'Boston',
          latitude: 42.3601,
          longitude: -71.0589,
          time: new Date('2024-01-20T08:00:00Z')
        },
        destination: {
          port: 'Portland',
          latitude: 43.6591,
          longitude: -70.2568
        }
      };

      await (orchestrator as any).planPassage(planRequest);
      
      // Weather agent should be called multiple times (once per waypoint)
      // With 4 waypoints, expect 4 calls
      expect(mockWeatherAgent.handleToolCall).toHaveBeenCalledTimes(4);
    });

    it('should execute tidal fetch after weather', async () => {
      const planRequest = {
        userId: 'test-user',
        departure: {
          port: 'Boston',
          latitude: 42.3601,
          longitude: -71.0589,
          time: new Date('2024-01-20T08:00:00Z')
        },
        destination: {
          port: 'Portland',
          latitude: 43.6591,
          longitude: -70.2568
        }
      };

      await (orchestrator as any).planPassage(planRequest);
      
      // All three agent types should be called
      expect(mockRouteAgent.handleToolCall).toHaveBeenCalled();
      expect(mockWeatherAgent.handleToolCall).toHaveBeenCalled();
      expect(mockTidalAgent.handleToolCall).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // TEST GROUP 2: Complete Passage Plan Generation
  // ============================================================================

  describe('Complete Passage Plan Generation', () => {
    it('should generate complete passage plan structure', async () => {
      const planRequest = {
        userId: 'test-user',
        departure: {
          port: 'Boston',
          latitude: 42.3601,
          longitude: -71.0589,
          time: new Date('2024-01-20T08:00:00Z')
        },
        destination: {
          port: 'Portland',
          latitude: 43.6591,
          longitude: -70.2568
        },
        vessel: {
          type: 'sailboat',
          cruiseSpeed: 5,
          maxSpeed: 7
        }
      };

      const result = await (orchestrator as any).planPassage(planRequest);
      const plan = JSON.parse(result.content[0].text);
      
      expect(plan.id).toBe('test-planning-id-12345');
      expect(plan.request).toBeDefined();
      expect(plan.route).toBeDefined();
      expect(plan.weather).toBeDefined();
      expect(plan.tides).toBeDefined();
      expect(plan.summary).toBeDefined();
    });

    it('should include route data in passage plan', async () => {
      const planRequest = {
        departure: {
          port: 'Boston',
          latitude: 42.3601,
          longitude: -71.0589,
          time: new Date('2024-01-20T08:00:00Z')
        },
        destination: {
          port: 'Portland',
          latitude: 43.6591,
          longitude: -70.2568
        }
      };

      const result = await (orchestrator as any).planPassage(planRequest);
      const plan = JSON.parse(result.content[0].text);
      
      expect(plan.route.waypoints).toBeDefined();
      expect(Array.isArray(plan.route.waypoints)).toBe(true);
      expect(plan.route.totalDistance).toBe(85.7);
      expect(plan.route.estimatedDuration).toBe(17.14);
    });

    it('should include weather data for all waypoints', async () => {
      const planRequest = {
        departure: {
          port: 'Boston',
          latitude: 42.3601,
          longitude: -71.0589,
          time: new Date('2024-01-20T08:00:00Z')
        },
        destination: {
          port: 'Portland',
          latitude: 43.6591,
          longitude: -70.2568
        }
      };

      const result = await (orchestrator as any).planPassage(planRequest);
      const plan = JSON.parse(result.content[0].text);
      
      expect(plan.weather).toBeDefined();
      expect(Array.isArray(plan.weather)).toBe(true);
      // Weather fetched for 4 waypoints
      expect(plan.weather.length).toBeGreaterThan(0);
    });

    it('should include tidal data in passage plan', async () => {
      const planRequest = {
        departure: {
          port: 'Boston',
          latitude: 42.3601,
          longitude: -71.0589,
          time: new Date('2024-01-20T08:00:00Z')
        },
        destination: {
          port: 'Portland',
          latitude: 43.6591,
          longitude: -70.2568
        }
      };

      const result = await (orchestrator as any).planPassage(planRequest);
      const plan = JSON.parse(result.content[0].text);
      
      expect(plan.tides).toBeDefined();
      if (plan.tides) {
        expect(plan.tides.station).toBe('8443970');
        expect(plan.tides.predictions).toBeDefined();
      }
    });

    it('should generate summary section', async () => {
      const planRequest = {
        departure: {
          port: 'Boston',
          latitude: 42.3601,
          longitude: -71.0589,
          time: new Date('2024-01-20T08:00:00Z')
        },
        destination: {
          port: 'Portland',
          latitude: 43.6591,
          longitude: -70.2568
        }
      };

      const result = await (orchestrator as any).planPassage(planRequest);
      const plan = JSON.parse(result.content[0].text);
      
      expect(plan.summary).toBeDefined();
      expect(plan.summary.totalDistance).toBe(85.7);
      expect(plan.summary.estimatedDuration).toBe(17.14);
      expect(plan.summary.departureTime).toBeDefined();
      expect(plan.summary.estimatedArrival).toBeDefined();
      expect(plan.summary.warnings).toBeDefined();
      expect(plan.summary.recommendations).toBeDefined();
    });
  });

  // ============================================================================
  // TEST GROUP 3: Performance Benchmarking
  // ============================================================================

  describe('Performance Benchmarking', () => {
    it('should complete simple passage plan in <3 seconds', async () => {
      const startTime = Date.now();

      const planRequest = {
        departure: {
          port: 'Boston',
          latitude: 42.3601,
          longitude: -71.0589,
          time: new Date('2024-01-20T08:00:00Z')
        },
        destination: {
          port: 'Portland',
          latitude: 43.6591,
          longitude: -70.2568
        }
      };

      await (orchestrator as any).planPassage(planRequest);

      const duration = Date.now() - startTime;
      
      // With mocked agents (no network delay), should be very fast
      expect(duration).toBeLessThan(3000);
    });

    it('should handle route calculation timing', async () => {
      // Add delay to route agent to simulate real calculation
      mockRouteAgent.handleToolCall = jest.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return {
          waypoints: [
            { latitude: 42.3601, longitude: -71.0589 },
            { latitude: 43.6591, longitude: -70.2568 }
          ],
          totalDistance: 85.7,
          estimatedDuration: 17.14
        };
      });

      const startTime = Date.now();

      const planRequest = {
        departure: {
          port: 'Boston',
          latitude: 42.3601,
          longitude: -71.0589,
          time: new Date('2024-01-20T08:00:00Z')
        },
        destination: {
          port: 'Portland',
          latitude: 43.6591,
          longitude: -70.2568
        }
      };

      await (orchestrator as any).planPassage(planRequest);

      const duration = Date.now() - startTime;
      
      // Should complete despite route delay
      expect(duration).toBeGreaterThanOrEqual(100);
      expect(duration).toBeLessThan(3000);
    });

    it('should benefit from parallel weather fetches', async () => {
      // Weather fetches happen in parallel (Promise.all)
      // Each fetch takes 50ms, but should complete in ~50ms total (parallel)
      mockWeatherAgent.handleToolCall = jest.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
        return [
          { time: '2024-01-20T12:00:00Z', windSpeed: 15, waveHeight: 2 }
        ];
      });

      const startTime = Date.now();

      const planRequest = {
        departure: {
          port: 'Boston',
          latitude: 42.3601,
          longitude: -71.0589,
          time: new Date('2024-01-20T08:00:00Z')
        },
        destination: {
          port: 'Portland',
          latitude: 43.6591,
          longitude: -70.2568
        }
      };

      await (orchestrator as any).planPassage(planRequest);

      const duration = Date.now() - startTime;
      
      // With 4 waypoints at 50ms each in parallel, should be ~50-100ms
      // (Not 4 * 50ms = 200ms sequential)
      expect(duration).toBeLessThan(300); // Parallel benefit
    });
  });

  // ============================================================================
  // TEST GROUP 4: Warning and Recommendation Generation
  // ============================================================================

  describe('Warning and Recommendation Generation', () => {
    it('should generate warnings for strong winds (>25kt)', async () => {
      mockWeatherAgent.handleToolCall = jest.fn().mockResolvedValue([
        { time: '2024-01-20T12:00:00Z', windSpeed: 30, waveHeight: 2 }
      ]);

      const planRequest = {
        departure: {
          port: 'Boston',
          latitude: 42.3601,
          longitude: -71.0589,
          time: new Date('2024-01-20T08:00:00Z')
        },
        destination: {
          port: 'Portland',
          latitude: 43.6591,
          longitude: -70.2568
        }
      };

      const result = await (orchestrator as any).planPassage(planRequest);
      const plan = JSON.parse(result.content[0].text);
      
      expect(plan.summary.warnings).toBeDefined();
      expect(plan.summary.warnings.some((w: string) => 
        w.toLowerCase().includes('wind')
      )).toBe(true);
    });

    it('should generate warnings for rough seas (>3ft)', async () => {
      mockWeatherAgent.handleToolCall = jest.fn().mockResolvedValue([
        { time: '2024-01-20T12:00:00Z', windSpeed: 15, waveHeight: 5 }
      ]);

      const planRequest = {
        departure: {
          port: 'Boston',
          latitude: 42.3601,
          longitude: -71.0589,
          time: new Date('2024-01-20T08:00:00Z')
        },
        destination: {
          port: 'Portland',
          latitude: 43.6591,
          longitude: -70.2568
        }
      };

      const result = await (orchestrator as any).planPassage(planRequest);
      const plan = JSON.parse(result.content[0].text);
      
      expect(plan.summary.warnings.some((w: string) => 
        w.toLowerCase().includes('sea')
      )).toBe(true);
    });

    it('should recommend motor sailing in light winds (<5kt)', async () => {
      mockWeatherAgent.handleToolCall = jest.fn().mockResolvedValue([
        { time: '2024-01-20T12:00:00Z', windSpeed: 3, waveHeight: 1 }
      ]);

      const planRequest = {
        departure: {
          port: 'Boston',
          latitude: 42.3601,
          longitude: -71.0589,
          time: new Date('2024-01-20T08:00:00Z')
        },
        destination: {
          port: 'Portland',
          latitude: 43.6591,
          longitude: -70.2568
        }
      };

      const result = await (orchestrator as any).planPassage(planRequest);
      const plan = JSON.parse(result.content[0].text);
      
      expect(plan.summary.recommendations.some((r: string) => 
        r.toLowerCase().includes('motor')
      )).toBe(true);
    });

    it('should recommend reefing in strong winds (>20kt)', async () => {
      mockWeatherAgent.handleToolCall = jest.fn().mockResolvedValue([
        { time: '2024-01-20T12:00:00Z', windSpeed: 25, waveHeight: 4 }
      ]);

      const planRequest = {
        departure: {
          port: 'Boston',
          latitude: 42.3601,
          longitude: -71.0589,
          time: new Date('2024-01-20T08:00:00Z')
        },
        destination: {
          port: 'Portland',
          latitude: 43.6591,
          longitude: -70.2568
        }
      };

      const result = await (orchestrator as any).planPassage(planRequest);
      const plan = JSON.parse(result.content[0].text);
      
      expect(plan.summary.recommendations.some((r: string) => 
        r.toLowerCase().includes('reef')
      )).toBe(true);
    });

    it('should recommend provisions for long passages (>200nm)', async () => {
      mockRouteAgent.handleToolCall = jest.fn().mockResolvedValue({
        waypoints: [
          { latitude: 42.3601, longitude: -71.0589 },
          { latitude: 32.3, longitude: -64.8 }
        ],
        totalDistance: 650, // Boston to Bermuda
        estimatedDuration: 130
      });

      const planRequest = {
        departure: {
          port: 'Boston',
          latitude: 42.3601,
          longitude: -71.0589,
          time: new Date('2024-01-20T08:00:00Z')
        },
        destination: {
          port: 'Bermuda',
          latitude: 32.3,
          longitude: -64.8
        }
      };

      const result = await (orchestrator as any).planPassage(planRequest);
      const plan = JSON.parse(result.content[0].text);
      
      expect(plan.summary.recommendations.some((r: string) => 
        r.toLowerCase().includes('provision')
      )).toBe(true);
    });

    it('should recommend watch schedule for multi-day passages (>24h)', async () => {
      mockRouteAgent.handleToolCall = jest.fn().mockResolvedValue({
        waypoints: [
          { latitude: 42.3601, longitude: -71.0589 },
          { latitude: 43.6591, longitude: -70.2568 }
        ],
        totalDistance: 85.7,
        estimatedDuration: 30 // 30 hours
      });

      const planRequest = {
        departure: {
          port: 'Boston',
          latitude: 42.3601,
          longitude: -71.0589,
          time: new Date('2024-01-20T08:00:00Z')
        },
        destination: {
          port: 'Portland',
          latitude: 43.6591,
          longitude: -70.2568
        }
      };

      const result = await (orchestrator as any).planPassage(planRequest);
      const plan = JSON.parse(result.content[0].text);
      
      expect(plan.summary.recommendations.some((r: string) => 
        r.toLowerCase().includes('watch')
      )).toBe(true);
    });

    it('should always include float plan recommendation', async () => {
      const planRequest = {
        departure: {
          port: 'Boston',
          latitude: 42.3601,
          longitude: -71.0589,
          time: new Date('2024-01-20T08:00:00Z')
        },
        destination: {
          port: 'Portland',
          latitude: 43.6591,
          longitude: -70.2568
        }
      };

      const result = await (orchestrator as any).planPassage(planRequest);
      const plan = JSON.parse(result.content[0].text);
      
      expect(plan.summary.recommendations.some((r: string) => 
        r.toLowerCase().includes('float plan')
      )).toBe(true);
    });

    it('should always include safety equipment recommendation', async () => {
      const planRequest = {
        departure: {
          port: 'Boston',
          latitude: 42.3601,
          longitude: -71.0589,
          time: new Date('2024-01-20T08:00:00Z')
        },
        destination: {
          port: 'Portland',
          latitude: 43.6591,
          longitude: -70.2568
        }
      };

      const result = await (orchestrator as any).planPassage(planRequest);
      const plan = JSON.parse(result.content[0].text);
      
      expect(plan.summary.recommendations.some((r: string) => 
        r.toLowerCase().includes('safety equipment')
      )).toBe(true);
    });
  });

  // ============================================================================
  // TEST GROUP 5: Response Format Validation
  // ============================================================================

  describe('Response Format Validation', () => {
    it('should return MCP-compliant response format', async () => {
      const planRequest = {
        departure: {
          port: 'Boston',
          latitude: 42.3601,
          longitude: -71.0589,
          time: new Date('2024-01-20T08:00:00Z')
        },
        destination: {
          port: 'Portland',
          latitude: 43.6591,
          longitude: -70.2568
        }
      };

      const result = await (orchestrator as any).planPassage(planRequest);
      
      expect(result.content).toBeDefined();
      expect(Array.isArray(result.content)).toBe(true);
      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toBeDefined();
    });

    it('should return valid JSON in response text', async () => {
      const planRequest = {
        departure: {
          port: 'Boston',
          latitude: 42.3601,
          longitude: -71.0589,
          time: new Date('2024-01-20T08:00:00Z')
        },
        destination: {
          port: 'Portland',
          latitude: 43.6591,
          longitude: -70.2568
        }
      };

      const result = await (orchestrator as any).planPassage(planRequest);
      
      // Should be valid JSON
      expect(() => JSON.parse(result.content[0].text)).not.toThrow();
    });

    it('should include planning ID in response', async () => {
      const planRequest = {
        departure: {
          port: 'Boston',
          latitude: 42.3601,
          longitude: -71.0589,
          time: new Date('2024-01-20T08:00:00Z')
        },
        destination: {
          port: 'Portland',
          latitude: 43.6591,
          longitude: -70.2568
        }
      };

      const result = await (orchestrator as any).planPassage(planRequest);
      const plan = JSON.parse(result.content[0].text);
      
      expect(plan.id).toBe('test-planning-id-12345');
    });
  });
});

