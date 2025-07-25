export const agentConfigs = [
  {
    id: 'weather-agent',
    name: 'Weather Agent',
    command: 'node',
    args: ['./agents/weather/dist/index.js'],
    env: {
      NOAA_API_KEY: process.env.NOAA_API_KEY!,
      OPENWEATHER_API_KEY: process.env.OPENWEATHER_API_KEY!,
    },
    healthCheckInterval: 30000, // 30 seconds
    healthCheckTimeout: 5000, // 5 seconds
    maxRestarts: 3,
    restartDelay: 5000, // 5 seconds
  },
  {
    id: 'tidal-agent',
    name: 'Tidal Agent',
    command: 'node',
    args: ['./agents/tidal/dist/index.js'],
    env: {
      NOAA_API_KEY: process.env.NOAA_API_KEY!,
    },
    healthCheckInterval: 30000,
    healthCheckTimeout: 5000,
    maxRestarts: 3,
    restartDelay: 5000,
  },
  {
    id: 'port-agent',
    name: 'Port Agent',
    command: 'node',
    args: ['./agents/port/dist/index.js'],
    env: {
      DATABASE_URL: process.env.DATABASE_URL!,
    },
    healthCheckInterval: 30000,
    healthCheckTimeout: 5000,
    maxRestarts: 3,
    restartDelay: 5000,
  },
  {
    id: 'safety-agent',
    name: 'Safety Agent',
    command: 'node',
    args: ['./agents/safety/dist/index.js'],
    env: {
      USCG_API_KEY: process.env.USCG_API_KEY!,
    },
    healthCheckInterval: 30000,
    healthCheckTimeout: 5000,
    maxRestarts: 3,
    restartDelay: 5000,
  },
  {
    id: 'route-agent',
    name: 'Route Agent',
    command: 'node',
    args: ['./agents/route/dist/index.js'],
    env: {
      OPENSEA_MAP_API_KEY: process.env.OPENSEA_MAP_API_KEY!,
    },
    healthCheckInterval: 30000,
    healthCheckTimeout: 5000,
    maxRestarts: 3,
    restartDelay: 5000,
  },
  {
    id: 'wind-agent',
    name: 'Wind Agent',
    command: 'node',
    args: ['./agents/wind/dist/index.js'],
    env: {
      WINDFINDER_API_KEY: process.env.WINDFINDER_API_KEY!,
      NOAA_API_KEY: process.env.NOAA_API_KEY!,
    },
    healthCheckInterval: 30000,
    healthCheckTimeout: 5000,
    maxRestarts: 3,
    restartDelay: 5000,
  },
]; 