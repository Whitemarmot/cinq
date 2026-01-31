/**
 * Cinq PWA Service Worker v2
 * Optimized caching strategies for performance
 */

const SW_VERSION = '2.0.0';
const CACHE_PREFIX = 'cinq';
const STATIC_CACHE = `${CACHE_PREFIX}-static-v2`;
const DYNAMIC_CACHE = `${CACHE_PREFIX}-dynamic-v2`;
const IMAGE_CACHE = `${CACHE_PREFIX}-images-v1`;
const FONT_CACHE = `${CACHE_PREFIX}-fonts-v1`;

// Maximum cache sizes
const MAX_DYNAMIC_CACHE = 50;
const MAX_IMAGE_CACHE = 30;

// Critical assets to precache (app shell)
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/app.html',
  '/login.html',
  '/register.html',
  '/gift.html',
  '/redeem.html',
  '/404.html',
  '/error.html',
  '/favicon.svg',
  '/manifest.json',
  '/styles.css',
  '/animations.css',
  '/animations.js',
  '/fun.js',
  '/pwa-install.js',
  '/assets/icons/icon-192x192.png',
  '/assets/icons/icon-512x512.png',
  '/assets/icons/icon.svg'
];

// Install event - precache critical assets
self.addEventListener('install', (event) => {
  console.log(`[SW ${SW_VERSION}] Installing...`);
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => {
        console.log('[SW] Precaching app shell');
        return cache.addAll(PRECACHE_ASSETS);
      })
      .then(() => self.skipWaiting())
      .catch(err => console.error('[SW] Precache failed:', err))
  );
});

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
  console.log(`[SW ${SW_VERSION}] Activating...`);
  const currentCaches = [STATIC_CACHE, DYNAMIC_CACHE, IMAGE_CACHE, FONT_CACHE];
  
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames
            .filter(name => name.startsWith(CACHE_PREFIX) && !currentCaches.includes(name))
            .map(name => {
              console.log('[SW] Deleting old cache:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => self.clients.claim())
  );
});

// Fetch event - route requests to appropriate strategy
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip chrome-extension and other non-http(s) schemes
  if (!url.protocol.startsWith('http')) return;

  // API calls - Network first with cache fallback
  if (url.pathname.startsWith('/api/') || url.hostname.includes('supabase')) {
    event.respondWith(networkFirst(request, DYNAMIC_CACHE));
    return;
  }

  // Google Fonts CSS - Stale while revalidate
  if (url.hostname === 'fonts.googleapis.com') {
    event.respondWith(staleWhileRevalidate(request, FONT_CACHE));
    return;
  }

  // Google Fonts files - Cache first (immutable)
  if (url.hostname === 'fonts.gstatic.com') {
    event.respondWith(cacheFirst(request, FONT_CACHE));
    return;
  }

  // Images - Cache first with size limit
  if (request.destination === 'image' || /\.(png|jpg|jpeg|gif|webp|svg|ico)$/i.test(url.pathname)) {
    event.respondWith(cacheFirst(request, IMAGE_CACHE, MAX_IMAGE_CACHE));
    return;
  }

  // HTML pages - Network first for freshness
  if (request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(networkFirst(request, DYNAMIC_CACHE));
    return;
  }

  // Static assets (JS, CSS) - Stale while revalidate
  if (/\.(js|css)$/i.test(url.pathname)) {
    event.respondWith(staleWhileRevalidate(request, DYNAMIC_CACHE));
    return;
  }

  // Default - Cache first for same origin
  if (url.origin === self.location.origin) {
    event.respondWith(cacheFirst(request, DYNAMIC_CACHE, MAX_DYNAMIC_CACHE));
  }
});

/**
 * Cache-first strategy - Best for immutable assets
 */
async function cacheFirst(request, cacheName, maxItems = null) {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }
  
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
      if (maxItems) trimCache(cacheName, maxItems);
    }
    return networkResponse;
  } catch (error) {
    // Return offline fallback for HTML
    if (request.headers.get('accept')?.includes('text/html')) {
      return caches.match('/404.html');
    }
    throw error;
  }
}

/**
 * Network-first strategy - Best for dynamic content
 */
async function networkFirst(request, cacheName, timeout = 3000) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    const networkResponse = await fetch(request, { signal: controller.signal });
    clearTimeout(timeoutId);
    
    if (networkResponse.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Return offline fallback for HTML
    if (request.headers.get('accept')?.includes('text/html')) {
      return caches.match('/404.html');
    }
    throw error;
  }
}

/**
 * Stale-while-revalidate - Return cache immediately, update in background
 */
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);
  
  // Fetch in background regardless
  const networkPromise = fetch(request).then(response => {
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  }).catch(() => null);
  
  // Return cached if available, otherwise wait for network
  return cachedResponse || networkPromise;
}

/**
 * Trim cache to max size (LRU-like, removes oldest entries)
 */
async function trimCache(cacheName, maxItems) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length > maxItems) {
    const deleteCount = keys.length - maxItems;
    await Promise.all(
      keys.slice(0, deleteCount).map(key => cache.delete(key))
    );
  }
}

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync:', event.tag);
  if (event.tag === 'sync-pings') {
    event.waitUntil(syncOfflineActions());
  }
});

async function syncOfflineActions() {
  console.log('[SW] Syncing offline actions...');
  // Get queued actions from IndexedDB and replay them
  // This would integrate with the app's offline queue
}

// Push notifications
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch (e) {
    data = { body: event.data.text() };
  }

  const options = {
    body: data.body || 'Tu as reçu un nouveau message',
    icon: data.icon || '/assets/icons/icon-192x192.png',
    badge: data.badge || '/assets/icons/icon-72x72.png',
    vibrate: [100, 50, 100],
    tag: data.tag || 'cinq-notification',
    renotify: true,
    requireInteraction: data.requireInteraction || false,
    data: {
      url: data.url || '/app.html',
      ...data.data
    },
    actions: data.actions || [
      { action: 'open', title: 'Ouvrir' },
      { action: 'dismiss', title: 'Ignorer' }
    ]
  };

  // Update app badge count
  if ('setAppBadge' in navigator) {
    navigator.setAppBadge(data.badgeCount || 1).catch(() => {});
  }

  event.waitUntil(
    self.registration.showNotification(data.title || 'Cinq 💫', options)
  );
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if ('clearAppBadge' in navigator) {
    navigator.clearAppBadge().catch(() => {});
  }

  if (event.action === 'dismiss') return;

  const targetUrl = event.notification.data?.url || '/app.html';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(clientList => {
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.postMessage({
              type: 'NOTIFICATION_CLICKED',
              url: targetUrl,
              data: event.notification.data
            });
            return client.focus();
          }
        }
        return clients.openWindow(targetUrl);
      })
  );
});

// Push subscription change handler
self.addEventListener('pushsubscriptionchange', (event) => {
  console.log('[SW] Push subscription changed');
  event.waitUntil(
    self.registration.pushManager.subscribe(event.oldSubscription?.options)
      .then(subscription => {
        return fetch('/api/push-subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subscription })
        });
      })
      .catch(err => console.error('[SW] Re-subscription failed:', err))
  );
});

// Message handler for cache management
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data?.type === 'GET_VERSION') {
    event.ports[0]?.postMessage({ version: SW_VERSION });
  }
  
  if (event.data?.type === 'CLEAR_CACHES') {
    caches.keys().then(names => {
      names.filter(n => n.startsWith(CACHE_PREFIX)).forEach(n => caches.delete(n));
    });
  }
});

console.log(`[SW ${SW_VERSION}] Service worker loaded`);
