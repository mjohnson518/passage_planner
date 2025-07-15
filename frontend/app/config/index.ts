export const config = {
  // API Configuration
  api: {
    url: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080',
    wsUrl: process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8080',
    timeout: 30000,
  },
  
  // Authentication
  auth: {
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    sessionExpiry: 24 * 60 * 60 * 1000, // 24 hours
  },
  
  // Stripe
  stripe: {
    publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!,
  },
  
  // Map Configuration
  map: {
    defaultCenter: {
      lat: 42.3601,
      lng: -71.0589,
    },
    defaultZoom: 8,
    tileUrl: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '© OpenStreetMap contributors',
  },
  
  // Feature Flags
  features: {
    aiChat: true,
    liveTracking: false,
    fleetManagement: false,
    offlineMode: true,
    pwa: true,
  },
  
  // Subscription Tiers
  subscriptions: {
    free: {
      name: 'Free',
      price: 0,
      limits: {
        passagesPerMonth: 2,
        forecastDays: 3,
        exportFormats: ['basic'],
      },
    },
    premium: {
      name: 'Premium',
      price: 19,
      limits: {
        passagesPerMonth: -1,
        forecastDays: 7,
        exportFormats: ['gpx', 'pdf', 'kml'],
      },
    },
    pro: {
      name: 'Pro',
      price: 49,
      limits: {
        passagesPerMonth: -1,
        forecastDays: 10,
        exportFormats: ['gpx', 'pdf', 'kml', 'api'],
      },
    },
  },
  
  // Chart Configuration
  chart: {
    providers: {
      openSeaMap: {
        url: 'https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png',
        enabled: true,
      },
      noaa: {
        url: 'https://tileservice.charts.noaa.gov/tiles/50000_1/{z}/{x}/{y}.png',
        enabled: false,
      },
    },
  },
  
  // Analytics
  analytics: {
    mixpanelToken: process.env.NEXT_PUBLIC_MIXPANEL_TOKEN,
    posthogKey: process.env.NEXT_PUBLIC_POSTHOG_KEY,
    sentryDsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  },
  
  // Performance
  performance: {
    imageCdn: process.env.NEXT_PUBLIC_IMAGE_CDN || '',
    enablePrefetch: true,
    enableServiceWorker: true,
  },
  
  // Offline Configuration
  offline: {
    maxStorageSize: 100 * 1024 * 1024, // 100MB
    chartCacheTime: 7 * 24 * 60 * 60 * 1000, // 7 days
    passagePlanLimit: 5,
  },
}; 