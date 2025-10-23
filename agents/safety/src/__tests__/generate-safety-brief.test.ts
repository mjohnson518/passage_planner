/**
 * Safety Agent: generateSafetyBrief Comprehensive Tests
 * 
 * PURPOSE: Validate pre-departure safety briefing generation that ensures
 * crew preparedness for passage planning. Comprehensive briefings include
 * checklists, emergency procedures, watch schedules, and communication plans.
 * 
 * COVERAGE TARGET: 85%+ of generateSafetyBrief function
 * 
 * MARITIME SAFETY PRINCIPLE: Proper pre-departure briefing is essential for
 * crew safety. All crew must know location of safety equipment, emergency
 * procedures, and watch responsibilities before departure.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

// Mock uuid before importing SafetyAgent
jest.mock('uuid', () => ({
  v4: () => 'test-brief-uuid-12345',
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

describe('SafetyAgent: generateSafetyBrief - PRE-DEPARTURE SAFETY', () => {
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
    it('should reject missing departure_port parameter', async () => {
      await expect(
        agent.handleToolCall('generate_safety_brief', {
          destination_port: 'Portland, ME'
        })
      ).rejects.toThrow('Departure port is required');
    });

    it('should reject missing destination_port parameter', async () => {
      await expect(
        agent.handleToolCall('generate_safety_brief', {
          departure_port: 'Boston, MA'
        })
      ).rejects.toThrow('Destination port is required');
    });

    it('should reject invalid crew_size (zero)', async () => {
      await expect(
        agent.handleToolCall('generate_safety_brief', {
          departure_port: 'Boston, MA',
          destination_port: 'Portland, ME',
          crew_size: 0
        })
      ).rejects.toThrow('Crew size must be greater than 0');
    });

    it('should reject invalid crew_size (negative)', async () => {
      await expect(
        agent.handleToolCall('generate_safety_brief', {
          departure_port: 'Boston, MA',
          destination_port: 'Portland, ME',
          crew_size: -2
        })
      ).rejects.toThrow('Crew size must be greater than 0');
    });
  });

  // ============================================================================
  // TEST GROUP 2: Briefing Completeness (Critical Safety Items)
  // ============================================================================

  describe('Pre-Departure Checklist Completeness', () => {
    it('should include complete 15-item pre-departure checklist', async () => {
      const result = await agent.handleToolCall('generate_safety_brief', {
        departure_port: 'Boston, MA',
        destination_port: 'Portland, ME',
        route_distance: 100,
        estimated_duration: '24 hours',
        crew_size: 2,
        vessel_type: 'sailboat'
      });

      const response = JSON.parse(result.content[0].text);
      
      expect(response.preDeparture).toBeDefined();
      expect(response.preDeparture.checklist).toBeDefined();
      expect(Array.isArray(response.preDeparture.checklist)).toBe(true);
      
      // Should have 15 checklist items as per implementation
      expect(response.preDeparture.checklist.length).toBe(15);
      
      // Verify key safety items present
      const checklistText = response.preDeparture.checklist.join(' ');
      expect(checklistText.toLowerCase()).toContain('weather');
      expect(checklistText.toLowerCase()).toContain('float plan');
      expect(checklistText.toLowerCase()).toContain('safety equipment');
      expect(checklistText.toLowerCase()).toContain('life jackets');
      expect(checklistText.toLowerCase()).toContain('epirb');
      expect(checklistText.toLowerCase()).toContain('vhf');
    });

    it('should include all four emergency procedures', async () => {
      const result = await agent.handleToolCall('generate_safety_brief', {
        departure_port: 'Boston, MA',
        destination_port: 'Portland, ME'
      });

      const response = JSON.parse(result.content[0].text);
      
      expect(response.emergencyProcedures).toBeDefined();
      expect(response.emergencyProcedures.manOverboard).toBeDefined();
      expect(response.emergencyProcedures.fire).toBeDefined();
      expect(response.emergencyProcedures.flooding).toBeDefined();
      expect(response.emergencyProcedures.medicalEmergency).toBeDefined();
      
      // Verify each procedure has steps
      expect(Array.isArray(response.emergencyProcedures.manOverboard)).toBe(true);
      expect(response.emergencyProcedures.manOverboard.length).toBeGreaterThan(0);
      expect(Array.isArray(response.emergencyProcedures.fire)).toBe(true);
      expect(response.emergencyProcedures.fire.length).toBeGreaterThan(0);
    });

    it('should include crew briefing topics', async () => {
      const result = await agent.handleToolCall('generate_safety_brief', {
        departure_port: 'Boston, MA',
        destination_port: 'Portland, ME'
      });

      const response = JSON.parse(result.content[0].text);
      
      expect(response.crewBriefing).toBeDefined();
      expect(response.crewBriefing.topics).toBeDefined();
      expect(Array.isArray(response.crewBriefing.topics)).toBe(true);
      expect(response.crewBriefing.topics.length).toBeGreaterThan(0);
      
      // Verify key briefing topics
      const topicsText = response.crewBriefing.topics.join(' ');
      expect(topicsText.toLowerCase()).toContain('watch');
      expect(topicsText.toLowerCase()).toContain('safety equipment');
      expect(topicsText.toLowerCase()).toContain('man overboard');
    });

    it('should include communication plan', async () => {
      const result = await agent.handleToolCall('generate_safety_brief', {
        departure_port: 'Boston, MA',
        destination_port: 'Portland, ME'
      });

      const response = JSON.parse(result.content[0].text);
      
      expect(response.communication).toBeDefined();
      expect(response.communication.vhf).toBeDefined();
      expect(response.communication.vhf.emergency).toBe('Channel 16');
      expect(response.communication.checkIn).toBeDefined();
    });

    it('should include weather monitoring plan', async () => {
      const result = await agent.handleToolCall('generate_safety_brief', {
        departure_port: 'Boston, MA',
        destination_port: 'Portland, ME'
      });

      const response = JSON.parse(result.content[0].text);
      
      expect(response.weatherMonitoring).toBeDefined();
      expect(response.weatherMonitoring.sources).toBeDefined();
      expect(Array.isArray(response.weatherMonitoring.sources)).toBe(true);
      expect(response.weatherMonitoring.abortCriteria).toBeDefined();
      expect(Array.isArray(response.weatherMonitoring.abortCriteria)).toBe(true);
    });
  });

  // ============================================================================
  // TEST GROUP 3: Watch Schedule Generation (Crew Management)
  // ============================================================================

  describe('Watch Schedule Generation', () => {
    it('should generate single-handed watch schedule for solo crew', async () => {
      const result = await agent.handleToolCall('generate_safety_brief', {
        departure_port: 'Boston, MA',
        destination_port: 'Portland, ME',
        crew_size: 1
      });

      const response = JSON.parse(result.content[0].text);
      
      expect(response.crewBriefing.watchSchedule).toBeDefined();
      expect(response.crewBriefing.watchSchedule.type).toBe('single-handed');
      expect(response.crewBriefing.watchSchedule.notes).toBeDefined();
      expect(response.crewBriefing.watchSchedule.notes).toContain('20 minutes');
    });

    it('should generate two-watch schedule for 2-person crew', async () => {
      const result = await agent.handleToolCall('generate_safety_brief', {
        departure_port: 'Boston, MA',
        destination_port: 'Portland, ME',
        crew_size: 2
      });

      const response = JSON.parse(result.content[0].text);
      
      expect(response.crewBriefing.watchSchedule.type).toBe('two-watch');
      expect(response.crewBriefing.watchSchedule.schedule).toBeDefined();
      expect(Array.isArray(response.crewBriefing.watchSchedule.schedule)).toBe(true);
      expect(response.crewBriefing.watchSchedule.schedule.length).toBe(6); // 4-hour watches
    });

    it('should generate three-watch schedule for 3+ person crew', async () => {
      const result = await agent.handleToolCall('generate_safety_brief', {
        departure_port: 'Boston, MA',
        destination_port: 'Portland, ME',
        crew_size: 3
      });

      const response = JSON.parse(result.content[0].text);
      
      expect(response.crewBriefing.watchSchedule.type).toBe('three-watch');
      expect(response.crewBriefing.watchSchedule.schedule).toBeDefined();
      expect(Array.isArray(response.crewBriefing.watchSchedule.schedule)).toBe(true);
      expect(response.crewBriefing.watchSchedule.schedule.length).toBe(6); // 4-hour watches
    });

    it('should generate three-watch schedule for 4+ person crew', async () => {
      const result = await agent.handleToolCall('generate_safety_brief', {
        departure_port: 'Boston, MA',
        destination_port: 'Portland, ME',
        crew_size: 5
      });

      const response = JSON.parse(result.content[0].text);
      
      expect(response.crewBriefing.watchSchedule.type).toBe('three-watch');
      expect(response.crewBriefing.watchSchedule.schedule).toBeDefined();
    });
  });

  // ============================================================================
  // TEST GROUP 4: Passage Overview (Route Information)
  // ============================================================================

  describe('Passage Overview Information', () => {
    it('should include complete passage details', async () => {
      const result = await agent.handleToolCall('generate_safety_brief', {
        departure_port: 'Boston, MA',
        destination_port: 'Portland, ME',
        route_distance: 100,
        estimated_duration: '24 hours',
        crew_size: 2,
        vessel_type: 'sailboat'
      });

      const response = JSON.parse(result.content[0].text);
      
      expect(response.passage).toBeDefined();
      expect(response.passage.from).toBe('Boston, MA');
      expect(response.passage.to).toBe('Portland, ME');
      expect(response.passage.distance).toBe('100 nm');
      expect(response.passage.duration).toBe('24 hours');
      expect(response.passage.crew).toBe(2);
      expect(response.passage.vessel).toBe('sailboat');
    });

    it('should use default values for optional parameters', async () => {
      const result = await agent.handleToolCall('generate_safety_brief', {
        departure_port: 'Boston, MA',
        destination_port: 'Portland, ME'
      });

      const response = JSON.parse(result.content[0].text);
      
      expect(response.passage.distance).toBe('100 nm'); // Default
      expect(response.passage.duration).toBe('24 hours'); // Default
      expect(response.passage.crew).toBe(2); // Default
      expect(response.passage.vessel).toBe('sailboat'); // Default
    });

    it('should handle custom route distance', async () => {
      const result = await agent.handleToolCall('generate_safety_brief', {
        departure_port: 'Boston, MA',
        destination_port: 'Bermuda',
        route_distance: 650
      });

      const response = JSON.parse(result.content[0].text);
      
      expect(response.passage.distance).toBe('650 nm');
    });

    it('should handle custom estimated duration', async () => {
      const result = await agent.handleToolCall('generate_safety_brief', {
        departure_port: 'Boston, MA',
        destination_port: 'Bermuda',
        estimated_duration: '4 days'
      });

      const response = JSON.parse(result.content[0].text);
      
      expect(response.passage.duration).toBe('4 days');
    });

    it('should handle different vessel types', async () => {
      const vesselTypes = ['sailboat', 'powerboat', 'catamaran'];
      
      for (const vesselType of vesselTypes) {
        const result = await agent.handleToolCall('generate_safety_brief', {
          departure_port: 'Boston, MA',
          destination_port: 'Portland, ME',
          vessel_type: vesselType
        });

        const response = JSON.parse(result.content[0].text);
        expect(response.passage.vessel).toBe(vesselType);
      }
    });
  });

  // ============================================================================
  // TEST GROUP 5: Emergency Procedures Detail (Life-Safety)
  // ============================================================================

  describe('Emergency Procedures Content', () => {
    it('should provide detailed man overboard procedures', async () => {
      const result = await agent.handleToolCall('generate_safety_brief', {
        departure_port: 'Boston, MA',
        destination_port: 'Portland, ME'
      });

      const response = JSON.parse(result.content[0].text);
      const mobProcedure = response.emergencyProcedures.manOverboard;
      
      expect(Array.isArray(mobProcedure)).toBe(true);
      expect(mobProcedure.length).toBeGreaterThan(5);
      
      // Verify key MOB steps
      const mobText = mobProcedure.join(' ');
      expect(mobText).toContain('MAN OVERBOARD');
      expect(mobText).toContain('flotation');
      expect(mobText).toContain('MOB');
      expect(mobText).toContain('recovery');
    });

    it('should provide fire emergency procedures', async () => {
      const result = await agent.handleToolCall('generate_safety_brief', {
        departure_port: 'Boston, MA',
        destination_port: 'Portland, ME'
      });

      const response = JSON.parse(result.content[0].text);
      const fireProcedure = response.emergencyProcedures.fire;
      
      const fireText = fireProcedure.join(' ');
      expect(fireText).toContain('FIRE');
      expect(fireText).toContain('extinguisher');
    });

    it('should provide flooding emergency procedures', async () => {
      const result = await agent.handleToolCall('generate_safety_brief', {
        departure_port: 'Boston, MA',
        destination_port: 'Portland, ME'
      });

      const response = JSON.parse(result.content[0].text);
      const floodingProcedure = response.emergencyProcedures.flooding;
      
      const floodingText = floodingProcedure.join(' ');
      expect(floodingText).toContain('water');
      expect(floodingText).toContain('pump');
    });

    it('should provide medical emergency procedures', async () => {
      const result = await agent.handleToolCall('generate_safety_brief', {
        departure_port: 'Boston, MA',
        destination_port: 'Portland, ME'
      });

      const response = JSON.parse(result.content[0].text);
      const medicalProcedure = response.emergencyProcedures.medicalEmergency;
      
      const medicalText = medicalProcedure.join(' ');
      expect(medicalText).toContain('first aid');
      expect(medicalText).toContain('Coast Guard');
    });
  });

  // ============================================================================
  // TEST GROUP 6: Response Structure and Compliance
  // ============================================================================

  describe('Response Structure and MCP Compliance', () => {
    it('should return complete safety brief structure', async () => {
      const result = await agent.handleToolCall('generate_safety_brief', {
        departure_port: 'Boston, MA',
        destination_port: 'Portland, ME'
      });

      const response = JSON.parse(result.content[0].text);
      
      // Verify all major sections present
      expect(response.passage).toBeDefined();
      expect(response.preDeparture).toBeDefined();
      expect(response.crewBriefing).toBeDefined();
      expect(response.emergencyProcedures).toBeDefined();
      expect(response.communication).toBeDefined();
      expect(response.weatherMonitoring).toBeDefined();
    });

    it('should return MCP-compliant response format', async () => {
      const result = await agent.handleToolCall('generate_safety_brief', {
        departure_port: 'Boston, MA',
        destination_port: 'Portland, ME'
      });

      expect(result.content).toBeDefined();
      expect(Array.isArray(result.content)).toBe(true);
      expect(result.content[0].type).toBe('text');
      expect(() => JSON.parse(result.content[0].text)).not.toThrow();
    });

    it('should include weather monitoring sources', async () => {
      const result = await agent.handleToolCall('generate_safety_brief', {
        departure_port: 'Boston, MA',
        destination_port: 'Portland, ME'
      });

      const response = JSON.parse(result.content[0].text);
      
      expect(response.weatherMonitoring.sources).toBeDefined();
      expect(Array.isArray(response.weatherMonitoring.sources)).toBe(true);
      expect(response.weatherMonitoring.sources.length).toBeGreaterThan(0);
    });

    it('should include abort criteria', async () => {
      const result = await agent.handleToolCall('generate_safety_brief', {
        departure_port: 'Boston, MA',
        destination_port: 'Portland, ME'
      });

      const response = JSON.parse(result.content[0].text);
      
      expect(response.weatherMonitoring.abortCriteria).toBeDefined();
      expect(Array.isArray(response.weatherMonitoring.abortCriteria)).toBe(true);
      
      // Verify key abort criteria present
      const criteriaText = response.weatherMonitoring.abortCriteria.join(' ');
      expect(criteriaText.toLowerCase()).toContain('wind');
      expect(criteriaText.toLowerCase()).toContain('visibility');
    });

    it('should include VHF communication channels', async () => {
      const result = await agent.handleToolCall('generate_safety_brief', {
        departure_port: 'Boston, MA',
        destination_port: 'Portland, ME'
      });

      const response = JSON.parse(result.content[0].text);
      
      expect(response.communication.vhf.emergency).toBeDefined();
      expect(response.communication.vhf.working).toBeDefined();
      expect(response.communication.vhf.weather).toBeDefined();
    });
  });

  // ============================================================================
  // TEST GROUP 7: Multiple Scenarios & Edge Cases
  // ============================================================================

  describe('Various Passage Scenarios', () => {
    it('should handle short coastal passage', async () => {
      const result = await agent.handleToolCall('generate_safety_brief', {
        departure_port: 'Boston, MA',
        destination_port: 'Salem, MA',
        route_distance: 15,
        estimated_duration: '3 hours'
      });

      const response = JSON.parse(result.content[0].text);
      
      expect(response.passage.distance).toBe('15 nm');
      expect(response.preDeparture.checklist.length).toBe(15);
    });

    it('should handle medium offshore passage', async () => {
      const result = await agent.handleToolCall('generate_safety_brief', {
        departure_port: 'Boston, MA',
        destination_port: 'Portland, ME',
        route_distance: 100,
        estimated_duration: '24 hours'
      });

      const response = JSON.parse(result.content[0].text);
      
      expect(response.passage.distance).toBe('100 nm');
      expect(response.emergencyProcedures).toBeDefined();
    });

    it('should handle long ocean passage', async () => {
      const result = await agent.handleToolCall('generate_safety_brief', {
        departure_port: 'Boston, MA',
        destination_port: 'Bermuda',
        route_distance: 650,
        estimated_duration: '4-5 days'
      });

      const response = JSON.parse(result.content[0].text);
      
      expect(response.passage.distance).toBe('650 nm');
      expect(response.preDeparture.checklist.length).toBe(15);
    });

    it('should handle different crew sizes consistently', async () => {
      const crewSizes = [1, 2, 3, 4, 6];
      
      for (const crewSize of crewSizes) {
        const result = await agent.handleToolCall('generate_safety_brief', {
          departure_port: 'Boston, MA',
          destination_port: 'Portland, ME',
          crew_size: crewSize
        });

        const response = JSON.parse(result.content[0].text);
        expect(response.passage.crew).toBe(crewSize);
        expect(response.crewBriefing.watchSchedule).toBeDefined();
      }
    });

    it('should handle powerboat briefing', async () => {
      const result = await agent.handleToolCall('generate_safety_brief', {
        departure_port: 'Boston, MA',
        destination_port: 'Portland, ME',
        vessel_type: 'powerboat'
      });

      const response = JSON.parse(result.content[0].text);
      
      expect(response.passage.vessel).toBe('powerboat');
      expect(response.preDeparture.checklist).toBeDefined();
    });

    it('should handle catamaran briefing', async () => {
      const result = await agent.handleToolCall('generate_safety_brief', {
        departure_port: 'Boston, MA',
        destination_port: 'Portland, ME',
        vessel_type: 'catamaran'
      });

      const response = JSON.parse(result.content[0].text);
      
      expect(response.passage.vessel).toBe('catamaran');
      expect(response.emergencyProcedures).toBeDefined();
    });
  });
});

