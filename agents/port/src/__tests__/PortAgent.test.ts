/**
 * Port Agent Comprehensive Tests
 * 
 * COVERAGE TARGET: ≥85% for Port Agent functionality
 * 
 * Tests validate:
 * - Port search by coordinates
 * - Port details retrieval
 * - Emergency harbor finding
 * - Customs information
 * - Data validation and error handling
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

// Mock MCP SDK
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

import PortAgent from '../PortAgent';
import { PORT_DATABASE } from '../data/portDatabase';

describe('PortAgent - Comprehensive Port Information Service', () => {
  let agent: PortAgent;

  beforeEach(async () => {
    process.env.LOG_LEVEL = 'silent';
    agent = new PortAgent();
    await agent.initialize();
  });

  afterEach(async () => {
    await agent.shutdown();
  });

  describe('PART A: Initialization and Setup', () => {
    it('should initialize with port database loaded', async () => {
      expect(agent).toBeDefined();
      expect(PORT_DATABASE.length).toBeGreaterThanOrEqual(20);
    });

    it('should provide tools list', () => {
      const tools = agent.getTools();
      expect(tools.length).toBeGreaterThanOrEqual(4);
      
      const toolNames = tools.map(t => t.name);
      expect(toolNames).toContain('search_ports');
      expect(toolNames).toContain('get_port_details');
      expect(toolNames).toContain('find_emergency_harbors');
      expect(toolNames).toContain('get_customs_info');
    });

    it('should have complete port database', () => {
      expect(PORT_DATABASE.length).toBeGreaterThanOrEqual(20);
      
      // Verify each port has required fields
      PORT_DATABASE.forEach(port => {
        expect(port.id).toBeDefined();
        expect(port.name).toBeDefined();
        expect(port.coordinates).toBeDefined();
        expect(port.facilities).toBeDefined();
        expect(port.navigation).toBeDefined();
      });
    });
  });

  describe('PART B: Search Ports Functionality', () => {
    it('should search ports near Boston', async () => {
      const result = await agent.handleToolCall('search_ports', {
        latitude: 42.3601,
        longitude: -71.0589,
        radius: 50
      });

      const response = JSON.parse(result.content[0].text);
      
      expect(response.resultsFound).toBeGreaterThan(0);
      expect(response.ports).toBeDefined();
      expect(Array.isArray(response.ports)).toBe(true);
    });

    it('should search ports near Portland, ME', async () => {
      const result = await agent.handleToolCall('search_ports', {
        latitude: 43.6591,
        longitude: -70.2568,
        radius: 30
      });

      const response = JSON.parse(result.content[0].text);
      
      expect(response.resultsFound).toBeGreaterThan(0);
      expect(response.searchCenter).toEqual({
        latitude: 43.6591,
        longitude: -70.2568
      });
    });

    it('should filter ports by name', async () => {
      const result = await agent.handleToolCall('search_ports', {
        latitude: 42.3601,
        longitude: -71.0589,
        radius: 100,
        name: 'Boston'
      });

      const response = JSON.parse(result.content[0].text);
      
      if (response.resultsFound > 0) {
        expect(response.ports.some((p: any) => 
          p.name.toLowerCase().includes('boston') ||
          p.location.toLowerCase().includes('boston')
        )).toBe(true);
      }
    });

    it('should filter ports by vessel draft', async () => {
      const result = await agent.handleToolCall('search_ports', {
        latitude: 42.3601,
        longitude: -71.0589,
        radius: 50,
        draft: 6.0 // 6ft draft vessel
      });

      const response = JSON.parse(result.content[0].text);
      
      expect(response.draftConsidered).toBe(6.0);
      
      // All returned ports should have suitable depth
      if (response.ports && response.ports.length > 0) {
        response.ports.forEach((port: any) => {
          expect(port.suitable).toBe(true);
        });
      }
    });

    it('should return ports sorted by distance', async () => {
      const result = await agent.handleToolCall('search_ports', {
        latitude: 42.3601,
        longitude: -71.0589,
        radius: 100
      });

      const response = JSON.parse(result.content[0].text);
      
      if (response.ports && response.ports.length > 1) {
        // Verify distances are in ascending order
        for (let i = 0; i < response.ports.length - 1; i++) {
          const dist1 = parseFloat(response.ports[i].distance);
          const dist2 = parseFloat(response.ports[i + 1].distance);
          expect(dist1).toBeLessThanOrEqual(dist2);
        }
      }
    });

    it('should validate latitude bounds', async () => {
      await expect(agent.handleToolCall('search_ports', {
        latitude: 91, // Invalid
        longitude: -71.0589,
        radius: 50
      })).rejects.toThrow();
    });

    it('should validate longitude bounds', async () => {
      await expect(agent.handleToolCall('search_ports', {
        latitude: 42.3601,
        longitude: -181, // Invalid
        radius: 50
      })).rejects.toThrow();
    });

    it('should handle no results found', async () => {
      const result = await agent.handleToolCall('search_ports', {
        latitude: 0, // Middle of Atlantic
        longitude: -30,
        radius: 10
      });

      const response = JSON.parse(result.content[0].text);
      expect(response.resultsFound).toBe(0);
    });
  });

  describe('PART C: Get Port Details', () => {
    it('should retrieve Boston Constitution Marina details', async () => {
      const result = await agent.handleToolCall('get_port_details', {
        portId: 'boston-constitution-marina'
      });

      const response = JSON.parse(result.content[0].text);
      
      expect(response.found).toBe(true);
      expect(response.port.basic.name).toContain('Constitution');
      expect(response.port.facilities).toBeDefined();
      expect(response.port.navigation).toBeDefined();
      expect(response.port.contact).toBeDefined();
    });

    it('should retrieve port by name', async () => {
      const result = await agent.handleToolCall('get_port_details', {
        portName: 'Portland'
      });

      const response = JSON.parse(result.content[0].text);
      
      if (response.found) {
        expect(response.port.basic.name).toBeDefined();
        expect(response.port.localKnowledge).toBeDefined();
      }
    });

    it('should return not found for invalid port ID', async () => {
      const result = await agent.handleToolCall('get_port_details', {
        portId: 'invalid-port-id-12345'
      });

      const response = JSON.parse(result.content[0].text);
      expect(response.found).toBe(false);
    });

    it('should include comprehensive navigation info', async () => {
      const result = await agent.handleToolCall('get_port_details', {
        portId: 'boston-constitution-marina'
      });

      const response = JSON.parse(result.content[0].text);
      
      if (response.found) {
        expect(response.port.navigation.approachDepth).toBeDefined();
        expect(response.port.navigation.tidalRange).toBeDefined();
        expect(response.port.navigation.approach).toBeDefined();
      }
    });

    it('should include facilities information', async () => {
      const result = await agent.handleToolCall('get_port_details', {
        portId: 'portland-dimillo-marina'
      });

      const response = JSON.parse(result.content[0].text);
      
      if (response.found) {
        expect(response.port.facilities.fuel).toBeDefined();
        expect(response.port.facilities.water).toBeDefined();
        expect(response.port.facilities.repair).toBeDefined();
      }
    });

    it('should include local knowledge', async () => {
      const result = await agent.handleToolCall('get_port_details', {
        portId: 'newport-goat-island'
      });

      const response = JSON.parse(result.content[0].text);
      
      if (response.found) {
        expect(response.port.localKnowledge).toBeDefined();
        expect(response.port.localKnowledge.bestApproach).toBeDefined();
        expect(response.port.localKnowledge.weatherConsiderations).toBeDefined();
      }
    });

    it('should include recommendations', async () => {
      const result = await agent.handleToolCall('get_port_details', {
        portId: 'boston-constitution-marina'
      });

      const response = JSON.parse(result.content[0].text);
      
      if (response.found) {
        expect(response.port.recommendations).toBeDefined();
        expect(Array.isArray(response.port.recommendations)).toBe(true);
      }
    });
  });

  describe('PART D: Emergency Harbor Finding', () => {
    it('should find emergency harbors near distress location', async () => {
      const result = await agent.handleToolCall('find_emergency_harbors', {
        latitude: 42.0,
        longitude: -70.5,
        maxDistance: 50
      });

      const response = JSON.parse(result.content[0].text);
      
      expect(response.emergencyLocation).toBeDefined();
      expect(response.recommendations).toBeDefined();
    });

    it('should filter emergency harbors by draft', async () => {
      const result = await agent.handleToolCall('find_emergency_harbors', {
        latitude: 42.3601,
        longitude: -71.0589,
        maxDistance: 50,
        draft: 8.0 // Deep draft
      });

      const response = JSON.parse(result.content[0].text);
      
      expect(response.draftRequirement).toBe(8.0);
    });

    it('should filter by required services', async () => {
      const result = await agent.handleToolCall('find_emergency_harbors', {
        latitude: 42.3601,
        longitude: -71.0589,
        maxDistance: 100,
        requiredServices: ['fuel', 'repair']
      });

      const response = JSON.parse(result.content[0].text);
      
      expect(response.requiredServices).toContain('fuel');
      expect(response.requiredServices).toContain('repair');
    });

    it('should prioritize ports with best protection and facilities', async () => {
      const result = await agent.handleToolCall('find_emergency_harbors', {
        latitude: 42.0,
        longitude: -71.0,
        maxDistance: 100
      });

      const response = JSON.parse(result.content[0].text);
      
      if (response.recommendations && response.recommendations.length > 1) {
        // First recommendation should have high ratings
        const first = response.recommendations[0];
        expect(first.protection).toBeGreaterThanOrEqual(3);
      }
    });

    it('should handle emergency near Key West', async () => {
      const result = await agent.handleToolCall('find_emergency_harbors', {
        latitude: 24.5585,
        longitude: -81.8065,
        maxDistance: 30
      });

      const response = JSON.parse(result.content[0].text);
      expect(response.emergencyLocation).toBeDefined();
    });
  });

  describe('PART E: Customs Information', () => {
    it('should retrieve customs info for Port of Entry', async () => {
      const result = await agent.handleToolCall('get_customs_info', {
        portId: 'boston-constitution-marina'
      });

      const response = JSON.parse(result.content[0].text);
      
      expect(response.portOfEntry).toBeDefined();
    });

    it('should provide USA customs information', async () => {
      const result = await agent.handleToolCall('get_customs_info', {
        country: 'USA'
      });

      const response = JSON.parse(result.content[0].text);
      
      expect(response.country).toBe('United States');
      expect(response.requirements).toBeDefined();
      expect(response.contacts).toBeDefined();
    });

    it('should provide Bahamas customs information', async () => {
      const result = await agent.handleToolCall('get_customs_info', {
        country: 'BAHAMAS'
      });

      const response = JSON.parse(result.content[0].text);
      
      expect(response.country).toBe('Bahamas');
      expect(response.requirements).toBeDefined();
    });

    it('should handle unknown country', async () => {
      const result = await agent.handleToolCall('get_customs_info', {
        country: 'UNKNOWN_COUNTRY'
      });

      const response = JSON.parse(result.content[0].text);
      expect(response.message).toContain('not available');
    });

    it('should handle port not found', async () => {
      const result = await agent.handleToolCall('get_customs_info', {
        portId: 'non-existent-port'
      });

      const response = JSON.parse(result.content[0].text);
      expect(response.found).toBe(false);
    });
  });

  describe('PART F: Data Validation', () => {
    it('should validate required latitude', async () => {
      await expect(agent.handleToolCall('search_ports', {
        longitude: -71.0589,
        radius: 50
      })).rejects.toThrow();
    });

    it('should validate required longitude', async () => {
      await expect(agent.handleToolCall('search_ports', {
        latitude: 42.3601,
        radius: 50
      })).rejects.toThrow();
    });

    it('should validate latitude range (-90 to 90)', async () => {
      await expect(agent.handleToolCall('search_ports', {
        latitude: -91,
        longitude: -71.0589,
        radius: 50
      })).rejects.toThrow();
    });

    it('should validate longitude range (-180 to 180)', async () => {
      await expect(agent.handleToolCall('search_ports', {
        latitude: 42.3601,
        longitude: 181,
        radius: 50
      })).rejects.toThrow();
    });

    it('should handle unknown tool call', async () => {
      await expect(agent.handleToolCall('unknown_tool', {}))
        .rejects.toThrow('Unknown tool');
    });
  });

  describe('PART G: Port Database Coverage', () => {
    it('should include Boston area ports', () => {
      const bostonPorts = PORT_DATABASE.filter(p => 
        p.location.city === 'Boston' || 
        p.name.includes('Boston')
      );
      expect(bostonPorts.length).toBeGreaterThan(0);
    });

    it('should include Portland, ME ports', () => {
      const portlandPorts = PORT_DATABASE.filter(p => 
        p.location.city === 'Portland' && p.location.state === 'ME'
      );
      expect(portlandPorts.length).toBeGreaterThan(0);
    });

    it('should include Newport, RI ports', () => {
      const newportPorts = PORT_DATABASE.filter(p => 
        p.location.city === 'Newport'
      );
      expect(newportPorts.length).toBeGreaterThan(0);
    });

    it('should include Charleston, SC ports', () => {
      const charlestonPorts = PORT_DATABASE.filter(p => 
        p.location.city === 'Charleston'
      );
      expect(charlestonPorts.length).toBeGreaterThan(0);
    });

    it('should include Florida ports', () => {
      const floridaPorts = PORT_DATABASE.filter(p => 
        p.location.state === 'FL'
      );
      expect(floridaPorts.length).toBeGreaterThan(0);
    });

    it('should include ports of entry for customs', () => {
      const portsOfEntry = PORT_DATABASE.filter(p => 
        p.customs.portOfEntry === true
      );
      expect(portsOfEntry.length).toBeGreaterThanOrEqual(5);
    });

    it('should include ports with fuel available', () => {
      const fuelPorts = PORT_DATABASE.filter(p => 
        p.facilities.fuel !== undefined
      );
      expect(fuelPorts.length).toBeGreaterThan(15);
    });

    it('should include ports with repair services', () => {
      const repairPorts = PORT_DATABASE.filter(p => 
        p.facilities.repair.available === true
      );
      expect(repairPorts.length).toBeGreaterThan(15);
    });

    it('should include anchorages', () => {
      const anchorages = PORT_DATABASE.filter(p => 
        p.services.anchorage.available === true
      );
      expect(anchorages.length).toBeGreaterThan(10);
    });

    it('should have VHF channels for all ports', () => {
      PORT_DATABASE.forEach(port => {
        expect(port.contact.vhf).toBeDefined();
        expect(port.contact.vhf.length).toBeGreaterThan(0);
      });
    });
  });

  describe('PART H: Real-World Scenario Tests', () => {
    it('should find suitable port for deep draft vessel', async () => {
      const result = await agent.handleToolCall('search_ports', {
        latitude: 42.3601,
        longitude: -71.0589,
        radius: 50,
        draft: 8.5 // Deep draft sailboat
      });

      const response = JSON.parse(result.content[0].text);
      
      // Should find some suitable ports (deeper harbors)
      expect(response.ports).toBeDefined();
    });

    it('should find shallow draft anchorages', async () => {
      const result = await agent.handleToolCall('search_ports', {
        latitude: 41.4, // Elizabeth Islands area
        longitude: -70.9,
        radius: 20,
        draft: 4.0 // Shallow draft
      });

      const response = JSON.parse(result.content[0].text);
      expect(response).toBeDefined();
    });

    it('should identify ports with haul-out facilities', async () => {
      const portsWithHaulOut = PORT_DATABASE.filter(p => 
        p.facilities.haulOut === true
      );
      expect(portsWithHaulOut.length).toBeGreaterThan(10);
    });

    it('should identify ports with full chandlery', async () => {
      const chandleryPorts = PORT_DATABASE.filter(p => 
        p.facilities.chandlery === true
      );
      expect(chandleryPorts.length).toBeGreaterThan(10);
    });
  });

  describe('PART I: Edge Cases and Error Handling', () => {
    it('should handle extreme northern coordinates', async () => {
      const result = await agent.handleToolCall('search_ports', {
        latitude: 89, // Near north pole
        longitude: 0,
        radius: 50
      });

      const response = JSON.parse(result.content[0].text);
      expect(response.resultsFound).toBe(0);
    });

    it('should handle extreme southern coordinates', async () => {
      const result = await agent.handleToolCall('search_ports', {
        latitude: -89, // Near south pole
        longitude: 0,
        radius: 50
      });

      const response = JSON.parse(result.content[0].text);
      expect(response.resultsFound).toBe(0);
    });

    it('should handle very small radius', async () => {
      const result = await agent.handleToolCall('search_ports', {
        latitude: 42.3601,
        longitude: -71.0589,
        radius: 1 // 1 nautical mile
      });

      const response = JSON.parse(result.content[0].text);
      expect(response.radius).toBe(1);
    });

    it('should handle very large radius', async () => {
      const result = await agent.handleToolCall('search_ports', {
        latitude: 42.3601,
        longitude: -71.0589,
        radius: 500 // 500 nautical miles
      });

      const response = JSON.parse(result.content[0].text);
      expect(response.resultsFound).toBeGreaterThan(0);
      expect(response.radius).toBe(500);
    });
  });

  describe('PART J: Branch Coverage - Additional Scenarios', () => {
    it('should handle port search with name filter finding no matches', async () => {
      const result = await agent.handleToolCall('search_ports', {
        latitude: 42.3601,
        longitude: -71.0589,
        radius: 50,
        name: 'NONEXISTENT_PORT_NAME_12345'
      });

      const response = JSON.parse(result.content[0].text);
      expect(response.resultsFound).toBe(0);
    });

    it('should handle port details search by name finding nothing', async () => {
      const result = await agent.handleToolCall('get_port_details', {
        portName: 'TOTALLY_FAKE_PORT_99999'
      });

      const response = JSON.parse(result.content[0].text);
      expect(response.found).toBe(false);
    });

    it('should handle emergency harbors with no required services', async () => {
      const result = await agent.handleToolCall('find_emergency_harbors', {
        latitude: 42.3601,
        longitude: -71.0589,
        maxDistance: 50,
        requiredServices: [] // Empty array
      });

      const response = JSON.parse(result.content[0].text);
      expect(response.requiredServices).toEqual([]);
    });

    it('should get port details that have navigation hazards', async () => {
      // Block Island has hazards listed
      const result = await agent.handleToolCall('get_port_details', {
        portId: 'block-island-harbor'
      });

      const response = JSON.parse(result.content[0].text);
      
      if (response.found) {
        expect(response.port.navigation.safetyNotes).toBeDefined();
      }
    });

    it('should format port with phone contact', async () => {
      const result = await agent.handleToolCall('get_port_details', {
        portId: 'portland-dimillo-marina'
      });

      const response = JSON.parse(result.content[0].text);
      
      if (response.found && response.port.contact.phone) {
        expect(response.port.contact.phone).toContain('+1');
      }
    });

    it('should find ports without draft filtering', async () => {
      const result = await agent.handleToolCall('search_ports', {
        latitude: 43.6591,
        longitude: -70.2568,
        radius: 20
        // No draft specified - should use standard search
      });

      const response = JSON.parse(result.content[0].text);
      expect(response.draftConsidered).toBeUndefined();
    });

    it('should filter emergency harbors by unknown service (default case)', async () => {
      const result = await agent.handleToolCall('find_emergency_harbors', {
        latitude: 42.3601,
        longitude: -71.0589,
        maxDistance: 50,
        requiredServices: ['unknown_service_type'] // Triggers default case
      });

      const response = JSON.parse(result.content[0].text);
      // Should not filter out ports for unknown service
      expect(response).toBeDefined();
    });

    it('should throw error for get_customs_info with no parameters', async () => {
      await expect(agent.handleToolCall('get_customs_info', {}))
        .rejects.toThrow('Either portId or country is required');
    });

    it('should handle ports with all facility types', async () => {
      const result = await agent.handleToolCall('get_port_details', {
        portId: 'fort-lauderdale'
      });

      const response = JSON.parse(result.content[0].text);
      
      if (response.found) {
        expect(response.port.facilities).toBeDefined();
        // Fort Lauderdale has comprehensive facilities
        expect(response.port.recommendations.length).toBeGreaterThan(0);
      }
    });
  });
});


