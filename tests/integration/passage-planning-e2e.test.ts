import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import axios from 'axios';
import { io as ioClient, Socket } from 'socket.io-client';

describe('Passage Planning End-to-End Tests', () => {
  let serverUrl: string;
  let socketClient: Socket;
  let planUpdates: any[] = [];
  
  beforeAll(async () => {
    serverUrl = process.env.TEST_SERVER_URL || 'http://localhost:8082';
    
    // Connect WebSocket client
    socketClient = ioClient(serverUrl, {
      transports: ['websocket'],
    });
    
    await new Promise((resolve) => {
      socketClient.on('connect', resolve);
    });
    
    // Monitor plan updates
    socketClient.on('plan:update', (data) => {
      planUpdates.push(data);
    });
  });
  
  afterAll(async () => {
    socketClient.disconnect();
  });
  
  describe('Coastal Passages', () => {
    test('should plan a simple day sail', async () => {
      const response = await axios.post(`${serverUrl}/api/mcp/tools/call`, {
        tool: 'plan_passage',
        arguments: {
          departure: 'Marblehead, MA',
          destination: 'Gloucester, MA',
          departure_time: getTomorrowMorning(),
          boat_type: 'sailboat',
          preferences: {
            avoid_night: true,
            max_wind_speed: 20,
          },
        },
      });
      
      expect(response.status).toBe(200);
      const plan = JSON.parse(response.data.content[0].text);
      
      // Verify basic plan structure
      expect(plan.distance.total).toBeLessThan(30); // Short coastal hop
      expect(plan.estimatedArrivalTime).toBeDefined();
      expect(new Date(plan.estimatedArrivalTime).getHours()).toBeLessThan(20); // Arrives before 8 PM
      
      // Verify weather consideration
      expect(plan.weather).toBeDefined();
      expect(plan.weather.conditions).toBeInstanceOf(Array);
      expect(plan.weather.warnings).toBeInstanceOf(Array);
      
      // Verify tidal information
      expect(plan.tides).toBeInstanceOf(Array);
      expect(plan.tides.length).toBeGreaterThan(0);
    });
    
    test('should plan multi-day coastal cruise', async () => {
      const response = await axios.post(`${serverUrl}/api/mcp/tools/call`, {
        tool: 'plan_passage',
        arguments: {
          departure: 'Newport, RI',
          destination: 'Martha\'s Vineyard, MA',
          departure_time: getTomorrowMorning(),
          boat_type: 'sailboat',
          waypoints: [
            { name: 'Block Island', latitude: 41.1711, longitude: -71.5778 }
          ],
        },
      });
      
      expect(response.status).toBe(200);
      const plan = JSON.parse(response.data.content[0].text);
      
      // Should include the waypoint
      expect(plan.waypoints.some((wp: any) => wp.name.includes('Block Island'))).toBe(true);
      expect(plan.waypoints.length).toBeGreaterThanOrEqual(3); // Start, waypoint, end
      
      // Check for overnight considerations
      if (plan.estimatedDuration > 12) {
        expect(plan.safety.requiredEquipment).toContain('Navigation lights');
      }
    });
  });
  
  describe('Offshore Passages', () => {
    test('should plan offshore passage with safety considerations', async () => {
      const response = await axios.post(`${serverUrl}/api/mcp/tools/call`, {
        tool: 'plan_passage',
        arguments: {
          departure: 'Montauk, NY',
          destination: 'Bermuda',
          departure_time: getNextWeek(),
          boat_type: 'sailboat',
        },
      });
      
      expect(response.status).toBe(200);
      const plan = JSON.parse(response.data.content[0].text);
      
      // Verify offshore distance
      expect(plan.distance.total).toBeGreaterThan(600); // ~640nm to Bermuda
      
      // Verify safety requirements for offshore
      expect(plan.safety.requiredEquipment).toContain('EPIRB');
      expect(plan.safety.requiredEquipment).toContain('Life raft');
      expect(plan.safety.emergencyContacts).toBeDefined();
      
      // Should have weather windows
      expect(plan.safety.weatherWindows).toBeDefined();
      expect(plan.safety.weatherWindows.length).toBeGreaterThan(0);
      
      // Alternative routes for safety
      expect(plan.alternativeRoutes).toBeDefined();
    });
  });
  
  describe('Weather-Dependent Planning', () => {
    test('should adjust route based on weather constraints', async () => {
      const response = await axios.post(`${serverUrl}/api/mcp/tools/call`, {
        tool: 'plan_passage',
        arguments: {
          departure: 'Cape May, NJ',
          destination: 'Norfolk, VA',
          departure_time: getTomorrowMorning(),
          boat_type: 'sailboat',
          preferences: {
            max_wind_speed: 15,
            max_wave_height: 1.5,
          },
        },
      });
      
      expect(response.status).toBe(200);
      const plan = JSON.parse(response.data.content[0].text);
      
      // Should include weather analysis
      expect(plan.weather.conditions.every((c: any) => 
        c.windSpeed <= 15 || plan.weather.warnings.length > 0
      )).toBe(true);
      
      // May suggest waiting for better conditions
      if (plan.weather.warnings.length > 0) {
        expect(plan.weather.warnings.some((w: string) => 
          w.toLowerCase().includes('wind') || w.toLowerCase().includes('weather')
        )).toBe(true);
      }
    });
  });
  
  describe('Port Services Integration', () => {
    test('should include port facilities in passage plan', async () => {
      const response = await axios.post(`${serverUrl}/api/mcp/tools/call`, {
        tool: 'plan_passage',
        arguments: {
          departure: 'Miami, FL',
          destination: 'Key West, FL',
          departure_time: getTomorrowMorning(),
          boat_type: 'powerboat',
        },
      });
      
      expect(response.status).toBe(200);
      const plan = JSON.parse(response.data.content[0].text);
      
      // Should have port information
      expect(plan.departure.facilities).toBeDefined();
      expect(plan.destination.facilities).toBeDefined();
      
      // Should have contact information
      expect(plan.destination.contacts).toBeDefined();
      expect(plan.destination.contacts.some((c: any) => 
        c.type === 'harbormaster' || c.type === 'marina'
      )).toBe(true);
    });
  });
  
  describe('Real-time Updates', () => {
    test('should receive progressive updates during planning', async () => {
      planUpdates = []; // Reset
      
      const planPromise = axios.post(`${serverUrl}/api/mcp/tools/call`, {
        tool: 'plan_passage',
        arguments: {
          departure: 'San Francisco, CA',
          destination: 'Half Moon Bay, CA',
          departure_time: getTomorrowMorning(),
          boat_type: 'sailboat',
        },
      });
      
      // Wait for some updates
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Should have received some updates
      expect(planUpdates.length).toBeGreaterThan(0);
      
      // Wait for completion
      const response = await planPromise;
      expect(response.status).toBe(200);
      
      // Final plan should be complete
      const finalPlan = JSON.parse(response.data.content[0].text);
      expect(finalPlan.waypoints).toBeDefined();
      expect(finalPlan.weather).toBeDefined();
      expect(finalPlan.tides).toBeDefined();
    });
  });
  
  describe('Error Scenarios', () => {
    test('should handle unknown ports gracefully', async () => {
      try {
        await axios.post(`${serverUrl}/api/mcp/tools/call`, {
          tool: 'plan_passage',
          arguments: {
            departure: 'Atlantis',
            destination: 'Neverland',
            departure_time: getTomorrowMorning(),
          },
        });
      } catch (error: any) {
        expect(error.response.status).toBe(400);
        expect(error.response.data.error).toContain('port');
      }
    });
    
    test('should handle invalid dates', async () => {
      try {
        await axios.post(`${serverUrl}/api/mcp/tools/call`, {
          tool: 'plan_passage',
          arguments: {
            departure: 'Boston, MA',
            destination: 'Portland, ME',
            departure_time: '2020-01-01T10:00:00Z', // Past date
          },
        });
      } catch (error: any) {
        expect(error.response.status).toBe(400);
        expect(error.response.data.error).toContain('future');
      }
    });
  });
  
  describe('Complex Scenarios', () => {
    test('should handle fuel stop planning for powerboats', async () => {
      const response = await axios.post(`${serverUrl}/api/mcp/tools/call`, {
        tool: 'plan_passage',
        arguments: {
          departure: 'Fort Lauderdale, FL',
          destination: 'Charleston, SC',
          departure_time: getTomorrowMorning(),
          boat_type: 'powerboat',
          preferences: {
            vessel_range_nm: 200,
            cruising_speed_kts: 25,
          },
        },
      });
      
      expect(response.status).toBe(200);
      const plan = JSON.parse(response.data.content[0].text);
      
      // Should include fuel stops for long passage
      if (plan.distance.total > 200) {
        expect(plan.waypoints.some((wp: any) => 
          wp.notes?.includes('fuel') || wp.name?.includes('fuel')
        )).toBe(true);
      }
    });
    
    test('should optimize waypoints for efficiency', async () => {
      const response = await axios.post(`${serverUrl}/api/mcp/tools/call`, {
        tool: 'plan_passage',
        arguments: {
          departure: 'Annapolis, MD',
          destination: 'Norfolk, VA',
          departure_time: getTomorrowMorning(),
          boat_type: 'sailboat',
          waypoints: [
            { name: 'Solomons Island', latitude: 38.3176, longitude: -76.4519 },
            { name: 'Deltaville', latitude: 37.5547, longitude: -76.3369 },
          ],
          preferences: {
            optimize_route: true,
          },
        },
      });
      
      expect(response.status).toBe(200);
      const plan = JSON.parse(response.data.content[0].text);
      
      // Waypoints should be in logical order
      const waypointNames = plan.waypoints.map((wp: any) => wp.name);
      expect(waypointNames.indexOf('Solomons Island')).toBeLessThan(
        waypointNames.indexOf('Deltaville')
      );
    });
  });
});

// Helper functions
function getTomorrowMorning(): string {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(9, 0, 0, 0);
  return tomorrow.toISOString();
}

function getNextWeek(): string {
  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 7);
  nextWeek.setHours(9, 0, 0, 0);
  return nextWeek.toISOString();
} 