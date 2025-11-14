import { useEffect, useState, useCallback } from 'react'
import { toast } from 'sonner'

interface ServiceWorkerState {
  isOffline: boolean
  isUpdateAvailable: boolean
  registration: ServiceWorkerRegistration | null
  isSupported: boolean
}

export function useServiceWorker() {
  const [state, setState] = useState<ServiceWorkerState>({
    isOffline: typeof window !== 'undefined' ? !navigator.onLine : false,
    isUpdateAvailable: false,
    registration: null,
    isSupported: typeof window !== 'undefined' && 'serviceWorker' in navigator,
  })

  const [syncRegistered, setSyncRegistered] = useState(false)

  // Register service worker
  useEffect(() => {
    if (!state.isSupported) return

    const registerSW = async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
        })

        setState(prev => ({ ...prev, registration }))

        // Check for updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing
          if (!newWorker) return

          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              setState(prev => ({ ...prev, isUpdateAvailable: true }))
              toast.info('New version available! Click to update.', {
                action: {
                  label: 'Update',
                  onClick: () => updateServiceWorker(),
                },
                duration: Infinity,
              })
            }
          })
        })

        // Register periodic sync for background updates
        if ('periodicSync' in registration) {
          try {
            await (registration as any).periodicSync.register('sync-passages', {
              minInterval: 24 * 60 * 60 * 1000, // 24 hours
            })
          } catch (error) {
            console.log('Periodic sync not available:', error)
          }
        }

        console.log('Service Worker registered successfully')
      } catch (error) {
        console.error('Service Worker registration failed:', error)
      }
    }

    registerSW()
  }, [state.isSupported])

  // Handle online/offline events
  useEffect(() => {
    const handleOnline = () => {
      setState(prev => ({ ...prev, isOffline: false }))
      toast.success('Back online! Syncing data...')
      requestSync('sync-passages')
    }

    const handleOffline = () => {
      setState(prev => ({ ...prev, isOffline: true }))
      toast.warning('You are offline. Changes will sync when connection is restored.')
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Update service worker
  const updateServiceWorker = useCallback(() => {
    if (!state.registration?.waiting) return

    // Send skip waiting message
    state.registration.waiting.postMessage({ type: 'SKIP_WAITING' })

    // Reload once activated
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      window.location.reload()
    })
  }, [state.registration])

  // Request background sync
  const requestSync = useCallback(async (tag: string) => {
    if (!state.registration || !('sync' in state.registration)) {
      console.log('Background sync not supported')
      return false
    }

    try {
      await (state.registration as any).sync?.register(tag)
      setSyncRegistered(true)
      return true
    } catch (error) {
      console.error('Failed to register sync:', error)
      return false
    }
  }, [state.registration])

  // Store data for offline sync
  const storeOfflineData = useCallback(async (type: string, data: any) => {
    if (!('indexedDB' in window)) return

    try {
      const db = await openDB()
      const tx = db.transaction(type === 'passage' ? 'pending_passages' : 'offline_analytics', 'readwrite')
      const store = tx.objectStore(type === 'passage' ? 'pending_passages' : 'offline_analytics')
      
      await store.add({
        id: `${Date.now()}-${Math.random()}`,
        data,
        timestamp: Date.now(),
        token: localStorage.getItem('auth_token'),
      })

      // Request sync when back online
      if (!state.isOffline) {
        requestSync(type === 'passage' ? 'sync-passages' : 'sync-analytics')
      }

      return true
    } catch (error) {
      console.error('Failed to store offline data:', error)
      return false
    }
  }, [state.isOffline, requestSync])

  // Get cached data
  const getCachedData = useCallback(async (key: string) => {
    if (!state.registration) return null

    try {
      const cache = await caches.open('passage-planner-dynamic-v1')
      const response = await cache.match(key)
      
      if (response) {
        return await response.json()
      }
    } catch (error) {
      console.error('Failed to get cached data:', error)
    }

    return null
  }, [state.registration])

  // Clear all caches
  const clearCache = useCallback(async () => {
    if (!state.isSupported) return

    try {
      const cacheNames = await caches.keys()
      await Promise.all(cacheNames.map(name => caches.delete(name)))
      toast.success('Cache cleared successfully')
    } catch (error) {
      console.error('Failed to clear cache:', error)
      toast.error('Failed to clear cache')
    }
  }, [state.isSupported])

  // Subscribe to push notifications
  const subscribeToPush = useCallback(async () => {
    if (!state.registration || !('pushManager' in state.registration)) {
      toast.error('Push notifications not supported')
      return false
    }

    try {
      // Check permission
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        toast.error('Notification permission denied')
        return false
      }

      // Subscribe
      const subscription = await state.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
      })

      // Send subscription to server
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
        body: JSON.stringify(subscription),
      })

      toast.success('Push notifications enabled')
      return true
    } catch (error) {
      console.error('Failed to subscribe to push:', error)
      toast.error('Failed to enable push notifications')
      return false
    }
  }, [state.registration])

  return {
    isOffline: state.isOffline,
    isUpdateAvailable: state.isUpdateAvailable,
    isSupported: state.isSupported,
    registration: state.registration,
    updateServiceWorker,
    requestSync,
    storeOfflineData,
    getCachedData,
    clearCache,
    subscribeToPush,
    syncRegistered,
  }
}

// Helper to open IndexedDB
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('HelmwiseDB', 1)
    
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)
    
    request.onupgradeneeded = (event: any) => {
      const db = event.target.result
      
      if (!db.objectStoreNames.contains('pending_passages')) {
        db.createObjectStore('pending_passages', { keyPath: 'id' })
      }
      
      if (!db.objectStoreNames.contains('offline_analytics')) {
        db.createObjectStore('offline_analytics', { keyPath: 'id' })
      }
    }
  })
} 