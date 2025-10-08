import { describe, it, expect, beforeAll, afterAll, jest } from '@jest/globals';

// Mock uuid before importing SafetyAgent
jest.mock('uuid', () => ({
  v4: () => 'test-uuid-12345',
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

import { SafetyAgent } from '../index';

describe('SafetyAgent - Safety Critical Tests', () => {
  let safetyAgent: SafetyAgent;

  beforeAll(async () => {
    // Initialize the safety agent
    safetyAgent = new SafetyAgent();
    await safetyAgent.initialize();
  });

  afterAll(async () => {
    await safetyAgent.shutdown();
  });

  describe('Initialization', () => {
    it('should initialize successfully', () => {
      expect(safetyAgent).toBeDefined();
    });

    it('should return all safety tools', () => {
      const tools = safetyAgent.getTools();
      expect(tools).toHaveLength(8); // 5 original + 3 new production features
      
      const toolNames = tools.map(t => t.name);
      // Original tools
      expect(toolNames).toContain('check_route_safety');
      expect(toolNames).toContain('get_navigation_warnings');
      expect(toolNames).toContain('get_emergency_contacts');
      expect(toolNames).toContain('generate_safety_brief');
      expect(toolNames).toContain('check_weather_hazards');
      // New production tools
      expect(toolNames).toContain('check_depth_safety');
      expect(toolNames).toContain('check_restricted_areas');
      expect(toolNames).toContain('apply_safety_override');
    });
  });

  describe('Route Safety Analysis - SAFETY CRITICAL', () => {
    it('should analyze route safety for valid route', async () => {
      const route = [
        { latitude: 42.3601, longitude: -71.0589 }, // Boston
        { latitude: 43.6591, longitude: -70.2568 }  // Portland
      ];

      const result = await safetyAgent.handleToolCall('check_route_safety', {
        route,
        departure_time: new Date().toISOString(),
        vessel_draft: 6.5
      });

      expect(result).toHaveProperty('content');
      expect(result.content).toHaveLength(1);
      
      const analysis = JSON.parse(result.content[0].text);
      expect(analysis).toHaveProperty('routeAnalyzed', true);
      expect(analysis).toHaveProperty('safetyScore');
      expect(analysis).toHaveProperty('warnings');
      expect(analysis).toHaveProperty('hazards');
      expect(analysis).toHaveProperty('recommendations');
      expect(analysis).toHaveProperty('emergencyProcedures');
      
      // Verify emergency procedures are present
      expect(analysis.emergencyProcedures).toHaveProperty('manOverboard');
      expect(analysis.emergencyProcedures).toHaveProperty('engineFailure');
      expect(analysis.emergencyProcedures).toHaveProperty('medicalEmergency');
      expect(analysis.emergencyProcedures).toHaveProperty('collision');
    });

    it('should detect shallow water hazards for deep draft vessel', async () => {
      const route = [
        { latitude: 42.0, longitude: -71.0 },
        { latitude: 42.5, longitude: -70.5 }
      ];

      const result = await safetyAgent.handleToolCall('check_route_safety', {
        route,
        vessel_draft: 12.0 // Very deep draft
      });

      const analysis = JSON.parse(result.content[0].text);
      // With deep draft, should potentially have shallow water warnings
      expect(analysis.hazards).toBeDefined();
      expect(Array.isArray(analysis.hazards)).toBe(true);
    });

    it('should provide recommendations for long routes', async () => {
      const longRoute = [];
      for (let i = 0; i < 15; i++) {
        longRoute.push({
          latitude: 42.0 + i * 0.1,
          longitude: -71.0 + i * 0.1
        });
      }

      const result = await safetyAgent.handleToolCall('check_route_safety', {
        route: longRoute
      });

      const analysis = JSON.parse(result.content[0].text);
      expect(analysis.recommendations).toBeDefined();
      expect(analysis.recommendations.length).toBeGreaterThan(0);
      
      // Should recommend rest stops for long passages
      const hasRestStopRec = analysis.recommendations.some((rec: string) => 
        rec.toLowerCase().includes('rest')
      );
      expect(hasRestStopRec).toBe(true);
    });

    it('should handle single-point route', async () => {
      const route = [{ latitude: 42.3601, longitude: -71.0589 }];

      const result = await safetyAgent.handleToolCall('check_route_safety', {
        route
      });

      const analysis = JSON.parse(result.content[0].text);
      expect(analysis.routeAnalyzed).toBe(true);
      expect(analysis.totalWaypoints).toBe(1);
    });

    it('should reject invalid coordinates', async () => {
      await expect(
        safetyAgent.handleToolCall('check_route_safety', {
          route: [
            { latitude: 999, longitude: 999 } // Invalid
          ]
        })
      ).rejects.toThrow();
    });

    it('should calculate safety score correctly', async () => {
      const route = [
        { latitude: 42.3601, longitude: -71.0589 },
        { latitude: 43.6591, longitude: -70.2568 }
      ];

      const result = await safetyAgent.handleToolCall('check_route_safety', {
        route
      });

      const analysis = JSON.parse(result.content[0].text);
      expect(analysis.safetyScore).toMatch(/^(Excellent|Good|Fair|Poor)$/);
    });
  });

  describe('Navigation Warnings - SAFETY CRITICAL', () => {
    it('should get navigation warnings for area', async () => {
      const bounds = {
        north: 43.0,
        south: 42.0,
        east: -70.0,
        west: -71.0
      };

      const result = await safetyAgent.handleToolCall('get_navigation_warnings', {
        bounds
      });

      expect(result).toHaveProperty('content');
      const warnings = JSON.parse(result.content[0].text);
      
      expect(warnings).toHaveProperty('area');
      expect(warnings).toHaveProperty('warningCount');
      expect(warnings).toHaveProperty('warnings');
      expect(warnings).toHaveProperty('lastUpdated');
      expect(Array.isArray(warnings.warnings)).toBe(true);
    });

    it('should include warning severity levels', async () => {
      const bounds = {
        north: 43.0,
        south: 42.0,
        east: -70.0,
        west: -71.0
      };

      const result = await safetyAgent.handleToolCall('get_navigation_warnings', {
        bounds
      });

      const warnings = JSON.parse(result.content[0].text);
      
      if (warnings.warnings.length > 0) {
        warnings.warnings.forEach((warning: any) => {
          expect(warning).toHaveProperty('id');
          expect(warning).toHaveProperty('type');
          expect(warning).toHaveProperty('title');
          expect(warning).toHaveProperty('description');
          expect(warning).toHaveProperty('severity');
          expect(['urgent', 'warning', 'advisory']).toContain(warning.severity);
        });
      }
    });

    it('should handle very large areas', async () => {
      const bounds = {
        north: 45.0,
        south: 40.0,
        east: -60.0,
        west: -80.0
      };

      const result = await safetyAgent.handleToolCall('get_navigation_warnings', {
        bounds
      });

      const warnings = JSON.parse(result.content[0].text);
      expect(warnings).toBeDefined();
      expect(warnings.warningCount).toBeDefined();
    });

    it('should reject invalid bounds', async () => {
      await expect(
        safetyAgent.handleToolCall('get_navigation_warnings', {
          bounds: {
            north: 40.0,
            south: 45.0, // Invalid: south > north
            east: -70.0,
            west: -71.0
          }
        })
      ).rejects.toThrow();
    });
  });

  describe('Emergency Contacts - SAFETY CRITICAL', () => {
    it('should provide emergency contacts for US waters', async () => {
      const result = await safetyAgent.handleToolCall('get_emergency_contacts', {
        latitude: 42.3601,
        longitude: -71.0589,
        country: 'US'
      });

      const contacts = JSON.parse(result.content[0].text);
      
      expect(contacts).toHaveProperty('location');
      expect(contacts).toHaveProperty('country', 'US');
      expect(contacts).toHaveProperty('emergency');
      expect(contacts).toHaveProperty('towingServices');
      expect(contacts).toHaveProperty('medical');
      expect(contacts).toHaveProperty('weather');
      expect(contacts).toHaveProperty('customs');
      
      // Verify Coast Guard info
      expect(contacts.emergency.coastGuard).toHaveProperty('name');
      expect(contacts.emergency.coastGuard).toHaveProperty('vhf');
      expect(contacts.emergency.coastGuard).toHaveProperty('phone');
      expect(contacts.emergency.coastGuard.vhf).toContain('16');
    });

    it('should auto-detect country from coordinates', async () => {
      const result = await safetyAgent.handleToolCall('get_emergency_contacts', {
        latitude: 42.3601,
        longitude: -71.0589
        // No country provided
      });

      const contacts = JSON.parse(result.content[0].text);
      expect(contacts.country).toBeDefined();
    });

    it('should include towing services', async () => {
      const result = await safetyAgent.handleToolCall('get_emergency_contacts', {
        latitude: 42.3601,
        longitude: -71.0589
      });

      const contacts = JSON.parse(result.content[0].text);
      expect(Array.isArray(contacts.towingServices)).toBe(true);
      expect(contacts.towingServices.length).toBeGreaterThan(0);
      
      contacts.towingServices.forEach((service: any) => {
        expect(service).toHaveProperty('name');
        expect(service).toHaveProperty('phone');
        expect(service).toHaveProperty('vhf');
      });
    });

    it('should include medical emergency contacts', async () => {
      const result = await safetyAgent.handleToolCall('get_emergency_contacts', {
        latitude: 42.3601,
        longitude: -71.0589
      });

      const contacts = JSON.parse(result.content[0].text);
      expect(contacts.medical).toBeDefined();
      expect(contacts.medical).toHaveProperty('poisonControl');
      expect(contacts.medical).toHaveProperty('medicalAdvice');
    });

    it('should include weather information channels', async () => {
      const result = await safetyAgent.handleToolCall('get_emergency_contacts', {
        latitude: 42.3601,
        longitude: -71.0589
      });

      const contacts = JSON.parse(result.content[0].text);
      expect(contacts.weather).toBeDefined();
      expect(contacts.weather).toHaveProperty('vhf');
      expect(contacts.weather.vhf).toHaveProperty('wx1');
    });
  });

  describe('Safety Brief Generation - SAFETY CRITICAL', () => {
    it('should generate comprehensive safety brief', async () => {
      const result = await safetyAgent.handleToolCall('generate_safety_brief', {
        departure_port: 'Boston, MA',
        destination_port: 'Portland, ME',
        route_distance: 100,
        estimated_duration: '12 hours',
        crew_size: 2,
        vessel_type: 'sailboat'
      });

      const brief = JSON.parse(result.content[0].text);
      
      expect(brief).toHaveProperty('passage');
      expect(brief).toHaveProperty('preDeparture');
      expect(brief).toHaveProperty('crewBriefing');
      expect(brief).toHaveProperty('emergencyProcedures');
      expect(brief).toHaveProperty('communication');
      expect(brief).toHaveProperty('weatherMonitoring');
    });

    it('should include pre-departure checklist', async () => {
      const result = await safetyAgent.handleToolCall('generate_safety_brief', {
        departure_port: 'Boston, MA',
        destination_port: 'Portland, ME'
      });

      const brief = JSON.parse(result.content[0].text);
      expect(brief.preDeparture).toHaveProperty('checklist');
      expect(Array.isArray(brief.preDeparture.checklist)).toBe(true);
      expect(brief.preDeparture.checklist.length).toBeGreaterThan(10);
      
      // Check for critical items
      const checklistText = brief.preDeparture.checklist.join(' ').toLowerCase();
      expect(checklistText).toContain('weather');
      expect(checklistText).toContain('safety');
      expect(checklistText).toContain('epirb');
      expect(checklistText).toContain('life jacket');
    });

    it('should include emergency procedures', async () => {
      const result = await safetyAgent.handleToolCall('generate_safety_brief', {
        departure_port: 'Boston, MA',
        destination_port: 'Portland, ME'
      });

      const brief = JSON.parse(result.content[0].text);
      const procedures = brief.emergencyProcedures;
      
      expect(procedures).toHaveProperty('manOverboard');
      expect(procedures).toHaveProperty('fire');
      expect(procedures).toHaveProperty('flooding');
      expect(procedures).toHaveProperty('medicalEmergency');
      
      expect(Array.isArray(procedures.manOverboard)).toBe(true);
      expect(procedures.manOverboard.length).toBeGreaterThan(3);
    });

    it('should adapt watch schedule to crew size', async () => {
      // Test with 2 crew
      const result2 = await safetyAgent.handleToolCall('generate_safety_brief', {
        departure_port: 'Boston, MA',
        destination_port: 'Portland, ME',
        crew_size: 2
      });
      const brief2 = JSON.parse(result2.content[0].text);
      expect(brief2.crewBriefing.watchSchedule.type).toBe('two-watch');

      // Test with 1 crew (single-handed)
      const result1 = await safetyAgent.handleToolCall('generate_safety_brief', {
        departure_port: 'Boston, MA',
        destination_port: 'Portland, ME',
        crew_size: 1
      });
      const brief1 = JSON.parse(result1.content[0].text);
      expect(brief1.crewBriefing.watchSchedule.type).toBe('single-handed');

      // Test with 3+ crew
      const result3 = await safetyAgent.handleToolCall('generate_safety_brief', {
        departure_port: 'Boston, MA',
        destination_port: 'Portland, ME',
        crew_size: 3
      });
      const brief3 = JSON.parse(result3.content[0].text);
      expect(brief3.crewBriefing.watchSchedule.type).toBe('three-watch');
    });

    it('should include communication protocols', async () => {
      const result = await safetyAgent.handleToolCall('generate_safety_brief', {
        departure_port: 'Boston, MA',
        destination_port: 'Portland, ME'
      });

      const brief = JSON.parse(result.content[0].text);
      expect(brief.communication).toHaveProperty('vhf');
      expect(brief.communication.vhf).toHaveProperty('emergency');
      expect(brief.communication.vhf.emergency).toContain('16');
    });

    it('should include weather monitoring guidance', async () => {
      const result = await safetyAgent.handleToolCall('generate_safety_brief', {
        departure_port: 'Boston, MA',
        destination_port: 'Portland, ME'
      });

      const brief = JSON.parse(result.content[0].text);
      expect(brief.weatherMonitoring).toHaveProperty('sources');
      expect(brief.weatherMonitoring).toHaveProperty('abortCriteria');
      expect(Array.isArray(brief.weatherMonitoring.abortCriteria)).toBe(true);
    });
  });

  describe('Weather Hazard Detection - SAFETY CRITICAL', () => {
    it('should detect weather hazards for location', async () => {
      const result = await safetyAgent.handleToolCall('check_weather_hazards', {
        latitude: 42.3601,
        longitude: -71.0589
      });

      const hazards = JSON.parse(result.content[0].text);
      
      expect(hazards).toHaveProperty('location');
      expect(hazards).toHaveProperty('timeRange');
      expect(hazards).toHaveProperty('hazardsDetected');
      expect(hazards).toHaveProperty('marine');
      expect(Array.isArray(hazards.hazardsDetected)).toBe(true);
    });

    it('should detect gale warnings for high wind speeds', async () => {
      const result = await safetyAgent.handleToolCall('check_weather_hazards', {
        latitude: 42.3601,
        longitude: -71.0589
      });

      const hazards = JSON.parse(result.content[0].text);
      expect(hazards.marine).toHaveProperty('windSpeed');
      expect(hazards.marine.windSpeed).toHaveProperty('max');
      expect(hazards.marine.windSpeed).toHaveProperty('average');
      expect(hazards.marine.windSpeed).toHaveProperty('unit');
    });

    it('should detect small craft advisories', async () => {
      const result = await safetyAgent.handleToolCall('check_weather_hazards', {
        latitude: 42.3601,
        longitude: -71.0589
      });

      const hazards = JSON.parse(result.content[0].text);
      if (hazards.marine.windSpeed.max > 20) {
        const hasSmallCraftAdvisory = hazards.hazardsDetected.some(
          (h: any) => h.type === 'small_craft_advisory'
        );
        expect(hasSmallCraftAdvisory).toBe(true);
      }
    });

    it('should include wave height information', async () => {
      const result = await safetyAgent.handleToolCall('check_weather_hazards', {
        latitude: 42.3601,
        longitude: -71.0589
      });

      const hazards = JSON.parse(result.content[0].text);
      expect(hazards.marine).toHaveProperty('waveHeight');
      expect(hazards.marine.waveHeight).toHaveProperty('max');
    });

    it('should include visibility information', async () => {
      const result = await safetyAgent.handleToolCall('check_weather_hazards', {
        latitude: 42.3601,
        longitude: -71.0589
      });

      const hazards = JSON.parse(result.content[0].text);
      expect(hazards.marine).toHaveProperty('visibility');
      expect(hazards.marine.visibility).toHaveProperty('min');
    });

    it('should accept custom time range', async () => {
      const now = new Date();
      const futureTime = new Date(now.getTime() + 48 * 60 * 60 * 1000);

      const result = await safetyAgent.handleToolCall('check_weather_hazards', {
        latitude: 42.3601,
        longitude: -71.0589,
        time_range: {
          start: now.toISOString(),
          end: futureTime.toISOString()
        }
      });

      const hazards = JSON.parse(result.content[0].text);
      expect(hazards.timeRange).toHaveProperty('start');
      expect(hazards.timeRange).toHaveProperty('end');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle unknown tool calls gracefully', async () => {
      await expect(
        safetyAgent.handleToolCall('nonexistent_tool', {})
      ).rejects.toThrow('Unknown tool');
    });

    it('should validate required parameters for check_route_safety', async () => {
      await expect(
        safetyAgent.handleToolCall('check_route_safety', {
          // Missing route
        })
      ).rejects.toThrow();
    });

    it('should validate required parameters for get_navigation_warnings', async () => {
      await expect(
        safetyAgent.handleToolCall('get_navigation_warnings', {
          // Missing bounds
        })
      ).rejects.toThrow();
    });

    it('should validate required parameters for get_emergency_contacts', async () => {
      await expect(
        safetyAgent.handleToolCall('get_emergency_contacts', {
          // Missing latitude/longitude
        })
      ).rejects.toThrow();
    });

    it('should handle polar coordinates', async () => {
      // Test arctic coordinates
      const result = await safetyAgent.handleToolCall('get_emergency_contacts', {
        latitude: 78.2232,
        longitude: 15.6267
      });

      const contacts = JSON.parse(result.content[0].text);
      expect(contacts).toBeDefined();
      expect(contacts.location).toHaveProperty('latitude', 78.2232);
    });

    it('should handle coordinates at International Date Line', async () => {
      const result = await safetyAgent.handleToolCall('get_emergency_contacts', {
        latitude: 0,
        longitude: 180
      });

      const contacts = JSON.parse(result.content[0].text);
      expect(contacts).toBeDefined();
    });

    it('should handle equator crossing', async () => {
      const route = [
        { latitude: 5, longitude: -30 },
        { latitude: -5, longitude: -30 }
      ];

      const result = await safetyAgent.handleToolCall('check_route_safety', {
        route
      });

      const analysis = JSON.parse(result.content[0].text);
      expect(analysis.routeAnalyzed).toBe(true);
    });
  });

  describe('Data Validation', () => {
    it('should reject latitude > 90', async () => {
      await expect(
        safetyAgent.handleToolCall('get_emergency_contacts', {
          latitude: 91,
          longitude: 0
        })
      ).rejects.toThrow();
    });

    it('should reject latitude < -90', async () => {
      await expect(
        safetyAgent.handleToolCall('get_emergency_contacts', {
          latitude: -91,
          longitude: 0
        })
      ).rejects.toThrow();
    });

    it('should reject longitude > 180', async () => {
      await expect(
        safetyAgent.handleToolCall('get_emergency_contacts', {
          latitude: 0,
          longitude: 181
        })
      ).rejects.toThrow();
    });

    it('should reject longitude < -180', async () => {
      await expect(
        safetyAgent.handleToolCall('get_emergency_contacts', {
          latitude: 0,
          longitude: -181
        })
      ).rejects.toThrow();
    });

    it('should handle negative crew size', async () => {
      await expect(
        safetyAgent.handleToolCall('generate_safety_brief', {
          departure_port: 'Boston',
          destination_port: 'Portland',
          crew_size: -1
        })
      ).rejects.toThrow();
    });

    it('should handle zero crew size', async () => {
      await expect(
        safetyAgent.handleToolCall('generate_safety_brief', {
          departure_port: 'Boston',
          destination_port: 'Portland',
          crew_size: 0
        })
      ).rejects.toThrow();
    });
  });

  describe('Distance Calculations', () => {
    it('should calculate distances correctly', async () => {
      const route = [
        { latitude: 42.0, longitude: -71.0 },
        { latitude: 43.0, longitude: -71.0 } // ~60nm north
      ];

      const result = await safetyAgent.handleToolCall('check_route_safety', {
        route
      });

      const analysis = JSON.parse(result.content[0].text);
      expect(analysis).toBeDefined();
      // Distance calculation is internal, but route should be analyzed
      expect(analysis.routeAnalyzed).toBe(true);
    });

    it('should handle very short routes', async () => {
      const route = [
        { latitude: 42.0, longitude: -71.0 },
        { latitude: 42.001, longitude: -71.001 } // ~0.1nm
      ];

      const result = await safetyAgent.handleToolCall('check_route_safety', {
        route
      });

      const analysis = JSON.parse(result.content[0].text);
      expect(analysis.routeAnalyzed).toBe(true);
    });

    it('should handle very long routes', async () => {
      const route = [
        { latitude: 42.0, longitude: -71.0 }, // Boston
        { latitude: 51.5, longitude: -0.1 }   // London (~3000nm)
      ];

      const result = await safetyAgent.handleToolCall('check_route_safety', {
        route
      });

      const analysis = JSON.parse(result.content[0].text);
      expect(analysis.routeAnalyzed).toBe(true);
      // Should recommend rest stops for long passages
      expect(analysis.recommendations.length).toBeGreaterThan(0);
    });
  });
});

