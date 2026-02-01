/**
 * ==========================================================================
 * CINQ PWA Service Worker v4
 * ==========================================================================
 * 
 * Advanced PWA features:
 * - Intelligent caching strategies
 * - Navigation Preload
 * - Background Sync for offline messages
 * - IndexedDB integration
 * - Push notifications
 * - Periodic sync
 * 
 * @version 4.0.0
 * @author Cinq Team
 */

const SW_VERSION = '4.0.0';
const CACHE_PREFIX = 'cinq';
const STATIC_CACHE = `${CACHE_PREFIX}-static-v5`;
const DYNAMIC_CACHE = `${CACHE_PREFIX}-dynamic-v5`;
const IMAGE_CACHE = `${CACHE_PREFIX}-images-v3`;
const FONT_CACHE = `${CACHE_PREFIX}-fonts-v3`;
const API_CACHE = `${CACHE_PREFIX}-api-v1`;

// Maximum cache sizes
const MAX_DYNAMIC_CACHE = 50;
const MAX_IMAGE_CACHE = 30;
const MAX_API_CACHE = 20;

// API endpoint patterns
const API_BASE = '/.netlify/functions';
const SUPABASE_URL = 'guioxfulihyehrwytxce.supabase.co';

// Critical assets to precache (app shell)
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
  '/js/offline-db.js',
  // Icons
  '/assets/icons/icon-72x72.png',
  '/assets/icons/icon-96x96.png',
  '/assets/icons/icon-192x192.png',
  '/assets/icons/icon-512x512.png',
  '/assets/icons/icon.svg'
];

// Optional assets (nice to have)
const OPTIONAL_PRECACHE = [
  '/assets/icons/icon-128x128.png',
  '/assets/icons/icon-144x144.png',
  '/assets/icons/icon-152x152.png',
  '/assets/icons/icon-384x384.png'
];

// ============================================================================
// INDEXEDDB FOR SYNC QUEUE
// ============================================================================

const DB_NAME = 'cinq-offline-db';
const DB_VERSION = 1;

let db = null;

/**
 * Open IndexedDB connection
 */
async function openDB() {
  if (db) return db;
  
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };
    
    request.onupgradeneeded = (event) => {
      const database = event.target.result;
      
      if (!database.objectStoreNames.contains('pending-messages')) {
        const store = database.createObjectStore('pending-messages', {
          keyPath: 'id',
          autoIncrement: true
        });
        store.createIndex('status', 'status', { unique: false });
      }
      
      if (!database.objectStoreNames.contains('pending-actions')) {
        database.createObjectStore('pending-actions', {
          keyPath: 'id',
          autoIncrement: true
        });
      }
    };
  });
}

/**
 * Get pending messages from IndexedDB
 */
