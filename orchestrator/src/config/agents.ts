export const AGENT_CONFIGS = [
  {
    name: 'weather',
    path: './agents/weather/dist/index.js',
    command: 'node',
    healthCheckUrl: 'http://localhost:3001/health',
    healthCheckInterval: 30000, // 30 seconds
    maxRestarts: 3,
    restartDelay: 5000,
    env: {
      PORT: '3001',
      NOAA_API_KEY: process.env.NOAA_API_KEY,
      OPENWEATHER_API_KEY: process.env.OPENWEATHER_API_KEY,
    }
  },
  {
    name: 'tidal',
    path: './agents/tidal/dist/index.js',
    command: 'node',
    healthCheckUrl: 'http://localhost:3002/health',
    healthCheckInterval: 30000,
    maxRestarts: 3,
    restartDelay: 5000,
    env: {
      PORT: '3002',
      NOAA_TIDES_API_KEY: process.env.NOAA_TIDES_API_KEY,
    }
  },
  {
    name: 'port',
    path: './agents/port/dist/index.js',
    command: 'node',
    healthCheckUrl: 'http://localhost:3003/health',
    healthCheckInterval: 30000,
    maxRestarts: 3,
    restartDelay: 5000,
    env: {
      PORT: '3003',
      NAVIONICS_API_KEY: process.env.NAVIONICS_API_KEY,
    }
  }
] 