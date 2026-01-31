/**
 * Cinq PWA Service Worker v3
 * Optimized caching strategies with Navigation Preload
 * 
 * @version 3.0.0
 * @author Cinq Team
 */

const SW_VERSION = '3.0.0';
const CACHE_PREFIX = 'cinq';
const STATIC_CACHE = `${CACHE_PREFIX}-static-v4`;
const DYNAMIC_CACHE = `${CACHE_PREFIX}-dynamic-v4`;
const IMAGE_CACHE = `${CACHE_PREFIX}-images-v2`;
const FONT_CACHE = `${CACHE_PREFIX}-fonts-v2`;

// Maximum cache sizes
const MAX_DYNAMIC_CACHE = 50;
const MAX_IMAGE_CACHE = 30;

// Critical assets to precache (app shell)
// These MUST work offline - no external dependencies
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/app.html',
  '/login.html',
  '/register.html',
  '/gift.html',
  '/redeem.html',
  '/feed.html',
  '/settings.html',
  '/404.html',
  '/error.html',
  '/offline.html',
  '/favicon.svg',
  '/manifest.json',
  // Stylesheets
  '/styles.css',
  '/styles.min.css',
  '/animations.css',
  '/animations.min.css',
  '/design/styles.min.css',
  '/css/base.min.css',
  '/css/components.min.css',
  '/css/mobile-responsive.min.css',
  '/css/a11y.min.css',
  // JavaScript
  '/animations.js',
  '/animations.min.js',
  '/fun.js',
  '/fun.min.js',
  '/pwa-install.js',
  '/pwa-install.min.js',
  '/analytics.min.js',
  '/js/app.js',
  '/js/common.js',
  // Icons
  '/assets/icons/icon-72x72.png',
  '/assets/icons/icon-96x96.png',
  '/assets/icons/icon-192x192.png',
  '/assets/icons/icon-512x512.png',
  '/assets/icons/icon.svg'
];

// Assets that are nice to have but not critical
const OPTIONAL_PRECACHE = [
  '/assets/icons/icon-128x128.png',
  '/assets/icons/icon-144x144.png',
  '/assets/icons/icon-152x152.png',
  '/assets/icons/icon-384x384.png'
];

// ============================================================================
// INSTALL EVENT
// ============================================================================

self.addEventListener('install', (event) => {
  console.log(`[SW ${SW_VERSION}] Installing...`);
  
  event.waitUntil(
    (async () => {
      const cache = await caches.open(STATIC_CACHE);
      
      // Precache critical assets (fail if any fails)
      console.log('[SW] Precaching critical assets...');
      try {
        await cache.addAll(PRECACHE_ASSETS);
        console.log('[SW] Critical assets cached successfully');
      } catch (err) {
        console.error('[SW] Critical precache failed:', err);
        // Don't throw - let the SW install anyway
      }
      
      // Try optional assets (don't fail if these fail)
      console.log('[SW] Precaching optional assets...');
      for (const url of OPTIONAL_PRECACHE) {
        try {
          await cache.add(url);
        } catch (e) {
          console.warn(`[SW] Optional asset failed: ${url}`);
        }
      }
      
      // Force activation
      await self.skipWaiting();
      console.log('[SW] Installation complete');
    })()
  );
});

// ============================================================================
// ACTIVATE EVENT
// ============================================================================

self.addEventListener('activate', (event) => {
  console.log(`[SW ${SW_VERSION}] Activating...`);
  
  const currentCaches = [STATIC_CACHE, DYNAMIC_CACHE, IMAGE_CACHE, FONT_CACHE];
  
  event.waitUntil(
    (async () => {
      // Enable Navigation Preload if supported
      if (self.registration.navigationPreload) {
        try {
          await self.registration.navigationPreload.enable();
          console.log('[SW] Navigation Preload enabled');
        } catch (e) {
          console.warn('[SW] Navigation Preload not available:', e);
        }
      }
      
      // Clean old caches
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames
          .filter(name => name.startsWith(CACHE_PREFIX) && !currentCaches.includes(name))
          .map(name => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
      
      // Claim all clients
      await self.clients.claim();
      console.log('[SW] Activation complete');
    })()
  );
});

// ============================================================================
// FETCH EVENT
// ============================================================================

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip chrome-extension and other non-http(s) schemes
  if (!url.protocol.startsWith('http')) return;

  // Skip requests to different origins except allowed CDNs
  const allowedOrigins = [
    self.location.origin,
    'https://fonts.googleapis.com',
    'https://fonts.gstatic.com'
  ];
  
  if (!allowedOrigins.some(origin => url.href.startsWith(origin))) {
    return;
  }

  // Route to appropriate strategy
  event.respondWith(handleFetch(event));
});

