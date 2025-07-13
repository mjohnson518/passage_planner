export const config = {
  api: {
    url: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080',
    wsUrl: process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8080',
  },
  features: {
    enableAgentFactory: process.env.NEXT_PUBLIC_ENABLE_AGENT_FACTORY === 'true',
    enableWeatherLayers: process.env.NEXT_PUBLIC_ENABLE_WEATHER_LAYERS === 'true',
  },
  map: {
    defaultCenter: {
      lat: parseFloat(process.env.NEXT_PUBLIC_DEFAULT_MAP_CENTER_LAT || '41.5'),
      lng: parseFloat(process.env.NEXT_PUBLIC_DEFAULT_MAP_CENTER_LNG || '-70.5'),
    },
    defaultZoom: parseInt(process.env.NEXT_PUBLIC_DEFAULT_MAP_ZOOM || '7', 10),
  },
} 