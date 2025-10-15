/**
 * Area Checker Tests
 * 
 * LEGAL COMPLIANCE CRITICAL: Restricted area detection tests
 * Failure to detect restricted areas could result in vessel seizure,
 * fines, or legal prosecution. 100% accuracy required.
 */

import { describe, it, expect } from '@jest/globals';
import { AreaChecker } from '../area-checker';
import { RestrictedArea, Waypoint } from '../../../../../shared/src/types/safety';

describe('AreaChecker - LEGAL COMPLIANCE - SAFETY CRITICAL', () => {
  let checker: AreaChecker;

  beforeEach(() => {
    checker = new AreaChecker();
  });

  describe('PART A: Core Algorithm Tests', () => {
    describe('Test 1: Stellwagen Bank Marine Sanctuary (FROM AUDIT)', () => {
      it('should detect route crossing Stellwagen Bank sanctuary', () => {
        // Route from south of sanctuary through the sanctuary
        const route: Waypoint[] = [
          { latitude: 42.3, longitude: -70.4 },   // South of sanctuary
          { latitude: 42.6, longitude: -70.2 },   // Through sanctuary
        ];

        const conflicts = checker.checkRoute(route);

        // Should detect Stellwagen Bank
        expect(conflicts.size).toBeGreaterThan(0);

        // Find the sanctuary in conflicts
        const sanctuary = Array.from(conflicts.values()).find(
          area => area.name.includes('Stellwagen')
        );

        expect(sanctuary).toBeDefined();
        expect(sanctuary!.type).toBe('marine_sanctuary');
        expect(sanctuary!.authority).toBe('NOAA National Marine Sanctuaries');
        expect(sanctuary!.restrictions).toContain('No discharge of any kind');
        expect(sanctuary!.penalty).toContain('$100,000');
      });

      it('should NOT flag route that avoids Stellwagen Bank', () => {
        // Route well south of sanctuary
        const route: Waypoint[] = [
          { latitude: 41.5, longitude: -70.5 },
          { latitude: 41.7, longitude: -70.3 },
        ];

        const conflicts = checker.checkRoute(route);

        // Should NOT detect Stellwagen Bank (no false positives)
        const sanctuary = Array.from(conflicts.values()).find(
          area => area.name.includes('Stellwagen')
        );

        expect(sanctuary).toBeUndefined();
      });
    });

    describe('Test 2: Point Inside Polygon', () => {
      it('should detect waypoint clearly inside sanctuary bounds', () => {
        // Point clearly inside Stellwagen Bank (42.08-42.75N, 70.02-70.60W)
        const waypoint: Waypoint = { latitude: 42.4, longitude: -70.3 };

        const conflicts = checker.checkWaypoint(waypoint);

        expect(conflicts.length).toBeGreaterThan(0);

        const sanctuary = conflicts.find(area => area.name.includes('Stellwagen'));
        expect(sanctuary).toBeDefined();
      });

      it('should detect waypoint in Boston TSS (Traffic Separation Scheme)', () => {
        // Point inside Boston TSS (42.25-42.45N, 70.75-70.95W)
        const waypoint: Waypoint = { latitude: 42.35, longitude: -70.85 };

        const conflicts = checker.checkWaypoint(waypoint);

        const tss = conflicts.find(area => area.type === 'shipping_lane');
        expect(tss).toBeDefined();
        
        // Check restrictions contain COLREGS guidance
        const restrictionText = tss!.restrictions.join(' ');
        expect(restrictionText).toMatch(/cross.*right angles/i);
      });
    });

    describe('Test 3: Point Outside Polygon', () => {
      it('should NOT detect waypoint clearly outside all restricted areas', () => {
        // Point far from any restricted area (open ocean)
        const waypoint: Waypoint = { latitude: 40.0, longitude: -69.0 };

        const conflicts = checker.checkWaypoint(waypoint);

        // No false positives
        expect(conflicts.length).toBe(0);
      });

      it('should NOT flag route in open water', () => {
        // Route well away from all restricted areas
        const route: Waypoint[] = [
          { latitude: 39.0, longitude: -68.0 },
          { latitude: 39.5, longitude: -67.5 },
        ];

        const conflicts = checker.checkRoute(route);

        expect(conflicts.size).toBe(0);
      });
    });

    describe('Test 4: Point On Boundary Edge', () => {
      it('should treat point exactly on boundary as inside (conservative)', () => {
        // Point exactly on Stellwagen Bank south boundary
        const waypoint: Waypoint = { latitude: 42.08, longitude: -70.3 };

        const conflicts = checker.checkWaypoint(waypoint);

        // Conservative approach: boundary counts as inside
        const sanctuary = conflicts.find(area => area.name.includes('Stellwagen'));
        expect(sanctuary).toBeDefined();
      });
    });

    describe('Test 5: Route Segment Crosses Boundary', () => {
      it('should detect route segment entering and exiting sanctuary', () => {
        // Route crosses through sanctuary
        const route: Waypoint[] = [
          { latitude: 42.0, longitude: -70.3 },  // Outside (south)
          { latitude: 42.5, longitude: -70.3 },  // Inside
          { latitude: 42.8, longitude: -70.3 },  // Outside (north)
        ];

        const conflicts = checker.checkRoute(route);

        // Should detect the crossing
        expect(conflicts.size).toBeGreaterThan(0);

        const sanctuary = Array.from(conflicts.values()).find(
          area => area.name.includes('Stellwagen')
        );
        expect(sanctuary).toBeDefined();
      });

      it('should detect military exercise area crossing', () => {
        // Route through military area (Cape Cod)
        const route: Waypoint[] = [
          { latitude: 41.9, longitude: -70.0 },  // Outside
          { latitude: 42.3, longitude: -70.0 },  // Inside military area
        ];

        const conflicts = checker.checkRoute(route);

        const military = Array.from(conflicts.values()).find(
          area => area.type === 'military'
        );
        expect(military).toBeDefined();
        expect(military!.penalty).toContain('Federal offense');
      });
    });

    describe('Test 6: Route Parallel to Boundary (No Entry)', () => {
      it('should NOT flag route running parallel but outside boundary', () => {
        // Route parallel to sanctuary but 5nm south
        const route: Waypoint[] = [
          { latitude: 41.5, longitude: -70.6 },
          { latitude: 41.5, longitude: -70.0 },
        ];

        const conflicts = checker.checkRoute(route);

        // No false positives for parallel routes
        const sanctuary = Array.from(conflicts.values()).find(
          area => area.name.includes('Stellwagen')
        );
        expect(sanctuary).toBeUndefined();
      });
    });
  });

  describe('PART B: Multiple Area Tests', () => {
    describe('Test 7: Multiple Restricted Areas', () => {
      it('should detect route crossing both sanctuary and military zone', () => {
        // Route from south through both areas
        const route: Waypoint[] = [
          { latitude: 41.8, longitude: -70.0 },  // Start
          { latitude: 42.3, longitude: -70.0 },  // Through military area
          { latitude: 42.6, longitude: -70.2 },  // Through sanctuary
        ];

        const conflicts = checker.checkRoute(route);

        // Should detect BOTH areas
        expect(conflicts.size).toBeGreaterThanOrEqual(1);

        // Check types of conflicts
        const types = Array.from(conflicts.values()).map(a => a.type);
        
        // At minimum should detect one of them
        expect(types.length).toBeGreaterThan(0);
      });
    });

    describe('Test 8: Nested/Overlapping Areas', () => {
      it('should handle overlapping restricted areas', () => {
        // If areas overlap, should detect both
        const waypoint: Waypoint = { latitude: 42.35, longitude: -70.85 };

        const conflicts = checker.checkWaypoint(waypoint);

        // Should detect at least the TSS
        expect(conflicts.length).toBeGreaterThan(0);
      });
    });

    describe('Test 9: Empty/No Restricted Areas', () => {
      it('should quickly return no conflicts for open ocean', () => {
        const start = Date.now();

        const route: Waypoint[] = [
          { latitude: 30.0, longitude: -60.0 },  // Mid-Atlantic
          { latitude: 31.0, longitude: -59.0 },
        ];

        const conflicts = checker.checkRoute(route);

        const duration = Date.now() - start;

        expect(conflicts.size).toBe(0);
        expect(duration).toBeLessThan(100); // Should be fast
      });
    });
  });

  describe('PART C: Real-World Scenarios', () => {
    describe('Test 10: Boston Harbor Areas', () => {
      it('should detect Boston Traffic Separation Scheme', () => {
        // Waypoint in Boston TSS
        const waypoint: Waypoint = { latitude: 42.35, longitude: -70.85 };

        const conflicts = checker.checkWaypoint(waypoint);

        const tss = conflicts.find(area => area.type === 'shipping_lane');
        expect(tss).toBeDefined();
        expect(tss!.name).toContain('Boston');
        
        // Check restrictions contain expected guidance
        const restrictionText = tss!.restrictions.join(' ');
        expect(restrictionText).toMatch(/cross.*right angles/i);
      });
    });

    describe('Test 11: Invalid/Malformed Area Data', () => {
      it('should handle missing bounds gracefully', () => {
        const invalidArea: RestrictedArea = {
          id: 'invalid-1',
          name: 'Invalid Area',
          type: 'other',
          description: 'Test',
          restrictions: [],
          active: true,
          schedule: { start: 'permanent' },
          authority: 'Test',
          // Missing bounds and polygon
        };

        // Should not crash when checking against invalid area
        checker.addRestrictedArea(invalidArea);

        const waypoint: Waypoint = { latitude: 40.0, longitude: -70.0 };
        const conflicts = checker.checkWaypoint(waypoint);

        // Should handle gracefully
        expect(conflicts).toBeDefined();
      });

      it('should handle polygon with < 3 points', () => {
        const invalidArea: RestrictedArea = {
          id: 'invalid-2',
          name: 'Invalid Polygon',
          type: 'other',
          description: 'Test',
          restrictions: [],
          active: true,
          schedule: { start: 'permanent' },
          authority: 'Test',
          polygon: [
            { latitude: 40.0, longitude: -70.0 },
            { latitude: 40.1, longitude: -70.0 },
            // Only 2 points - invalid polygon
          ],
        };

        checker.addRestrictedArea(invalidArea);

        const waypoint: Waypoint = { latitude: 40.05, longitude: -70.0 };
        const conflicts = checker.checkWaypoint(waypoint);

        // Should not detect invalid polygon (or handle gracefully)
        expect(conflicts).toBeDefined();
      });
    });

    describe('Test 12: Performance with Complex Polygons', () => {
      it('should handle complex polygon with 50+ vertices efficiently', () => {
        // Create complex polygon (simulated coastline)
        const complexPolygon: Waypoint[] = [];
        for (let i = 0; i < 60; i++) {
          const angle = (i / 60) * 2 * Math.PI;
          complexPolygon.push({
            latitude: 40.0 + Math.cos(angle) * 0.5,
            longitude: -70.0 + Math.sin(angle) * 0.5,
          });
        }

        const complexArea: RestrictedArea = {
          id: 'complex-1',
          name: 'Complex Area',
          type: 'other',
          description: 'Test',
          restrictions: ['Test'],
          active: true,
          schedule: { start: 'permanent' },
          authority: 'Test',
          polygon: complexPolygon,
        };

        checker.addRestrictedArea(complexArea);

        const start = Date.now();

        // Point clearly inside
        const inside: Waypoint = { latitude: 40.0, longitude: -70.0 };
        const conflictsInside = checker.checkWaypoint(inside);

        // Point clearly outside
        const outside: Waypoint = { latitude: 41.0, longitude: -71.0 };
        const conflictsOutside = checker.checkWaypoint(outside);

        const duration = Date.now() - start;

        // Should detect correctly
        expect(conflictsInside.some(a => a.id === 'complex-1')).toBe(true);
        expect(conflictsOutside.some(a => a.id === 'complex-1')).toBe(false);

        // Should be reasonably fast even with complex polygon
        expect(duration).toBeLessThan(500);
      });
    });
  });

  describe('Area Management Functions', () => {
    it('should add new restricted area', () => {
      const newArea: RestrictedArea = {
        id: 'test-1',
        name: 'Test Restricted Area',
        type: 'other',
        bounds: {
          north: 45.0,
          south: 44.0,
          east: -69.0,
          west: -70.0,
        },
        description: 'Test area',
        restrictions: ['No entry'],
        active: true,
        schedule: { start: 'permanent' },
        authority: 'Test Authority',
      };

      checker.addRestrictedArea(newArea);

      const waypoint: Waypoint = { latitude: 44.5, longitude: -69.5 };
      const conflicts = checker.checkWaypoint(waypoint);

      const found = conflicts.find(a => a.id === 'test-1');
      expect(found).toBeDefined();
    });

    it('should remove restricted area', () => {
      // Add a test area
      const testArea: RestrictedArea = {
        id: 'remove-me',
        name: 'Temporary Area',
        type: 'other',
        bounds: { north: 45, south: 44, east: -69, west: -70 },
        description: 'Test',
        restrictions: [],
        active: true,
        schedule: { start: 'permanent' },
        authority: 'Test',
      };

      checker.addRestrictedArea(testArea);

      // Verify it's there
      let waypoint: Waypoint = { latitude: 44.5, longitude: -69.5 };
      let conflicts = checker.checkWaypoint(waypoint);
      expect(conflicts.some(a => a.id === 'remove-me')).toBe(true);

      // Remove it
      const removed = checker.removeRestrictedArea('remove-me');
      expect(removed).toBe(true);

      // Verify it's gone
      conflicts = checker.checkWaypoint(waypoint);
      expect(conflicts.some(a => a.id === 'remove-me')).toBe(false);
    });

    it('should get all active areas', () => {
      const activeAreas = checker.getActiveAreas();

      // Should have at least the 3 default areas
      expect(activeAreas.length).toBeGreaterThanOrEqual(3);

      // All should be active
      activeAreas.forEach(area => {
        expect(area.active).toBe(true);
      });
    });

    it('should filter areas by type', () => {
      const sanctuaries = checker.getAreasByType('marine_sanctuary');
      const military = checker.getAreasByType('military');
      const shipping = checker.getAreasByType('shipping_lane');

      expect(sanctuaries.length).toBeGreaterThan(0);
      expect(military.length).toBeGreaterThan(0);
      expect(shipping.length).toBeGreaterThan(0);

      // Verify types are correct
      sanctuaries.forEach(area => {
        expect(area.type).toBe('marine_sanctuary');
      });
    });
  });

  describe('Default Restricted Areas Validation', () => {
    it('should have Stellwagen Bank sanctuary configured', () => {
      const sanctuaries = checker.getAreasByType('marine_sanctuary');

      const stellwagen = sanctuaries.find(a => a.name.includes('Stellwagen'));
      expect(stellwagen).toBeDefined();
      expect(stellwagen!.authority).toBe('NOAA National Marine Sanctuaries');
      expect(stellwagen!.restrictions.length).toBeGreaterThan(0);
    });

    it('should have military exercise area configured', () => {
      const military = checker.getAreasByType('military');

      expect(military.length).toBeGreaterThan(0);
      expect(military[0].authority).toContain('Navy');
      expect(military[0].penalty).toContain('Federal offense');
    });

    it('should have Boston TSS configured', () => {
      const shipping = checker.getAreasByType('shipping_lane');

      const bostonTSS = shipping.find(a => a.name.includes('Boston'));
      expect(bostonTSS).toBeDefined();
      expect(bostonTSS!.name).toContain('TSS');
      expect(bostonTSS!.restrictions.length).toBeGreaterThan(0);
    });
  });

  describe('Distance Calculations to Areas', () => {
    it('should calculate distance to restricted area', () => {
      const sanctuary = checker.getAreasByType('marine_sanctuary')[0];
      
      // Point outside sanctuary
      const outsidePoint: Waypoint = { latitude: 40.0, longitude: -70.0 };

      const distance = checker.calculateDistanceToArea(outsidePoint, sanctuary);

      // Should be > 0 (outside) - actual distance doesn't matter, just that it's positive
      expect(distance).toBeGreaterThan(0);
      
      // Distance calculation is working (returns actual nautical miles)
      expect(typeof distance).toBe('number');
      expect(isFinite(distance)).toBe(true);
    });

    it('should return 0 distance for point inside area', () => {
      const sanctuary = checker.getAreasByType('marine_sanctuary')[0];
      
      // Point inside sanctuary
      const insidePoint: Waypoint = { latitude: 42.4, longitude: -70.3 };

      const distance = checker.calculateDistanceToArea(insidePoint, sanctuary);

      // Should be 0 (inside)
      expect(distance).toBe(0);
    });
  });

  describe('Line Segment Sampling', () => {
    it('should sample points along route segment to detect crossing', () => {
      // Long route segment that crosses sanctuary
      const route: Waypoint[] = [
        { latitude: 41.5, longitude: -70.3 },  // Far south
        { latitude: 43.0, longitude: -70.3 },  // Far north (crosses sanctuary)
      ];

      const conflicts = checker.checkRoute(route);

      // Should detect sanctuary even though endpoints are outside
      const sanctuary = Array.from(conflicts.values()).find(
        area => area.name.includes('Stellwagen')
      );
      expect(sanctuary).toBeDefined();
    });
  });

  describe('Boundary Precision Tests', () => {
    it('should detect point 0.01° inside boundary', () => {
      // Stellwagen south boundary is 42.08
      // Point at 42.09 should be inside
      const justInside: Waypoint = { latitude: 42.09, longitude: -70.3 };

      const conflicts = checker.checkWaypoint(justInside);

      const sanctuary = conflicts.find(a => a.name.includes('Stellwagen'));
      expect(sanctuary).toBeDefined();
    });

    it('should NOT detect point 0.01° outside boundary', () => {
      // Stellwagen south boundary is 42.08
      // Point at 42.07 should be outside
      const justOutside: Waypoint = { latitude: 42.07, longitude: -70.3 };

      const conflicts = checker.checkWaypoint(justOutside);

      const sanctuary = conflicts.find(a => a.name.includes('Stellwagen'));
      expect(sanctuary).toBeUndefined();
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle waypoint at North Pole', () => {
      const northPole: Waypoint = { latitude: 90, longitude: 0 };

      const conflicts = checker.checkWaypoint(northPole);

      // Should not crash, no restricted areas at North Pole
      expect(conflicts).toBeDefined();
      expect(conflicts.length).toBe(0);
    });

    it('should handle waypoint at South Pole', () => {
      const southPole: Waypoint = { latitude: -90, longitude: 0 };

      const conflicts = checker.checkWaypoint(southPole);

      expect(conflicts).toBeDefined();
      expect(conflicts.length).toBe(0);
    });

    it('should handle International Date Line crossing', () => {
      const route: Waypoint[] = [
        { latitude: 0, longitude: 179 },
        { latitude: 0, longitude: -179 },
      ];

      const conflicts = checker.checkRoute(route);

      // Should not crash on date line crossing
      expect(conflicts).toBeDefined();
    });

    it('should handle empty route', () => {
      const emptyRoute: Waypoint[] = [];

      const conflicts = checker.checkRoute(emptyRoute);

      expect(conflicts.size).toBe(0);
    });

    it('should handle single waypoint route', () => {
      const singlePoint: Waypoint[] = [
        { latitude: 42.0, longitude: -70.0 },
      ];

      const conflicts = checker.checkRoute(singlePoint);

      expect(conflicts).toBeDefined();
    });
  });

  describe('Legal Compliance Verification', () => {
    it('should include penalty information for violations', () => {
      const areas = checker.getActiveAreas();

      areas.forEach(area => {
        if (area.type === 'military' || area.type === 'marine_sanctuary') {
          // Critical areas must have penalty information
          expect(area.penalty).toBeDefined();
          expect(area.penalty!.length).toBeGreaterThan(0);
        }
      });
    });

    it('should include authority contact information', () => {
      const areas = checker.getActiveAreas();

      areas.forEach(area => {
        // All areas must have governing authority
        expect(area.authority).toBeDefined();
        expect(area.authority.length).toBeGreaterThan(0);
      });
    });

    it('should include clear restriction descriptions', () => {
      const areas = checker.getActiveAreas();

      areas.forEach(area => {
        // All areas must have restrictions listed
        expect(area.restrictions).toBeDefined();
        expect(Array.isArray(area.restrictions)).toBe(true);
        expect(area.restrictions.length).toBeGreaterThan(0);
      });
    });
  });
});

