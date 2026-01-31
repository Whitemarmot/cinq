/**
 * Cinq PWA Service Worker
 * Cache-first strategy for static assets, network-first for API
 */

const CACHE_NAME = 'cinq-v1';
const STATIC_CACHE = 'cinq-static-v1';
const DYNAMIC_CACHE = 'cinq-dynamic-v1';

// Assets to cache on install
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/app.html',
  '/login.html',
  '/gift.html',
  '/redeem.html',
  '/404.html',
  '/error.html',
  '/favicon.svg',
  '/manifest.json',
  '/design/styles.css',
  '/styles.css',
  '/animations.css',
  '/animations.js',
  '/fun.js',
  '/assets/icons/icon-192x192.png',
  '/assets/icons/icon-512x512.png'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('[SW] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => self.skipWaiting())
      .catch((err) => console.log('[SW] Cache failed:', err))
  );
});

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== STATIC_CACHE && name !== DYNAMIC_CACHE)
            .map((name) => {
              console.log('[SW] Deleting old cache:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => self.clients.claim())
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip external requests (except fonts)
  if (!url.origin.includes(self.location.origin) && !url.hostname.includes('fonts.googleapis.com') && !url.hostname.includes('fonts.gstatic.com')) {
    return;
  }

  // API calls - Network first, cache fallback
  if (url.pathname.includes('/api/') || url.hostname.includes('supabase')) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Static assets - Cache first, network fallback
  event.respondWith(cacheFirst(request));
});

// Cache-first strategy
async function cacheFirst(request) {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }
  
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    // Return offline fallback for HTML requests
    if (request.headers.get('accept')?.includes('text/html')) {
      return caches.match('/404.html');
    }
    throw error;
  }
}

// Network-first strategy
async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    throw error;
  }
}

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync:', event.tag);
  if (event.tag === 'sync-pings') {
    event.waitUntil(syncPings());
  }
});

async function syncPings() {
  // Placeholder for syncing offline pings when back online
  console.log('[SW] Syncing offline pings...');
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

  // Handle notification badge count
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

  // Clear badge when notification is clicked
  if ('clearAppBadge' in navigator) {
    navigator.clearAppBadge().catch(() => {});
  }

  if (event.action === 'dismiss') return;

  const targetUrl = event.notification.data?.url || '/app.html';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Focus existing window if open and navigate
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
        // Otherwise open new window
        return clients.openWindow(targetUrl);
      })
  );
});

// Notification close handler (dismissed by user)
self.addEventListener('notificationclose', (event) => {
  console.log('[SW] Notification dismissed:', event.notification.tag);
});

// Push subscription change handler
self.addEventListener('pushsubscriptionchange', (event) => {
  console.log('[SW] Push subscription changed');
  event.waitUntil(
    self.registration.pushManager.subscribe(event.oldSubscription.options)
      .then((subscription) => {
        // Re-register with server
        return fetch('/.netlify/functions/push-subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subscription })
        });
      })
      .catch((err) => console.error('[SW] Re-subscription failed:', err))
  );
});

console.log('[SW] Service worker loaded');
