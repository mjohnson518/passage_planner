/**
 * Helmwise Backend - Incremental Build
 * Minimal backend with real route calculations
 */

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { calculateRoute, formatDuration } from './services/routeCalculator';
import { getWeatherData, formatWindDescription } from './services/weatherService';

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

// Passage planning endpoint with real route calculations and weather
app.post('/api/passage-planning/analyze', async (req, res) => {
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
    
    // Fetch weather data for departure and destination
    console.log('Fetching weather data...');
    const [departureWeather, destinationWeather] = await Promise.all([
      getWeatherData(departure.latitude, departure.longitude),
      getWeatherData(destination.latitude, destination.longitude)
    ]);
    
    // Generate recommendations based on route and weather
    const recommendations = generateRecommendations(
      route, 
      departureWeather, 
      destinationWeather
    );
    
    // Compile all warnings
    const allWarnings = [
      ...departureWeather.warnings,
      ...destinationWeather.warnings
    ];
    
    // Determine if conditions are suitable for passage
    const maxWindSpeed = Math.max(
      departureWeather.windSpeed, 
      destinationWeather.windSpeed
    );
    const suitable = maxWindSpeed < 25 && allWarnings.length === 0;
    
    // Return comprehensive response
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
        departure: {
          ...departureWeather,
          windDescription: formatWindDescription(
            departureWeather.windSpeed,
            departureWeather.windDirection
          )
        },
        destination: {
          ...destinationWeather,
          windDescription: formatWindDescription(
            destinationWeather.windSpeed,
            destinationWeather.windDirection
          )
        },
        summary: {
          maxWindSpeed,
          suitable,
          warnings: allWarnings,
          overall: suitable 
            ? 'Conditions appear favorable for passage' 
            : 'Conditions require careful consideration'
        }
      },
      tidal: {
        status: 'Tidal service integration in progress',
        message: 'Real tidal predictions coming in next deployment'
      },
      summary: {
        totalDistance: `${route.distance} nm`,
        estimatedTime: formatDuration(route.estimatedDuration),
        averageSpeed: `${cruiseSpeed} knots`,
        suitableForPassage: suitable,
        warnings: allWarnings.length > 0 ? allWarnings : ['No weather warnings'],
        recommendations
      }
    });
  } catch (error: any) {
    console.error('Passage planning error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to analyze passage'
    });
  }
});

// Generate recommendations based on route and weather
function generateRecommendations(
  route: any, 
  departureWeather: any, 
  destinationWeather: any
): string[] {
  const recommendations: string[] = [];
  
  // Wind-based recommendations
  if (departureWeather.windSpeed > 25) {
    recommendations.push('⚠️ CRITICAL: Departure winds exceed safe limits - delay departure');
  } else if (departureWeather.windSpeed > 20) {
    recommendations.push('Strong winds at departure - experienced crew recommended');
  } else if (departureWeather.windSpeed < 5) {
    recommendations.push('Light winds at departure - consider motoring or wait for breeze');
  }
  
  if (destinationWeather.windSpeed > 25) {
    recommendations.push('⚠️ CRITICAL: Destination winds exceed safe limits - consider alternate port');
  } else if (destinationWeather.windSpeed > 20) {
    recommendations.push('Strong winds forecast at destination - prepare for challenging arrival');
  }
  
  // Weather warning based recommendations
  if (departureWeather.warnings.length > 0) {
    recommendations.push(`Weather warnings active at departure: ${departureWeather.warnings.join(', ')}`);
  }
  
  if (destinationWeather.warnings.length > 0) {
    recommendations.push(`Weather warnings active at destination: ${destinationWeather.warnings.join(', ')}`);
  }
  
  // Wave height recommendations
  const maxWaveHeight = Math.max(departureWeather.waveHeight, destinationWeather.waveHeight);
  if (maxWaveHeight > 6) {
    recommendations.push('⚠️ High seas forecast - passage not recommended for small vessels');
  } else if (maxWaveHeight > 4) {
    recommendations.push('Rough seas expected - secure all gear and prepare crew');
  } else if (maxWaveHeight > 2) {
    recommendations.push('Moderate seas - ensure crew comfort measures in place');
  }
  
  // Duration-based recommendations
  if (route.estimatedDurationHours > 12) {
    recommendations.push('Extended passage - plan for crew rest rotation and monitor weather updates');
  } else if (route.estimatedDurationHours > 8) {
    recommendations.push('Long passage - monitor weather conditions throughout transit');
  }
  
  // Distance-based recommendations
  if (route.distance > 100) {
    recommendations.push('Offshore passage - ensure adequate fuel, water, and safety equipment');
  }
  
  // Positive conditions
  if (recommendations.length === 0) {
    recommendations.push('✅ Conditions appear favorable for passage');
    recommendations.push('Monitor weather forecasts for any changes');
    recommendations.push('Verify all safety equipment before departure');
  }
  
  // Always include safety reminders
  recommendations.push('Always file a float plan with harbor master or trusted contact');
  recommendations.push('This is a planning tool - verify with official charts and forecasts');
  
  return recommendations;
}

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
