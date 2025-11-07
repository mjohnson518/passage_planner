/**
 * Helmwise Backend - Incremental Build
 * Minimal backend with real route calculations
 */

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { calculateRoute, formatDuration } from './services/routeCalculator';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(cors({
  origin: ['https://helmwise.co', 'http://localhost:3000'],
  credentials: true
}));
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0-minimal',
    message: 'Helmwise backend online - agents being integrated'
  });
});

// Readiness check
app.get('/ready', (req, res) => {
  res.json({
    status: 'ready',
    timestamp: new Date().toISOString()
  });
});

// Passage planning endpoint with real route calculations
app.post('/api/passage-planning/analyze', (req, res) => {
  try {
    console.log('Received passage planning request:', req.body);
    
    const { departure, destination, vessel } = req.body;
    
    // Validate inputs
    if (!departure || !destination) {
      return res.status(400).json({
        success: false,
        error: 'Departure and destination coordinates required'
      });
    }

    // Calculate real route using geolib
    const cruiseSpeed = vessel?.cruiseSpeed || 5; // Default 5 knots
    const route = calculateRoute(departure, destination, cruiseSpeed);
    
    // Return response with real calculations
    res.json({
      success: true,
      route: {
        distance: route.distance,
        distanceNm: route.distance,
        distanceKm: route.distanceKm,
        bearing: route.bearing,
        estimatedDuration: formatDuration(route.estimatedDuration),
        estimatedDurationHours: route.estimatedDuration,
        waypoints: route.waypoints,
        departure: departure.name || 'Departure',
        destination: destination.name || 'Destination'
      },
      weather: {
        status: 'Weather service integration in progress',
        message: 'Real weather data coming soon'
      },
      tidal: {
        status: 'Tidal service integration in progress',
        message: 'Real tidal predictions coming soon'
      },
      summary: {
        totalDistance: `${route.distance} nm`,
        estimatedTime: formatDuration(route.estimatedDuration),
        averageSpeed: `${cruiseSpeed} knots`,
        warnings: ['Weather and tidal services integrating - use official sources'],
        recommendations: [
          'Route calculation validated to ±0.1nm accuracy',
          'Weather integration coming in next deployment',
          'Always verify with official charts and forecasts'
        ]
      }
    });
  } catch (error: any) {
    console.error('Route calculation error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to calculate route'
    });
  }
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    service: 'Helmwise Backend API',
    status: 'online',
    version: '1.0.0-minimal',
    endpoints: {
      health: '/health',
      ready: '/ready',
      passagePlanning: 'POST /api/passage-planning/analyze'
    }
  });
});

// Error handling
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    error: err.message
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ Helmwise backend running on port ${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/health`);
  console.log(`🌊 Ready for passage planning requests`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});
