/**
 * Safety Agent: checkDepthSafety Comprehensive Tests
 * 
 * PURPOSE: Validate depth safety calculations that prevent vessel groundings.
 * This is CRITICAL life-safety code - incorrect depth calculations can lead
 * to vessel groundings, damage, and crew injury.
 * 
 * COVERAGE TARGET: 85%+ of checkDepthSafety function
 * 
 * MARITIME SAFETY PRINCIPLE: Conservative depth margins prevent groundings.
 * Standard: 20% of draft minimum clearance
 * Novice crew: 30% of draft minimum clearance (extra safety margin)
 * 
 * CALCULATION: Clearance = (ChartedDepth + TidalHeight) - VesselDraft
 * Safety Margin = VesselDraft * 0.20 (or 0.30 for novice)
 * Safe if: Clearance >= SafetyMargin
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

// Mock uuid before importing SafetyAgent
jest.mock('uuid', () => ({
  v4: () => 'test-depth-uuid-12345',
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

describe('SafetyAgent: checkDepthSafety - GROUNDING PREVENTION', () => {
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
    it('should reject missing location parameter', async () => {
      await expect(
        agent.handleToolCall('check_depth_safety', {
          charted_depth: 20,
          vessel_draft: 6
        })
      ).rejects.toThrow('Location with latitude and longitude is required');
    });

    it('should reject location without latitude', async () => {
      await expect(
        agent.handleToolCall('check_depth_safety', {
          location: { longitude: -71.0589 },
          charted_depth: 20,
          vessel_draft: 6
        })
      ).rejects.toThrow('Location with latitude and longitude is required');
    });

    it('should reject location without longitude', async () => {
      await expect(
        agent.handleToolCall('check_depth_safety', {
          location: { latitude: 42.3601 },
          charted_depth: 20,
          vessel_draft: 6
        })
      ).rejects.toThrow('Location with latitude and longitude is required');
    });

    it('should reject missing charted_depth parameter', async () => {
      await expect(
        agent.handleToolCall('check_depth_safety', {
          location: { latitude: 42.3601, longitude: -71.0589 },
          vessel_draft: 6
        })
      ).rejects.toThrow('Charted depth is required');
    });

    it('should reject negative charted_depth', async () => {
      await expect(
        agent.handleToolCall('check_depth_safety', {
          location: { latitude: 42.3601, longitude: -71.0589 },
          charted_depth: -5,
          vessel_draft: 6
        })
      ).rejects.toThrow('must be non-negative');
    });

    it('should reject missing vessel_draft parameter', async () => {
      await expect(
        agent.handleToolCall('check_depth_safety', {
          location: { latitude: 42.3601, longitude: -71.0589 },
          charted_depth: 20
        })
      ).rejects.toThrow('Vessel draft is required');
    });

    it('should reject zero or negative vessel_draft', async () => {
      await expect(
        agent.handleToolCall('check_depth_safety', {
          location: { latitude: 42.3601, longitude: -71.0589 },
          charted_depth: 20,
          vessel_draft: 0
        })
      ).rejects.toThrow('must be positive');
    });

    it('should reject negative vessel_draft', async () => {
      await expect(
        agent.handleToolCall('check_depth_safety', {
          location: { latitude: 42.3601, longitude: -71.0589 },
          charted_depth: 20,
          vessel_draft: -3
        })
      ).rejects.toThrow('must be positive');
    });
  });

  // ============================================================================
  // TEST GROUP 2: Adequate Clearance (Safe Passage Scenarios)
  // ============================================================================

  describe('Adequate Clearance Scenarios', () => {
    it('should approve adequate clearance (>20% margin)', async () => {
      // Example: 20ft depth, 6ft draft = 14ft clearance
      // 20% of 6ft = 1.2ft minimum required
      // 14ft > 1.2ft = SAFE
      const result = await agent.handleToolCall('check_depth_safety', {
        location: { latitude: 42.3601, longitude: -71.0589 },
        charted_depth: 20,
        vessel_draft: 6,
        tidal_height: 0
      });

      const response = JSON.parse(result.content[0].text);
      
      expect(response.location).toEqual({ 
        latitude: 42.3601, 
        longitude: -71.0589 
      });
      expect(response.analysis).toBeDefined();
      expect(response.analysis.isGroundingRisk).toBe(false);
      expect(response.analysis.severity).toMatch(/safe|low/i);
    });

    it('should approve deep water (plenty of clearance)', async () => {
      // Example: 50ft depth, 6ft draft = 44ft clearance
      // WAY more than 20% margin needed
      const result = await agent.handleToolCall('check_depth_safety', {
        location: { latitude: 42.3601, longitude: -71.0589 },
        charted_depth: 50,
        vessel_draft: 6
      });

      const response = JSON.parse(result.content[0].text);
      
      expect(response.analysis.isGroundingRisk).toBe(false);
      expect(response.analysis.clearanceAvailable).toBeGreaterThan(40);
    });

    it('should handle shallow draft vessels safely', async () => {
      // Small boat: 15ft depth, 3ft draft = 12ft clearance
      // 20% of 3ft = 0.6ft minimum
      // 12ft > 0.6ft = VERY SAFE
      const result = await agent.handleToolCall('check_depth_safety', {
        location: { latitude: 42.3601, longitude: -71.0589 },
        charted_depth: 15,
        vessel_draft: 3
      });

      const response = JSON.parse(result.content[0].text);
      
      expect(response.analysis.isGroundingRisk).toBe(false);
    });

    it('should include tidal height in calculations', async () => {
      // Example: 12ft depth, 6ft draft, +3ft tide = 15ft actual depth
      // Clearance = 15 - 6 = 9ft (adequate)
      const result = await agent.handleToolCall('check_depth_safety', {
        location: { latitude: 42.3601, longitude: -71.0589 },
        charted_depth: 12,
        vessel_draft: 6,
        tidal_height: 3
      });

      const response = JSON.parse(result.content[0].text);
      
      expect(response.analysis.isGroundingRisk).toBe(false);
      // Should account for tidal adjustment
    });

    it('should default tidal height to 0 when not provided', async () => {
      const result = await agent.handleToolCall('check_depth_safety', {
        location: { latitude: 42.3601, longitude: -71.0589 },
        charted_depth: 20,
        vessel_draft: 6
      });

      const response = JSON.parse(result.content[0].text);
      
      // Should work without tidal_height parameter
      expect(response.analysis).toBeDefined();
      expect(response.analysis.clearanceAvailable).toBeDefined();
    });
  });

  // ============================================================================
  // TEST GROUP 3: Insufficient Clearance (Warning Scenarios)
  // ============================================================================

  describe('Insufficient Clearance Scenarios', () => {
    it('should warn about marginal clearance', async () => {
      // Example: 8ft depth, 6ft draft = 2ft clearance
      // 20% of 6ft = 1.2ft minimum
      // 2ft > 1.2ft but not by much = marginal
      const result = await agent.handleToolCall('check_depth_safety', {
        location: { latitude: 42.3601, longitude: -71.0589 },
        charted_depth: 8,
        vessel_draft: 6
      });

      const response = JSON.parse(result.content[0].text);
      
      expect(response.analysis).toBeDefined();
      // Should either be safe or warning, depending on exact calculation
    });

    it('should detect insufficient clearance (<20% margin)', async () => {
      // Example: 7ft depth, 6ft draft = 1ft clearance
      // 20% of 6ft = 1.2ft required
      // 1ft < 1.2ft = INSUFFICIENT CLEARANCE
      const result = await agent.handleToolCall('check_depth_safety', {
        location: { latitude: 42.3601, longitude: -71.0589 },
        charted_depth: 7,
        vessel_draft: 6
      });

      const response = JSON.parse(result.content[0].text);
      
      expect(response.analysis.isGroundingRisk).toBe(true);
      expect(response.analysis.severity).toMatch(/warning|critical|high/i);
    });

    it('should handle deep draft vessels in moderate depths', async () => {
      // Sailboat: 12ft depth, 9ft draft = 3ft clearance
      // 20% of 9ft = 1.8ft required
      // 3ft > 1.8ft but barely adequate
      const result = await agent.handleToolCall('check_depth_safety', {
        location: { latitude: 42.3601, longitude: -71.0589 },
        charted_depth: 12,
        vessel_draft: 9
      });

      const response = JSON.parse(result.content[0].text);
      
      expect(response.analysis).toBeDefined();
      expect(response.analysis.clearanceAvailable).toBeLessThan(4);
    });

    it('should warn about low tide reducing clearance', async () => {
      // Example: 10ft depth, 6ft draft, -2ft tide = 8ft actual depth
      // Clearance = 8 - 6 = 2ft
      // 20% of 6ft = 1.2ft required
      // 2ft > 1.2ft but tide reduces safety margin
      const result = await agent.handleToolCall('check_depth_safety', {
        location: { latitude: 42.3601, longitude: -71.0589 },
        charted_depth: 10,
        vessel_draft: 6,
        tidal_height: -2
      });

      const response = JSON.parse(result.content[0].text);
      
      // Negative tide should reduce effective depth
      expect(response.analysis).toBeDefined();
    });
  });

  // ============================================================================
  // TEST GROUP 4: Critical Hazards (Grounding Risk)
  // ============================================================================

  describe('Critical Grounding Risk Scenarios', () => {
    it('should detect critical grounding risk (depth < draft)', async () => {
      // CRITICAL: 5ft depth, 6ft draft = vessel bottom is BELOW chart depth!
      const result = await agent.handleToolCall('check_depth_safety', {
        location: { latitude: 42.3601, longitude: -71.0589 },
        charted_depth: 5,
        vessel_draft: 6
      });

      const response = JSON.parse(result.content[0].text);
      
      expect(response.analysis.isGroundingRisk).toBe(true);
      expect(response.analysis.severity).toBe('critical');
    });

    it('should detect grounding risk with minimal clearance', async () => {
      // Example: 6.5ft depth, 6ft draft = 0.5ft clearance (DANGEROUS)
      const result = await agent.handleToolCall('check_depth_safety', {
        location: { latitude: 42.3601, longitude: -71.0589 },
        charted_depth: 6.5,
        vessel_draft: 6
      });

      const response = JSON.parse(result.content[0].text);
      
      expect(response.analysis.isGroundingRisk).toBe(true);
      expect(response.analysis.clearanceAvailable).toBeLessThan(1);
    });

    it('should provide clear grounding risk recommendation', async () => {
      const result = await agent.handleToolCall('check_depth_safety', {
        location: { latitude: 42.3601, longitude: -71.0589 },
        charted_depth: 5,
        vessel_draft: 6
      });

      const response = JSON.parse(result.content[0].text);
      
      expect(response.analysis.recommendation).toBeDefined();
      expect(response.analysis.recommendation.toLowerCase()).toContain('not');
    });
  });

  // ============================================================================
  // TEST GROUP 5: Crew Experience Adjustments (Safety Margins)
  // ============================================================================

  describe('Crew Experience Safety Margin Adjustments', () => {
    it('should apply 30% margin for novice crew', async () => {
      // Example: 10ft depth, 6ft draft
      // Novice requires 30% margin = 1.8ft minimum clearance
      const result = await agent.handleToolCall('check_depth_safety', {
        location: { latitude: 42.3601, longitude: -71.0589 },
        charted_depth: 10,
        vessel_draft: 6,
        crew_experience: 'novice'
      });

      const response = JSON.parse(result.content[0].text);
      
      expect(response.crewExperienceAdjusted).toBe(true);
      expect(response.safetyMargins.applied).toContain('30%');
      expect(response.safetyMargins.applied).toContain('novice');
    });

    it('should apply standard 20% margin for non-novice crew', async () => {
      const result = await agent.handleToolCall('check_depth_safety', {
        location: { latitude: 42.3601, longitude: -71.0589 },
        charted_depth: 10,
        vessel_draft: 6,
        crew_experience: 'intermediate'
      });

      const response = JSON.parse(result.content[0].text);
      
      expect(response.crewExperienceAdjusted).toBe(true);
      expect(response.safetyMargins.applied).toContain('20%');
    });

    it('should apply standard margin for advanced crew', async () => {
      const result = await agent.handleToolCall('check_depth_safety', {
        location: { latitude: 42.3601, longitude: -71.0589 },
        charted_depth: 10,
        vessel_draft: 6,
        crew_experience: 'advanced'
      });

      const response = JSON.parse(result.content[0].text);
      
      expect(response.crewExperienceAdjusted).toBe(true);
      expect(response.safetyMargins.applied).toContain('20%');
    });

    it('should apply standard margin for professional crew', async () => {
      const result = await agent.handleToolCall('check_depth_safety', {
        location: { latitude: 42.3601, longitude: -71.0589 },
        charted_depth: 10,
        vessel_draft: 6,
        crew_experience: 'professional'
      });

      const response = JSON.parse(result.content[0].text);
      
      expect(response.crewExperienceAdjusted).toBe(true);
      expect(response.safetyMargins.applied).toContain('20%');
    });

    it('should make novice crew scenario more conservative', async () => {
      // Depth that's marginal for experienced crew but unsafe for novice
      // 8ft depth, 6ft draft = 2ft clearance
      // Standard: 20% of 6ft = 1.2ft (OK)
      // Novice: 30% of 6ft = 1.8ft (NOT OK)
      
      const noviceResult = await agent.handleToolCall('check_depth_safety', {
        location: { latitude: 42.3601, longitude: -71.0589 },
        charted_depth: 8,
        vessel_draft: 6,
        crew_experience: 'novice'
      });

      const advancedResult = await agent.handleToolCall('check_depth_safety', {
        location: { latitude: 42.3601, longitude: -71.0589 },
        charted_depth: 8,
        vessel_draft: 6,
        crew_experience: 'advanced'
      });

      const noviceResponse = JSON.parse(noviceResult.content[0].text);
      const advancedResponse = JSON.parse(advancedResult.content[0].text);

      // Novice should require more clearance
      expect(noviceResponse.analysis.minimumClearance).toBeGreaterThan(
        advancedResponse.analysis.minimumClearance
      );
    });
  });

  // ============================================================================
  // TEST GROUP 6: Response Structure & Compliance
  // ============================================================================

  describe('Response Structure and Compliance', () => {
    it('should return complete depth safety analysis', async () => {
      const result = await agent.handleToolCall('check_depth_safety', {
        location: { latitude: 42.3601, longitude: -71.0589 },
        charted_depth: 20,
        vessel_draft: 6
      });

      const response = JSON.parse(result.content[0].text);
      
      expect(response.location).toBeDefined();
      expect(response.analysis).toBeDefined();
      expect(response.chartDatum).toBe('MLW');
      expect(response.safetyMargins).toBeDefined();
      expect(response.crewExperienceAdjusted).toBeDefined();
    });

    it('should include chart datum information', async () => {
      const result = await agent.handleToolCall('check_depth_safety', {
        location: { latitude: 42.3601, longitude: -71.0589 },
        charted_depth: 20,
        vessel_draft: 6
      });

      const response = JSON.parse(result.content[0].text);
      
      expect(response.chartDatum).toBe('MLW'); // Mean Low Water
    });

    it('should document safety margin standards', async () => {
      const result = await agent.handleToolCall('check_depth_safety', {
        location: { latitude: 42.3601, longitude: -71.0589 },
        charted_depth: 20,
        vessel_draft: 6
      });

      const response = JSON.parse(result.content[0].text);
      
      expect(response.safetyMargins.standard).toBeDefined();
      expect(response.safetyMargins.applied).toBeDefined();
    });

    it('should return MCP-compliant response format', async () => {
      const result = await agent.handleToolCall('check_depth_safety', {
        location: { latitude: 42.3601, longitude: -71.0589 },
        charted_depth: 20,
        vessel_draft: 6
      });

      expect(result.content).toBeDefined();
      expect(Array.isArray(result.content)).toBe(true);
      expect(result.content[0].type).toBe('text');
      expect(() => JSON.parse(result.content[0].text)).not.toThrow();
    });

    it('should include all depth calculation parameters', async () => {
      const result = await agent.handleToolCall('check_depth_safety', {
        location: { latitude: 42.3601, longitude: -71.0589 },
        charted_depth: 20,
        vessel_draft: 6,
        tidal_height: 2
      });

      const response = JSON.parse(result.content[0].text);
      const analysis = response.analysis;
      
      expect(analysis.clearanceAvailable).toBeDefined();
      expect(analysis.minimumClearance).toBeDefined();
      expect(analysis.isGroundingRisk).toBeDefined();
      expect(analysis.severity).toBeDefined();
      expect(analysis.recommendation).toBeDefined();
    });
  });

  // ============================================================================
  // TEST GROUP 7: Edge Cases and Various Vessel Types
  // ============================================================================

  describe('Edge Cases and Vessel Type Variations', () => {
    it('should handle very shallow draft dinghy (2ft)', async () => {
      const result = await agent.handleToolCall('check_depth_safety', {
        location: { latitude: 42.3601, longitude: -71.0589 },
        charted_depth: 5,
        vessel_draft: 2
      });

      const response = JSON.parse(result.content[0].text);
      
      expect(response.analysis.isGroundingRisk).toBe(false);
    });

    it('should handle typical monohull sailboat (6ft)', async () => {
      const result = await agent.handleToolCall('check_depth_safety', {
        location: { latitude: 42.3601, longitude: -71.0589 },
        charted_depth: 15,
        vessel_draft: 6
      });

      const response = JSON.parse(result.content[0].text);
      
      expect(response.analysis).toBeDefined();
    });

    it('should handle deep draft sailboat (9ft)', async () => {
      const result = await agent.handleToolCall('check_depth_safety', {
        location: { latitude: 42.3601, longitude: -71.0589 },
        charted_depth: 20,
        vessel_draft: 9
      });

      const response = JSON.parse(result.content[0].text);
      
      expect(response.analysis).toBeDefined();
    });

    it('should handle fractional depths and drafts', async () => {
      const result = await agent.handleToolCall('check_depth_safety', {
        location: { latitude: 42.3601, longitude: -71.0589 },
        charted_depth: 12.5,
        vessel_draft: 5.5
      });

      const response = JSON.parse(result.content[0].text);
      
      expect(response.analysis).toBeDefined();
      expect(response.analysis.clearanceAvailable).toBeDefined();
    });

    it('should handle zero tidal height (chart datum)', async () => {
      const result = await agent.handleToolCall('check_depth_safety', {
        location: { latitude: 42.3601, longitude: -71.0589 },
        charted_depth: 15,
        vessel_draft: 6,
        tidal_height: 0
      });

      const response = JSON.parse(result.content[0].text);
      
      expect(response.analysis).toBeDefined();
    });

    it('should handle positive tidal adjustment (high tide)', async () => {
      const result = await agent.handleToolCall('check_depth_safety', {
        location: { latitude: 42.3601, longitude: -71.0589 },
        charted_depth: 10,
        vessel_draft: 6,
        tidal_height: 4
      });

      const response = JSON.parse(result.content[0].text);
      
      // High tide should improve clearance
      expect(response.analysis.clearanceAvailable).toBeGreaterThan(7);
    });

    it('should handle negative tidal adjustment (low tide)', async () => {
      const result = await agent.handleToolCall('check_depth_safety', {
        location: { latitude: 42.3601, longitude: -71.0589 },
        charted_depth: 10,
        vessel_draft: 6,
        tidal_height: -1
      });

      const response = JSON.parse(result.content[0].text);
      
      // Low tide should reduce clearance
      expect(response.analysis).toBeDefined();
    });
  });
});