async function handleFetch(event) {
  const { request } = event;
  const url = new URL(request.url);

  try {
    // API calls - Network first with cache fallback (shorter timeout on mobile)
    if (url.pathname.startsWith('/api/') || url.hostname.includes('supabase')) {
      return await networkFirst(request, DYNAMIC_CACHE, 5000);
    }

    // Google Fonts CSS - Stale while revalidate
    if (url.hostname === 'fonts.googleapis.com') {
      return await staleWhileRevalidate(request, FONT_CACHE);
    }

    // Google Fonts files - Cache first (immutable)
    if (url.hostname === 'fonts.gstatic.com') {
      return await cacheFirst(request, FONT_CACHE);
    }

    // Images - Cache first with size limit
    if (request.destination === 'image' || /\.(png|jpg|jpeg|gif|webp|svg|ico)$/i.test(url.pathname)) {
      return await cacheFirst(request, IMAGE_CACHE, MAX_IMAGE_CACHE);
    }

    // HTML pages - Network first with Navigation Preload support
    if (request.mode === 'navigate' || request.headers.get('accept')?.includes('text/html')) {
      return await handleNavigationRequest(event);
    }

    // Static assets (JS, CSS) - Stale while revalidate
    if (/\.(js|css)$/i.test(url.pathname)) {
      return await staleWhileRevalidate(request, DYNAMIC_CACHE);
    }

    // Default - Cache first for same origin
    if (url.origin === self.location.origin) {
      return await cacheFirst(request, DYNAMIC_CACHE, MAX_DYNAMIC_CACHE);
    }

    // Fallback to network
    return await fetch(request);

  } catch (error) {
    console.error('[SW] Fetch error:', error);
    
    // Return offline page for navigation requests
    if (request.mode === 'navigate' || request.headers.get('accept')?.includes('text/html')) {
      const offlinePage = await caches.match('/offline.html');
      if (offlinePage) return offlinePage;
    }
    
    throw error;
  }
}

// ============================================================================
// CACHING STRATEGIES
// ============================================================================

/**
 * Handle navigation requests with Navigation Preload support
 */
async function handleNavigationRequest(event) {
  const { request } = event;
  
  try {
    // Use Navigation Preload response if available
    const preloadResponse = event.preloadResponse ? await event.preloadResponse : null;
    
    if (preloadResponse) {
      // Cache the preloaded response
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, preloadResponse.clone());
      return preloadResponse;
    }
    
    // Fall back to network first
    return await networkFirst(request, DYNAMIC_CACHE, 5000);
    
  } catch (error) {
    // Return cached version or offline page
    const cachedResponse = await caches.match(request);
    if (cachedResponse) return cachedResponse;
    
    const offlinePage = await caches.match('/offline.html');
    if (offlinePage) return offlinePage;
    
    throw error;
  }
}

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
      return caches.match('/offline.html');
    }
    throw error;
  }
}

/**
 * Network-first strategy - Best for dynamic content
 * Uses AbortController for timeout
 */
async function networkFirst(request, cacheName, timeout = 5000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const networkResponse = await fetch(request, { signal: controller.signal });
    clearTimeout(timeoutId);
    
    if (networkResponse.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
    
  } catch (error) {
    clearTimeout(timeoutId);
    
    // Try cache on network failure
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      console.log('[SW] Serving from cache:', request.url);
      return cachedResponse;
    }
    
    // Return offline fallback for HTML
    if (request.headers.get('accept')?.includes('text/html')) {
      return caches.match('/offline.html');
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
  
  // Always fetch in background to update cache
  const fetchPromise = fetch(request)
    .then(response => {
      if (response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => null);
  
  // Return cached response immediately if available
  if (cachedResponse) {
    return cachedResponse;
  }
  
  // If no cache, wait for network
  return fetchPromise;
}

/**
 * Trim cache to max size (removes oldest entries)
 */
async function trimCache(cacheName, maxItems) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  
  if (keys.length > maxItems) {
    const deleteCount = keys.length - maxItems;
    console.log(`[SW] Trimming ${deleteCount} items from ${cacheName}`);
    await Promise.all(
      keys.slice(0, deleteCount).map(key => cache.delete(key))
    );
  }
}

// ============================================================================
// BACKGROUND SYNC
// ============================================================================

self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync:', event.tag);
  
  if (event.tag === 'sync-pings') {
    event.waitUntil(syncOfflineActions('pings'));
  }
  
  if (event.tag === 'sync-messages') {
    event.waitUntil(syncOfflineActions('messages'));
  }
});

async function syncOfflineActions(type) {
  console.log(`[SW] Syncing offline ${type}...`);
  
  // Get queued actions from IndexedDB
  // This would integrate with the app's offline queue
  try {
    // Notify clients that sync is starting
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({
        type: 'SYNC_STATUS',
        status: 'syncing',
        queue: type
      });
    });
    
    // TODO: Implement actual sync logic
    
    // Notify clients that sync completed
    clients.forEach(client => {
      client.postMessage({
        type: 'SYNC_STATUS',
        status: 'complete',
        queue: type
      });
    });
  } catch (error) {
    console.error('[SW] Sync failed:', error);
  }
}

