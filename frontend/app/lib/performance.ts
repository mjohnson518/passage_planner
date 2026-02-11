/**
 * Performance optimization utilities
 */

// Dynamic imports for heavy components
export const loadHeavyComponents = {
  // Lazy load chart components
  PassageMap: () => import('../components/maps/PassageMap'),
  WeatherChart: () => import('../components/charts/WeatherChart'), 
  TideChart: () => import('../components/charts/TideChart'),
  
  // Lazy load export components
  ExportDialog: () => import('../components/export/ExportDialog'),
  PDFPreview: () => import('../components/export/PDFPreview'),
  
  // Lazy load analytics
  AnalyticsDashboard: () => import('../components/analytics/AnalyticsDashboard'),
  FleetAnalyticsDashboard: () => import('../components/fleet/FleetAnalyticsDashboard'),
}

// Debounce function for search inputs
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null
  
  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null
      func(...args)
    }
    
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(later, wait)
  }
}

// Throttle function for scroll/resize handlers
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean = false
  
  return function executedFunction(this: unknown, ...args: Parameters<T>) {
    if (!inThrottle) {
      func.apply(this, args)
      inThrottle = true
      setTimeout(() => inThrottle = false, limit)
    }
  }
}

// Intersection Observer for lazy loading
export function useLazyLoad(
  ref: React.RefObject<HTMLElement>,
  onIntersect: () => void,
  options?: IntersectionObserverInit
) {
  if (typeof window === 'undefined') return
  
  const observer = new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting) {
      onIntersect()
      observer.disconnect()
    }
  }, options)
  
  if (ref.current) {
    observer.observe(ref.current)
  }
  
  return () => observer.disconnect()
}

// Preload critical resources
export function preloadCriticalResources() {
  // Preload fonts
  const fontLinks = [
    '/fonts/inter-var.woff2',
    '/fonts/cal-sans.woff2'
  ]
  
  fontLinks.forEach(href => {
    const link = document.createElement('link')
    link.rel = 'preload'
    link.as = 'font'
    link.type = 'font/woff2'
    link.href = href
    link.crossOrigin = 'anonymous'
    document.head.appendChild(link)
  })
  
  // Preconnect to external domains
  const domains = [
    'https://api.mapbox.com',
    'https://tile.openstreetmap.org',
    'https://api.stripe.com'
  ]
  
  domains.forEach(href => {
    const link = document.createElement('link')
    link.rel = 'preconnect'
    link.href = href
    document.head.appendChild(link)
  })
}

// Service Worker registration with updates
export async function registerServiceWorker() {
  if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js')
      
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New service worker available
              if (confirm('New version available! Reload to update?')) {
                window.location.reload()
              }
            }
          })
        }
      })
      
      return registration
    } catch (error) {
      console.error('Service Worker registration failed:', error)
    }
  }
}

// Memory leak prevention for subscriptions
export class SubscriptionManager {
  private subscriptions: Set<() => void> = new Set()
  
  add(unsubscribe: () => void) {
    this.subscriptions.add(unsubscribe)
    return () => {
      unsubscribe()
      this.subscriptions.delete(unsubscribe)
    }
  }
  
  cleanup() {
    this.subscriptions.forEach(unsubscribe => unsubscribe())
    this.subscriptions.clear()
  }
}

// Request deduplication
const requestCache = new Map<string, Promise<any>>()

export async function deduplicatedFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl = 5000
): Promise<T> {
  const cached = requestCache.get(key)
  if (cached) return cached
  
  const promise = fetcher()
  requestCache.set(key, promise)
  
  // Clean up after TTL
  setTimeout(() => requestCache.delete(key), ttl)
  
  try {
    return await promise
  } catch (error) {
    requestCache.delete(key)
    throw error
  }
} 