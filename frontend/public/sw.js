// Service Worker Version
const CACHE_VERSION = 'v1';
const CACHE_NAME = `passage-planner-${CACHE_VERSION}`;

// Assets to cache
const urlsToCache = [
  '/',
  '/dashboard',
  '/offline',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png'
];

// Install event - cache assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName.startsWith('passage-planner-')) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event - serve from cache when offline
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // Skip API requests
  if (event.request.url.includes('/api/')) {
    return event.respondWith(
      fetch(event.request).catch(() => {
        return new Response(
          JSON.stringify({ error: 'Offline' }), 
          { headers: { 'Content-Type': 'application/json' } }
        );
      })
    );
  }

  event.respondWith(
    caches.match(event.request).then((response) => {
      // Cache hit - return response
      if (response) {
        return response;
      }

      // Clone the request
      const fetchRequest = event.request.clone();

      return fetch(fetchRequest).then((response) => {
        // Check if valid response
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }

        // Clone the response
        const responseToCache = response.clone();

        // Cache the response for future use
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });

        return response;
      }).catch(() => {
        // Offline fallback
        if (event.request.destination === 'document') {
          return caches.match('/offline');
        }
      });
    })
  );
});

// Background sync for offline passage planning
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-passages') {
    event.waitUntil(syncPassages());
  }
});

async function syncPassages() {
  // Get pending passages from IndexedDB
  const pendingPassages = await getPendingPassages();
  
  for (const passage of pendingPassages) {
    try {
      const response = await fetch('/api/passages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(passage)
      });
      
      if (response.ok) {
        await removePendingPassage(passage.id);
      }
    } catch (error) {
      console.error('Failed to sync passage:', error);
    }
  }
}

// Helper functions for IndexedDB (simplified)
async function getPendingPassages() {
  // Implementation would use IndexedDB
  return [];
}

async function removePendingPassage(id) {
  // Implementation would use IndexedDB
} 