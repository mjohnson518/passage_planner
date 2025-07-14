import { describe, test, expect, beforeAll, afterAll, jest } from '@jest/globals';
import { OrchestratorService } from '../../orchestrator/src/index';
import { WeatherAgent } from '../../agents/weather/src/index';
import { TidalAgent } from '../../agents/tidal/src/index';
import { PortAgent } from '../../agents/port/src/index';
import { SafetyAgent } from '../../agents/safety/src/index';
import { RouteAgent } from '../../agents/route/src/index';
import { createServer } from '../../orchestrator/src/server';
import { io as ioClient, Socket } from 'socket.io-client';
import axios from 'axios';

describe('Agent Communication Integration Tests', () => {
  let orchestrator: OrchestratorService;
  let agents: Map<string, any>;
  let serverUrl: string;
  let socketClient: Socket;
  
  beforeAll(async () => {
    // Start test database and Redis
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_passage_planner';
    process.env.REDIS_URL = 'redis://localhost:6379/1';
    process.env.NODE_ENV = 'test';
    
    // Initialize orchestrator
    orchestrator = new OrchestratorService();
    
    // Start agents
    agents = new Map();
    const agentClasses = {
      'weather-agent': WeatherAgent,
      'tidal-agent': TidalAgent,
      'port-agent': PortAgent,
      'safety-agent': SafetyAgent,
      'route-agent': RouteAgent,
    };
    
    for (const [id, AgentClass] of Object.entries(agentClasses)) {
      const agent = new AgentClass();
      await agent.start();
      agents.set(id, agent);
    }
    
    // Start HTTP/WebSocket server
    const server = await createServer();
    await server.listen(8082);
    serverUrl = 'http://localhost:8082';
    
    // Connect WebSocket client
    socketClient = ioClient(serverUrl, {
      transports: ['websocket'],
    });
    
    await new Promise((resolve) => {
      socketClient.on('connect', resolve);
    });
  }, 30000);
  
  afterAll(async () => {
    // Cleanup
    socketClient.disconnect();
    
    for (const agent of agents.values()) {
      await agent.shutdown?.();
    }
    
    await orchestrator.shutdown();
  });
  
  describe('Agent Registration', () => {
    test('all agents should register successfully', async () => {
      // Wait for agents to register
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const response = await axios.post(`${serverUrl}/api/mcp/tools/call`, {
        tool: 'check_agent_status',
        arguments: {},
      });
      
      expect(response.status).toBe(200);
      const agents = JSON.parse(response.data.content[0].text);
      
      expect(agents).toHaveProperty('weather-agent');
      expect(agents).toHaveProperty('tidal-agent');
      expect(agents).toHaveProperty('port-agent');
      expect(agents).toHaveProperty('safety-agent');
      expect(agents).toHaveProperty('route-agent');
      
      Object.values(agents).forEach((agent: any) => {
        expect(agent.status).toBe('active');
      });
    });
  });
  
  describe('Single Agent Communication', () => {
    test('weather agent should respond to requests', async () => {
      const response = await axios.post(`${serverUrl}/api/mcp/tools/call`, {
        tool: 'get_weather_briefing',
        arguments: {
          coordinates: [
            { lat: 42.3601, lon: -71.0589 },
            { lat: 41.5241, lon: -70.6731 }
          ],
        },
      });
      
      expect(response.status).toBe(200);
      const result = JSON.parse(response.data.content[0].text);
      expect(result).toHaveProperty('weather');
      expect(result.weather).toBeInstanceOf(Array);
    });
    
    test('port agent should provide port information', async () => {
      const response = await axios.post(`${serverUrl}/api/mcp/tools/call`, {
        tool: 'plan_passage',
        arguments: {
          departure: 'Boston, MA',
          destination: 'Portland, ME',
          departure_time: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        },
      });
      
      expect(response.status).toBe(200);
      const result = JSON.parse(response.data.content[0].text);
      expect(result).toHaveProperty('departure');
      expect(result).toHaveProperty('destination');
    });
  });
  
  describe('Multi-Agent Coordination', () => {
    test('passage planning should coordinate multiple agents', async () => {
      const agentActivations: string[] = [];
      
      // Monitor agent activations via WebSocket
      socketClient.on('agent:status', (data) => {
        if (data.status === 'processing') {
          agentActivations.push(data.agentId);
        }
      });
      
      const response = await axios.post(`${serverUrl}/api/mcp/tools/call`, {
        tool: 'plan_passage',
        arguments: {
          departure: 'Newport, RI',
          destination: 'Block Island, RI',
          departure_time: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
          boat_type: 'sailboat',
        },
      });
      
      expect(response.status).toBe(200);
      const result = JSON.parse(response.data.content[0].text);
      
      // Verify passage plan structure
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('departure');
      expect(result).toHaveProperty('destination');
      expect(result).toHaveProperty('waypoints');
      expect(result).toHaveProperty('distance');
      expect(result).toHaveProperty('weather');
      expect(result).toHaveProperty('tides');
      expect(result).toHaveProperty('safety');
      
      // Verify multiple agents were activated
      expect(agentActivations.length).toBeGreaterThan(2);
      expect(agentActivations).toContain('weather-agent');
      expect(agentActivations).toContain('route-agent');
    });
  });
  
  describe('Error Handling', () => {
    test('should handle agent timeout gracefully', async () => {
      // Simulate slow agent by mocking
      const originalTimeout = process.env.MCP_AGENT_TIMEOUT;
      process.env.MCP_AGENT_TIMEOUT = '100'; // 100ms timeout
      
      try {
        const response = await axios.post(`${serverUrl}/api/mcp/tools/call`, {
          tool: 'plan_passage',
          arguments: {
            departure: 'Miami, FL',
            destination: 'Bahamas',
            departure_time: new Date().toISOString(),
          },
        });
        
        expect(response.status).toBe(200);
        const result = JSON.parse(response.data.content[0].text);
        
        // Should still have partial results
        expect(result).toBeDefined();
      } finally {
        process.env.MCP_AGENT_TIMEOUT = originalTimeout;
      }
    });
    
    test('should handle invalid agent responses', async () => {
      try {
        const response = await axios.post(`${serverUrl}/api/mcp/tools/call`, {
          tool: 'plan_passage',
          arguments: {
            departure: '', // Invalid empty departure
            destination: 'Portland, ME',
            departure_time: new Date().toISOString(),
          },
        });
        
        expect(response.status).toBe(400);
      } catch (error: any) {
        expect(error.response.status).toBe(400);
        expect(error.response.data).toHaveProperty('error');
      }
    });
  });
  
  describe('WebSocket Communication', () => {
    test('should receive real-time agent status updates', async () => {
      const statusUpdates: any[] = [];
      
      socketClient.on('agent:status', (data) => {
        statusUpdates.push(data);
      });
      
      // Trigger a passage plan
      await axios.post(`${serverUrl}/api/mcp/tools/call`, {
        tool: 'plan_passage',
        arguments: {
          departure: 'Boston, MA',
          destination: 'Provincetown, MA',
          departure_time: new Date().toISOString(),
        },
      });
      
      // Wait for status updates
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      expect(statusUpdates.length).toBeGreaterThan(0);
      expect(statusUpdates.some(u => u.status === 'processing')).toBe(true);
      expect(statusUpdates.some(u => u.status === 'active')).toBe(true);
    });
    
    test('should receive request start/complete events', async () => {
      const requestEvents: any[] = [];
      
      socketClient.on('request:start', (data) => {
        requestEvents.push({ type: 'start', ...data });
      });
      
      socketClient.on('request:complete', (data) => {
        requestEvents.push({ type: 'complete', ...data });
      });
      
      await axios.post(`${serverUrl}/api/mcp/tools/call`, {
        tool: 'get_weather_briefing',
        arguments: {
          coordinates: [{ lat: 42.3601, lon: -71.0589 }],
        },
      });
      
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const starts = requestEvents.filter(e => e.type === 'start');
      const completes = requestEvents.filter(e => e.type === 'complete');
      
      expect(starts.length).toBeGreaterThan(0);
      expect(completes.length).toBeGreaterThan(0);
      
      // Each start should have a corresponding complete
      starts.forEach(start => {
        expect(completes.some(c => c.requestId === start.id)).toBe(true);
      });
    });
  });
  
  describe('Performance', () => {
    test('should handle concurrent requests', async () => {
      const requests = Array.from({ length: 5 }, (_, i) => ({
        departure: 'Boston, MA',
        destination: `Portland, ME ${i}`,
        departure_time: new Date().toISOString(),
      }));
      
      const startTime = Date.now();
      
      const responses = await Promise.all(
        requests.map(req =>
          axios.post(`${serverUrl}/api/mcp/tools/call`, {
            tool: 'plan_passage',
            arguments: req,
          })
        )
      );
      
      const duration = Date.now() - startTime;
      
      expect(responses).toHaveLength(5);
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
      
      // Should complete within reasonable time (concurrent processing)
      expect(duration).toBeLessThan(10000); // 10 seconds for 5 requests
    });
    
    test('should cache repeated requests', async () => {
      const request = {
        tool: 'get_weather_briefing',
        arguments: {
          coordinates: [{ lat: 41.5, lon: -70.5 }],
        },
      };
      
      // First request
      const start1 = Date.now();
      const response1 = await axios.post(`${serverUrl}/api/mcp/tools/call`, request);
      const duration1 = Date.now() - start1;
      
      // Second identical request (should be cached)
      const start2 = Date.now();
      const response2 = await axios.post(`${serverUrl}/api/mcp/tools/call`, request);
      const duration2 = Date.now() - start2;
      
      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);
      
      // Cached response should be significantly faster
      expect(duration2).toBeLessThan(duration1 * 0.5);
      
      // Results should be identical
      expect(response1.data).toEqual(response2.data);
    });
  });
}); 