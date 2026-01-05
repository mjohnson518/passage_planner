// @ts-nocheck
/**
 * Orchestrator: Agent Coordination Tests
 *
 * PURPOSE: Validate end-to-end passage planning workflow including data flow
 * between agents, result aggregation, and complete integration scenarios.
 *
 * COVERAGE TARGET: 80%+ of coordination and integration logic
 *
 * INTEGRATION TEST: Tests complete Boston → Portland passage planning workflow
 * with all agents coordinating to produce comprehensive passage plan.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

// Mock all dependencies
jest.mock('ioredis');
jest.mock('@supabase/supabase-js');
jest.mock('ws');
jest.mock('@modelcontextprotocol/sdk/server/index.js');
jest.mock('@modelcontextprotocol/sdk/server/stdio.js');
jest.mock('../../../agents/weather/src/WeatherAgent');
jest.mock('../../../agents/tidal/src/TidalAgent');
jest.mock('../../../agents/route/src/RouteAgent');
jest.mock('uuid', () => ({
  v4: () => 'test-coordination-id-12345'
}));

import { Orchestrator } from '../Orchestrator';
import { WeatherAgent } from '../../../agents/weather/src/WeatherAgent';
import { TidalAgent } from '../../../agents/tidal/src/TidalAgent';
import { RouteAgent } from '../../../agents/route/src/RouteAgent';

describe('Orchestrator: Agent Coordination & Integration', () => {
  let orchestrator: Orchestrator;

  beforeEach(async () => {
    jest.clearAllMocks();

    // Standard mock setup
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

    // Realistic agent responses for integration testing
    (RouteAgent as any).mockImplementation(() => {
      const mock: any = {
        initialize: jest.fn().mockResolvedValue(undefined),
        shutdown: jest.fn().mockResolvedValue(undefined),
        getTools: jest.fn().mockReturnValue([]),
        handleToolCall: jest.fn().mockResolvedValue({
          waypoints: [
            { latitude: 42.3601, longitude: -71.0589, name: 'Boston, MA' },
            { latitude: 42.7, longitude: -70.8 },
            { latitude: 43.0, longitude: -70.5 },
            { latitude: 43.6591, longitude: -70.2568, name: 'Portland, ME' }
          ],
          totalDistance: 85.7,
          estimatedDuration: 17.14,
          route_type: 'great_circle'
        })
      };
      return mock;
    });

    (WeatherAgent as any).mockImplementation(() => {
      const mock: any = {
        initialize: jest.fn().mockResolvedValue(undefined),
        shutdown: jest.fn().mockResolvedValue(undefined),
        getTools: jest.fn().mockReturnValue([]),
        handleToolCall: jest.fn().mockResolvedValue([
          {
            time: '2024-01-20T12:00:00Z',
            windSpeed: 15,
            windDirection: 'NE',
            waveHeight: 2,
            temperature: 45,
            conditions: 'Partly Cloudy'
          },
          {
            time: '2024-01-20T18:00:00Z',
            windSpeed: 18,
            windDirection: 'E',
            waveHeight: 3,
            temperature: 42,
            conditions: 'Cloudy'
          }
        ])
      };
      return mock;
    });

    (TidalAgent as any).mockImplementation(() => {
      const mock: any = {
        initialize: jest.fn().mockResolvedValue(undefined),
        shutdown: jest.fn().mockResolvedValue(undefined),
        getTools: jest.fn().mockReturnValue([]),
        handleToolCall: jest.fn().mockResolvedValue({
          station: '8443970',
          station_name: 'Boston Harbor',
          predictions: [
            { time: '2024-01-20T06:15:00Z', height: 9.5, type: 'H' },
            { time: '2024-01-20T12:30:00Z', height: 1.2, type: 'L' },
            { time: '2024-01-20T18:45:00Z', height: 9.8, type: 'H' }
          ],
          datum: 'MLLW',
          units: 'english'
        })
      };
      return mock;
    });

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
  // TEST GROUP 1: End-to-End Integration (Boston → Portland)
  // ============================================================================

  describe('End-to-End Integration', () => {
    it('should complete full Boston to Portland passage plan', async () => {
      const planRequest = {
        userId: 'sailor_123',
        departure: {
          port: 'Boston, MA',
          latitude: 42.3601,
          longitude: -71.0589,
          time: new Date('2024-01-20T08:00:00Z')
        },
        destination: {
          port: 'Portland, ME',
          latitude: 43.6591,
          longitude: -70.2568
        },
        vessel: {
          type: 'sailboat',
          cruiseSpeed: 5,
          maxSpeed: 7
        },
        preferences: {
          avoidNight: false,
          maxWindSpeed: 30,
          maxWaveHeight: 8
        }
      };

      const result = await (orchestrator as any).planPassage(planRequest);
      const plan = JSON.parse(result.content[0].text);
      
      // Complete plan structure
      expect(plan.id).toBe('test-coordination-id-12345');
      expect(plan.request.departure.port).toBe('Boston, MA');
      expect(plan.request.destination.port).toBe('Portland, ME');
      expect(plan.route.totalDistance).toBe(85.7);
      expect(plan.route.waypoints.length).toBe(4);
      expect(plan.weather.length).toBeGreaterThan(0);
      expect(plan.tides.station).toBe('8443970');
      expect(plan.summary.totalDistance).toBe(85.7);
    });

    it('should include all agent data in aggregated response', async () => {
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
      
      // Verify all three agent types contributed
      expect(plan.route).toBeDefined(); // Route agent
      expect(plan.weather).toBeDefined(); // Weather agent
      expect(plan.tides).toBeDefined(); // Tidal agent
    });

    it('should call route agent with correct parameters', async () => {
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
        },
        vessel: {
          cruiseSpeed: 6
        }
      };

      const mockRoute = require('../../../agents/route/src/RouteAgent').mock.results[0].value;

      await (orchestrator as any).planPassage(planRequest);
      
      expect(mockRoute.handleToolCall).toHaveBeenCalledWith(
        'calculate_route',
        expect.objectContaining({
          departure: planRequest.departure,
          destination: planRequest.destination,
          vessel_speed: 6
        })
      );
    });

    it('should call weather agent for each waypoint', async () => {
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

      const mockWeather = require('../../../agents/weather/src/WeatherAgent').mock.results[0].value;

      await (orchestrator as any).planPassage(planRequest);
      
      // Should call weather agent once per waypoint (4 waypoints)
      expect(mockWeather.handleToolCall).toHaveBeenCalledTimes(4);
      
      // Each call should have latitude, longitude, hours parameters
      expect(mockWeather.handleToolCall).toHaveBeenCalledWith(
        'get_marine_forecast',
        expect.objectContaining({
          latitude: expect.any(Number),
          longitude: expect.any(Number),
          hours: 72
        })
      );
    });

    it('should call tidal agent with departure coordinates', async () => {
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

      const mockTidal = require('../../../agents/tidal/src/TidalAgent').mock.results[0].value;

      await (orchestrator as any).planPassage(planRequest);
      
      expect(mockTidal.handleToolCall).toHaveBeenCalledWith(
        'get_tide_predictions',
        expect.objectContaining({
          latitude: 42.3601,
          longitude: -71.0589
        })
      );
    });

    it('should pass 7-day date range to tidal agent', async () => {
      const departureTime = new Date('2024-01-20T08:00:00Z');
      const expectedEndDate = new Date(departureTime.getTime() + 7 * 24 * 60 * 60 * 1000);

      const planRequest = {
        departure: {
          port: 'Boston',
          latitude: 42.3601,
          longitude: -71.0589,
          time: departureTime
        },
        destination: {
          port: 'Portland',
          latitude: 43.6591,
          longitude: -70.2568
        }
      };

      const mockTidal = require('../../../agents/tidal/src/TidalAgent').mock.results[0].value;

      await (orchestrator as any).planPassage(planRequest);
      
      expect(mockTidal.handleToolCall).toHaveBeenCalledWith(
        'get_tide_predictions',
        expect.objectContaining({
          start_date: departureTime,
          end_date: expectedEndDate.toISOString()
        })
      );
    });
  });

  // ============================================================================
  // TEST GROUP 2: Summary Generation (Warnings & Recommendations)
  // ============================================================================

  describe('Summary Generation', () => {
    it('should calculate estimated arrival time from route duration', async () => {
      const departureTime = new Date('2024-01-20T08:00:00Z');

      const planRequest = {
        departure: {
          port: 'Boston',
          latitude: 42.3601,
          longitude: -71.0589,
          time: departureTime
        },
        destination: {
          port: 'Portland',
          latitude: 43.6591,
          longitude: -70.2568
        }
      };

      const result = await (orchestrator as any).planPassage(planRequest);
      const plan = JSON.parse(result.content[0].text);
      
      // Estimated arrival = departure + duration
      // Duration: 17.14 hours
      const expectedArrival = new Date(departureTime.getTime() + 17.14 * 60 * 60 * 1000);
      const actualArrival = new Date(plan.summary.estimatedArrival);
      
      // Allow 1 minute tolerance
      const diff = Math.abs(actualArrival.getTime() - expectedArrival.getTime());
      expect(diff).toBeLessThan(60 * 1000);
    });

    it('should include departure time in summary', async () => {
      const departureTime = new Date('2024-01-20T08:00:00Z');

      const planRequest = {
        departure: {
          port: 'Boston',
          latitude: 42.3601,
          longitude: -71.0589,
          time: departureTime
        },
        destination: {
          port: 'Portland',
          latitude: 43.6591,
          longitude: -70.2568
        }
      };

      const result = await (orchestrator as any).planPassage(planRequest);
      const plan = JSON.parse(result.content[0].text);
      
      expect(plan.summary.departureTime).toBe(departureTime);
    });

    it('should generate appropriate recommendations for short passages', async () => {
      const planRequest = {
        departure: {
          port: 'Boston',
          latitude: 42.3601,
          longitude: -71.0589,
          time: new Date('2024-01-20T08:00:00Z')
        },
        destination: {
          port: 'Salem',
          latitude: 42.5195,
          longitude: -70.8967
        }
      };

      const result = await (orchestrator as any).planPassage(planRequest);
      const plan = JSON.parse(result.content[0].text);
      
      // Should always include base safety recommendations
      expect(plan.summary.recommendations.length).toBeGreaterThan(0);
      expect(plan.summary.recommendations.some((r: string) => 
        r.toLowerCase().includes('float plan')
      )).toBe(true);
    });

    it('should not warn about provisions for short passages (<200nm)', async () => {
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
      
      // 85.7nm passage shouldn't trigger long passage warnings
      expect(plan.summary.recommendations.some((r: string) => 
        r.toLowerCase().includes('provision')
      )).toBe(false);
    });
  });

  // ============================================================================
  // TEST GROUP 3: Data Flow and Dependencies
  // ============================================================================

  describe('Data Flow and Dependencies', () => {
    it('should use route waypoints for weather forecast locations', async () => {
      const mockRoute = require('../../../agents/route/src/RouteAgent').mock.results[0].value;
      const mockWeather = require('../../../agents/weather/src/WeatherAgent').mock.results[0].value;

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
      
      // Route should be called first
      expect(mockRoute.handleToolCall).toHaveBeenCalled();
      
      // Weather should be called for each waypoint from route
      expect(mockWeather.handleToolCall).toHaveBeenCalledTimes(4);
    });

    it('should use departure coordinates for tidal predictions', async () => {
      const mockTidal = require('../../../agents/tidal/src/TidalAgent').mock.results[0].value;

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
      
      expect(mockTidal.handleToolCall).toHaveBeenCalledWith(
        'get_tide_predictions',
        expect.objectContaining({
          latitude: 42.3601, // Departure coordinates
          longitude: -71.0589
        })
      );
    });

    it('should propagate vessel information to route calculation', async () => {
      const mockRoute = require('../../../agents/route/src/RouteAgent').mock.results[0].value;

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
        },
        vessel: {
          type: 'sailboat',
          cruiseSpeed: 5.5,
          maxSpeed: 8
        }
      };

      await (orchestrator as any).planPassage(planRequest);
      
      expect(mockRoute.handleToolCall).toHaveBeenCalledWith(
        'calculate_route',
        expect.objectContaining({
          vessel_speed: 5.5
        })
      );
    });

    it('should default vessel speed if not provided', async () => {
      const mockRoute = require('../../../agents/route/src/RouteAgent').mock.results[0].value;

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
        // No vessel specified
      };

      await (orchestrator as any).planPassage(planRequest);
      
      // Should default to 5 knots
      expect(mockRoute.handleToolCall).toHaveBeenCalledWith(
        'calculate_route',
        expect.objectContaining({
          vessel_speed: 5
        })
      );
    });
  });

  // ============================================================================
  // TEST GROUP 4: Request Variations
  // ============================================================================

  describe('Request Variations', () => {
    it('should handle passage with all optional parameters', async () => {
      const planRequest = {
        userId: 'sailor_456',
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
          type: 'catamaran',
          cruiseSpeed: 6.5,
          maxSpeed: 10
        },
        preferences: {
          avoidNight: true,
          maxWindSpeed: 25,
          maxWaveHeight: 6,
          preferredStops: ['Gloucester', 'Portsmouth']
        }
      };

      const result = await (orchestrator as any).planPassage(planRequest);
      const plan = JSON.parse(result.content[0].text);
      
      expect(plan.request.vessel.type).toBe('catamaran');
      expect(plan.request.preferences.avoidNight).toBe(true);
    });

    it('should handle passage with minimal parameters', async () => {
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
        // No userId, vessel, or preferences
      };

      const result = await (orchestrator as any).planPassage(planRequest);
      const plan = JSON.parse(result.content[0].text);
      
      expect(plan.route).toBeDefined();
      expect(plan.summary).toBeDefined();
    });

    it('should handle different geographic locations', async () => {
      const locations = [
        {
          name: 'Miami to Bimini',
          departure: { port: 'Miami', latitude: 25.7617, longitude: -80.1918, time: new Date() },
          destination: { port: 'Bimini', latitude: 25.7, longitude: -79.3 }
        },
        {
          name: 'San Francisco to Half Moon Bay',
          departure: { port: 'San Francisco', latitude: 37.8, longitude: -122.4, time: new Date() },
          destination: { port: 'Half Moon Bay', latitude: 37.5, longitude: -122.5 }
        }
      ];

      for (const location of locations) {
        const planRequest = {
          departure: location.departure,
          destination: location.destination
        };

        const result = await (orchestrator as any).planPassage(planRequest);
        const plan = JSON.parse(result.content[0].text);
        
        expect(plan.route).toBeDefined();
        expect(plan.summary).toBeDefined();
      }
    });
  });
});

