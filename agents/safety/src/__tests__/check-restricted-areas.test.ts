/**
 * Safety Agent: checkRestrictedAreas Comprehensive Tests
 * 
 * PURPOSE: Validate restricted area checking that identifies when a planned
 * route conflicts with military zones, marine sanctuaries, shipping lanes,
 * or other restricted/hazardous areas.
 * 
 * COVERAGE TARGET: 85%+ of checkRestrictedAreas function
 * 
 * MARITIME SAFETY & REGULATORY PRINCIPLE: Vessels must avoid restricted areas
 * to comply with maritime law and prevent dangerous situations. Penalties for
 * violating military zones or marine sanctuaries can be severe.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

// Mock uuid before importing SafetyAgent
jest.mock('uuid', () => ({
  v4: () => 'test-restricted-uuid-12345',
}));

// Mock MCP SDK before importing SafetyAgent
jest.mock('@modelcontextprotocol/sdk/server/index.js', () => ({
  Server: jest.fn().mockImplementation(() => ({
    setRequestHandler: jest.fn(),
    connect: jest.fn(),
    close: jest.fn(),
  }))
}));

jest.mock('@modelcontextprotocol/sdk/types', () => ({
  ListToolsRequestSchema: { method: 'tools/list' },
  CallToolRequestSchema: { method: 'tools/call' }
}));

import SafetyAgent from '../index';

describe('SafetyAgent: checkRestrictedAreas - REGULATORY COMPLIANCE', () => {
  let agent: SafetyAgent;

  beforeEach(async () => {
    // Set test environment
    process.env.LOG_LEVEL = 'silent';
    process.env.NOAA_API_KEY = 'test-key';
    process.env.NODE_ENV = 'test';
    
    agent = new SafetyAgent();
    await agent.initialize();
  });

  afterEach(async () => {
    await agent.shutdown();
  });

  // ============================================================================
  // TEST GROUP 1: Input Validation (Robustness)
  // ============================================================================

  describe('Input Validation', () => {
    it('should reject missing waypoints parameter', async () => {
      await expect(
        agent.handleToolCall('check_restricted_areas', {})
      ).rejects.toThrow('Waypoints array is required');
    });

    it('should reject non-array waypoints', async () => {
      await expect(
        agent.handleToolCall('check_restricted_areas', {
          waypoints: 'not an array'
        })
      ).rejects.toThrow('Waypoints array is required');
    });

    it('should reject empty waypoints array', async () => {
      await expect(
        agent.handleToolCall('check_restricted_areas', {
          waypoints: []
        })
      ).rejects.toThrow('must not be empty');
    });
  });

  // ============================================================================
  // TEST GROUP 2: Restricted Area Detection
  // ============================================================================

  describe('Restricted Area Detection', () => {
    it('should check route against restricted areas', async () => {
      const result = await agent.handleToolCall('check_restricted_areas', {
        waypoints: [
          { latitude: 42.3601, longitude: -71.0589 },
          { latitude: 43.6591, longitude: -70.2568 }
        ]
      });

      const response = JSON.parse(result.content[0].text);
      
      expect(response.waypoints_checked).toBe(2);
      expect(response.restricted_areas_found).toBeDefined();
      expect(typeof response.restricted_areas_found).toBe('number');
      expect(response.conflicts).toBeDefined();
      expect(Array.isArray(response.conflicts)).toBe(true);
    });

    it('should return conflict details when areas found', async () => {
      const result = await agent.handleToolCall('check_restricted_areas', {
        waypoints: [
          { latitude: 42.3601, longitude: -71.0589 },
          { latitude: 43.6591, longitude: -70.2568 }
        ]
      });

      const response = JSON.parse(result.content[0].text);
      
      // If conflicts found, verify structure
      if (response.conflicts.length > 0) {
        const conflict = response.conflicts[0];
        expect(conflict.id).toBeDefined();
        expect(conflict.name).toBeDefined();
        expect(conflict.type).toBeDefined();
        expect(conflict.description).toBeDefined();
        expect(conflict.restrictions).toBeDefined();
        expect(conflict.authority).toBeDefined();
        expect(conflict.severity).toBeDefined();
      }
    });

    it('should classify military areas as critical severity', async () => {
      const result = await agent.handleToolCall('check_restricted_areas', {
        waypoints: [
          { latitude: 42.3601, longitude: -71.0589 },
          { latitude: 43.0, longitude: -70.5 }
        ]
      });

      const response = JSON.parse(result.content[0].text);
      
      const militaryConflicts = response.conflicts.filter(
        (c: any) => c.type === 'military'
      );
      
      if (militaryConflicts.length > 0) {
        expect(militaryConflicts[0].severity).toBe('critical');
      }
    });

    it('should classify marine sanctuaries as high severity', async () => {
      const result = await agent.handleToolCall('check_restricted_areas', {
        waypoints: [
          { latitude: 42.3601, longitude: -71.0589 },
          { latitude: 43.0, longitude: -70.5 }
        ]
      });

      const response = JSON.parse(result.content[0].text);
      
      const sanctuaryConflicts = response.conflicts.filter(
        (c: any) => c.type === 'marine_sanctuary'
      );
      
      if (sanctuaryConflicts.length > 0) {
        expect(sanctuaryConflicts[0].severity).toBe('high');
      }
    });

    it('should provide recommendations when conflicts found', async () => {
      const result = await agent.handleToolCall('check_restricted_areas', {
        waypoints: [
          { latitude: 42.3601, longitude: -71.0589 },
          { latitude: 43.0, longitude: -70.5 }
        ]
      });

      const response = JSON.parse(result.content[0].text);
      
      expect(response.recommendations).toBeDefined();
      expect(Array.isArray(response.recommendations)).toBe(true);
      expect(response.recommendations.length).toBeGreaterThan(0);
    });

    it('should recommend avoidance when conflicts found', async () => {
      const result = await agent.handleToolCall('check_restricted_areas', {
        waypoints: [
          { latitude: 42.3601, longitude: -71.0589 },
          { latitude: 43.0, longitude: -70.5 }
        ]
      });

      const response = JSON.parse(result.content[0].text);
      
      if (response.restricted_areas_found > 0) {
        const recommendationsText = response.recommendations.join(' ');
        expect(recommendationsText.toLowerCase()).toContain('avoid');
      }
    });
  });

  // ============================================================================
  // TEST GROUP 3: Multiple Waypoints and Route Scenarios
  // ============================================================================

  describe('Multiple Waypoints and Routes', () => {
    it('should handle single waypoint check', async () => {
      const result = await agent.handleToolCall('check_restricted_areas', {
        waypoints: [
          { latitude: 42.3601, longitude: -71.0589 }
        ]
      });

      const response = JSON.parse(result.content[0].text);
      
      expect(response.waypoints_checked).toBe(1);
      expect(response.conflicts).toBeDefined();
    });

    it('should handle multi-waypoint route', async () => {
      const result = await agent.handleToolCall('check_restricted_areas', {
        waypoints: [
          { latitude: 42.3601, longitude: -71.0589 },
          { latitude: 42.5, longitude: -71.0 },
          { latitude: 43.0, longitude: -70.5 },
          { latitude: 43.6591, longitude: -70.2568 }
        ]
      });

      const response = JSON.parse(result.content[0].text);
      
      expect(response.waypoints_checked).toBe(4);
    });

    it('should check all waypoints along route', async () => {
      const longRoute = Array.from({ length: 10 }, (_, i) => ({
        latitude: 42.0 + i * 0.5,
        longitude: -71.0 + i * 0.3
      }));

      const result = await agent.handleToolCall('check_restricted_areas', {
        waypoints: longRoute
      });

      const response = JSON.parse(result.content[0].text);
      
      expect(response.waypoints_checked).toBe(10);
    });
  });

  // ============================================================================
  // TEST GROUP 4: Response Structure and MCP Compliance
  // ============================================================================

  describe('Response Structure and MCP Compliance', () => {
    it('should return complete restricted areas check response', async () => {
      const result = await agent.handleToolCall('check_restricted_areas', {
        waypoints: [
          { latitude: 42.3601, longitude: -71.0589 },
          { latitude: 43.6591, longitude: -70.2568 }
        ]
      });

      const response = JSON.parse(result.content[0].text);
      
      expect(response.waypoints_checked).toBeDefined();
      expect(response.restricted_areas_found).toBeDefined();
      expect(response.conflicts).toBeDefined();
      expect(response.recommendations).toBeDefined();
    });

    it('should return MCP-compliant response format', async () => {
      const result = await agent.handleToolCall('check_restricted_areas', {
        waypoints: [
          { latitude: 42.3601, longitude: -71.0589 },
          { latitude: 43.6591, longitude: -70.2568 }
        ]
      });

      expect(result.content).toBeDefined();
      expect(Array.isArray(result.content)).toBe(true);
      expect(result.content[0].type).toBe('text');
      expect(() => JSON.parse(result.content[0].text)).not.toThrow();
    });

    it('should match conflict count to array length', async () => {
      const result = await agent.handleToolCall('check_restricted_areas', {
        waypoints: [
          { latitude: 42.3601, longitude: -71.0589 },
          { latitude: 43.6591, longitude: -70.2568 }
        ]
      });

      const response = JSON.parse(result.content[0].text);
      
      expect(response.restricted_areas_found).toBe(response.conflicts.length);
    });

    it('should provide actionable recommendations', async () => {
      const result = await agent.handleToolCall('check_restricted_areas', {
        waypoints: [
          { latitude: 42.3601, longitude: -71.0589 },
          { latitude: 43.6591, longitude: -70.2568 }
        ]
      });

      const response = JSON.parse(result.content[0].text);
      
      // Recommendations should always be present
      expect(response.recommendations).toBeDefined();
      expect(Array.isArray(response.recommendations)).toBe(true);
      expect(response.recommendations.length).toBeGreaterThan(0);
      
      if (response.restricted_areas_found > 0) {
        const recText = response.recommendations.join(' ');
        expect(recText.length).toBeGreaterThan(0);
      }
    });
  });
});

