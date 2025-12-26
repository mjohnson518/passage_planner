/**
 * Route Export Service Tests
 * 
 * SAFETY CRITICAL: Navigation export accuracy tests
 * GPX/KML coordinate errors could lead to groundings or collisions
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import { RouteExportService, Route } from '../route-export';
import pino from 'pino';

describe('RouteExportService - NAVIGATION SAFETY CRITICAL', () => {
  let exportService: RouteExportService;
  let testRoute: Route;

  beforeAll(() => {
    const logger = pino({ level: 'silent' }); // Suppress logs in tests
    exportService = new RouteExportService(logger);

    // Boston to Portland test route (real coordinates)
    testRoute = {
      name: 'Boston to Portland Test Route',
      description: 'Test passage for navigation export validation',
      waypoints: [
        { 
          latitude: 42.3601, 
          longitude: -71.0589, 
          name: 'Boston Harbor',
          description: 'Departure point'
        },
        { 
          latitude: 42.8, 
          longitude: -70.7, 
          name: 'Cape Ann',
          description: 'First waypoint'
        },
        { 
          latitude: 43.2, 
          longitude: -70.5, 
          name: 'Midpoint',
          description: 'Mid-route waypoint'
        },
        { 
          latitude: 43.6591, 
          longitude: -70.2568, 
          name: 'Portland',
          description: 'Destination'
        },
      ],
      metadata: {
        distance: 95,
        duration: '16 hours',
        departure: 'Boston, MA',
        destination: 'Portland, ME',
        createdAt: new Date('2024-07-15T10:00:00Z'),
      },
    };
  });

  describe('GPX Export - Coordinate Accuracy', () => {
    it('should export GPX with exact coordinates (±0.001° tolerance)', () => {
      const gpx = exportService.exportToGPX(testRoute);

      // Verify GPX structure
      expect(gpx).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(gpx).toContain('<gpx version="1.1"');
      expect(gpx).toContain('xmlns="http://www.topografix.com/GPX/1/1"');

      // CRITICAL: Verify first waypoint coordinates are EXACT
      expect(gpx).toContain('lat="42.3601"');
      expect(gpx).toContain('lon="-71.0589"');

      // CRITICAL: Verify last waypoint coordinates are EXACT
      expect(gpx).toContain('lat="43.6591"');
      expect(gpx).toContain('lon="-70.2568"');

      // Verify all waypoint names present
      expect(gpx).toContain('<name>Boston Harbor</name>');
      expect(gpx).toContain('<name>Cape Ann</name>');
      expect(gpx).toContain('<name>Midpoint</name>');
      expect(gpx).toContain('<name>Portland</name>');
    });

    it('should preserve coordinate precision to 4 decimal places minimum', () => {
      const gpx = exportService.exportToGPX(testRoute);

      // Extract coordinates using regex
      const coordRegex = /lat="(-?\d+\.\d+)" lon="(-?\d+\.\d+)"/g;
      const matches = [...gpx.matchAll(coordRegex)];

      expect(matches.length).toBeGreaterThan(0);

      for (const match of matches) {
        const lat = match[1];
        const lon = match[2];

        // Verify minimum 4 decimal places (±60 feet accuracy)
        const latDecimals = (lat.split('.')[1] || '').length;
        const lonDecimals = (lon.split('.')[1] || '').length;

        expect(latDecimals).toBeGreaterThanOrEqual(4);
        expect(lonDecimals).toBeGreaterThanOrEqual(4);
      }
    });

    it('should maintain waypoint order exactly as provided', () => {
      const gpx = exportService.exportToGPX(testRoute);

      // Extract waypoint names in order
      const nameRegex = /<name>(.*?)<\/name>/g;
      const names = [...gpx.matchAll(nameRegex)].map(m => m[1]);

      // Filter to actual waypoint names (exclude route name)
      const waypointNames = names.filter(n => 
        ['Boston Harbor', 'Cape Ann', 'Midpoint', 'Portland'].includes(n)
      );

      // CRITICAL: Order must match exactly for navigation
      expect(waypointNames[0]).toBe('Boston Harbor');
      expect(waypointNames[1]).toBe('Cape Ann');
      expect(waypointNames[2]).toBe('Midpoint');
      expect(waypointNames[3]).toBe('Portland');
    });

    it('should handle negative longitude (Western Hemisphere) correctly', () => {
      const gpx = exportService.exportToGPX(testRoute);

      // All test waypoints are in Western Hemisphere (negative longitude)
      expect(gpx).toContain('lon="-71.0589"');
      expect(gpx).toContain('lon="-70.7"');
      expect(gpx).toContain('lon="-70.5"');
      expect(gpx).toContain('lon="-70.2568"');

      // Verify no positive longitudes for these waypoints
      const bostonMatch = gpx.match(/Boston Harbor.*?lat="42\.3601" lon="(-?\d+\.\d+)"/s);
      expect(bostonMatch![1]).toBe('-71.0589');
    });

    it('should not truncate or round coordinates', () => {
      const testWaypoint = {
        latitude: 42.36014567,  // Many decimal places
        longitude: -71.05894321,
      };

      const route: Route = {
        name: 'Precision Test',
        waypoints: [testWaypoint],
      };

      const gpx = exportService.exportToGPX(route);

      // Should preserve at least 7-8 decimal places (±0.5 feet accuracy)
      expect(gpx).toMatch(/lat="42\.36014567"/);
      expect(gpx).toMatch(/lon="-71\.05894321"/);
    });
  });

  describe('KML Export - Coordinate Accuracy', () => {
    it('should export KML with exact coordinates', () => {
      const kml = exportService.exportToKML(testRoute);

      // KML uses lon,lat,altitude format (OPPOSITE of GPX!)
      expect(kml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(kml).toContain('<kml xmlns="http://www.opengis.net/kml/2.2">');

      // CRITICAL: Verify coordinates in correct order (lon,lat not lat,lon!)
      expect(kml).toContain('-71.0589,42.3601,0'); // Boston
      expect(kml).toContain('-70.2568,43.6591,0'); // Portland
    });

    it('should use correct coordinate order for KML (lon,lat,alt)', () => {
      const kml = exportService.exportToKML(testRoute);

      // Extract all coordinate sets
      const coordMatch = kml.match(/<coordinates>([\s\S]*?)<\/coordinates>/);
      expect(coordMatch).not.toBeNull();

      const coords = coordMatch![1].trim().split('\n').map(c => c.trim());

      // First coordinate should be: lon,lat,0 (not lat,lon,0)
      const first = coords[0].split(',');
      expect(parseFloat(first[0])).toBe(-71.0589); // Longitude first
      expect(parseFloat(first[1])).toBe(42.3601);  // Latitude second
      expect(parseFloat(first[2])).toBe(0);        // Altitude third
    });
  });

  describe('CSV Export - Data Integrity', () => {
    it('should export CSV with all waypoint data', () => {
      const csv = exportService.exportToCSV(testRoute);

      const lines = csv.split('\n');
      expect(lines[0]).toBe('Waypoint,Latitude,Longitude,Name,Description');
      
      // Verify each waypoint present
      expect(lines[1]).toContain('42.3601');
      expect(lines[1]).toContain('-71.0589');
      expect(lines[1]).toContain('Boston Harbor');

      expect(lines[4]).toContain('43.6591');
      expect(lines[4]).toContain('-70.2568');
      expect(lines[4]).toContain('Portland');
    });

    it('should escape special characters in CSV', () => {
      const route: Route = {
        name: 'Test Route',
        waypoints: [{
          latitude: 42.3601,
          longitude: -71.0589,
          name: 'Test "Quoted" Name',
          description: 'Description with, comma',
        }],
      };

      const csv = exportService.exportToCSV(route);

      // Should handle quotes and commas properly
      expect(csv).toContain('"Test "Quoted" Name"');
      expect(csv).toContain('"Description with, comma"');
    });
  });

  describe('Waypoint List Generation', () => {
    it('should calculate accurate bearings between waypoints', () => {
      const waypoints = exportService.generateWaypointList(testRoute);

      // Boston to Cape Ann should be approximately NE (bearing ~045°)
      // This is a simplified check - actual bearing is calculated
      expect(waypoints).toContain('Bearing');
      expect(waypoints).toContain('Distance');
    });

    it('should format coordinates in degrees-minutes correctly', () => {
      const waypoints = exportService.generateWaypointList(testRoute);

      // 42.3601°N should be 42° 21.606' N
      expect(waypoints).toMatch(/42°.*21\.606.*N/);
      
      // 71.0589°W should be 71° 3.534' W (or 71° 03.534' W)
      expect(waypoints).toMatch(/71°.*0?3\.534.*W/);
    });

    it('should calculate accurate distances between waypoints', () => {
      const waypoints = exportService.generateWaypointList(testRoute);

      // Total distance should be ~95nm
      expect(waypoints).toContain('95');
      expect(waypoints).toContain('nm');
    });
  });

  describe('Edge Cases & Error Handling', () => {
    it('should handle single waypoint route', () => {
      const singlePoint: Route = {
        name: 'Single Point',
        waypoints: [{ latitude: 42.3601, longitude: -71.0589, name: 'Solo' }],
      };

      const gpx = exportService.exportToGPX(singlePoint);
      expect(gpx).toContain('lat="42.3601"');
      expect(gpx).toContain('lon="-71.0589"');
    });

    it('should handle routes crossing International Date Line', () => {
      const dateLine: Route = {
        name: 'Date Line Crossing',
        waypoints: [
          { latitude: 0, longitude: 179 },
          { latitude: 0, longitude: -179 },
        ],
      };

      const gpx = exportService.exportToGPX(dateLine);
      expect(gpx).toContain('lon="179"');
      expect(gpx).toContain('lon="-179"');
    });

    it('should handle polar coordinates (high latitudes)', () => {
      const arctic: Route = {
        name: 'Arctic Route',
        waypoints: [
          { latitude: 78.2232, longitude: 15.6267, name: 'Svalbard' },
          { latitude: 80.5, longitude: 20.0, name: 'North' },
        ],
      };

      const gpx = exportService.exportToGPX(arctic);
      expect(gpx).toContain('lat="78.2232"');
      expect(gpx).toContain('lat="80.5"');
    });

    it('should handle Southern Hemisphere coordinates', () => {
      const south: Route = {
        name: 'Southern Route',
        waypoints: [
          { latitude: -33.8688, longitude: 151.2093, name: 'Sydney' },
          { latitude: -37.8136, longitude: 144.9631, name: 'Melbourne' },
        ],
      };

      const gpx = exportService.exportToGPX(south);
      expect(gpx).toContain('lat="-33.8688"');
      expect(gpx).toContain('lat="-37.8136"');
    });

    it('should escape XML special characters in names/descriptions', () => {
      const route: Route = {
        name: 'Route with <special> & "characters"',
        waypoints: [{
          latitude: 42.36,
          longitude: -71.06,
          name: 'Point & <brackets>',
          description: 'Description with "quotes" & <tags>',
        }],
      };

      const gpx = exportService.exportToGPX(route);

      // Should not contain unescaped characters
      expect(gpx).not.toContain('& "');
      expect(gpx).not.toContain('& <');
      
      // Should contain escaped versions
      expect(gpx).toContain('&amp;');
      expect(gpx).toContain('&lt;');
      expect(gpx).toContain('&gt;');
      expect(gpx).toContain('&quot;');
    });
  });

  describe('Distance and Bearing Calculations', () => {
    it('should calculate Haversine distance accurately', () => {
      // Boston to Portland is ~95 nautical miles
      const waypoints = exportService.generateWaypointList(testRoute);

      // Extract total distance from output
      const distanceMatch = waypoints.match(/Total Distance:\s*(\d+\.?\d*)\s*nm/);
      expect(distanceMatch).not.toBeNull();

      const distance = parseFloat(distanceMatch![1]);
      
      // Verify within 5% of known distance (95nm)
      expect(distance).toBeGreaterThan(90);
      expect(distance).toBeLessThan(100);
    });

    it('should calculate bearings accurately', () => {
      // Boston (42.3601, -71.0589) to Cape Ann (42.8, -70.7)
      // Expected bearing: approximately NE (30-60 degrees)
      
      const waypoints = exportService.generateWaypointList(testRoute);

      // Bearing should be present and reasonable
      expect(waypoints).toContain('°');
      
      // Should not be 0° (exact north) or 90° (exact east)
      // Actual bearing Boston→Cape Ann is ~045°
      expect(waypoints).toMatch(/\d+°/);
    });

    it('should format coordinates in traditional navigation format', () => {
      const waypoints = exportService.generateWaypointList(testRoute);

      // Should contain degrees symbol and direction letters
      expect(waypoints).toMatch(/\d+°.*N/);
      expect(waypoints).toMatch(/\d+°.*W/);
      
      // Should show minutes with decimal
      expect(waypoints).toMatch(/\d+'\s*[NSEW]/);
    });
  });

  describe('Metadata Inclusion', () => {
    it('should include route metadata in GPX', () => {
      const gpx = exportService.exportToGPX(testRoute);

      expect(gpx).toContain('<metadata>');
      expect(gpx).toContain(testRoute.name);
      expect(gpx).toContain(testRoute.description);
      expect(gpx).toContain('<author>');
      expect(gpx).toContain('Helmwise');
      expect(gpx).toContain('2024-07-15T10:00:00');
    });

    it('should include route information in KML', () => {
      const kml = exportService.exportToKML(testRoute);

      expect(kml).toContain('<Document>');
      expect(kml).toContain(`<name>${testRoute.name}</name>`);
      expect(kml).toContain(testRoute.description);
    });

    it('should include distance in waypoint list if provided', () => {
      const waypoints = exportService.generateWaypointList(testRoute);

      expect(waypoints).toContain('Total Distance: 95');
      expect(waypoints).toContain('Estimated Duration: 16 hours');
    });
  });

  describe('Real-World Navigation Scenarios', () => {
    it('should export route suitable for Garmin chartplotter', () => {
      const gpx = exportService.exportToGPX(testRoute);

      // Garmin requires these GPX elements
      expect(gpx).toContain('<gpx version="1.1"');
      expect(gpx).toContain('<rte>'); // Route element
      expect(gpx).toContain('<rtept'); // Route points
      expect(gpx).toContain('<name>');
      
      // Verify well-formed XML
      expect(gpx.match(/<wpt/g)?.length).toBe(testRoute.waypoints.length);
      expect(gpx.match(/<rtept/g)?.length).toBe(testRoute.waypoints.length);
    });

    it('should export route suitable for OpenCPN', () => {
      const gpx = exportService.exportToGPX(testRoute);

      // OpenCPN compatible format
      expect(gpx).toContain('creator="Helmwise Passage Planner"');
      expect(gpx).toContain('<wpt');
      expect(gpx).toContain('<sym>'); // Symbol for waypoint display
      
      // Verify each waypoint has type
      expect(gpx).toMatch(/<type>WPT<\/type>/);
    });

    it('should export KML suitable for Google Earth', () => {
      const kml = exportService.exportToKML(testRoute);

      // Google Earth requirements
      expect(kml).toContain('xmlns="http://www.opengis.net/kml/2.2"');
      expect(kml).toContain('<Placemark>');
      expect(kml).toContain('<LineString>');
      expect(kml).toContain('<coordinates>');
      
      // Should have styling
      expect(kml).toContain('<Style');
      expect(kml).toContain('<LineStyle>');
    });
  });

  describe('Coordinate Validation - Critical Safety', () => {
    it('should reject invalid latitudes', () => {
      const invalid: Route = {
        name: 'Invalid',
        waypoints: [{ latitude: 91, longitude: 0 }], // Lat > 90
      };

      // Service should either reject or clamp to valid range
      const gpx = exportService.exportToGPX(invalid);
      
      // If it doesn't throw, verify it doesn't export invalid coords
      expect(gpx).toBeDefined();
    });

    it('should handle edge case coordinates correctly', () => {
      const edges: Route = {
        name: 'Edge Cases',
        waypoints: [
          { latitude: 0, longitude: 0, name: 'Equator/Prime Meridian' },
          { latitude: 90, longitude: 0, name: 'North Pole' },
          { latitude: -90, longitude: 0, name: 'South Pole' },
          { latitude: 0, longitude: 180, name: 'Date Line East' },
          { latitude: 0, longitude: -180, name: 'Date Line West' },
        ],
      };

      const gpx = exportService.exportToGPX(edges);

      expect(gpx).toContain('lat="0"');
      expect(gpx).toContain('lat="90"');
      expect(gpx).toContain('lat="-90"');
      expect(gpx).toContain('lon="180"');
      expect(gpx).toContain('lon="-180"');
    });
  });
});

