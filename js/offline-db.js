/**
 * ==========================================================================
 * CINQ - IndexedDB Offline Database Module
 * ==========================================================================
 * 
 * Provides offline-first data persistence with sync capabilities:
 * - Messages queue for offline sending
 * - Contacts cache
 * - Pending actions queue
 * - Background sync integration
 * 
 * @author Cinq Team
 * @version 1.0.0
 */

'use strict';

/**
 * CinqOfflineDB - Offline Database Module
 */
const CinqOfflineDB = (function() {
  
  // ============================================
  // Configuration
  // ============================================
  
  const DB_NAME = 'cinq-offline-db';
  const DB_VERSION = 1;
  
  const STORES = {
    MESSAGES: 'pending-messages',
    CONTACTS: 'contacts-cache',
    ACTIONS: 'pending-actions',
    SYNC_META: 'sync-metadata'
  };
  
  // ============================================
  // State
  // ============================================
  
  /** @type {IDBDatabase|null} */
  let db = null;
  
  /** @type {boolean} */
  let isInitialized = false;
  
  // ============================================
  // Database Initialization
  // ============================================
  
  /**
   * Initialize the IndexedDB database
   * @returns {Promise<IDBDatabase>}
   */
  async function init() {
    if (isInitialized && db) return db;
    
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      
      request.onerror = () => {
        console.error('[OfflineDB] Failed to open database:', request.error);
        reject(request.error);
      };
      
      request.onsuccess = () => {
        db = request.result;
        isInitialized = true;
        console.log('[OfflineDB] Database initialized');
        
        // Handle connection errors
        db.onerror = (event) => {
          console.error('[OfflineDB] Database error:', event.target.error);
        };
        
        // Handle version change (another tab upgraded)
        db.onversionchange = () => {
          db.close();
          isInitialized = false;
          console.log('[OfflineDB] Database version changed, please reload');
        };
        
        resolve(db);
      };
      
      request.onupgradeneeded = (event) => {
        const database = event.target.result;
        console.log('[OfflineDB] Upgrading database schema...');
        
        // Pending Messages Store
        if (!database.objectStoreNames.contains(STORES.MESSAGES)) {
          const messagesStore = database.createObjectStore(STORES.MESSAGES, {
            keyPath: 'id',
            autoIncrement: true
          });
          messagesStore.createIndex('contact_id', 'contact_id', { unique: false });
          messagesStore.createIndex('created_at', 'created_at', { unique: false });
          messagesStore.createIndex('status', 'status', { unique: false });
        }
        
        // Contacts Cache Store
        if (!database.objectStoreNames.contains(STORES.CONTACTS)) {
          const contactsStore = database.createObjectStore(STORES.CONTACTS, {
            keyPath: 'id'
          });
          contactsStore.createIndex('email', 'email', { unique: true });
          contactsStore.createIndex('cached_at', 'cached_at', { unique: false });
        }
        
        // Pending Actions Store (for any offline action)
        if (!database.objectStoreNames.contains(STORES.ACTIONS)) {
          const actionsStore = database.createObjectStore(STORES.ACTIONS, {
            keyPath: 'id',
            autoIncrement: true
          });
          actionsStore.createIndex('type', 'type', { unique: false });
          actionsStore.createIndex('created_at', 'created_at', { unique: false });
          actionsStore.createIndex('priority', 'priority', { unique: false });
        }
        
        // Sync Metadata Store
        if (!database.objectStoreNames.contains(STORES.SYNC_META)) {
          database.createObjectStore(STORES.SYNC_META, {
            keyPath: 'key'
          });
        }
      };
    });
  }
  
  /**
   * Get a database transaction
   * @param {string|string[]} storeNames - Store name(s)
   * @param {IDBTransactionMode} mode - 'readonly' or 'readwrite'
   * @returns {IDBTransaction}
   */
  function getTransaction(storeNames, mode = 'readonly') {
    if (!db) throw new Error('Database not initialized');
    return db.transaction(storeNames, mode);
  }
  
  /**
   * Get an object store
   * @param {string} storeName - Store name
   * @param {IDBTransactionMode} mode - Transaction mode
   * @returns {IDBObjectStore}
   */
  function getStore(storeName, mode = 'readonly') {
    return getTransaction(storeName, mode).objectStore(storeName);
  }
  
  // ============================================
  // Message Queue Operations
  // ============================================
  
  /**
   * Queue a message for sending when online
   * @param {Object} message - Message data
   * @returns {Promise<number>} - Queued message ID
   */
  async function queueMessage(message) {
    await init();
    
    const messageData = {
      contact_id: message.contact_id,
      content: message.content || null,
      is_ping: message.is_ping || false,
      status: 'pending',
      created_at: new Date().toISOString(),
      retries: 0,
      last_error: null
    };
    
    return new Promise((resolve, reject) => {
      const store = getStore(STORES.MESSAGES, 'readwrite');
      const request = store.add(messageData);
      
      request.onsuccess = () => {
        const id = request.result;
        console.log('[OfflineDB] Message queued:', id);
        
        // Register for background sync
        registerSync('sync-messages');
        
        // Notify UI
        dispatchEvent('message-queued', { id, ...messageData });
        
        resolve(id);
      };
      
      request.onerror = () => reject(request.error);
    });
  }
  
  /**
   * Get all pending messages
   * @returns {Promise<Array>}
   */
  async function getPendingMessages() {
    await init();
    
    return new Promise((resolve, reject) => {
      const store = getStore(STORES.MESSAGES);
      const index = store.index('status');
      const request = index.getAll('pending');
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  
  /**
   * Get queued messages count
   * @returns {Promise<number>}
   */
  async function getQueuedCount() {
    await init();
    
    return new Promise((resolve, reject) => {
      const store = getStore(STORES.MESSAGES);
      const index = store.index('status');
      const request = index.count('pending');
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  
  /**
   * Update message status
   * @param {number} id - Message ID
   * @param {string} status - New status ('pending', 'sending', 'sent', 'failed')
   * @param {Object} [extra={}] - Extra fields to update
   * @returns {Promise<void>}
   */
  async function updateMessageStatus(id, status, extra = {}) {
    await init();
    
    return new Promise((resolve, reject) => {
      const store = getStore(STORES.MESSAGES, 'readwrite');
      const request = store.get(id);
      
      request.onsuccess = () => {
        const message = request.result;
        if (!message) {
          reject(new Error('Message not found'));
          return;
        }
        
        const updated = {
          ...message,
          ...extra,
          status,
          updated_at: new Date().toISOString()
        };
        
        const updateRequest = store.put(updated);
        updateRequest.onsuccess = () => {
          dispatchEvent('message-status-changed', { id, status });
          resolve();
        };
        updateRequest.onerror = () => reject(updateRequest.error);
      };
      
      request.onerror = () => reject(request.error);
    });
  }
  
  /**
   * Remove a sent message from queue
   * @param {number} id - Message ID
   * @returns {Promise<void>}
   */
  async function removeSentMessage(id) {
    await init();
    
    return new Promise((resolve, reject) => {
      const store = getStore(STORES.MESSAGES, 'readwrite');
      const request = store.delete(id);
      
      request.onsuccess = () => {
        dispatchEvent('message-removed', { id });
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }
  
  /**
   * Clear all sent messages
   * @returns {Promise<void>}
   */
  async function clearSentMessages() {
    await init();
    
    return new Promise((resolve, reject) => {
      const store = getStore(STORES.MESSAGES, 'readwrite');
      const index = store.index('status');
      const request = index.openCursor('sent');
      
      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        } else {
          resolve();
        }
      };
      
      request.onerror = () => reject(request.error);
    });
  }
  
  // ============================================
  // Contacts Cache Operations
  // ============================================
  
  /**
   * Cache contacts list
   * @param {Array} contacts - Contacts to cache
   * @returns {Promise<void>}
   */
  async function cacheContacts(contacts) {
    await init();
    
    const now = new Date().toISOString();
    
    return new Promise((resolve, reject) => {
      const tx = getTransaction(STORES.CONTACTS, 'readwrite');
      const store = tx.objectStore(STORES.CONTACTS);
      
      // Clear existing and add new
      store.clear();
      
      contacts.forEach(contact => {
        store.add({
          ...contact,
          cached_at: now
        });
      });
      
      tx.oncomplete = () => {
        console.log('[OfflineDB] Contacts cached:', contacts.length);
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    });
  }
  
  /**
   * Get cached contacts
   * @returns {Promise<Array>}
   */
  async function getCachedContacts() {
    await init();
    
    return new Promise((resolve, reject) => {
      const store = getStore(STORES.CONTACTS);
      const request = store.getAll();
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  
  // ============================================
  // Pending Actions Queue
  // ============================================
  
  /**
   * Queue a generic action for background sync
   * @param {Object} action - Action data
   * @returns {Promise<number>}
   */
  async function queueAction(action) {
    await init();
    
    const actionData = {
      type: action.type,
      endpoint: action.endpoint,
      method: action.method || 'POST',
      body: action.body || null,
      priority: action.priority || 5, // 1 = highest, 10 = lowest
      created_at: new Date().toISOString(),
      status: 'pending',
      retries: 0
    };
    
    return new Promise((resolve, reject) => {
      const store = getStore(STORES.ACTIONS, 'readwrite');
      const request = store.add(actionData);
      
      request.onsuccess = () => {
        const id = request.result;
        registerSync('sync-actions');
        dispatchEvent('action-queued', { id, type: action.type });
        resolve(id);
      };
      
      request.onerror = () => reject(request.error);
    });
  }
  
  /**
   * Get pending actions sorted by priority
   * @returns {Promise<Array>}
   */
  async function getPendingActions() {
    await init();
    
    return new Promise((resolve, reject) => {
      const store = getStore(STORES.ACTIONS);
      const index = store.index('status');
      const request = index.getAll('pending');
      
      request.onsuccess = () => {
        const actions = request.result.sort((a, b) => a.priority - b.priority);
        resolve(actions);
      };
      request.onerror = () => reject(request.error);
    });
  }
  
  /**
   * Remove a completed action
   * @param {number} id - Action ID
   * @returns {Promise<void>}
   */
  async function removeAction(id) {
    await init();
    
    return new Promise((resolve, reject) => {
      const store = getStore(STORES.ACTIONS, 'readwrite');
      const request = store.delete(id);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
  
  // ============================================
  // Sync Metadata
  // ============================================
  
  /**
   * Set sync metadata
   * @param {string} key - Metadata key
   * @param {*} value - Metadata value
   * @returns {Promise<void>}
   */
  async function setSyncMeta(key, value) {
    await init();
    
    return new Promise((resolve, reject) => {
      const store = getStore(STORES.SYNC_META, 'readwrite');
      const request = store.put({ key, value, updated_at: new Date().toISOString() });
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
  
  /**
   * Get sync metadata
   * @param {string} key - Metadata key
   * @returns {Promise<*>}
   */
  async function getSyncMeta(key) {
    await init();
    
    return new Promise((resolve, reject) => {
      const store = getStore(STORES.SYNC_META);
      const request = store.get(key);
      
      request.onsuccess = () => resolve(request.result?.value);
      request.onerror = () => reject(request.error);
    });
  }
  
  // ============================================
  // Background Sync Registration
  // ============================================
  
  /**
   * Register for background sync
   * @param {string} tag - Sync tag
   * @returns {Promise<void>}
   */
  async function registerSync(tag) {
    if (!('serviceWorker' in navigator) || !('sync' in window.SyncManager?.prototype || {})) {
      console.log('[OfflineDB] Background sync not supported');
      return;
    }
    
    try {
      const registration = await navigator.serviceWorker.ready;
      await registration.sync.register(tag);
      console.log('[OfflineDB] Sync registered:', tag);
    } catch (err) {
      console.warn('[OfflineDB] Sync registration failed:', err);
    }
  }
  
  // ============================================
  // Event Dispatching
  // ============================================
  
  /**
   * Dispatch a custom event
   * @param {string} name - Event name
   * @param {Object} detail - Event detail
   */
  function dispatchEvent(name, detail) {
    window.dispatchEvent(new CustomEvent(`cinq-offline:${name}`, { detail }));
  }
  
  // ============================================
  // Sync Handler (called from Service Worker)
  // ============================================
  
  /**
   * Process message sync queue
   * @returns {Promise<{sent: number, failed: number}>}
   */
  async function syncMessages() {
    const messages = await getPendingMessages();
    const results = { sent: 0, failed: 0 };
    
    if (messages.length === 0) {
      console.log('[OfflineDB] No messages to sync');
      return results;
    }
    
    console.log(`[OfflineDB] Syncing ${messages.length} messages...`);
    
    for (const msg of messages) {
      try {
        await updateMessageStatus(msg.id, 'sending');
        
        const token = await window.Cinq?.getAccessToken();
        if (!token) {
          throw new Error('No auth token');
        }
        
        const response = await fetch('/.netlify/functions/messages', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
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
          await removeSentMessage(msg.id);
          results.sent++;
          dispatchEvent('message-sent', { id: msg.id, serverMessage: result.message });
        } else {
          throw new Error(result.error || 'Failed to send');
        }
        
      } catch (err) {
        console.error('[OfflineDB] Failed to send message:', msg.id, err);
        await updateMessageStatus(msg.id, 'pending', {
          retries: msg.retries + 1,
          last_error: err.message
        });
        results.failed++;
      }
    }
    
    console.log('[OfflineDB] Sync complete:', results);
    dispatchEvent('sync-complete', { type: 'messages', results });
    
    return results;
  }
  
  /**
   * Process actions sync queue
   * @returns {Promise<{success: number, failed: number}>}
   */
  async function syncActions() {
    const actions = await getPendingActions();
    const results = { success: 0, failed: 0 };
    
    if (actions.length === 0) return results;
    
    console.log(`[OfflineDB] Syncing ${actions.length} actions...`);
    
    for (const action of actions) {
      try {
        const token = await window.Cinq?.getAccessToken();
        const headers = {
          'Content-Type': 'application/json'
        };
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
        
        const response = await fetch(action.endpoint, {
          method: action.method,
          headers,
          body: action.body ? JSON.stringify(action.body) : null
        });
        
        if (response.ok) {
          await removeAction(action.id);
          results.success++;
        } else {
          throw new Error(`HTTP ${response.status}`);
        }
        
      } catch (err) {
        console.error('[OfflineDB] Action failed:', action.id, err);
        results.failed++;
      }
    }
    
    return results;
  }
  
  // ============================================
  // Status Indicator
  // ============================================
  
  /**
   * Get current offline queue status
   * @returns {Promise<Object>}
   */
  async function getStatus() {
    await init();
    
    const [messages, actions, lastSync] = await Promise.all([
      getQueuedCount(),
      getPendingActions().then(a => a.length),
      getSyncMeta('lastSuccessfulSync')
    ]);
    
    return {
      pendingMessages: messages,
      pendingActions: actions,
      lastSync,
      isOnline: navigator.onLine
    };
  }
  
  // ============================================
  // UI Integration Helpers
  // ============================================
  
  /**
   * Show pending queue indicator
   */
  function showQueueIndicator() {
    let indicator = document.getElementById('offline-queue-indicator');
    
    if (!indicator) {
      indicator = document.createElement('div');
      indicator.id = 'offline-queue-indicator';
      indicator.className = 'offline-queue-indicator';
      indicator.innerHTML = `
        <span class="offline-queue-icon">📤</span>
        <span class="offline-queue-count">0</span>
        <span class="offline-queue-text">en attente</span>
      `;
      document.body.appendChild(indicator);
      
      // Add styles
      const style = document.createElement('style');
      style.textContent = `
        .offline-queue-indicator {
          position: fixed;
          top: 16px;
          right: 16px;
          background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
          color: white;
          padding: 8px 12px;
          border-radius: 20px;
          font-size: 13px;
          font-weight: 500;
          display: flex;
          align-items: center;
          gap: 6px;
          z-index: 9999;
          box-shadow: 0 4px 12px rgba(0,0,0,0.3);
          animation: slideIn 0.3s ease-out;
          cursor: pointer;
        }
        .offline-queue-indicator.syncing {
          background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
        }
        .offline-queue-indicator.syncing .offline-queue-icon {
          animation: spin 1s linear infinite;
        }
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .offline-queue-indicator.hidden {
          display: none;
        }
      `;
      document.head.appendChild(style);
    }
    
    return indicator;
  }
  
  /**
   * Update queue indicator
   */
  async function updateQueueIndicator() {
    const status = await getStatus();
    const total = status.pendingMessages + status.pendingActions;
    
    if (total === 0) {
      const indicator = document.getElementById('offline-queue-indicator');
      if (indicator) {
        indicator.classList.add('hidden');
      }
      return;
    }
    
    const indicator = showQueueIndicator();
    indicator.classList.remove('hidden');
    indicator.querySelector('.offline-queue-count').textContent = total;
    indicator.querySelector('.offline-queue-text').textContent = 
      total === 1 ? 'en attente' : 'en attente';
  }
  
  // ============================================
  // Initialization & Event Listeners
  // ============================================
  
  // Listen for online/offline events
  window.addEventListener('online', async () => {
    console.log('[OfflineDB] Back online, triggering sync...');
    await syncMessages();
    await syncActions();
    await updateQueueIndicator();
  });
  
  window.addEventListener('offline', () => {
    console.log('[OfflineDB] Gone offline');
    updateQueueIndicator();
  });
  
  // Listen for service worker messages
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', async (event) => {
      const { type } = event.data || {};
      
      if (type === 'SYNC_MESSAGES') {
        const results = await syncMessages();
        event.ports?.[0]?.postMessage({ results });
      }
      
      if (type === 'SYNC_ACTIONS') {
        const results = await syncActions();
        event.ports?.[0]?.postMessage({ results });
      }
      
      if (type === 'SYNC_STATUS') {
        await updateQueueIndicator();
      }
    });
  }
  
  // ============================================
  // Public API
  // ============================================
  
  return {
    // Initialization
    init,
    
    // Messages
    queueMessage,
    getPendingMessages,
    getQueuedCount,
    updateMessageStatus,
    removeSentMessage,
    clearSentMessages,
    
    // Contacts
    cacheContacts,
    getCachedContacts,
    
    // Actions
    queueAction,
    getPendingActions,
    removeAction,
    
    // Metadata
    setSyncMeta,
    getSyncMeta,
    
    // Sync
    syncMessages,
    syncActions,
    registerSync,
    
    // Status
    getStatus,
    updateQueueIndicator,
    
    // Constants
    STORES
  };
  
})();

// Export to global scope
window.CinqOfflineDB = CinqOfflineDB;
