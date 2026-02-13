// Service Worker for Helmwise PWA
const CACHE_NAME = 'helmwise-v1';
const DYNAMIC_CACHE = 'passage-planner-dynamic-v1';

// Assets to cache on install
const STATIC_ASSETS = [
  '/',
  '/offline',
  '/manifest.json',
  '/icon.svg',
];

// API routes to cache
const API_ROUTES = [
  '/api/auth/session',
  '/api/user/profile',
  '/api/passages',
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Service Worker: Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating...');
  
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames
            .filter(name => name !== CACHE_NAME && name !== DYNAMIC_CACHE)
            .map(name => caches.delete(name))
        );
      })
      .then(() => self.clients.claim())
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip chrome-extension and non-http(s) requests
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return;
  }

  // Handle API requests differently
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(handleAPIRequest(request));
    return;
  }

  // Handle static assets and pages
  event.respondWith(
    caches.match(request)
      .then(response => {
        if (response) {
          // Return cached version
          return response;
        }

        // Fetch from network and cache
        return fetch(request.clone())
          .then(response => {
            // Don't cache non-successful responses
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // Clone the response
            const responseToCache = response.clone();

            caches.open(DYNAMIC_CACHE)
              .then(cache => {
                cache.put(request, responseToCache);
              });

            return response;
          })
          .catch(() => {
            // Return offline page for navigation requests
            if (request.destination === 'document') {
              return caches.match('/offline');
            }
          });
      })
  );
});

// Handle API requests with network-first strategy
async function handleAPIRequest(request) {
  try {
    // Try network first
    const networkResponse = await fetch(request);

    // Cache successful responses
    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());

      // Also store passage plans in IndexedDB for offline viewing
      const url = new URL(request.url);
      if (url.pathname === '/api/plan' && request.method === 'POST') {
        try {
          const responseClone = networkResponse.clone();
          const data = await responseClone.json();
          if (data.success && data.plan) {
            const db = await openDB();
            const tx = db.transaction('pending_passages', 'readwrite');
            tx.objectStore('pending_passages').put({
              id: data.plan.id || `plan-${Date.now()}`,
              data: data.plan,
              cachedAt: new Date().toISOString()
            });
          }
        } catch (e) {
          // Non-critical: don't break the response if caching fails
        }
      }
    }

    return networkResponse;
  } catch (error) {
    // Fallback to cache for GET requests
    if (request.method === 'GET') {
      const cachedResponse = await caches.match(request);
      if (cachedResponse) {
        return cachedResponse;
      }
    }

    // Return error response
    return new Response(
      JSON.stringify({ error: 'Offline - request failed' }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  console.log('Service Worker: Sync event', event.tag);
  
  if (event.tag === 'sync-passages') {
    event.waitUntil(syncPassages());
  } else if (event.tag === 'sync-analytics') {
    event.waitUntil(syncAnalytics());
  }
});

// Sync offline passage plans
async function syncPassages() {
  try {
    // Get pending passages from IndexedDB
    const db = await openDB();
    const tx = db.transaction('pending_passages', 'readonly');
    const store = tx.objectStore('pending_passages');
    const passages = await store.getAll();
    
    // Send each passage to the server
    for (const passage of passages) {
      await fetch('/api/passages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${passage.token}`
        },
        body: JSON.stringify(passage.data)
      });
      
      // Remove from pending after successful sync
      const deleteTx = db.transaction('pending_passages', 'readwrite');
      await deleteTx.objectStore('pending_passages').delete(passage.id);
    }
  } catch (error) {
    console.error('Failed to sync passages:', error);
  }
}

// Sync offline analytics events
async function syncAnalytics() {
  try {
    const db = await openDB();
    const tx = db.transaction('offline_analytics', 'readonly');
    const store = tx.objectStore('offline_analytics');
    const events = await store.getAll();

    if (events.length === 0) return;

    // Batch send analytics events
    await fetch('/api/analytics/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events: events.map(e => e.data) })
    });

    // Clear sent events
    const deleteTx = db.transaction('offline_analytics', 'readwrite');
    const deleteStore = deleteTx.objectStore('offline_analytics');
    for (const event of events) {
      deleteStore.delete(event.id);
    }
  } catch (error) {
    console.error('Failed to sync analytics:', error);
  }
}

// Push notifications
self.addEventListener('push', (event) => {
  const options = {
    body: event.data ? event.data.text() : 'New update from Helmwise',
    icon: '/icon.svg',
    badge: '/icon.svg',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    }
  };
  
  event.waitUntil(
    self.registration.showNotification('Helmwise', options)
  );
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  event.waitUntil(
    clients.openWindow('/')
  );
});

// Helper function to open IndexedDB
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('HelmwiseDB', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      if (!db.objectStoreNames.contains('pending_passages')) {
        db.createObjectStore('pending_passages', { keyPath: 'id' });
      }
      
      if (!db.objectStoreNames.contains('offline_analytics')) {
        db.createObjectStore('offline_analytics', { keyPath: 'id' });
      }
    };
  });
}

// Listen for skip waiting message
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
}); 