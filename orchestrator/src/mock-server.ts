import express from 'express';
import { createServer as createHttpServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import { LLMService } from './llm-service';

const app = express();
const httpServer = createHttpServer(app);

// Configure Socket.io with proper CORS
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002'],
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Middleware
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002'],
  credentials: true
}));
app.use(express.json());

// Mock agent registry
const mockAgents = [
  { id: 'weather-agent', name: 'Weather Agent', status: 'active' },
  { id: 'tidal-agent', name: 'Tidal Agent', status: 'active' },
  { id: 'route-agent', name: 'Route Agent', status: 'active' },
  { id: 'port-agent', name: 'Port Agent', status: 'active' },
  { id: 'safety-agent', name: 'Safety Agent', status: 'active' },
];

// Initialize LLM service (you can switch between providers)
const llmService = process.env.OPENAI_API_KEY 
  ? new LLMService({ 
      provider: 'openai', 
      apiKey: process.env.OPENAI_API_KEY,
      model: 'gpt-4-turbo-preview'
    })
  : process.env.ANTHROPIC_API_KEY
  ? new LLMService({ 
      provider: 'anthropic', 
      apiKey: process.env.ANTHROPIC_API_KEY,
      model: 'claude-3-opus-20240229'
    })
  : null;

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date(),
    version: '1.0.0',
    agents: mockAgents.length,
    llmEnabled: !!llmService
  });
});

// Natural language chat endpoint
app.post('/api/chat', async (req, res) => {
  console.log('Received chat message:', req.body);
  
  const { message } = req.body;
  
  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }
  
  try {
    if (llmService) {
      // Parse the user's message to extract passage planning details
      const passageRequest = await llmService.parsePassageRequest(message);
      console.log('Parsed request:', passageRequest);
      
      // Trigger the passage planning process
      const response = await fetch('http://localhost:8080/api/mcp/tools/call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tool: 'plan_passage',
          arguments: passageRequest
        })
      });
      
      // The actual response will come through WebSocket
      res.json({ 
        status: 'processing',
        message: 'I\'m planning your passage. Please wait while I gather information from the weather, tidal, and route agents...'
      });
      
    } else {
      // No LLM configured, use the existing mock endpoint
      res.json({
        status: 'processing',
        message: 'I\'m planning your passage (using mock data as no LLM is configured). Please configure OPENAI_API_KEY or ANTHROPIC_API_KEY for intelligent responses.'
      });
    }
  } catch (error) {
    console.error('Error processing chat message:', error);
    res.status(500).json({ 
      error: 'Failed to process message',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Mock MCP tool call endpoint
app.post('/api/mcp/tools/call', async (req, res) => {
  console.log('Received tool call:', req.body);
  
  const { tool, arguments: args } = req.body;
  
  if (tool === 'plan_passage') {
    // Emit agent activity via WebSocket
    io.emit('agents:status', {
      agents: [
        { id: 'weather-agent', name: 'Weather Agent', status: 'processing', currentOperation: 'Fetching weather data' },
        { id: 'tidal-agent', name: 'Tidal Agent', status: 'processing', currentOperation: 'Getting tide predictions' },
        { id: 'route-agent', name: 'Route Agent', status: 'processing', currentOperation: 'Calculating optimal route' }
      ]
    });
    
    // Simulate processing
    setTimeout(() => {
      io.emit('agents:status', {
        agents: [
          { id: 'port-agent', name: 'Port Agent', status: 'processing', currentOperation: 'Loading port information' },
          { id: 'safety-agent', name: 'Safety Agent', status: 'processing', currentOperation: 'Checking safety requirements' }
        ]
      });
    }, 1000);
    
    // Return mock passage plan
    setTimeout(async () => {
      const passagePlan = {
        id: `plan-${Date.now()}`,
        departure: {
          name: args.departure || 'Boston, MA',
          coordinates: { latitude: 42.3601, longitude: -71.0589 },
          country: 'US',
          facilities: [],
          contacts: []
        },
        destination: {
          name: args.destination || 'Portland, ME',
          coordinates: { latitude: 43.6591, longitude: -70.2568 },
          country: 'US',
          facilities: [],
          contacts: []
        },
        waypoints: [
          {
            id: 'wp1',
            name: 'Cape Ann',
            coordinates: { latitude: 42.6306, longitude: -70.6251 },
            estimatedArrival: new Date(Date.now() + 3600000).toISOString()
          },
          {
            id: 'wp2',
            name: 'Portsmouth Harbor',
            coordinates: { latitude: 43.0718, longitude: -70.7626 },
            estimatedArrival: new Date(Date.now() + 7200000).toISOString()
          }
        ],
        departureTime: args.departure_time || new Date().toISOString(),
        estimatedArrivalTime: new Date(Date.now() + 14400000).toISOString(),
        distance: {
          total: 105,
          unit: 'nm'
        },
        weather: {
          conditions: [
            {
              timeWindow: {
                start: new Date().toISOString(),
                end: new Date(Date.now() + 86400000).toISOString()
              },
              description: 'Fair weather with light winds',
              windSpeed: 10,
              windDirection: 'NW',
              waveHeight: 2,
              visibility: 10,
              precipitation: 0
            }
          ],
          warnings: [],
          lastUpdated: new Date().toISOString()
        },
        tides: [
          {
            location: args.departure || 'Boston, MA',
            predictions: [
              {
                time: new Date(Date.now() + 21600000).toISOString(),
                height: 9.5,
                type: 'high'
              },
              {
                time: new Date(Date.now() + 43200000).toISOString(),
                height: 1.2,
                type: 'low'
              }
            ]
          }
        ],
        safety: {
          emergencyContacts: [
            {
              type: 'harbormaster',
              name: 'Boston Harbor Master',
              phone: '+1-617-555-0123',
              vhfChannel: 16
            },
            {
              type: 'emergency',
              name: 'USCG Sector Boston',
              phone: '+1-617-555-0911',
              vhfChannel: 16
            }
          ],
          hazards: [],
          requiredEquipment: ['Life jackets', 'Flares', 'VHF Radio', 'First aid kit'],
          weatherWindows: [
            {
              start: new Date().toISOString(),
              end: new Date(Date.now() + 86400000).toISOString()
            }
          ]
        }
      };
      
      // Generate natural language response if LLM is available
      if (llmService) {
        const naturalResponse = await llmService.generatePassageResponse(passagePlan);
        io.emit('plan:complete', {
          ...passagePlan,
          naturalResponse
        });
      } else {
        io.emit('plan:complete', passagePlan);
      }
      
      io.emit('agents:status', { agents: [] }); // Clear agents
      
      res.json({
        content: [
          {
            type: 'text',
            text: JSON.stringify(passagePlan, null, 2)
          }
        ]
      });
    }, 3000);
  } else {
    res.status(404).json({ error: 'Unknown tool' });
  }
});

// WebSocket connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  // Send initial agent status
  socket.emit('agents:status', {
    agents: mockAgents.map(a => ({ ...a, status: 'idle', lastSeen: new Date() }))
  });
  
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Start server
const PORT = process.env.PORT || 8080;
httpServer.listen(PORT, () => {
  console.log(`Mock server listening on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`WebSocket: ws://localhost:${PORT}`);
}); 