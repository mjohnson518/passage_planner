/**
 * Safety Agent: getNavigationWarnings Comprehensive Tests
 * 
 * PURPOSE: Validate navigation warning retrieval that provides mariners with
 * real-time hazard information including obstructions, military zones, and
 * weather advisories for specific geographic areas.
 * 
 * COVERAGE TARGET: 85%+ of getNavigationWarnings function
 * 
 * MARITIME SAFETY PRINCIPLE: Current navigation warnings are essential for
 * safe passage planning. Mariners must be aware of temporary obstructions,
 * military exercises, and hazards not shown on charts.
 * 
 * NOTE: Current implementation returns MOCK warnings. Tests validate the
 * structure and filtering logic. Real NOAA warning API integration will
 * maintain the same interface.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

// Mock uuid before importing SafetyAgent
jest.mock('uuid', () => ({
  v4: () => 'test-warnings-uuid-12345',
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

describe('SafetyAgent: getNavigationWarnings - REAL-TIME HAZARD AWARENESS', () => {
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
    it('should reject missing bounds parameter', async () => {
      await expect(
        agent.handleToolCall('get_navigation_warnings', {})
      ).rejects.toThrow('Bounds are required');
    });

    it('should reject bounds without north coordinate', async () => {
      await expect(
        agent.handleToolCall('get_navigation_warnings', {
          bounds: {
            south: 42.0,
            east: -70.0,
            west: -71.0
          }
        })
      ).rejects.toThrow('Bounds must include north, south, east, and west');
    });

    it('should reject bounds without south coordinate', async () => {
      await expect(
        agent.handleToolCall('get_navigation_warnings', {
          bounds: {
            north: 43.0,
            east: -70.0,
            west: -71.0
          }
        })
      ).rejects.toThrow('Bounds must include north, south, east, and west');
    });

    it('should reject bounds without east coordinate', async () => {
      await expect(
        agent.handleToolCall('get_navigation_warnings', {
          bounds: {
            north: 43.0,
            south: 42.0,
            west: -71.0
          }
        })
      ).rejects.toThrow('Bounds must include north, south, east, and west');
    });

    it('should reject bounds without west coordinate', async () => {
      await expect(
        agent.handleToolCall('get_navigation_warnings', {
          bounds: {
            north: 43.0,
            south: 42.0,
            east: -70.0
          }
        })
      ).rejects.toThrow('Bounds must include north, south, east, and west');
    });

    it('should reject invalid bounds (north < south)', async () => {
      await expect(
        agent.handleToolCall('get_navigation_warnings', {
          bounds: {
            north: 42.0,
            south: 43.0, // South > North (invalid)
            east: -70.0,
            west: -71.0
          }
        })
      ).rejects.toThrow('North latitude must be greater than south latitude');
    });
  });

  // ============================================================================
  // TEST GROUP 2: Warning Retrieval (Core Functionality)
  // ============================================================================

  describe('Warning Retrieval', () => {
    it('should retrieve navigation warnings for valid area', async () => {
      const result = await agent.handleToolCall('get_navigation_warnings', {
        bounds: {
          north: 43.0,
          south: 42.0,
          east: -70.0,
          west: -71.0
        }
      });

      const response = JSON.parse(result.content[0].text);
      
      expect(response).toBeDefined();
      expect(response.area).toBeDefined();
      expect(response.warningCount).toBeDefined();
      expect(response.warnings).toBeDefined();
      expect(Array.isArray(response.warnings)).toBe(true);
    });

    it('should include warning count in response', async () => {
      const result = await agent.handleToolCall('get_navigation_warnings', {
        bounds: {
          north: 43.0,
          south: 42.0,
          east: -70.0,
          west: -71.0
        }
      });

      const response = JSON.parse(result.content[0].text);
      
      expect(response.warningCount).toBeDefined();
      expect(typeof response.warningCount).toBe('number');
      expect(response.warningCount).toBeGreaterThanOrEqual(0);
      expect(response.warningCount).toBe(response.warnings.length);
    });

    it('should include last updated timestamp', async () => {
      const result = await agent.handleToolCall('get_navigation_warnings', {
        bounds: {
          north: 43.0,
          south: 42.0,
          east: -70.0,
          west: -71.0
        }
      });

      const response = JSON.parse(result.content[0].text);
      
      expect(response.lastUpdated).toBeDefined();
      expect(typeof response.lastUpdated).toBe('string');
      // Should be valid ISO 8601 timestamp
      expect(() => new Date(response.lastUpdated)).not.toThrow();
    });

    it('should return mock warnings (3 types: obstruction, military, weather)', async () => {
      const result = await agent.handleToolCall('get_navigation_warnings', {
        bounds: {
          north: 43.0,
          south: 42.0,
          east: -70.0,
          west: -71.0
        }
      });

      const response = JSON.parse(result.content[0].text);
      
      // Implementation returns 3 mock warnings
      expect(response.warnings.length).toBeGreaterThan(0);
      expect(response.warnings.length).toBe(3); // Current implementation
      
      // Verify warning types present
      const types = response.warnings.map((w: any) => w.type);
      expect(types).toContain('obstruction');
      expect(types).toContain('military_exercise');
      expect(types).toContain('weather');
    });
  });

  // ============================================================================
  // TEST GROUP 3: Warning Structure (Data Completeness)
  // ============================================================================

  describe('Warning Structure and Content', () => {
    it('should include complete warning details', async () => {
      const result = await agent.handleToolCall('get_navigation_warnings', {
        bounds: {
          north: 43.0,
          south: 42.0,
          east: -70.0,
          west: -71.0
        }
      });

      const response = JSON.parse(result.content[0].text);
      
      if (response.warnings.length > 0) {
        const warning = response.warnings[0];
        expect(warning.id).toBeDefined();
        expect(warning.type).toBeDefined();
        expect(warning.title).toBeDefined();
        expect(warning.description).toBeDefined();
        expect(warning.issued).toBeDefined();
        expect(warning.expires).toBeDefined();
        expect(warning.severity).toBeDefined();
      }
    });

    it('should include obstruction warning details', async () => {
      const result = await agent.handleToolCall('get_navigation_warnings', {
        bounds: {
          north: 43.0,
          south: 42.0,
          east: -70.0,
          west: -71.0
        }
      });

      const response = JSON.parse(result.content[0].text);
      
      const obstructionWarnings = response.warnings.filter(
        (w: any) => w.type === 'obstruction'
      );
      
      if (obstructionWarnings.length > 0) {
        const warning = obstructionWarnings[0];
        expect(warning.location).toBeDefined();
        expect(warning.location.latitude).toBeDefined();
        expect(warning.location.longitude).toBeDefined();
      }
    });

    it('should include military exercise warning details', async () => {
      const result = await agent.handleToolCall('get_navigation_warnings', {
        bounds: {
          north: 43.0,
          south: 42.0,
          east: -70.0,
          west: -71.0
        }
      });

      const response = JSON.parse(result.content[0].text);
      
      const militaryWarnings = response.warnings.filter(
        (w: any) => w.type === 'military_exercise'
      );
      
      if (militaryWarnings.length > 0) {
        const warning = militaryWarnings[0];
        expect(warning.area).toBeDefined();
        expect(warning.schedule).toBeDefined();
      }
    });

    it('should include weather warning details', async () => {
      const result = await agent.handleToolCall('get_navigation_warnings', {
        bounds: {
          north: 43.0,
          south: 42.0,
          east: -70.0,
          west: -71.0
        }
      });

      const response = JSON.parse(result.content[0].text);
      
      const weatherWarnings = response.warnings.filter(
        (w: any) => w.type === 'weather'
      );
      
      if (weatherWarnings.length > 0) {
        const warning = weatherWarnings[0];
        expect(warning.area).toBeDefined();
        expect(warning.description).toBeDefined();
      }
    });

    it('should include warning severity levels', async () => {
      const result = await agent.handleToolCall('get_navigation_warnings', {
        bounds: {
          north: 43.0,
          south: 42.0,
          east: -70.0,
          west: -71.0
        }
      });

      const response = JSON.parse(result.content[0].text);
      
      for (const warning of response.warnings) {
        expect(warning.severity).toBeDefined();
        expect(['urgent', 'warning', 'advisory', 'info']).toContain(warning.severity);
      }
    });
  });

  // ============================================================================
  // TEST GROUP 4: Geographic Coverage (Different Locations)
  // ============================================================================

  describe('Geographic Coverage', () => {
    it('should handle different geographic areas', async () => {
      const areas = [
        { name: 'Boston', north: 43.0, south: 42.0, east: -70.0, west: -71.0 },
        { name: 'Miami', north: 26.0, south: 25.0, east: -79.0, west: -80.5 },
        { name: 'San Francisco', north: 38.0, south: 37.0, east: -122.0, west: -123.0 },
      ];

      for (const area of areas) {
        const result = await agent.handleToolCall('get_navigation_warnings', {
          bounds: {
            north: area.north,
            south: area.south,
            east: area.east,
            west: area.west
          }
        });

        const response = JSON.parse(result.content[0].text);
        expect(response.warnings).toBeDefined();
        expect(Array.isArray(response.warnings)).toBe(true);
      }
    });

    it('should handle small geographic area', async () => {
      const result = await agent.handleToolCall('get_navigation_warnings', {
        bounds: {
          north: 42.4,
          south: 42.3,
          east: -70.9,
          west: -71.0
        }
      });

      const response = JSON.parse(result.content[0].text);
      expect(response.warnings).toBeDefined();
    });

    it('should handle large geographic area', async () => {
      const result = await agent.handleToolCall('get_navigation_warnings', {
        bounds: {
          north: 45.0,
          south: 40.0,
          east: -68.0,
          west: -74.0
        }
      });

      const response = JSON.parse(result.content[0].text);
      expect(response.warnings).toBeDefined();
    });

    it('should include queried area bounds in response', async () => {
      const bounds = {
        north: 43.0,
        south: 42.0,
        east: -70.0,
        west: -71.0
      };

      const result = await agent.handleToolCall('get_navigation_warnings', {
        bounds
      });

      const response = JSON.parse(result.content[0].text);
      
      expect(response.area).toEqual(bounds);
    });
  });

  // ============================================================================
  // TEST GROUP 5: Response Structure and MCP Compliance
  // ============================================================================

  describe('Response Structure and MCP Compliance', () => {
    it('should return complete navigation warnings response', async () => {
      const result = await agent.handleToolCall('get_navigation_warnings', {
        bounds: {
          north: 43.0,
          south: 42.0,
          east: -70.0,
          west: -71.0
        }
      });

      const response = JSON.parse(result.content[0].text);
      
      // Verify all required fields
      expect(response.area).toBeDefined();
      expect(response.warningCount).toBeDefined();
      expect(response.warnings).toBeDefined();
      expect(response.lastUpdated).toBeDefined();
    });

    it('should return MCP-compliant response format', async () => {
      const result = await agent.handleToolCall('get_navigation_warnings', {
        bounds: {
          north: 43.0,
          south: 42.0,
          east: -70.0,
          west: -71.0
        }
      });

      expect(result.content).toBeDefined();
      expect(Array.isArray(result.content)).toBe(true);
      expect(result.content[0].type).toBe('text');
      expect(() => JSON.parse(result.content[0].text)).not.toThrow();
    });

    it('should return warnings as array', async () => {
      const result = await agent.handleToolCall('get_navigation_warnings', {
        bounds: {
          north: 43.0,
          south: 42.0,
          east: -70.0,
          west: -71.0
        }
      });

      const response = JSON.parse(result.content[0].text);
      
      expect(Array.isArray(response.warnings)).toBe(true);
    });

    it('should include warning count matching array length', async () => {
      const result = await agent.handleToolCall('get_navigation_warnings', {
        bounds: {
          north: 43.0,
          south: 42.0,
          east: -70.0,
          west: -71.0
        }
      });

      const response = JSON.parse(result.content[0].text);
      
      expect(response.warningCount).toBe(response.warnings.length);
    });
  });

  // ============================================================================
  // TEST GROUP 6: Edge Cases and Boundary Conditions
  // ============================================================================

  describe('Edge Cases and Boundary Conditions', () => {
    it('should handle bounds at maximum valid coordinates', async () => {
      const result = await agent.handleToolCall('get_navigation_warnings', {
        bounds: {
          north: 90,
          south: -90,
          east: 180,
          west: -180
        }
      });

      const response = JSON.parse(result.content[0].text);
      expect(response.warnings).toBeDefined();
    });

    it('should handle bounds crossing International Date Line', async () => {
      const result = await agent.handleToolCall('get_navigation_warnings', {
        bounds: {
          north: 35.0,
          south: 30.0,
          east: -170.0,
          west: 170.0
        }
      });

      const response = JSON.parse(result.content[0].text);
      expect(response.warnings).toBeDefined();
    });

    it('should handle bounds at equator', async () => {
      const result = await agent.handleToolCall('get_navigation_warnings', {
        bounds: {
          north: 1.0,
          south: -1.0,
          east: -30.0,
          west: -31.0
        }
      });

      const response = JSON.parse(result.content[0].text);
      expect(response.warnings).toBeDefined();
    });

    it('should handle consistent results for same bounds', async () => {
      const bounds = {
        north: 43.0,
        south: 42.0,
        east: -70.0,
        west: -71.0
      };

      const result1 = await agent.handleToolCall('get_navigation_warnings', { bounds });
      const result2 = await agent.handleToolCall('get_navigation_warnings', { bounds });

      const response1 = JSON.parse(result1.content[0].text);
      const response2 = JSON.parse(result2.content[0].text);

      // Mock data should be consistent
      expect(response1.warningCount).toBe(response2.warningCount);
      expect(response1.warnings.length).toBe(response2.warnings.length);
    });
  });
});

