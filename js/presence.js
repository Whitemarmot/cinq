/**
 * ==========================================================================
 * CINQ - Presence Indicators
 * ==========================================================================
 * 
 * Real-time presence tracking using Supabase Realtime Presence.
 * Shows when contacts are active on the same page (feed, chat).
 * 
 * Features:
 * - Track user presence per page (feed, chat, app)
 * - Show presence indicators next to contacts
 * - Typing indicators in chat
 * - "Viewing with you" badge on feed
 * 
 * @author Cinq Team
 * @version 1.0.0
 */

'use strict';

/**
 * CinqPresence - Presence tracking module
 */
const CinqPresence = (function() {
  
  // ============================================
  // Configuration
  // ============================================
  
  const SUPABASE_URL = 'https://guioxfulihyehrwytxce.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd1aW94ZnVsaWh5ZWhyd3l0eGNlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk4MDg5NjUsImV4cCI6MjA4NTM4NDk2NX0.pLvhH3dEYGH7EQCFxUwtvhscLamKVnsWRNrT412YHQ';
  
  // ============================================
  // State
  // ============================================
  
  /** @type {Object|null} Supabase client instance */
  let db = null;
  
  /** @type {Object|null} Current authenticated user */
  let currentUser = null;
  
  /** @type {Object|null} Presence channel */
  let presenceChannel = null;
  
  /** @type {string} Current page type */
  let currentPage = 'unknown';
  
  /** @type {Map<string, Object>} Online users map: userId -> presence data */
  const onlineUsers = new Map();
  
  /** @type {Set<string>} Users currently typing (for chat) */
  const typingUsers = new Set();
  
  /** @type {Array<Function>} Presence change listeners */
  const listeners = [];
  
  /** @type {number|null} Typing timeout */
  let typingTimeout = null;
  
  /** @type {boolean} Is currently typing */
  let isTyping = false;
  
  // ============================================
  // Initialization
  // ============================================
  
  /**
   * Initialize presence tracking
   * @param {Object} options - Configuration options
   * @param {string} options.page - Current page type ('feed', 'chat', 'app')
   * @param {Object} [options.user] - Current user object
   * @param {Object} [options.supabaseClient] - Existing Supabase client
   */
  async function init(options = {}) {
    currentPage = options.page || detectPage();
    
    // Use provided Supabase client or create new one
    if (options.supabaseClient) {
      db = options.supabaseClient;
    } else if (typeof supabase !== 'undefined') {
      db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    } else {
      console.warn('[Presence] Supabase client not available');
      return false;
    }
    
    // Get current user
    if (options.user) {
      currentUser = options.user;
    } else {
      const { data: { session } } = await db.auth.getSession();
      currentUser = session?.user;
    }
    
    if (!currentUser) {
      console.warn('[Presence] No authenticated user');
      return false;
    }
    
    // Subscribe to presence channel
    await subscribeToPresence();
    
    // Handle visibility changes (pause when tab hidden)
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Clean up on page unload
    window.addEventListener('beforeunload', cleanup);
    
    console.log('[Presence] Initialized for page:', currentPage);
    return true;
  }
  
  /**
   * Detect current page from URL
   * @returns {string} Page type
   */
  function detectPage() {
    const path = window.location.pathname;
    if (path.includes('feed')) return 'feed';
    if (path.includes('app')) return 'chat';
    if (path.includes('profile')) return 'profile';
    if (path.includes('settings')) return 'settings';
    return 'app';
  }
  
  // ============================================
  // Presence Channel
  // ============================================
  
  /**
   * Subscribe to the presence channel
   */
  async function subscribeToPresence() {
    if (!db || !currentUser) return;
    
    // Create a unique room for presence (all users share this)
    const roomName = 'cinq-presence';
    
    presenceChannel = db.channel(roomName, {
      config: {
        presence: {
          key: currentUser.id,
        },
      },
    });
    
    // Handle presence sync (initial state)
    presenceChannel.on('presence', { event: 'sync' }, () => {
      const state = presenceChannel.presenceState();
      onlineUsers.clear();
      
      Object.entries(state).forEach(([key, presences]) => {
        if (presences.length > 0) {
          const latest = presences[presences.length - 1];
          onlineUsers.set(key, latest);
        }
      });
      
      notifyListeners();
      updatePresenceUI();
    });
    
    // Handle user joining
    presenceChannel.on('presence', { event: 'join' }, ({ key, newPresences }) => {
      if (newPresences.length > 0) {
        onlineUsers.set(key, newPresences[newPresences.length - 1]);
        notifyListeners();
        updatePresenceUI();
      }
    });
    
    // Handle user leaving
    presenceChannel.on('presence', { event: 'leave' }, ({ key }) => {
      onlineUsers.delete(key);
      typingUsers.delete(key);
      notifyListeners();
      updatePresenceUI();
    });
    
    // Subscribe and track our presence
    await presenceChannel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await trackPresence();
      }
    });
  }
  
  /**
   * Track current user's presence
   */
  async function trackPresence() {
    if (!presenceChannel || !currentUser) return;
    
    const presenceData = {
      user_id: currentUser.id,
      email: currentUser.email,
      page: currentPage,
      is_typing: isTyping,
      online_at: new Date().toISOString(),
    };
    
    await presenceChannel.track(presenceData);
  }
  
  /**
   * Update presence data (e.g., when page changes or typing)
   * @param {Object} updates - Partial presence data to update
   */
  async function updatePresence(updates = {}) {
    if (!presenceChannel || !currentUser) return;
    
    // Merge with current presence
    const currentPresence = onlineUsers.get(currentUser.id) || {};
    
    const presenceData = {
      ...currentPresence,
      user_id: currentUser.id,
      email: currentUser.email,
      page: currentPage,
      is_typing: isTyping,
      online_at: new Date().toISOString(),
      ...updates,
    };
    
    await presenceChannel.track(presenceData);
  }
  
  // ============================================
  // Typing Indicator
  // ============================================
  
  /**
   * Notify that current user started typing
   */
  function startTyping() {
    if (isTyping) {
      // Reset timeout
      if (typingTimeout) clearTimeout(typingTimeout);
    } else {
      isTyping = true;
      updatePresence({ is_typing: true });
    }
    
    // Auto-stop typing after 3 seconds of inactivity
    typingTimeout = setTimeout(stopTyping, 3000);
  }
  
  /**
   * Notify that current user stopped typing
   */
  function stopTyping() {
    if (!isTyping) return;
    
    isTyping = false;
    if (typingTimeout) {
      clearTimeout(typingTimeout);
      typingTimeout = null;
    }
    
    updatePresence({ is_typing: false });
  }
  
  // ============================================
  // Visibility Handling
  // ============================================
  
  /**
   * Handle visibility change (pause/resume presence)
   */
  function handleVisibilityChange() {
    if (document.hidden) {
      // User switched away - mark as inactive
      updatePresence({ page: 'inactive' });
    } else {
      // User came back
      updatePresence({ page: currentPage });
    }
  }
  
  // ============================================
  // Query Methods
  // ============================================
  
  /**
   * Get all online users
   * @returns {Map<string, Object>} Map of user ID to presence data
   */
  function getOnlineUsers() {
    return new Map(onlineUsers);
  }
  
  /**
   * Check if a specific user is online
   * @param {string} userId - User ID to check
   * @returns {boolean}
   */
  function isUserOnline(userId) {
    const presence = onlineUsers.get(userId);
    return presence && presence.page !== 'inactive';
  }
  
  /**
   * Get users on a specific page
   * @param {string} page - Page type
   * @returns {Array<Object>} Users on that page
   */
  function getUsersOnPage(page) {
    const users = [];
    onlineUsers.forEach((presence, userId) => {
      if (presence.page === page && userId !== currentUser?.id) {
        users.push({ userId, ...presence });
      }
    });
    return users;
  }
  
  /**
   * Get contacts online on the same page
   * @param {Array<Object>} contacts - User's contacts list
   * @returns {Array<Object>} Contacts on same page
   */
  function getContactsOnSamePage(contacts = []) {
    const samePage = [];
    
    contacts.forEach(contact => {
      const contactId = contact.contact_user_id || contact.user_id || contact.id;
      const presence = onlineUsers.get(contactId);
      
      if (presence && presence.page === currentPage && presence.page !== 'inactive') {
        samePage.push({
          contact,
          presence,
          isTyping: typingUsers.has(contactId) || presence.is_typing,
        });
      }
    });
    
    return samePage;
  }
  
  /**
   * Get online contacts
   * @param {Array<Object>} contacts - User's contacts list
   * @returns {Array<Object>} Online contacts with presence data
   */
  function getOnlineContacts(contacts = []) {
    const online = [];
    
    contacts.forEach(contact => {
      const contactId = contact.contact_user_id || contact.user_id || contact.id;
      const presence = onlineUsers.get(contactId);
      
      if (presence && presence.page !== 'inactive') {
        online.push({
          contact,
          presence,
          isTyping: typingUsers.has(contactId) || presence.is_typing,
        });
      }
    });
    
    return online;
  }
  
  /**
   * Check if a contact is typing
   * @param {string} contactId - Contact user ID
   * @returns {boolean}
   */
  function isContactTyping(contactId) {
    const presence = onlineUsers.get(contactId);
    return presence?.is_typing || typingUsers.has(contactId);
  }
  
  // ============================================
  // Event Listeners
  // ============================================
  
  /**
   * Add a presence change listener
   * @param {Function} callback - Called when presence changes
   * @returns {Function} Unsubscribe function
   */
  function onPresenceChange(callback) {
    listeners.push(callback);
    return () => {
      const index = listeners.indexOf(callback);
      if (index > -1) listeners.splice(index, 1);
    };
  }
  
  /**
   * Notify all listeners of presence change
   */
  function notifyListeners() {
    const data = {
      onlineUsers: getOnlineUsers(),
      currentPage,
    };
    
    listeners.forEach(callback => {
      try {
        callback(data);
      } catch (err) {
        console.error('[Presence] Listener error:', err);
      }
    });
  }
  
  // ============================================
  // UI Updates
  // ============================================
  
  /**
   * Update presence UI elements
   * Called automatically on presence changes
   */
  function updatePresenceUI() {
    // Update online indicators on contact cards
    updateContactIndicators();
    
    // Update "viewing with you" badge on feed
    updateViewingWithYouBadge();
    
    // Update typing indicators in chat
    updateTypingIndicator();
    
    // Dispatch custom event for other components
    window.dispatchEvent(new CustomEvent('cinq:presence-update', {
      detail: {
        onlineUsers: getOnlineUsers(),
        currentPage,
      }
    }));
  }
  
  /**
   * Update online indicators on contact cards/slots
   */
  function updateContactIndicators() {
    // Find all contact elements
    const contactSlots = document.querySelectorAll('.contact-slot:not(.empty)');
    
    contactSlots.forEach(slot => {
      const emailEl = slot.querySelector('.text-white\\/40, .text-xs');
      const email = emailEl?.textContent?.trim();
      
      if (!email) return;
      
      // Find matching online user by email
      let isOnline = false;
      let onSamePage = false;
      
      onlineUsers.forEach((presence) => {
        if (presence.email === email && presence.page !== 'inactive') {
          isOnline = true;
          if (presence.page === currentPage) {
            onSamePage = true;
          }
        }
      });
      
      // Add or update presence indicator
      let indicator = slot.querySelector('.presence-indicator');
      
      if (isOnline) {
        if (!indicator) {
          indicator = document.createElement('span');
          indicator.className = 'presence-indicator';
          const avatar = slot.querySelector('.w-10, .contact-avatar, [class*="rounded-full"]');
          if (avatar) {
            avatar.style.position = 'relative';
            avatar.appendChild(indicator);
          }
        }
        
        indicator.classList.toggle('same-page', onSamePage);
        indicator.setAttribute('title', onSamePage ? 'Ici avec toi' : 'En ligne');
      } else if (indicator) {
        indicator.remove();
      }
    });
  }
  
  /**
   * Update "viewing with you" badge on feed page
   */
  function updateViewingWithYouBadge() {
    if (currentPage !== 'feed') return;
    
    const samePage = getUsersOnPage('feed');
    const badge = document.getElementById('viewing-with-you-badge') || createViewingBadge();
    
    if (samePage.length > 0) {
      const names = samePage.slice(0, 3).map(u => {
        const email = u.email || '';
        return email.split('@')[0] || 'Quelqu\'un';
      });
      
      let text = names.join(', ');
      if (samePage.length > 3) {
        text += ` +${samePage.length - 3}`;
      }
      
      badge.innerHTML = `
        <span class="viewing-badge-dot"></span>
        <span class="viewing-badge-text">${text} ${samePage.length === 1 ? 'est' : 'sont'} ici</span>
      `;
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
  }
  
  /**
   * Create the viewing with you badge element
   * @returns {HTMLElement}
   */
  function createViewingBadge() {
    const badge = document.createElement('div');
    badge.id = 'viewing-with-you-badge';
    badge.className = 'viewing-with-you-badge hidden';
    
    // Insert after feed header
    const header = document.querySelector('.feed-header');
    if (header && header.parentNode) {
      header.parentNode.insertBefore(badge, header.nextSibling);
    } else {
      document.body.appendChild(badge);
    }
    
    return badge;
  }
  
  /**
   * Update typing indicator in chat
   */
  function updateTypingIndicator() {
    if (currentPage !== 'chat' && currentPage !== 'app') return;
    
    // Get current chat contact (if in a chat)
    const chatNameEl = document.getElementById('chat-contact-name');
    if (!chatNameEl) return;
    
    const contactName = chatNameEl.textContent;
    
    // Check if any contact in current chat is typing
    let contactTyping = null;
    
    onlineUsers.forEach((presence, userId) => {
      if (presence.is_typing && presence.page === 'chat') {
        const email = presence.email || '';
        const name = email.split('@')[0] || '';
        if (name.toLowerCase() === contactName.toLowerCase()) {
          contactTyping = presence;
        }
      }
    });
    
    // Update or create typing indicator
    let typingEl = document.getElementById('typing-indicator');
    
    if (contactTyping) {
      if (!typingEl) {
        typingEl = document.createElement('div');
        typingEl.id = 'typing-indicator';
        typingEl.className = 'typing-indicator';
        
        const messagesContainer = document.getElementById('messages-container') ||
                                  document.querySelector('.messages-list');
        if (messagesContainer) {
          messagesContainer.appendChild(typingEl);
        }
      }
      
      typingEl.innerHTML = `
        <div class="typing-dots">
          <span></span><span></span><span></span>
        </div>
        <span class="typing-text">écrit...</span>
      `;
      typingEl.classList.remove('hidden');
      
      // Scroll to show typing indicator
      typingEl.scrollIntoView({ behavior: 'smooth', block: 'end' });
    } else if (typingEl) {
      typingEl.classList.add('hidden');
    }
  }
  
  // ============================================
  // Cleanup
  // ============================================
  
  /**
   * Clean up presence tracking
   */
  function cleanup() {
    if (presenceChannel) {
      presenceChannel.unsubscribe();
      presenceChannel = null;
    }
    
    if (typingTimeout) {
      clearTimeout(typingTimeout);
    }
    
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    window.removeEventListener('beforeunload', cleanup);
    
    onlineUsers.clear();
    typingUsers.clear();
    listeners.length = 0;
  }
  
  /**
   * Change current page (for SPA navigation)
   * @param {string} page - New page type
   */
  function setPage(page) {
    currentPage = page;
    updatePresence({ page });
  }
  
  // ============================================
  // Public API
  // ============================================
  
  return {
    init,
    cleanup,
    setPage,
    
    // Typing
    startTyping,
    stopTyping,
    isContactTyping,
    
    // Queries
    getOnlineUsers,
    isUserOnline,
    getUsersOnPage,
    getContactsOnSamePage,
    getOnlineContacts,
    
    // Events
    onPresenceChange,
    
    // Manual UI update
    updateUI: updatePresenceUI,
  };
  
})();

// Export for use in modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CinqPresence;
}

// Auto-expose globally
window.CinqPresence = CinqPresence;
