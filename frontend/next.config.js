const withBundleAnalyzer = process.env.ANALYZE === 'true'
  ? require('webpack-bundle-analyzer').BundleAnalyzerPlugin
  : null

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
  
  // CRITICAL: Disable CSS optimization (critters) that's causing build failures
  experimental: {
    scrollRestoration: true,
    optimizePackageImports: [
      'lucide-react',
      'date-fns',
      'recharts',
      '@radix-ui/react-checkbox',
      '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-label',
      '@radix-ui/react-popover',
      '@radix-ui/react-progress',
      '@radix-ui/react-radio-group',
      '@radix-ui/react-scroll-area',
      '@radix-ui/react-select',
      '@radix-ui/react-slider',
      '@radix-ui/react-switch',
      '@radix-ui/react-tabs',
      '@radix-ui/react-toast',
    ],
  },

  images: {
    // Enable Next.js image optimization (was disabled, re-enabling for performance)
    remotePatterns: [
      { protocol: 'https', hostname: '**.supabase.co' },
      { protocol: 'https', hostname: '**.supabase.in' },
    ],
  },

  async rewrites() {
    const orchestratorUrl =
      process.env.NEXT_PUBLIC_ORCHESTRATOR_URL ||
      process.env.ORCHESTRATOR_URL ||
      'http://localhost:8080'

    const proxied = [
      'subscription',
      'founding-member',
      'fleet',
      'usage',
      'user',
      'users',
      'admin',
      'agents',
      'push',
    ]

    return proxied.map((prefix) => ({
      source: `/api/${prefix}/:path*`,
      destination: `${orchestratorUrl}/api/${prefix}/:path*`,
    }))
  },

  webpack: (config, { isServer }) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
    };

    // Bundle analyzer — run with ANALYZE=true npm run build
    if (withBundleAnalyzer && !isServer) {
      config.plugins.push(
        new withBundleAnalyzer({
          analyzerMode: 'static',
          reportFilename: '../analyze/client.html',
          openAnalyzer: false,
        })
      )
    }

    return config;
  },
}

module.exports = nextConfig
