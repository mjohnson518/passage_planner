/**
 * Orchestrator: Error Handling Tests
 * 
 * PURPOSE: Validate orchestrator resilience under failure conditions including
 * agent failures, network errors, timeouts, and partial data scenarios.
 * 
 * COVERAGE TARGET: 85%+ of error handling paths
 * 
 * CRITICAL: Orchestrator must fail safely - never return incorrect data,
 * always provide clear error messages, continue with partial results when
 * safe to do so, and maintain system stability when agents fail.
 * 
 * MARITIME SAFETY PRINCIPLE: Partial data is acceptable if clearly flagged.
 * No data is better than wrong data. System must degrade gracefully.
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
  v4: () => 'test-error-id-12345'
}));

import { Orchestrator } from '../Orchestrator';
import { WeatherAgent } from '../../agents/weather/src/WeatherAgent';
import { TidalAgent } from '../../agents/tidal/src/TidalAgent';
import { RouteAgent } from '../../agents/route/src/RouteAgent';

describe('Orchestrator: Error Handling & Resilience', () => {
  let orchestrator: Orchestrator;
  let mockWeatherAgent: any;
  let mockTidalAgent: any;
  let mockRouteAgent: any;

  beforeEach(async () => {
    jest.clearAllMocks();

    // Setup standard mocks
    const mockRedis = {
      ping: jest.fn().mockResolvedValue('PONG'),
      hgetall: jest.fn().mockResolvedValue({}),
      quit: jest.fn().mockResolvedValue('OK'),
    };
    require('ioredis').default = jest.fn(() => mockRedis);

    const mockSupabase = {
      from: jest.fn().mockReturnValue({
        insert: jest.fn().mockResolvedValue({ data: {}, error: null })
      })
    };
    require('@supabase/supabase-js').createClient = jest.fn().mockReturnValue(mockSupabase);

    const mockWss = {
      on: jest.fn(),
      clients: new Set(),
      close: jest.fn(),
      forEach: jest.fn()
    };
    require('ws').WebSocketServer = jest.fn().mockImplementation(() => mockWss);

    const mockMcpServer = {
      setRequestHandler: jest.fn(),
      connect: jest.fn().mockResolvedValue(undefined)
    };
    require('@modelcontextprotocol/sdk/server/index.js').Server = jest.fn(() => mockMcpServer);

    // Setup default successful agent mocks
    mockRouteAgent = {
      initialize: jest.fn().mockResolvedValue(undefined),
      shutdown: jest.fn().mockResolvedValue(undefined),
      getTools: jest.fn().mockReturnValue([]),
      handleToolCall: jest.fn().mockResolvedValue({
        waypoints: [
          { latitude: 42.3601, longitude: -71.0589 },
          { latitude: 43.6591, longitude: -70.2568 }
        ],
        totalDistance: 85.7,
        estimatedDuration: 17.14
      })
    };

    mockWeatherAgent = {
      initialize: jest.fn().mockResolvedValue(undefined),
      shutdown: jest.fn().mockResolvedValue(undefined),
      getTools: jest.fn().mockReturnValue([]),
      handleToolCall: jest.fn().mockResolvedValue([
        { time: '2024-01-20T12:00:00Z', windSpeed: 15, waveHeight: 2 }
      ])
    };

    mockTidalAgent = {
      initialize: jest.fn().mockResolvedValue(undefined),
      shutdown: jest.fn().mockResolvedValue(undefined),
      getTools: jest.fn().mockReturnValue([]),
      handleToolCall: jest.fn().mockResolvedValue({
        station: '8443970',
        predictions: []
      })
    };

    (WeatherAgent as any).mockImplementation(() => mockWeatherAgent);
    (TidalAgent as any).mockImplementation(() => mockTidalAgent);
    (RouteAgent as any).mockImplementation(() => mockRouteAgent);

    orchestrator = new Orchestrator();
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  afterEach(async () => {
    if (orchestrator) {
      try {
        await orchestrator.shutdown();
      } catch (error) {
        // Ignore
      }
    }
  });

  // ============================================================================
  // TEST GROUP 1: Single Agent Failures
  // ============================================================================

  describe('Single Agent Failures', () => {
    it('should handle route agent failure by throwing error', async () => {
      mockRouteAgent.handleToolCall = jest.fn().mockRejectedValue(
        new Error('Route calculation failed')
      );

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

      // Route failure should propagate (can't plan without route)
      await expect(
        (orchestrator as any).planPassage(planRequest)
      ).rejects.toThrow('Route calculation failed');
    });

    it('should continue with null weather if weather agent fails', async () => {
      mockWeatherAgent.handleToolCall = jest.fn().mockRejectedValue(
        new Error('Weather API unavailable')
      );

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
      
      // Plan should complete despite weather failure
      expect(plan.route).toBeDefined();
      // Weather data should be empty or have nulls
      expect(Array.isArray(plan.weather)).toBe(true);
    });

    it('should continue without tidal data if tidal agent fails', async () => {
      mockTidalAgent.handleToolCall = jest.fn().mockRejectedValue(
        new Error('Tidal API unavailable')
      );

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
      
      // Plan should complete despite tidal failure
      expect(plan.route).toBeDefined();
      expect(plan.weather).toBeDefined();
      expect(plan.tides).toBeNull();
    });

    it('should filter out null weather data from failed fetches', async () => {
      // Some weather fetches succeed, some fail
      let callCount = 0;
      mockWeatherAgent.handleToolCall = jest.fn().mockImplementation(async () => {
        callCount++;
        if (callCount === 2) {
          throw new Error('Weather fetch failed for waypoint 2');
        }
        return [
          { time: '2024-01-20T12:00:00Z', windSpeed: 15, waveHeight: 2 }
        ];
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
      
      // Should have weather data, with nulls filtered out
      expect(Array.isArray(plan.weather)).toBe(true);
      // Should have some successful weather fetches
      expect(plan.weather.length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // TEST GROUP 2: Database Save Failures
  // ============================================================================

  describe('Database Save Failures', () => {
    it('should continue planning even if database save fails', async () => {
      const mockSupabase = {
        from: jest.fn().mockReturnValue({
          insert: jest.fn().mockResolvedValue({ 
            data: null, 
            error: new Error('Database connection failed')
          })
        })
      };
      require('@supabase/supabase-js').createClient = jest.fn().mockReturnValue(mockSupabase);

      orchestrator = new Orchestrator();
      await new Promise(resolve => setTimeout(resolve, 100));

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

      // Should not throw even if DB save fails
      const result = await (orchestrator as any).planPassage(planRequest);
      expect(result).toBeDefined();
    });

    it('should skip database save if no userId provided', async () => {
      const mockSupabase = {
        from: jest.fn().mockReturnValue({
          insert: jest.fn()
        })
      };
      require('@supabase/supabase-js').createClient = jest.fn().mockReturnValue(mockSupabase);

      orchestrator = new Orchestrator();
      await new Promise(resolve => setTimeout(resolve, 100));

      const planRequest = {
        // No userId
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
      
      // Database insert should not be called without userId
      const supabaseFrom = mockSupabase.from;
      expect(supabaseFrom).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // TEST GROUP 3: Partial Results Handling
  // ============================================================================

  describe('Partial Results Handling', () => {
    it('should return plan with route but without weather if weather fails', async () => {
      mockWeatherAgent.handleToolCall = jest.fn().mockRejectedValue(
        new Error('Weather service down')
      );

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
      
      // Route should be present
      expect(plan.route).toBeDefined();
      expect(plan.route.totalDistance).toBe(85.7);
      
      // Weather should be empty or have nulls
      expect(Array.isArray(plan.weather)).toBe(true);
    });

    it('should return plan with route and weather but without tides if tidal fails', async () => {
      mockTidalAgent.handleToolCall = jest.fn().mockRejectedValue(
        new Error('Tidal service down')
      );

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
      
      // Route and weather should be present
      expect(plan.route).toBeDefined();
      expect(plan.weather).toBeDefined();
      
      // Tides should be null
      expect(plan.tides).toBeNull();
    });

    it('should generate summary even with partial data', async () => {
      mockTidalAgent.handleToolCall = jest.fn().mockRejectedValue(
        new Error('Tidal service unavailable')
      );

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
      
      // Summary should still be generated
      expect(plan.summary).toBeDefined();
      expect(plan.summary.totalDistance).toBe(85.7);
      expect(plan.summary.warnings).toBeDefined();
      expect(plan.summary.recommendations).toBeDefined();
    });
  });

  // ============================================================================
  // TEST GROUP 4: Network and Timeout Errors
  // ============================================================================

  describe('Network and Timeout Errors', () => {
    it('should handle network timeout from weather agent', async () => {
      mockWeatherAgent.handleToolCall = jest.fn().mockRejectedValue(
        new Error('Request timeout after 30000ms')
      );

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

      // Should continue despite weather timeout
      const result = await (orchestrator as any).planPassage(planRequest);
      expect(result).toBeDefined();
    });

    it('should handle network error from tidal agent', async () => {
      mockTidalAgent.handleToolCall = jest.fn().mockRejectedValue(
        new Error('ECONNREFUSED - Connection refused')
      );

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
      
      // Should complete with null tidal data
      expect(plan.tides).toBeNull();
    });

    it('should handle DNS resolution failures', async () => {
      mockWeatherAgent.handleToolCall = jest.fn().mockRejectedValue(
        new Error('ENOTFOUND - DNS lookup failed for api.weather.gov')
      );

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
      expect(result).toBeDefined();
    });
  });

  // ============================================================================
  // TEST GROUP 5: Error Message and Context
  // ============================================================================

  describe('Error Messages and Context', () => {
    it('should throw descriptive error when route calculation fails', async () => {
      mockRouteAgent.handleToolCall = jest.fn().mockRejectedValue(
        new Error('Invalid coordinates provided')
      );

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

      await expect(
        (orchestrator as any).planPassage(planRequest)
      ).rejects.toThrow('Invalid coordinates provided');
    });

    it('should preserve error context through planning flow', async () => {
      const detailedError = new Error('NOAA API returned 503 Service Unavailable');
      mockWeatherAgent.handleToolCall = jest.fn().mockRejectedValue(detailedError);

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

      // Should not crash, continues with null weather
      const result = await (orchestrator as any).planPassage(planRequest);
      expect(result).toBeDefined();
    });
  });

  // ============================================================================
  // TEST GROUP 6: Multiple Agent Failures
  // ============================================================================

  describe('Multiple Agent Failures', () => {
    it('should handle both weather and tidal failures', async () => {
      mockWeatherAgent.handleToolCall = jest.fn().mockRejectedValue(
        new Error('Weather service down')
      );
      mockTidalAgent.handleToolCall = jest.fn().mockRejectedValue(
        new Error('Tidal service down')
      );

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
      
      // Should have route but no weather or tidal
      expect(plan.route).toBeDefined();
      expect(plan.tides).toBeNull();
    });

    it('should fail if all critical agents fail', async () => {
      mockRouteAgent.handleToolCall = jest.fn().mockRejectedValue(
        new Error('Route failed')
      );
      mockWeatherAgent.handleToolCall = jest.fn().mockRejectedValue(
        new Error('Weather failed')
      );
      mockTidalAgent.handleToolCall = jest.fn().mockRejectedValue(
        new Error('Tidal failed')
      );

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

      // Route is critical - should fail
      await expect(
        (orchestrator as any).planPassage(planRequest)
      ).rejects.toThrow();
    });
  });

  // ============================================================================
  // TEST GROUP 7: Malformed Agent Responses
  // ============================================================================

  describe('Malformed Agent Responses', () => {
    it('should handle route response missing waypoints', async () => {
      mockRouteAgent.handleToolCall = jest.fn().mockResolvedValue({
        // Missing waypoints array
        totalDistance: 85.7,
        estimatedDuration: 17.14
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

      // Should throw error when trying to map waypoints
      await expect(
        (orchestrator as any).planPassage(planRequest)
      ).rejects.toThrow();
    });

    it('should handle weather response with unexpected format', async () => {
      mockWeatherAgent.handleToolCall = jest.fn().mockResolvedValue(
        'Invalid response format'  // String instead of array
      );

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

      // Should handle gracefully (malformed weather treated as null)
      const result = await (orchestrator as any).planPassage(planRequest);
      expect(result).toBeDefined();
    });

    it('should handle null agent responses', async () => {
      mockTidalAgent.handleToolCall = jest.fn().mockResolvedValue(null);

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
      
      expect(plan.tides).toBeNull();
    });
  });

  // ============================================================================
  // TEST GROUP 8: Edge Cases and Boundary Conditions
  // ============================================================================

  describe('Edge Cases', () => {
    it('should handle route with single waypoint (departure = destination)', async () => {
      mockRouteAgent.handleToolCall = jest.fn().mockResolvedValue({
        waypoints: [
          { latitude: 42.3601, longitude: -71.0589 }
        ],
        totalDistance: 0,
        estimatedDuration: 0
      });

      const planRequest = {
        departure: {
          port: 'Boston',
          latitude: 42.3601,
          longitude: -71.0589,
          time: new Date('2024-01-20T08:00:00Z')
        },
        destination: {
          port: 'Boston',
          latitude: 42.3601,
          longitude: -71.0589
        }
      };

      const result = await (orchestrator as any).planPassage(planRequest);
      const plan = JSON.parse(result.content[0].text);
      
      expect(plan.route.totalDistance).toBe(0);
    });

    it('should handle empty weather data array', async () => {
      mockWeatherAgent.handleToolCall = jest.fn().mockResolvedValue([]);

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
      
      // Should handle empty weather gracefully
      expect(Array.isArray(plan.weather)).toBe(true);
    });

    it('should handle very long routes (many waypoints)', async () => {
      const manyWaypoints = Array.from({ length: 50 }, (_, i) => ({
        latitude: 42.0 + i * 0.5,
        longitude: -71.0 + i * 0.2
      }));

      mockRouteAgent.handleToolCall = jest.fn().mockResolvedValue({
        waypoints: manyWaypoints,
        totalDistance: 1500,
        estimatedDuration: 300
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
      
      // Should handle many waypoints (50 weather fetches in parallel)
      expect(mockWeatherAgent.handleToolCall).toHaveBeenCalledTimes(50);
      expect(result).toBeDefined();
    });
  });
});

