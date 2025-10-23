/**
 * Safety Agent: getEmergencyContacts Comprehensive Tests
 * 
 * PURPOSE: Validate emergency contact retrieval that provides mariners with
 * critical contact information for Coast Guard, rescue services, towing,
 * medical facilities, and weather information.
 * 
 * COVERAGE TARGET: 85%+ of getEmergencyContacts function
 * 
 * MARITIME SAFETY PRINCIPLE: In emergencies, rapid access to correct contact
 * information can save lives. All vessels should have emergency contacts
 * readily available for their operating area.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

// Mock uuid before importing SafetyAgent
jest.mock('uuid', () => ({
  v4: () => 'test-contacts-uuid-12345',
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

describe('SafetyAgent: getEmergencyContacts - EMERGENCY PREPAREDNESS', () => {
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
    it('should reject missing latitude parameter', async () => {
      await expect(
        agent.handleToolCall('get_emergency_contacts', {
          longitude: -71.0589
        })
      ).rejects.toThrow('Latitude and longitude are required');
    });

    it('should reject missing longitude parameter', async () => {
      await expect(
        agent.handleToolCall('get_emergency_contacts', {
          latitude: 42.3601
        })
      ).rejects.toThrow('Latitude and longitude are required');
    });

    it('should reject invalid latitude (> 90)', async () => {
      await expect(
        agent.handleToolCall('get_emergency_contacts', {
          latitude: 95,
          longitude: -71.0589
        })
      ).rejects.toThrow('Invalid latitude: 95');
    });

    it('should reject invalid latitude (< -90)', async () => {
      await expect(
        agent.handleToolCall('get_emergency_contacts', {
          latitude: -95,
          longitude: -71.0589
        })
      ).rejects.toThrow('Invalid latitude: -95');
    });

    it('should reject invalid longitude (> 180)', async () => {
      await expect(
        agent.handleToolCall('get_emergency_contacts', {
          latitude: 42.3601,
          longitude: 185
        })
      ).rejects.toThrow('Invalid longitude: 185');
    });

    it('should reject invalid longitude (< -180)', async () => {
      await expect(
        agent.handleToolCall('get_emergency_contacts', {
          latitude: 42.3601,
          longitude: -185
        })
      ).rejects.toThrow('Invalid longitude: -185');
    });
  });

  // ============================================================================
  // TEST GROUP 2: Contact Information Completeness
  // ============================================================================

  describe('Contact Information Completeness', () => {
    it('should return complete emergency contact structure', async () => {
      const result = await agent.handleToolCall('get_emergency_contacts', {
        latitude: 42.3601,
        longitude: -71.0589
      });

      const response = JSON.parse(result.content[0].text);
      
      // Verify all major sections present
      expect(response.location).toBeDefined();
      expect(response.country).toBeDefined();
      expect(response.emergency).toBeDefined();
      expect(response.towingServices).toBeDefined();
      expect(response.medical).toBeDefined();
      expect(response.weather).toBeDefined();
      expect(response.customs).toBeDefined();
    });

    it('should include Coast Guard contact details', async () => {
      const result = await agent.handleToolCall('get_emergency_contacts', {
        latitude: 42.3601,
        longitude: -71.0589
      });

      const response = JSON.parse(result.content[0].text);
      const coastGuard = response.emergency.coastGuard;
      
      expect(coastGuard).toBeDefined();
      expect(coastGuard.name).toBe('US Coast Guard');
      expect(coastGuard.vhf).toBeDefined();
      expect(coastGuard.vhf).toContain('Channel 16');
      expect(coastGuard.phone).toBeDefined();
      expect(coastGuard.mmsi).toBeDefined();
    });

    it('should include rescue service contacts', async () => {
      const result = await agent.handleToolCall('get_emergency_contacts', {
        latitude: 42.3601,
        longitude: -71.0589
      });

      const response = JSON.parse(result.content[0].text);
      const rescue = response.emergency.rescue;
      
      expect(rescue).toBeDefined();
      expect(rescue.phone).toBeDefined();
      expect(rescue.vhf).toBe('Channel 16');
    });

    it('should include towing service information', async () => {
      const result = await agent.handleToolCall('get_emergency_contacts', {
        latitude: 42.3601,
        longitude: -71.0589
      });

      const response = JSON.parse(result.content[0].text);
      
      expect(response.towingServices).toBeDefined();
      expect(Array.isArray(response.towingServices)).toBe(true);
      expect(response.towingServices.length).toBeGreaterThan(0);
      
      // Verify towing service has required fields
      const towService = response.towingServices[0];
      expect(towService.name).toBeDefined();
      expect(towService.phone).toBeDefined();
      expect(towService.vhf).toBeDefined();
    });

    it('should include medical facility information', async () => {
      const result = await agent.handleToolCall('get_emergency_contacts', {
        latitude: 42.3601,
        longitude: -71.0589
      });

      const response = JSON.parse(result.content[0].text);
      
      expect(response.medical).toBeDefined();
      expect(response.medical.poisonControl).toBeDefined();
      expect(response.medical.medicalAdvice).toBeDefined();
      expect(response.medical.nearestHospital).toBeDefined();
      expect(response.medical.nearestHospital.helicopterCapable).toBeDefined();
    });

    it('should include weather information sources', async () => {
      const result = await agent.handleToolCall('get_emergency_contacts', {
        latitude: 42.3601,
        longitude: -71.0589
      });

      const response = JSON.parse(result.content[0].text);
      
      expect(response.weather).toBeDefined();
      expect(response.weather.vhf).toBeDefined();
      expect(response.weather.phone).toBeDefined();
    });

    it('should include customs/border protection information', async () => {
      const result = await agent.handleToolCall('get_emergency_contacts', {
        latitude: 42.3601,
        longitude: -71.0589
      });

      const response = JSON.parse(result.content[0].text);
      
      expect(response.customs).toBeDefined();
      expect(response.customs.cbp).toBeDefined();
      expect(response.customs.cbp.phone).toBeDefined();
    });
  });

  // ============================================================================
  // TEST GROUP 3: Country Detection and Optional Parameter
  // ============================================================================

  describe('Country Detection', () => {
    it('should use provided country parameter', async () => {
      const result = await agent.handleToolCall('get_emergency_contacts', {
        latitude: 49.2827,
        longitude: -123.1207,
        country: 'CA'
      });

      const response = JSON.parse(result.content[0].text);
      
      expect(response.country).toBe('CA');
    });

    it('should default to US when country not provided', async () => {
      const result = await agent.handleToolCall('get_emergency_contacts', {
        latitude: 42.3601,
        longitude: -71.0589
      });

      const response = JSON.parse(result.content[0].text);
      
      expect(response.country).toBe('US');
    });

    it('should include queried location in response', async () => {
      const result = await agent.handleToolCall('get_emergency_contacts', {
        latitude: 42.3601,
        longitude: -71.0589
      });

      const response = JSON.parse(result.content[0].text);
      
      expect(response.location.latitude).toBe(42.3601);
      expect(response.location.longitude).toBe(-71.0589);
    });
  });

  // ============================================================================
  // TEST GROUP 4: Geographic Coverage
  // ============================================================================

  describe('Geographic Coverage', () => {
    it('should handle different locations', async () => {
      const locations = [
        { name: 'Boston', latitude: 42.3601, longitude: -71.0589 },
        { name: 'Miami', latitude: 25.7617, longitude: -80.1918 },
        { name: 'San Francisco', latitude: 37.8044, longitude: -122.2712 },
      ];

      for (const location of locations) {
        const result = await agent.handleToolCall('get_emergency_contacts', {
          latitude: location.latitude,
          longitude: location.longitude
        });

        const response = JSON.parse(result.content[0].text);
        expect(response.emergency.coastGuard).toBeDefined();
        expect(response.medical).toBeDefined();
      }
    });

    it('should handle international waters', async () => {
      const result = await agent.handleToolCall('get_emergency_contacts', {
        latitude: 35.0,
        longitude: -50.0 // Mid-Atlantic
      });

      const response = JSON.parse(result.content[0].text);
      expect(response.emergency).toBeDefined();
    });
  });

  // ============================================================================
  // TEST GROUP 5: Response Structure and MCP Compliance
  // ============================================================================

  describe('Response Structure and MCP Compliance', () => {
    it('should return MCP-compliant response format', async () => {
      const result = await agent.handleToolCall('get_emergency_contacts', {
        latitude: 42.3601,
        longitude: -71.0589
      });

      expect(result.content).toBeDefined();
      expect(Array.isArray(result.content)).toBe(true);
      expect(result.content[0].type).toBe('text');
      expect(() => JSON.parse(result.content[0].text)).not.toThrow();
    });

    it('should provide actionable VHF contact information', async () => {
      const result = await agent.handleToolCall('get_emergency_contacts', {
        latitude: 42.3601,
        longitude: -71.0589
      });

      const response = JSON.parse(result.content[0].text);
      
      // VHF is primary emergency communication at sea
      expect(response.emergency.coastGuard.vhf).toContain('Channel 16');
      expect(response.emergency.rescue.vhf).toContain('Channel 16');
    });

    it('should provide phone numbers for all critical services', async () => {
      const result = await agent.handleToolCall('get_emergency_contacts', {
        latitude: 42.3601,
        longitude: -71.0589
      });

      const response = JSON.parse(result.content[0].text);
      
      expect(response.emergency.coastGuard.phone).toBeDefined();
      expect(response.emergency.rescue.phone).toBeDefined();
      expect(response.medical.poisonControl).toBeDefined();
      expect(response.weather.phone).toBeDefined();
    });
  });
});