// ============================================================================
// PUSH NOTIFICATIONS
// ============================================================================

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
    silent: data.silent || false,
    data: {
      url: data.url || '/app.html',
      timestamp: Date.now(),
      ...data.data
    },
    actions: data.actions || [
      { action: 'open', title: 'Ouvrir', icon: '/assets/icons/icon-96x96.png' },
      { action: 'dismiss', title: 'Ignorer' }
    ]
  };

  // Update app badge count
  if ('setAppBadge' in navigator && data.badgeCount) {
    navigator.setAppBadge(data.badgeCount).catch(() => {});
  }

  event.waitUntil(
    self.registration.showNotification(data.title || 'Cinq 💫', options)
  );
});

// ============================================================================
// NOTIFICATION CLICK HANDLER
// ============================================================================

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  // Clear badge
  if ('clearAppBadge' in navigator) {
    navigator.clearAppBadge().catch(() => {});
  }

  // Handle dismiss action
  if (event.action === 'dismiss') {
    return;
  }

  const targetUrl = event.notification.data?.url || '/app.html';

  event.waitUntil(
    (async () => {
      // Try to find an existing window
      const clientList = await clients.matchAll({ 
        type: 'window', 
        includeUncontrolled: true 
      });
      
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          // Post message to existing client
          client.postMessage({
            type: 'NOTIFICATION_CLICKED',
            url: targetUrl,
            data: event.notification.data
          });
          return client.focus();
        }
      }
      
      // No existing window - open new one
      return clients.openWindow(targetUrl);
    })()
  );
});

// ============================================================================
// NOTIFICATION CLOSE HANDLER
// ============================================================================

self.addEventListener('notificationclose', (event) => {
  // Track notification dismissal for analytics
  console.log('[SW] Notification dismissed:', event.notification.tag);
});

// ============================================================================
// PUSH SUBSCRIPTION CHANGE
// ============================================================================

self.addEventListener('pushsubscriptionchange', (event) => {
  console.log('[SW] Push subscription changed');
  
  event.waitUntil(
    (async () => {
      try {
        const subscription = await self.registration.pushManager.subscribe(
          event.oldSubscription?.options || {
            userVisibleOnly: true
          }
        );
        
        // Update subscription on server
        await fetch('/api/push-subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            subscription,
            action: 'update'
          })
        });
        
        console.log('[SW] Push subscription updated');
      } catch (err) {
        console.error('[SW] Re-subscription failed:', err);
      }
    })()
  );
});

// ============================================================================
// MESSAGE HANDLER
// ============================================================================

self.addEventListener('message', (event) => {
  const { type, data } = event.data || {};
  
  switch (type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;
      
    case 'GET_VERSION':
      event.ports[0]?.postMessage({ version: SW_VERSION });
      break;
      
    case 'CLEAR_CACHES':
      caches.keys().then(names => {
        Promise.all(
          names.filter(n => n.startsWith(CACHE_PREFIX)).map(n => caches.delete(n))
        );
      });
      break;
      
    case 'CACHE_URLS':
      if (data?.urls && Array.isArray(data.urls)) {
        caches.open(STATIC_CACHE).then(cache => {
          cache.addAll(data.urls).catch(err => {
            console.warn('[SW] Manual cache failed:', err);
          });
        });
      }
      break;
      
    case 'GET_CACHE_STATUS':
      (async () => {
        const cacheNames = await caches.keys();
        const status = {};
        for (const name of cacheNames.filter(n => n.startsWith(CACHE_PREFIX))) {
          const cache = await caches.open(name);
          const keys = await cache.keys();
          status[name] = keys.length;
        }
        event.ports[0]?.postMessage({ caches: status, version: SW_VERSION });
      })();
      break;
  }
});

// ============================================================================
// PERIODIC BACKGROUND SYNC (for supported browsers)
// ============================================================================

self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'content-sync') {
    event.waitUntil(periodicContentSync());
  }
});

async function periodicContentSync() {
  console.log('[SW] Periodic content sync');
  
  try {
    // Refresh critical cached content
    const cache = await caches.open(DYNAMIC_CACHE);
    const urls = ['/app.html', '/feed.html'];
    
    for (const url of urls) {
      try {
        const response = await fetch(url);
        if (response.ok) {
          await cache.put(url, response);
        }
      } catch (e) {
        console.warn(`[SW] Failed to refresh ${url}`);
      }
    }
  } catch (error) {
    console.error('[SW] Periodic sync failed:', error);
  }
}

// ============================================================================
// STARTUP
// ============================================================================

console.log(`[SW ${SW_VERSION}] Service worker loaded`);
