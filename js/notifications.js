/**
 * ==========================================================================
 * CINQ - Notification System
 * ==========================================================================
 * 
 * Handles all notification types:
 * - Push notifications (Web Push API)
 * - In-app notifications (badge, sound, notification center)
 * - Polling with visibility-aware backoff
 * - App badge (Badging API)
 * 
 * @author Cinq Team
 * @version 1.0.0
 */

'use strict';

window.CinqNotifications = (function() {
  
  // ============================================
  // Configuration
  // ============================================
  
  const CONFIG = {
    // VAPID public key for push notifications
    // Will be loaded from window.CINQ_VAPID_PUBLIC_KEY or meta tag
    VAPID_PUBLIC_KEY: null,
    
    // Polling intervals (ms)
    POLL_INTERVAL_FOREGROUND: 30000,   // 30 seconds when visible
    POLL_INTERVAL_BACKGROUND: 120000,  // 2 minutes when hidden
    POLL_INTERVAL_IDLE: 300000,        // 5 minutes when idle
    
    // Backoff settings
    MAX_BACKOFF_MULTIPLIER: 4,
    BACKOFF_RESET_AFTER: 60000,        // Reset backoff after 1 min of success
    
    // Notification sounds (optional, set path or null to disable)
    // Files should exist in /assets/sounds/
    SOUND_MESSAGE: null, // '/assets/sounds/message.mp3'
    SOUND_PING: null,    // '/assets/sounds/ping.mp3'
    
    // Storage keys
    STORAGE_KEY_SETTINGS: 'cinq_notification_settings',
    STORAGE_KEY_UNREAD: 'cinq_unread_count',
    STORAGE_KEY_LAST_CHECK: 'cinq_last_notification_check'
  };
  
  // ============================================
  // State
  // ============================================
  
  let isInitialized = false;
  let pollInterval = null;
  let currentBackoffMultiplier = 1;
  let lastSuccessfulPoll = Date.now();
  let unreadCount = 0;
  let notificationSettings = {
    push: true,
    sound: true,
    inApp: true,
    badge: true
  };
  
  // Notification center state
  let notificationCenterOpen = false;
  let notifications = [];
  
  // Audio elements for notification sounds
  let audioMessage = null;
  let audioPing = null;
  
  // ============================================
  // Initialization
  // ============================================
  
  /**
   * Initialize the notification system
   * @param {Object} options - Configuration options
   * @param {string} options.vapidPublicKey - VAPID public key
   * @param {boolean} options.enableSounds - Enable notification sounds
   * @returns {Promise<void>}
   */
  async function init(options = {}) {
    if (isInitialized) return;
    
    // Load VAPID key from multiple sources
    CONFIG.VAPID_PUBLIC_KEY = options.vapidPublicKey 
      || window.CINQ_VAPID_PUBLIC_KEY
      || document.querySelector('meta[name="vapid-public-key"]')?.content
      || null;
    
    // Enable sounds if files exist
    if (options.enableSounds) {
      CONFIG.SOUND_MESSAGE = '/assets/sounds/message.mp3';
      CONFIG.SOUND_PING = '/assets/sounds/ping.mp3';
    }
    
    // Load saved settings
    loadSettings();
    
    // Load unread count
    loadUnreadCount();
    
    // Preload audio if sounds enabled
    if (notificationSettings.sound) {
      preloadSounds();
    }
    
    // Start polling
    startPolling();
    
    // Listen for visibility changes
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Listen for messages from service worker
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.addEventListener('message', handleServiceWorkerMessage);
    }
    
    // Create notification center UI
    createNotificationCenter();
    
    // Update badge on init
    updateBadge();
    
    isInitialized = true;
    console.log('[Notifications] Initialized');
  }
  
  // ============================================
  // Push Notification Subscription
  // ============================================
  
  /**
   * Check if push notifications are supported
   * @returns {boolean}
   */
  function isPushSupported() {
    return 'serviceWorker' in navigator && 
           'PushManager' in window && 
           'Notification' in window;
  }
  
  /**
   * Get current push permission status
   * @returns {string} - 'granted', 'denied', or 'default'
   */
  function getPushPermission() {
    return Notification.permission;
  }
  
  /**
   * Request push notification permission and subscribe
   * @returns {Promise<{success: boolean, message: string}>}
   */
  async function subscribeToPush() {
    if (!isPushSupported()) {
      return { success: false, message: 'Push notifications non supportées' };
    }
    
    try {
      // Request permission
      const permission = await Notification.requestPermission();
      
      if (permission !== 'granted') {
        return { 
          success: false, 
          message: permission === 'denied' 
            ? 'Notifications bloquées. Active-les dans les paramètres du navigateur.'
            : 'Permission refusée'
        };
      }
      
      // Get service worker registration
      const registration = await navigator.serviceWorker.ready;
      
      // Check existing subscription
      let subscription = await registration.pushManager.getSubscription();
      
      // If no subscription or key mismatch, create new one
      if (!subscription) {
        const convertedKey = urlBase64ToUint8Array(CONFIG.VAPID_PUBLIC_KEY);
        
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: convertedKey
        });
        
        console.log('[Push] New subscription created');
      }
      
      // Send subscription to server
      const token = await window.Cinq.getAccessToken();
      if (!token) {
        return { success: false, message: 'Non connecté' };
      }
      
      const response = await fetch('/api/push-subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ subscription: subscription.toJSON() })
      });
      
      const result = await response.json();
      
      if (result.success) {
        notificationSettings.push = true;
        saveSettings();
        return { success: true, message: 'Notifications activées !' };
      } else {
        return { success: false, message: result.error || 'Erreur serveur' };
      }
      
    } catch (error) {
      console.error('[Push] Subscribe error:', error);
      return { 
        success: false, 
        message: 'Erreur lors de l\'activation des notifications'
      };
    }
  }
  
  /**
   * Unsubscribe from push notifications
   * @returns {Promise<{success: boolean, message: string}>}
   */
  async function unsubscribeFromPush() {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      
      if (subscription) {
        // Notify server
        const token = await window.Cinq.getAccessToken();
        if (token) {
          await fetch('/api/push-subscribe', {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ endpoint: subscription.endpoint })
          });
        }
        
        // Unsubscribe locally
        await subscription.unsubscribe();
      }
      
      notificationSettings.push = false;
      saveSettings();
      
      return { success: true, message: 'Notifications désactivées' };
      
    } catch (error) {
      console.error('[Push] Unsubscribe error:', error);
      return { success: false, message: 'Erreur lors de la désactivation' };
    }
  }
  
  /**
   * Check if currently subscribed to push
   * @returns {Promise<boolean>}
   */
  async function isSubscribedToPush() {
    if (!isPushSupported()) return false;
    
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      return subscription !== null;
    } catch {
      return false;
    }
  }
  
  // ============================================
  // In-App Notifications
  // ============================================
  
  /**
   * Show an in-app notification
   * @param {Object} notification
   * @param {string} notification.title - Notification title
   * @param {string} notification.body - Notification body
   * @param {string} notification.type - 'message', 'ping', 'info'
   * @param {string} [notification.url] - URL to navigate to on click
   * @param {string} [notification.avatar] - Avatar URL or initial
   */
  function showInAppNotification(notification) {
    if (!notificationSettings.inApp) return;
    
    // Add to notifications array
    const notif = {
      id: Date.now().toString(),
      ...notification,
      timestamp: new Date().toISOString(),
      read: false
    };
    
    notifications.unshift(notif);
    
    // Keep only last 50
    if (notifications.length > 50) {
      notifications = notifications.slice(0, 50);
    }
    
    // Update unread count
    incrementUnread();
    
    // Play sound if enabled
    if (notificationSettings.sound) {
      playSound(notification.type);
    }
    
    // Show toast
    showNotificationToast(notif);
    
    // Update notification center if open
    if (notificationCenterOpen) {
      renderNotificationCenter();
    }
  }
  
  /**
   * Show a toast notification
   * @param {Object} notif - Notification object
   */
  function showNotificationToast(notif) {
    // Remove existing toast
    const existing = document.getElementById('cinq-notification-toast');
    if (existing) existing.remove();
    
    // Create toast
    const toast = document.createElement('div');
    toast.id = 'cinq-notification-toast';
    toast.className = 'notification-toast';
    toast.setAttribute('role', 'alert');
    
    const icon = notif.type === 'ping' ? '💫' : '💬';
    const avatarHtml = notif.avatar 
      ? `<div class="notification-toast-avatar">${notif.avatar.length === 1 ? notif.avatar : ''}</div>`
      : `<div class="notification-toast-icon">${icon}</div>`;
    
    toast.innerHTML = `
      ${avatarHtml}
      <div class="notification-toast-content">
        <p class="notification-toast-title">${escapeHtml(notif.title)}</p>
        <p class="notification-toast-body">${escapeHtml(notif.body)}</p>
      </div>
      <button class="notification-toast-close" aria-label="Fermer">&times;</button>
    `;
    
    document.body.appendChild(toast);
    
    // Add styles if not present
    injectToastStyles();
    
    // Animate in
    requestAnimationFrame(() => {
      toast.classList.add('visible');
    });
    
    // Click handler
    toast.addEventListener('click', (e) => {
      if (e.target.closest('.notification-toast-close')) {
        hideToast(toast);
        return;
      }
      
      if (notif.url) {
        window.location.href = notif.url;
      }
      hideToast(toast);
    });
    
    // Auto-hide after 5 seconds
    setTimeout(() => hideToast(toast), 5000);
  }
  
  /**
   * Hide and remove toast
   * @param {HTMLElement} toast
   */
  function hideToast(toast) {
    toast.classList.remove('visible');
    toast.classList.add('hiding');
    setTimeout(() => toast.remove(), 300);
  }
  
  // ============================================
  // Badge Management
  // ============================================
  
  /**
   * Update the app badge with unread count
   */
  function updateBadge() {
    if (!notificationSettings.badge) return;
    
    // Update PWA badge if supported
    if ('setAppBadge' in navigator) {
      if (unreadCount > 0) {
        navigator.setAppBadge(unreadCount).catch(() => {});
      } else {
        navigator.clearAppBadge().catch(() => {});
      }
    }
    
    // Update favicon badge (for browser tabs)
    updateFaviconBadge(unreadCount);
    
    // Update in-app badge indicator
    const badgeEl = document.getElementById('notification-badge');
    if (badgeEl) {
      if (unreadCount > 0) {
        badgeEl.textContent = unreadCount > 99 ? '99+' : unreadCount;
        badgeEl.classList.remove('hidden');
      } else {
        badgeEl.classList.add('hidden');
      }
    }
    
    // Update title
    updateDocumentTitle();
  }
  
  /**
   * Update favicon with badge count
   * @param {number} count
   */
  function updateFaviconBadge(count) {
    const favicon = document.querySelector('link[rel="icon"]');
    if (!favicon) return;
    
    if (count === 0) {
      // Restore original favicon
      favicon.href = '/favicon.svg';
      return;
    }
    
    // Create badge canvas
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');
    
    // Load original favicon
    const img = new Image();
    img.onload = () => {
      // Draw original icon
      ctx.drawImage(img, 0, 0, 32, 32);
      
      // Draw badge circle
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(24, 8, 8, 0, 2 * Math.PI);
      ctx.fill();
      
      // Draw count
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const text = count > 9 ? '9+' : count.toString();
      ctx.fillText(text, 24, 8);
      
      // Update favicon
      favicon.href = canvas.toDataURL('image/png');
    };
    img.src = '/favicon.svg';
  }
  
  /**
   * Update document title with unread count
   */
  function updateDocumentTitle() {
    const baseTitle = 'Cinq';
    if (unreadCount > 0) {
      document.title = `(${unreadCount}) ${baseTitle}`;
    } else {
      document.title = baseTitle;
    }
  }
  
  /**
   * Increment unread count
   * @param {number} amount - Amount to add (default 1)
   */
  function incrementUnread(amount = 1) {
    unreadCount += amount;
    saveUnreadCount();
    updateBadge();
  }
  
  /**
   * Clear unread count
   */
  function clearUnread() {
    unreadCount = 0;
    saveUnreadCount();
    updateBadge();
  }
  
  /**
   * Set specific unread count
   * @param {number} count
   */
  function setUnreadCount(count) {
    unreadCount = Math.max(0, count);
    saveUnreadCount();
    updateBadge();
  }
  
  // ============================================
  // Notification Center UI
  // ============================================
  
  /**
   * Create notification center container
   */
  function createNotificationCenter() {
    if (document.getElementById('notification-center')) return;
    
    const center = document.createElement('div');
    center.id = 'notification-center';
    center.className = 'notification-center hidden';
    center.setAttribute('role', 'dialog');
    center.setAttribute('aria-label', 'Centre de notifications');
    
    center.innerHTML = `
      <div class="notification-center-header">
        <h2>Notifications</h2>
        <button id="notification-center-close" aria-label="Fermer">&times;</button>
      </div>
      <div id="notification-center-list" class="notification-center-list">
        <!-- Notifications will be rendered here -->
      </div>
      <div class="notification-center-footer">
        <button id="notification-center-clear">Tout marquer comme lu</button>
      </div>
    `;
    
    document.body.appendChild(center);
    injectNotificationCenterStyles();
    
    // Event listeners
    document.getElementById('notification-center-close').addEventListener('click', closeNotificationCenter);
    document.getElementById('notification-center-clear').addEventListener('click', markAllAsRead);
  }
  
  /**
   * Open notification center
   */
  function openNotificationCenter() {
    const center = document.getElementById('notification-center');
    if (!center) return;
    
    notificationCenterOpen = true;
    center.classList.remove('hidden');
    renderNotificationCenter();
    
    // Focus trap
    center.querySelector('button')?.focus();
  }
  
  /**
   * Close notification center
   */
  function closeNotificationCenter() {
    const center = document.getElementById('notification-center');
    if (!center) return;
    
    notificationCenterOpen = false;
    center.classList.add('hidden');
  }
  
  /**
   * Toggle notification center
   */
  function toggleNotificationCenter() {
    if (notificationCenterOpen) {
      closeNotificationCenter();
    } else {
      openNotificationCenter();
    }
  }
  
  /**
   * Render notification center content
   */
  function renderNotificationCenter() {
    const list = document.getElementById('notification-center-list');
    if (!list) return;
    
    if (notifications.length === 0) {
      list.innerHTML = `
        <div class="notification-center-empty">
          <span>🔔</span>
          <p>Pas de notifications</p>
        </div>
      `;
      return;
    }
    
    list.innerHTML = notifications.map(notif => `
      <div class="notification-item ${notif.read ? 'read' : 'unread'}" data-id="${notif.id}">
        <div class="notification-item-icon">${notif.type === 'ping' ? '💫' : '💬'}</div>
        <div class="notification-item-content">
          <p class="notification-item-title">${escapeHtml(notif.title)}</p>
          <p class="notification-item-body">${escapeHtml(notif.body)}</p>
          <p class="notification-item-time">${formatRelativeTime(notif.timestamp)}</p>
        </div>
      </div>
    `).join('');
    
    // Click handlers
    list.querySelectorAll('.notification-item').forEach(item => {
      item.addEventListener('click', () => {
        const id = item.dataset.id;
        markAsRead(id);
        
        const notif = notifications.find(n => n.id === id);
        if (notif?.url) {
          window.location.href = notif.url;
        }
      });
    });
  }
  
  /**
   * Mark a notification as read
   * @param {string} id
   */
  function markAsRead(id) {
    const notif = notifications.find(n => n.id === id);
    if (notif && !notif.read) {
      notif.read = true;
      unreadCount = Math.max(0, unreadCount - 1);
      saveUnreadCount();
      updateBadge();
      renderNotificationCenter();
    }
  }
  
  /**
   * Mark all notifications as read
   */
  function markAllAsRead() {
    notifications.forEach(n => n.read = true);
    clearUnread();
    renderNotificationCenter();
  }
  
  // ============================================
  // Polling with Backoff
  // ============================================
  
  /**
   * Start polling for new messages/notifications
   */
  function startPolling() {
    if (pollInterval) return;
    
    // Initial poll
    pollForUpdates();
    
    // Set up interval based on visibility
    updatePollInterval();
  }
  
  /**
   * Stop polling
   */
  function stopPolling() {
    if (pollInterval) {
      clearInterval(pollInterval);
      pollInterval = null;
    }
  }
  
  /**
   * Update polling interval based on visibility state
   */
  function updatePollInterval() {
    stopPolling();
    
    let interval;
    
    if (document.hidden) {
      interval = CONFIG.POLL_INTERVAL_BACKGROUND;
    } else if (isUserIdle()) {
      interval = CONFIG.POLL_INTERVAL_IDLE;
    } else {
      interval = CONFIG.POLL_INTERVAL_FOREGROUND;
    }
    
    // Apply backoff multiplier
    interval *= currentBackoffMultiplier;
    
    console.log(`[Notifications] Polling every ${interval / 1000}s (backoff: ${currentBackoffMultiplier}x)`);
    
    pollInterval = setInterval(pollForUpdates, interval);
  }
  
  /**
   * Check if user is idle (no interaction for a while)
   * @returns {boolean}
   */
  function isUserIdle() {
    const lastActivity = parseInt(localStorage.getItem('cinq_last_activity') || '0');
    const idleThreshold = 5 * 60 * 1000; // 5 minutes
    return (Date.now() - lastActivity) > idleThreshold;
  }
  
  /**
   * Poll for updates
   */
  async function pollForUpdates() {
    try {
      const token = await window.Cinq.getAccessToken();
      if (!token) return;
      
      const lastCheck = localStorage.getItem(CONFIG.STORAGE_KEY_LAST_CHECK) || '0';
      
      const response = await fetch(`/api/messages?since=${lastCheck}&count=true`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Poll failed');
      }
      
      const data = await response.json();
      
      // Success - reset backoff
      if (currentBackoffMultiplier > 1) {
        if (Date.now() - lastSuccessfulPoll > CONFIG.BACKOFF_RESET_AFTER) {
          currentBackoffMultiplier = 1;
          updatePollInterval();
        }
      }
      lastSuccessfulPoll = Date.now();
      
      // Update last check timestamp
      localStorage.setItem(CONFIG.STORAGE_KEY_LAST_CHECK, Date.now().toString());
      
      // Handle new messages
      if (data.newCount && data.newCount > 0) {
        setUnreadCount(data.newCount);
        
        // Show in-app notification for new messages
        if (data.latestMessage) {
          showInAppNotification({
            title: data.latestMessage.senderName || 'Nouveau message',
            body: data.latestMessage.isPing ? '💫 Ping !' : (data.latestMessage.content || ''),
            type: data.latestMessage.isPing ? 'ping' : 'message',
            url: '/app.html'
          });
        }
      }
      
    } catch (error) {
      console.warn('[Notifications] Poll error:', error.message);
      
      // Increase backoff on failure
      if (currentBackoffMultiplier < CONFIG.MAX_BACKOFF_MULTIPLIER) {
        currentBackoffMultiplier = Math.min(
          currentBackoffMultiplier * 2,
          CONFIG.MAX_BACKOFF_MULTIPLIER
        );
        updatePollInterval();
      }
    }
  }
  
  /**
   * Handle visibility change
   */
  function handleVisibilityChange() {
    updatePollInterval();
    
    // Poll immediately when becoming visible
    if (!document.hidden) {
      pollForUpdates();
      clearUnread(); // User is looking at the app
    }
  }
  
  // ============================================
  // Sound Management
  // ============================================
  
  /**
   * Preload notification sounds
   */
  function preloadSounds() {
    if (CONFIG.SOUND_MESSAGE) {
      audioMessage = new Audio(CONFIG.SOUND_MESSAGE);
      audioMessage.preload = 'auto';
      audioMessage.volume = 0.5;
    }
    
    if (CONFIG.SOUND_PING) {
      audioPing = new Audio(CONFIG.SOUND_PING);
      audioPing.preload = 'auto';
      audioPing.volume = 0.6;
    }
  }
  
  /**
   * Play notification sound
   * @param {string} type - 'message' or 'ping'
   */
  function playSound(type) {
    if (!notificationSettings.sound) return;
    
    try {
      const audio = type === 'ping' ? audioPing : audioMessage;
      if (audio) {
        audio.currentTime = 0;
        audio.play().catch(() => {
          // Autoplay blocked - ignore
        });
      }
    } catch (e) {
      console.warn('[Notifications] Sound playback failed:', e);
    }
  }
  
  // ============================================
  // Settings
  // ============================================
  
  /**
   * Get current notification settings
   * @returns {Object}
   */
  function getSettings() {
    return { ...notificationSettings };
  }
  
  /**
   * Update notification settings
   * @param {Object} settings - Settings to update
   */
  function updateSettings(settings) {
    notificationSettings = { ...notificationSettings, ...settings };
    saveSettings();
    
    // Apply changes
    if (settings.sound !== undefined && settings.sound) {
      preloadSounds();
    }
    
    updateBadge();
  }
  
  /**
   * Save settings to localStorage
   */
  function saveSettings() {
    localStorage.setItem(CONFIG.STORAGE_KEY_SETTINGS, JSON.stringify(notificationSettings));
  }
  
  /**
   * Load settings from localStorage
   */
  function loadSettings() {
    try {
      const saved = localStorage.getItem(CONFIG.STORAGE_KEY_SETTINGS);
      if (saved) {
        notificationSettings = { ...notificationSettings, ...JSON.parse(saved) };
      }
    } catch (e) {
      console.warn('[Notifications] Failed to load settings');
    }
  }
  
  /**
   * Save unread count to localStorage
   */
  function saveUnreadCount() {
    localStorage.setItem(CONFIG.STORAGE_KEY_UNREAD, unreadCount.toString());
  }
  
  /**
   * Load unread count from localStorage
   */
  function loadUnreadCount() {
    const saved = localStorage.getItem(CONFIG.STORAGE_KEY_UNREAD);
    if (saved) {
      unreadCount = parseInt(saved, 10) || 0;
    }
  }
  
  // ============================================
  // Service Worker Messages
  // ============================================
  
  /**
   * Handle messages from service worker
   * @param {MessageEvent} event
   */
  function handleServiceWorkerMessage(event) {
    const { type, data } = event.data || {};
    
    switch (type) {
      case 'NOTIFICATION_CLICKED':
        // Notification was clicked, navigate if needed
        if (data?.url) {
          window.location.href = data.url;
        }
        break;
        
      case 'NEW_MESSAGE':
        // New message received via push
        showInAppNotification({
          title: data.senderName || 'Nouveau message',
          body: data.isPing ? '💫 Ping !' : (data.content || ''),
          type: data.isPing ? 'ping' : 'message',
          url: '/app.html'
        });
        break;
    }
  }
  
  // ============================================
  // Utility Functions
  // ============================================
  
  /**
   * Convert URL-safe base64 to Uint8Array
   * @param {string} base64String
   * @returns {Uint8Array}
   */
  function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');
    
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }
  
  /**
   * Escape HTML to prevent XSS
   * @param {string} str
   * @returns {string}
   */
  function escapeHtml(str) {
    if (typeof str !== 'string') return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
  
  /**
   * Format relative time
   * @param {string|Date} date
   * @returns {string}
   */
  function formatRelativeTime(date) {
    const d = new Date(date);
    const now = new Date();
    const diffMs = now - d;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return "à l'instant";
    if (diffMins < 60) return `il y a ${diffMins}min`;
    if (diffHours < 24) return `il y a ${diffHours}h`;
    if (diffDays < 7) return `il y a ${diffDays}j`;
    
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  }
  
  // ============================================
  // Style Injection
  // ============================================
  
  /**
   * Inject toast notification styles
   */
  function injectToastStyles() {
    if (document.getElementById('notification-toast-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'notification-toast-styles';
    style.textContent = `
      .notification-toast {
        position: fixed;
        top: 20px;
        right: 20px;
        max-width: 360px;
        padding: 12px 16px;
        background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
        border: 1px solid rgba(99, 102, 241, 0.3);
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
        display: flex;
        align-items: flex-start;
        gap: 12px;
        z-index: 10001;
        cursor: pointer;
        transform: translateX(120%);
        transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        font-family: 'Inter', -apple-system, sans-serif;
      }
      
      .notification-toast.visible {
        transform: translateX(0);
      }
      
      .notification-toast.hiding {
        transform: translateX(120%);
      }
      
      .notification-toast-icon,
      .notification-toast-avatar {
        width: 40px;
        height: 40px;
        border-radius: 10px;
        background: rgba(99, 102, 241, 0.2);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 18px;
        flex-shrink: 0;
      }
      
      .notification-toast-content {
        flex: 1;
        min-width: 0;
      }
      
      .notification-toast-title {
        font-size: 14px;
        font-weight: 600;
        color: white;
        margin: 0 0 4px 0;
      }
      
      .notification-toast-body {
        font-size: 13px;
        color: rgba(255, 255, 255, 0.7);
        margin: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      
      .notification-toast-close {
        position: absolute;
        top: 8px;
        right: 8px;
        width: 24px;
        height: 24px;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.1);
        border: none;
        color: rgba(255, 255, 255, 0.6);
        font-size: 16px;
        cursor: pointer;
        opacity: 0;
        transition: opacity 0.2s;
      }
      
      .notification-toast:hover .notification-toast-close {
        opacity: 1;
      }
      
      @media (max-width: 480px) {
        .notification-toast {
          left: 12px;
          right: 12px;
          max-width: none;
        }
      }
    `;
    document.head.appendChild(style);
  }
  
  /**
   * Inject notification center styles
   */
  function injectNotificationCenterStyles() {
    if (document.getElementById('notification-center-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'notification-center-styles';
    style.textContent = `
      .notification-center {
        position: fixed;
        top: 60px;
        right: 20px;
        width: 360px;
        max-height: 500px;
        background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
        border: 1px solid rgba(99, 102, 241, 0.3);
        border-radius: 16px;
        box-shadow: 0 12px 48px rgba(0, 0, 0, 0.5);
        z-index: 10000;
        display: flex;
        flex-direction: column;
        font-family: 'Inter', -apple-system, sans-serif;
        animation: slideDown 0.2s ease-out;
      }
      
      .notification-center.hidden {
        display: none;
      }
      
      @keyframes slideDown {
        from { opacity: 0; transform: translateY(-10px); }
        to { opacity: 1; transform: translateY(0); }
      }
      
      .notification-center-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 16px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      }
      
      .notification-center-header h2 {
        font-size: 16px;
        font-weight: 600;
        color: white;
        margin: 0;
      }
      
      .notification-center-header button {
        width: 28px;
        height: 28px;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.1);
        border: none;
        color: rgba(255, 255, 255, 0.6);
        font-size: 18px;
        cursor: pointer;
      }
      
      .notification-center-list {
        flex: 1;
        overflow-y: auto;
        padding: 8px;
      }
      
      .notification-center-empty {
        text-align: center;
        padding: 40px 20px;
        color: rgba(255, 255, 255, 0.5);
      }
      
      .notification-center-empty span {
        font-size: 40px;
        display: block;
        margin-bottom: 12px;
      }
      
      .notification-item {
        display: flex;
        align-items: flex-start;
        gap: 12px;
        padding: 12px;
        border-radius: 10px;
        cursor: pointer;
        transition: background 0.2s;
      }
      
      .notification-item:hover {
        background: rgba(255, 255, 255, 0.05);
      }
      
      .notification-item.unread {
        background: rgba(99, 102, 241, 0.1);
      }
      
      .notification-item-icon {
        width: 36px;
        height: 36px;
        border-radius: 8px;
        background: rgba(99, 102, 241, 0.2);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 16px;
        flex-shrink: 0;
      }
      
      .notification-item-content {
        flex: 1;
        min-width: 0;
      }
      
      .notification-item-title {
        font-size: 13px;
        font-weight: 600;
        color: white;
        margin: 0 0 2px 0;
      }
      
      .notification-item-body {
        font-size: 12px;
        color: rgba(255, 255, 255, 0.6);
        margin: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      
      .notification-item-time {
        font-size: 11px;
        color: rgba(255, 255, 255, 0.4);
        margin: 4px 0 0 0;
      }
      
      .notification-center-footer {
        padding: 12px 16px;
        border-top: 1px solid rgba(255, 255, 255, 0.1);
      }
      
      .notification-center-footer button {
        width: 100%;
        padding: 10px;
        background: rgba(255, 255, 255, 0.1);
        border: none;
        border-radius: 8px;
        color: rgba(255, 255, 255, 0.8);
        font-size: 13px;
        cursor: pointer;
        transition: background 0.2s;
      }
      
      .notification-center-footer button:hover {
        background: rgba(255, 255, 255, 0.15);
      }
      
      @media (max-width: 480px) {
        .notification-center {
          left: 12px;
          right: 12px;
          width: auto;
          max-height: 60vh;
        }
      }
    `;
    document.head.appendChild(style);
  }
  
  // ============================================
  // Track User Activity
  // ============================================
  
  // Track user activity for idle detection
  ['click', 'keydown', 'scroll', 'touchstart'].forEach(event => {
    document.addEventListener(event, () => {
      localStorage.setItem('cinq_last_activity', Date.now().toString());
    }, { passive: true });
  });
  
  // ============================================
  // Public API
  // ============================================
  
  return {
    init,
    
    // Push notifications
    isPushSupported,
    getPushPermission,
    subscribeToPush,
    unsubscribeFromPush,
    isSubscribedToPush,
    
    // In-app notifications
    showInAppNotification,
    
    // Badge
    incrementUnread,
    clearUnread,
    setUnreadCount,
    getUnreadCount: () => unreadCount,
    
    // Notification center
    openNotificationCenter,
    closeNotificationCenter,
    toggleNotificationCenter,
    markAsRead,
    markAllAsRead,
    
    // Settings
    getSettings,
    updateSettings,
    
    // Polling control
    startPolling,
    stopPolling,
    pollForUpdates
  };
  
})();
