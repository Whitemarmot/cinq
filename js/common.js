/**
 * ==========================================================================
 * CINQ - Common JavaScript Utilities
 * ==========================================================================
 * 
 * Shared utilities used across all pages:
 * - DOM helpers
 * - Security (XSS prevention)
 * - Accessibility (screen reader announcements)
 * - Error handling
 * - Clipboard operations
 * - API calls
 * - Authentication helpers
 * - Session management
 * 
 * @author Cinq Team
 * @version 1.0.0
 */

// Use strict mode for better error catching
'use strict';

/**
 * Global Cinq namespace
 * All common utilities are attached here to avoid polluting global scope
 */
window.Cinq = window.Cinq || {};

(function(Cinq) {
  
  // ============================================
  // Configuration
  // ============================================
  
  /**
   * API base URL for Netlify Functions
   * @constant {string}
   */
  const API_BASE = '/.netlify/functions';
  
  /**
   * Local storage keys
   * @constant {Object}
   */
  const STORAGE_KEYS = {
    SESSION: 'cinq_session',
    USER: 'cinq_user'
  };
  
  // Export config
  Cinq.config = {
    API_BASE,
    STORAGE_KEYS
  };
  
  // ============================================
  // DOM Helpers
  // ============================================
  
  /**
   * Shorthand for document.getElementById
   * @param {string} id - Element ID
   * @returns {HTMLElement|null}
   */
  function $(id) {
    return document.getElementById(id);
  }
  
  /**
   * Query selector shorthand
   * @param {string} selector - CSS selector
   * @param {HTMLElement} [context=document] - Context element
   * @returns {HTMLElement|null}
   */
  function $q(selector, context = document) {
    return context.querySelector(selector);
  }
  
  /**
   * Query selector all shorthand
   * @param {string} selector - CSS selector
   * @param {HTMLElement} [context=document] - Context element
   * @returns {NodeList}
   */
  function $qa(selector, context = document) {
    return context.querySelectorAll(selector);
  }
  
  // Export DOM helpers
  Cinq.$ = $;
  Cinq.$q = $q;
  Cinq.$qa = $qa;
  
  // ============================================
  // Security - XSS Prevention
  // ============================================
  
  /**
   * Escape HTML to prevent XSS attacks
   * @param {string} str - String to escape
   * @returns {string} - Escaped string
   * @example
   * escapeHtml('<script>alert("xss")</script>')
   * // Returns: '&lt;script&gt;alert("xss")&lt;/script&gt;'
   */
  function escapeHtml(str) {
    if (typeof str !== 'string') return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
  
  // Export security helpers
  Cinq.escapeHtml = escapeHtml;
  
  // ============================================
  // Accessibility
  // ============================================
  
  /**
   * Announce message to screen readers via ARIA live region
   * Requires an element with id="sr-announcements" and aria-live="assertive"
   * 
   * @param {string} message - Message to announce
   * @example
   * announce('Form submitted successfully');
   */
  function announce(message) {
    const el = $('sr-announcements');
    if (el) {
      el.textContent = message;
    }
  }
  
  /**
   * Focus first focusable element in a container
   * Useful for modal/screen transitions
   * 
   * @param {string|HTMLElement} container - Container ID or element
   * @param {number} [delay=100] - Delay before focusing (for animations)
   */
  function focusFirst(container, delay = 100) {
    const el = typeof container === 'string' ? $(container) : container;
    if (!el) return;
    
    setTimeout(() => {
      const focusable = el.querySelector(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable) {
        focusable.focus();
      }
    }, delay);
  }
  
  // Export accessibility helpers
  Cinq.announce = announce;
  Cinq.focusFirst = focusFirst;
  
  // ============================================
  // Error Handling
  // ============================================
  
  /**
   * Show error message in a designated element
   * 
   * @param {string} elementId - ID of the error element
   * @param {string} message - Error message to display
   * @example
   * showError('email-error', 'Invalid email address');
   */
  function showError(elementId, message) {
    const el = $(elementId);
    if (!el) return;
    
    // Handle general error containers with nested text elements
    const textEl = $(elementId + '-text') || $(elementId + '-message');
    if (textEl) {
      textEl.textContent = escapeHtml(message);
    } else {
      el.textContent = escapeHtml(message);
    }
    
    el.classList.remove('hidden');
    el.setAttribute('role', 'alert');
  }
  
  /**
   * Hide error message element
   * 
   * @param {string} elementId - ID of the error element
   */
  function hideError(elementId) {
    const el = $(elementId);
    if (el) {
      el.classList.add('hidden');
    }
  }
  
  /**
   * Hide all error messages in a form
   * 
   * @param {string[]} errorIds - Array of error element IDs
   */
  function hideAllErrors(errorIds) {
    errorIds.forEach(id => hideError(id));
  }
  
  // Export error helpers
  Cinq.showError = showError;
  Cinq.hideError = hideError;
  Cinq.hideAllErrors = hideAllErrors;
  
  // ============================================
  // Clipboard Operations
  // ============================================
  
  /**
   * Copy text to clipboard with fallback for older browsers
   * 
   * @param {string} text - Text to copy
   * @returns {Promise<boolean>} - True if copy succeeded
   * @example
   * const success = await copyToClipboard('Hello World');
   * if (success) console.log('Copied!');
   */
  async function copyToClipboard(text) {
    // Modern API
    if (navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (err) {
        // Fall through to fallback
      }
    }
    
    // Fallback for older browsers or permission denied
    try {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.cssText = 'position:fixed;left:-9999px;top:-9999px;';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      
      const success = document.execCommand('copy');
      document.body.removeChild(textArea);
      return success;
    } catch (err) {
      return false;
    }
  }
  
  // Export clipboard helpers
  Cinq.copyToClipboard = copyToClipboard;
  
  // ============================================
  // Time Formatting
  // ============================================
  
  /**
   * Format a date as relative time (e.g., "il y a 5 min")
   * 
   * @param {string|Date} date - Date to format
   * @returns {string} - Formatted relative time in French
   * @example
   * formatRelativeTime(new Date(Date.now() - 60000))
   * // Returns: "il y a 1min"
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
    
    return d.toLocaleDateString('fr-FR', { 
      day: 'numeric', 
      month: 'short' 
    });
  }
  
  // Export time helpers
  Cinq.formatRelativeTime = formatRelativeTime;
  
  // ============================================
  // API Calls
  // ============================================
  
  /**
   * Make an authenticated API call to Netlify Functions
   * Automatically adds Authorization header if session exists
   * 
   * @param {string} endpoint - API endpoint (without /api/ prefix)
   * @param {Object} [options={}] - Fetch options
   * @param {string} [options.method='GET'] - HTTP method
   * @param {Object} [options.body] - Request body (will be JSON stringified)
   * @param {boolean} [options.auth=true] - Whether to include auth header
   * @returns {Promise<Object>} - Parsed JSON response
   * @throws {Error} - If request fails or returns error
   * 
   * @example
   * // GET request
   * const data = await apiCall('contacts');
   * 
   * // POST request
   * const result = await apiCall('contacts', {
   *   method: 'POST',
   *   body: { email: 'user@example.com' }
   * });
   */
  async function apiCall(endpoint, options = {}) {
    const { method = 'GET', body, auth = true } = options;
    
    const headers = {
      'Content-Type': 'application/json'
    };
    
    // Add auth header if needed
    if (auth) {
      const token = await getAccessToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }
    
    const fetchOptions = {
      method,
      headers
    };
    
    if (body && method !== 'GET') {
      fetchOptions.body = JSON.stringify(body);
    }
    
    const res = await fetch(`${API_BASE}/${endpoint}`, fetchOptions);
    const data = await res.json();
    
    if (!res.ok || data.success === false) {
      const err = new Error(data.error || 'API error');
      err.code = data.details?.code || data.code;
      err.status = res.status;
      throw err;
    }
    
    return data;
  }
  
  // Export API helpers
  Cinq.apiCall = apiCall;
  
  // ============================================
  // Authentication & Session
  // ============================================
  
  /**
   * Get the current access token from local storage
   * Returns null if no session or session expired
   * 
   * @returns {Promise<string|null>} - Access token or null
   */
  async function getAccessToken() {
    try {
      const sessionStr = localStorage.getItem(STORAGE_KEYS.SESSION);
      if (!sessionStr) return null;
      
      const session = JSON.parse(sessionStr);
      
      // Check if token is expired
      if (session.expires_at) {
        const expiresAt = typeof session.expires_at === 'number' 
          ? session.expires_at * 1000 
          : new Date(session.expires_at).getTime();
        
        if (expiresAt <= Date.now()) {
          // Session expired, clean up
          clearSession();
          return null;
        }
      }
      
      return session.access_token || null;
    } catch (e) {
      clearSession();
      return null;
    }
  }
  
  /**
   * Save session data to local storage
   * 
   * @param {Object} session - Session object with access_token, refresh_token, expires_at
   */
  function saveSession(session) {
    if (!session) return;
    
    localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_at: session.expires_at
    }));
  }
  
  /**
   * Save user data to local storage
   * 
   * @param {Object} user - User object
   */
  function saveUser(user) {
    if (!user) return;
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
  }
  
  /**
   * Get current user from local storage
   * 
   * @returns {Object|null} - User object or null
   */
  function getUser() {
    try {
      const userStr = localStorage.getItem(STORAGE_KEYS.USER);
      return userStr ? JSON.parse(userStr) : null;
    } catch (e) {
      return null;
    }
  }
  
  /**
   * Clear all session data from local storage
   */
  function clearSession() {
    localStorage.removeItem(STORAGE_KEYS.SESSION);
    localStorage.removeItem(STORAGE_KEYS.USER);
  }
  
  /**
   * Check if user is currently authenticated
   * 
   * @returns {Promise<boolean>}
   */
  async function isAuthenticated() {
    const token = await getAccessToken();
    return token !== null;
  }
  
  /**
   * Get email prefix (part before @)
   * Useful for displaying user names
   * 
   * @param {string} email - Email address
   * @returns {string} - Email prefix
   * @example
   * getEmailPrefix('john.doe@example.com') // Returns: 'john.doe'
   */
  function getEmailPrefix(email) {
    if (!email || typeof email !== 'string') return '';
    return email.split('@')[0];
  }
  
  // Export auth helpers
  Cinq.getAccessToken = getAccessToken;
  Cinq.saveSession = saveSession;
  Cinq.saveUser = saveUser;
  Cinq.getUser = getUser;
  Cinq.clearSession = clearSession;
  Cinq.isAuthenticated = isAuthenticated;
  Cinq.getEmailPrefix = getEmailPrefix;
  
  // ============================================
  // UI Helpers
  // ============================================
  
  /**
   * Set a button to loading state
   * 
   * @param {string} btnId - Button element ID
   * @param {boolean} loading - Whether to show loading state
   * @param {Object} [options={}] - Options
   * @param {string} [options.loadingText='...'] - Text to show when loading
   * @param {string} [options.iconId] - Icon element ID
   * @param {string} [options.textId] - Text element ID
   */
  function setButtonLoading(btnId, loading, options = {}) {
    const btn = $(btnId);
    if (!btn) return;
    
    const { 
      loadingText = '...', 
      iconId = btnId.replace('-btn', '-btn-icon'),
      textId = btnId.replace('-btn', '-btn-text')
    } = options;
    
    const icon = $(iconId);
    const text = $(textId);
    
    btn.disabled = loading;
    
    if (loading) {
      if (icon) {
        icon.dataset.originalIcon = icon.textContent;
        icon.innerHTML = `
          <div class="flex gap-1">
            <div class="loader-dot w-2 h-2 rounded-full bg-white"></div>
            <div class="loader-dot w-2 h-2 rounded-full bg-white"></div>
            <div class="loader-dot w-2 h-2 rounded-full bg-white"></div>
          </div>
        `;
      }
      if (text) {
        text.dataset.originalText = text.textContent;
        text.textContent = loadingText;
      }
    } else {
      if (icon && icon.dataset.originalIcon) {
        icon.textContent = icon.dataset.originalIcon;
      }
      if (text && text.dataset.originalText) {
        text.textContent = text.dataset.originalText;
      }
    }
  }
  
  /**
   * Show a specific screen and hide others
   * 
   * @param {string} screenName - Screen name (without 'screen-' prefix)
   * @param {Object} [options={}] - Options
   * @param {boolean} [options.announce=true] - Announce screen change to screen readers
   */
  function showScreen(screenName, options = {}) {
    const { announce: shouldAnnounce = true } = options;
    
    // Hide all screens
    document.querySelectorAll('.screen').forEach(screen => {
      screen.classList.add('hidden');
      screen.setAttribute('aria-hidden', 'true');
    });
    
    // Show target screen
    const target = $(`screen-${screenName}`);
    if (target) {
      target.classList.remove('hidden');
      target.setAttribute('aria-hidden', 'false');
      
      // Focus first element
      focusFirst(target);
      
      // Announce to screen readers
      if (shouldAnnounce) {
        const title = target.querySelector('h1, h2');
        if (title) {
          announce(title.textContent);
        }
      }
    }
  }
  
  // Export UI helpers
  Cinq.setButtonLoading = setButtonLoading;
  Cinq.showScreen = showScreen;
  
  // ============================================
  // Validation
  // ============================================
  
  /**
   * Validate email format
   * 
   * @param {string} email - Email to validate
   * @returns {boolean}
   */
  function isValidEmail(email) {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
  }
  
  /**
   * Validate password strength
   * Requires: min 8 chars, at least one letter and one number
   * 
   * @param {string} password - Password to validate
   * @returns {{valid: boolean, message?: string}}
   */
  function validatePassword(password) {
    if (!password || password.length < 8) {
      return { 
        valid: false, 
        message: 'Le mot de passe doit contenir au moins 8 caractères' 
      };
    }
    
    if (!/\d/.test(password) || !/[a-zA-Z]/.test(password)) {
      return { 
        valid: false, 
        message: 'Le mot de passe doit contenir au moins une lettre et un chiffre' 
      };
    }
    
    return { valid: true };
  }
  
  // Export validation helpers
  Cinq.isValidEmail = isValidEmail;
  Cinq.validatePassword = validatePassword;
  
})(window.Cinq);

// ============================================
// DOMContentLoaded - Global initialization
// ============================================

document.addEventListener('DOMContentLoaded', function() {
  // Add ARIA live region for announcements if not present
  if (!document.getElementById('sr-announcements')) {
    const liveRegion = document.createElement('div');
    liveRegion.id = 'sr-announcements';
    liveRegion.className = 'sr-only';
    liveRegion.setAttribute('aria-live', 'assertive');
    liveRegion.setAttribute('aria-atomic', 'true');
    document.body.appendChild(liveRegion);
  }
});
