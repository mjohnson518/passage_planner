import dynamic from 'next/dynamic'
import { Skeleton } from './ui/skeleton'

// Loading components
const MapLoader = () => (
  <div className="w-full h-[600px] relative">
    <Skeleton className="w-full h-full" />
    <div className="absolute inset-0 flex items-center justify-center">
      <p className="text-muted-foreground">Loading map...</p>
    </div>
  </div>
)

const ChartLoader = () => (
  <div className="w-full h-[300px]">
    <Skeleton className="w-full h-full" />
  </div>
)

const EditorLoader = () => (
  <div className="w-full h-[400px]">
    <Skeleton className="w-full h-full" />
  </div>
)

// Lazy loaded components with custom loading states
export const LazyMap = dynamic(
  () => import('./map/InteractiveMap'),
  {
    loading: () => <MapLoader />,
    ssr: false, // Leaflet doesn't support SSR
  }
)

export const LazyWeatherOverlay = dynamic(
  () => import('./map/WeatherOverlay'),
  {
    loading: () => <div className="animate-pulse">Loading weather data...</div>,
    ssr: false,
  }
)

export const LazyAnalyticsChart = dynamic(
  () => import('./analytics/AnalyticsChart'),
  {
    loading: () => <ChartLoader />,
  }
)

export const LazyFleetAnalytics = dynamic(
  () => import('./fleet/FleetAnalyticsDashboard'),
  {
    loading: () => <ChartLoader />,
  }
)

export const LazyPDFPreview = dynamic(
  () => import('./export/PDFPreview'),
  {
    loading: () => <div className="animate-pulse">Generating preview...</div>,
    ssr: false,
  }
)

export const LazyCodeEditor = dynamic(
  () => import('./admin/CodeEditor'),
  {
    loading: () => <EditorLoader />,
    ssr: false,
  }
)

export const LazyStripeCheckout = dynamic(
  () => import('./billing/StripeCheckout'),
  {
    loading: () => <div className="animate-pulse">Loading checkout...</div>,
    ssr: false,
  }
)

// Lazy loaded admin components (code-split per tab)
export const LazyAdminOverview = dynamic(
  () => import('./admin/AdminOverview').then(m => ({ default: m.AdminOverview })),
  { loading: () => <ChartLoader /> }
)

export const LazyUserManagement = dynamic(
  () => import('./admin/UserManagement').then(m => ({ default: m.UserManagement })),
  { loading: () => <ChartLoader /> }
)

export const LazyRevenueMetrics = dynamic(
  () => import('./admin/RevenueMetrics').then(m => ({ default: m.RevenueMetrics })),
  { loading: () => <ChartLoader /> }
)

export const LazySystemHealth = dynamic(
  () => import('./admin/SystemHealth').then(m => ({ default: m.SystemHealth })),
  { loading: () => <ChartLoader /> }
)

export const LazyAgentMonitoring = dynamic(
  () => import('./admin/AgentMonitoring').then(m => ({ default: m.AgentMonitoring })),
  { loading: () => <ChartLoader /> }
)

export const LazyAnalyticsReports = dynamic(
  () => import('./admin/AnalyticsReports').then(m => ({ default: m.AnalyticsReports })),
  { loading: () => <ChartLoader /> }
)

// Lazy loaded demo component
export const LazyDemoPassage = dynamic(
  () => import('./demo/DemoPassage').then(m => ({ default: m.DemoPassage })),
  { loading: () => <ChartLoader /> }
)

// Preload critical components after initial render
export const preloadCriticalComponents = () => {
  if (typeof window !== 'undefined') {
    // Preload map component for planner page
    import('./map/InteractiveMap')
    
    // Preload analytics for dashboard
    import('./analytics/AnalyticsChart')
  }
} 