async function getPendingMessages() {
  const database = await openDB();
  
  return new Promise((resolve, reject) => {
    const tx = database.transaction('pending-messages', 'readonly');
    const store = tx.objectStore('pending-messages');
    const index = store.index('status');
    const request = index.getAll('pending');
    
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Update message status in IndexedDB
 */
async function updateMessageStatus(id, status, extra = {}) {
  const database = await openDB();
  
  return new Promise((resolve, reject) => {
    const tx = database.transaction('pending-messages', 'readwrite');
    const store = tx.objectStore('pending-messages');
    const getRequest = store.get(id);
    
    getRequest.onsuccess = () => {
      const message = getRequest.result;
      if (!message) {
        resolve();
        return;
      }
      
      const updated = { ...message, ...extra, status };
      store.put(updated);
    };
    
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Remove message from IndexedDB
 */
async function removeMessage(id) {
  const database = await openDB();
  
  return new Promise((resolve, reject) => {
    const tx = database.transaction('pending-messages', 'readwrite');
    const store = tx.objectStore('pending-messages');
    store.delete(id);
    
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ============================================================================
// INSTALL EVENT
// ============================================================================

self.addEventListener('install', (event) => {
  console.log(`[SW ${SW_VERSION}] Installing...`);
  
  event.waitUntil(
    (async () => {
      const cache = await caches.open(STATIC_CACHE);
      
      // Precache critical assets
      console.log('[SW] Precaching critical assets...');
      try {
        await cache.addAll(PRECACHE_ASSETS);
        console.log('[SW] Critical assets cached successfully');
      } catch (err) {
        console.error('[SW] Critical precache failed:', err);
      }
      
      // Try optional assets
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
  
  const currentCaches = [STATIC_CACHE, DYNAMIC_CACHE, IMAGE_CACHE, FONT_CACHE, API_CACHE];
  
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

  // Handle POST requests for messages (queue if offline)
  if (request.method === 'POST' && url.pathname.includes('/messages')) {
    event.respondWith(handleMessagePost(event));
    return;
  }

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip non-http(s) schemes
  if (!url.protocol.startsWith('http')) return;

  // Allowed origins
  const allowedOrigins = [
    self.location.origin,
    'https://fonts.googleapis.com',
    'https://fonts.gstatic.com'
  ];
  
  if (!allowedOrigins.some(origin => url.href.startsWith(origin))) {
    return;
  }

  event.respondWith(handleFetch(event));
});

/**
 * Handle message POST requests - queue if offline
 */
async function handleMessagePost(event) {
  const { request } = event;
  
  // Try network first
  try {
    const response = await fetch(request.clone());
    return response;
  } catch (error) {
    // Network failed - queue for background sync
    console.log('[SW] Network failed, queuing message for sync...');
    
    try {
      const body = await request.clone().json();
      
      // Store in IndexedDB
      const database = await openDB();
      const tx = database.transaction('pending-messages', 'readwrite');
      const store = tx.objectStore('pending-messages');
      
      await new Promise((resolve, reject) => {
        const addRequest = store.add({
          contact_id: body.contact_id,
          content: body.content || null,
          is_ping: body.is_ping || false,
          status: 'pending',
          created_at: new Date().toISOString(),
          retries: 0
        });
        
        addRequest.onsuccess = () => resolve(addRequest.result);
        addRequest.onerror = () => reject(addRequest.error);
      });
      
      // Register for background sync
      await self.registration.sync.register('sync-messages');
      
      // Notify client
      const clients = await self.clients.matchAll();
      clients.forEach(client => {
        client.postMessage({
          type: 'MESSAGE_QUEUED',
          status: 'pending'
        });
      });
      
      // Return a synthetic response
      return new Response(JSON.stringify({
        success: true,
        queued: true,
        message: 'Message en attente de connexion'
      }), {
        status: 202,
        headers: { 'Content-Type': 'application/json' }
      });
      
    } catch (queueError) {
      console.error('[SW] Failed to queue message:', queueError);
      return new Response(JSON.stringify({
        success: false,
        error: 'Impossible d\'envoyer le message hors ligne'
      }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
}

/**
 * Main fetch handler
 */
async function handleFetch(event) {
  const { request } = event;
  const url = new URL(request.url);

  try {
    // API calls - Network first with cache fallback
    if (url.pathname.startsWith('/api/') || url.pathname.startsWith(API_BASE) || url.hostname.includes(SUPABASE_URL)) {
      return await networkFirst(request, API_CACHE, 5000);
    }

    // Google Fonts CSS - Stale while revalidate
    if (url.hostname === 'fonts.googleapis.com') {
      return await staleWhileRevalidate(request, FONT_CACHE);
    }

    // Google Fonts files - Cache first
    if (url.hostname === 'fonts.gstatic.com') {
      return await cacheFirst(request, FONT_CACHE);
    }

    // Images - Cache first with size limit
    if (request.destination === 'image' || /\.(png|jpg|jpeg|gif|webp|svg|ico)$/i.test(url.pathname)) {
      return await cacheFirst(request, IMAGE_CACHE, MAX_IMAGE_CACHE);
    }

    // HTML pages - Network first with Navigation Preload
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

    return await fetch(request);

  } catch (error) {
    console.error('[SW] Fetch error:', error);
    
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
 * Handle navigation with Navigation Preload
 */
async function handleNavigationRequest(event) {
  const { request } = event;
  
  try {
    const preloadResponse = event.preloadResponse ? await event.preloadResponse : null;
    
    if (preloadResponse) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, preloadResponse.clone());
      return preloadResponse;
    }
    
    return await networkFirst(request, DYNAMIC_CACHE, 5000);
    
  } catch (error) {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) return cachedResponse;
    
    const offlinePage = await caches.match('/offline.html');
    if (offlinePage) return offlinePage;
    
    throw error;
  }
}

/**
 * Cache-first strategy
 */
async function cacheFirst(request, cacheName, maxItems = null) {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) return cachedResponse;
  
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
      if (maxItems) trimCache(cacheName, maxItems);
    }
    return networkResponse;
  } catch (error) {
    if (request.headers.get('accept')?.includes('text/html')) {
      return caches.match('/offline.html');
    }
    throw error;
  }
}

/**
 * Network-first strategy with timeout
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
    
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      console.log('[SW] Serving from cache:', request.url);
      return cachedResponse;
    }
    
    if (request.headers.get('accept')?.includes('text/html')) {
      return caches.match('/offline.html');
    }
    
    throw error;
  }
}

/**
 * Stale-while-revalidate strategy
 */
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);
  
  const fetchPromise = fetch(request)
    .then(response => {
      if (response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => null);
  
  if (cachedResponse) return cachedResponse;
  return fetchPromise;
}

/**
 * Trim cache to max size
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
  
  if (event.tag === 'sync-messages') {
    event.waitUntil(syncPendingMessages());
  }
  
  if (event.tag === 'sync-pings') {
    event.waitUntil(syncPendingMessages());
  }
  
  if (event.tag === 'sync-actions') {
    event.waitUntil(syncPendingActions());
  }
});

/**
 * Sync pending messages from IndexedDB
 */
async function syncPendingMessages() {
  console.log('[SW] Starting message sync...');
  
  const clients = await self.clients.matchAll();
  const results = { sent: 0, failed: 0 };
  
  // Notify clients sync is starting
  clients.forEach(client => {
    client.postMessage({
      type: 'SYNC_STATUS',
      status: 'syncing',
      queue: 'messages'
    });
  });
  
  try {
    const messages = await getPendingMessages();
    console.log(`[SW] Found ${messages.length} pending messages`);
    
    if (messages.length === 0) {
      clients.forEach(client => {
        client.postMessage({
          type: 'SYNC_STATUS',
          status: 'complete',
          queue: 'messages',
          results: { sent: 0, failed: 0 }
        });
      });
      return;
    }
    
    // Get auth token from a client
    let authToken = null;
    for (const client of clients) {
      try {
        const messageChannel = new MessageChannel();
        client.postMessage({ type: 'GET_AUTH_TOKEN' }, [messageChannel.port2]);
        
        authToken = await new Promise((resolve) => {
          messageChannel.port1.onmessage = (event) => {
            resolve(event.data?.token);
          };
          setTimeout(() => resolve(null), 2000);
        });
        
        if (authToken) break;
      } catch (e) {
        console.warn('[SW] Failed to get auth token from client');
      }
    }
    
    if (!authToken) {
      console.warn('[SW] No auth token available, sync postponed');
      return;
    }
    
    // Send each message
    for (const msg of messages) {
      try {
        await updateMessageStatus(msg.id, 'sending');
        
        const response = await fetch(`${API_BASE}/messages`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            contact_id: msg.contact_id,
            content: msg.content,
            is_ping: msg.is_ping
          })
        });
        
        const result = await response.json();
        
        if (result.success) {
          await removeMessage(msg.id);
          results.sent++;
          
          // Notify clients of successful send
          clients.forEach(client => {
            client.postMessage({
              type: 'MESSAGE_SENT',
              localId: msg.id,
              serverMessage: result.message
            });
          });
        } else {
          throw new Error(result.error || 'Failed to send');
        }
        
      } catch (err) {
        console.error('[SW] Failed to send message:', msg.id, err);
        await updateMessageStatus(msg.id, 'pending', {
          retries: (msg.retries || 0) + 1,
          last_error: err.message
        });
        results.failed++;
      }
    }
    
  } catch (error) {
    console.error('[SW] Sync failed:', error);
    results.failed++;
  }
  
  // Notify clients sync completed
  clients.forEach(client => {
    client.postMessage({
      type: 'SYNC_STATUS',
      status: 'complete',
      queue: 'messages',
      results
    });
  });
  
  console.log('[SW] Message sync complete:', results);
}

/**
 * Sync pending actions
 */
async function syncPendingActions() {
  console.log('[SW] Syncing pending actions...');
  
  // Similar logic for generic actions
  const clients = await self.clients.matchAll();
  clients.forEach(client => {
    client.postMessage({
      type: 'SYNC_STATUS',
      status: 'complete',
      queue: 'actions'
    });
  });
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

  // Update app badge
  if ('setAppBadge' in navigator && data.badgeCount) {
    navigator.setAppBadge(data.badgeCount).catch(() => {});
  }

  event.waitUntil(
    self.registration.showNotification(data.title || 'Cinq 💫', options)
  );
});

// ============================================================================
// NOTIFICATION HANDLERS
// ============================================================================

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if ('clearAppBadge' in navigator) {
    navigator.clearAppBadge().catch(() => {});
  }

  if (event.action === 'dismiss') return;

  const targetUrl = event.notification.data?.url || '/app.html';

  event.waitUntil(
    (async () => {
      const clientList = await clients.matchAll({ 
        type: 'window', 
        includeUncontrolled: true 
      });
      
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
    })()
  );
});

self.addEventListener('notificationclose', (event) => {
  console.log('[SW] Notification dismissed:', event.notification.tag);
});

self.addEventListener('pushsubscriptionchange', (event) => {
  console.log('[SW] Push subscription changed');
  
  event.waitUntil(
    (async () => {
      try {
        const subscription = await self.registration.pushManager.subscribe(
          event.oldSubscription?.options || { userVisibleOnly: true }
        );
        
        await fetch('/api/push-subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subscription, action: 'update' })
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
      
    case 'SYNC_NOW':
      // Manual sync trigger
      (async () => {
        await syncPendingMessages();
        event.ports[0]?.postMessage({ success: true });
      })();
      break;
      
    case 'GET_PENDING_COUNT':
      (async () => {
        const messages = await getPendingMessages();
        event.ports[0]?.postMessage({ count: messages.length });
      })();
      break;
  }
});

// ============================================================================
// PERIODIC BACKGROUND SYNC
// ============================================================================

self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'content-sync') {
    event.waitUntil(periodicContentSync());
  }
  
  if (event.tag === 'message-sync') {
    event.waitUntil(syncPendingMessages());
  }
});

async function periodicContentSync() {
  console.log('[SW] Periodic content sync');
  
  try {
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
