/**
 * ==========================================================================
 * CINQ - Shared Utilities
 * ==========================================================================
 * 
 * Common functions shared between app.html and feed.html
 * Reduces code duplication and improves maintainability.
 * 
 * Functions exposed globally:
 * - escapeHtml(str) - XSS prevention
 * - authHeaders() - Get auth headers for API calls
 * - showToast(options) - Display toast notifications
 * - triggerHaptic(type) - Haptic feedback
 * 
 * @author Cinq Team
 * @version 1.0.0
 */

'use strict';

(function(window) {

  // ============================================
  // Security - XSS Prevention
  // ============================================

  /**
   * Escape HTML special characters to prevent XSS attacks
   * @param {string} str - String to escape
   * @returns {string} - Escaped string safe for HTML insertion
   * @example
   * escapeHtml('<script>alert("xss")</script>')
   * // Returns: '&lt;script&gt;alert("xss")&lt;/script&gt;'
   */
  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // ============================================
  // Authentication
  // ============================================

  /**
   * Get the current access token from session storage
   * @returns {string|null} - Access token or null
   */
  function getToken() {
    try {
      const sessionStr = localStorage.getItem('cinq_session');
      if (!sessionStr) return null;
      const session = JSON.parse(sessionStr);
      return session?.access_token || null;
    } catch (e) {
      return null;
    }
  }

  /**
   * Get authorization headers for API calls
   * @returns {Object} - Headers object with Content-Type and Authorization
   * @example
   * fetch('/api/posts', { headers: authHeaders() })
   */
  function authHeaders() {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getToken()}`
    };
  }

  // ============================================
  // Haptic Feedback
  // ============================================

  /**
   * Trigger haptic feedback if available
   * @param {string} type - Feedback type: 'success', 'error', 'tap'
   */
  function triggerHaptic(type) {
    if (!navigator.vibrate) return;
    
    const patterns = {
      success: [10, 30, 10],
      error: [30, 50, 30, 50, 30],
      tap: [10]
    };
    
    const pattern = patterns[type] || patterns.tap;
    try {
      navigator.vibrate(pattern);
    } catch (e) {
      // Vibration not supported or blocked
    }
  }

  // ============================================
  // Toast Notifications
  // ============================================

  /**
   * Display a toast notification
   * @param {Object} options - Toast options
   * @param {string} [options.type='info'] - Type: 'success', 'error', 'notification', 'info'
   * @param {string} [options.title] - Toast title
   * @param {string} [options.message] - Toast message (can use message instead of title for simple toasts)
   * @param {number} [options.duration=4000] - Duration in milliseconds
   * @param {Function} [options.onClick] - Click handler
   * @example
   * showToast({ type: 'success', message: 'Saved!' })
   * showToast({ type: 'error', title: 'Error', message: 'Something went wrong' })
   */
  function showToast(options) {
    // Handle simple string argument
    if (typeof options === 'string') {
      options = { message: options };
    }

    const { 
      type = 'info', 
      title, 
      message, 
      duration = 4000, 
      onClick 
    } = options;

    const container = document.getElementById('toast-container');
    if (!container) {
      console.warn('Toast container not found');
      return;
    }

    const icons = { 
      success: '✓', 
      error: '✕', 
      notification: '💬', 
      info: 'ℹ' 
    };

    // Trigger haptic feedback based on toast type
    if (type === 'success') triggerHaptic('success');
    else if (type === 'error') triggerHaptic('error');
    else if (type === 'notification') triggerHaptic('tap');

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.setAttribute('role', 'alert');

    // Build toast content safely (XSS prevention via DOM methods)
    const iconSpan = document.createElement('span');
    iconSpan.className = 'toast-icon';
    iconSpan.textContent = icons[type] || icons.info;
    iconSpan.setAttribute('aria-hidden', 'true');

    const contentDiv = document.createElement('div');
    contentDiv.className = 'toast-content';

    // Title (use message as title if no title provided)
    const displayTitle = title || message || '';
    if (displayTitle) {
      const titleDiv = document.createElement('div');
      titleDiv.className = 'toast-title';
      titleDiv.textContent = displayTitle;
      contentDiv.appendChild(titleDiv);
    }

    // Message (only if both title and message are provided)
    if (title && message) {
      const messageDiv = document.createElement('div');
      messageDiv.className = 'toast-message';
      messageDiv.textContent = message;
      contentDiv.appendChild(messageDiv);
    }

    toast.appendChild(iconSpan);
    toast.appendChild(contentDiv);

    // Click handler
    if (onClick) {
      toast.style.cursor = 'pointer';
      toast.onclick = () => {
        onClick();
        removeToast(toast);
      };
    }

    container.appendChild(toast);

    // Auto-remove after duration
    setTimeout(() => removeToast(toast), duration);
  }

  /**
   * Remove a toast with animation
   * @param {HTMLElement} toast - Toast element to remove
   */
  function removeToast(toast) {
    if (!toast || !toast.parentNode) return;
    toast.classList.add('toast-out');
    setTimeout(() => toast.remove(), 300);
  }

  // ============================================
  // Time Formatting
  // ============================================

  /**
   * Format a date as relative time in French
   * @param {string|Date} dateStr - Date to format
   * @returns {string} - Formatted relative time
   * @example
   * formatTime(new Date(Date.now() - 60000)) // "il y a 1 min"
   */
  function formatTime(dateStr) {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = Math.floor((now - date) / 1000);

    if (diff < 60) return 'À l\'instant';
    if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`;
    if (diff < 86400) return `il y a ${Math.floor(diff / 3600)}h`;
    if (diff < 604800) return `il y a ${Math.floor(diff / 86400)}j`;

    return date.toLocaleDateString('fr-FR', { 
      day: 'numeric', 
      month: 'short' 
    });
  }

  // ============================================
  // Export to Global Scope
  // ============================================

  // Export functions globally for use in HTML onclick handlers and inline scripts
  window.escapeHtml = escapeHtml;
  window.authHeaders = authHeaders;
  window.getToken = getToken;
  window.showToast = showToast;
  window.triggerHaptic = triggerHaptic;
  window.formatTime = formatTime;

  // Also expose under CinqShared namespace
  window.CinqShared = {
    escapeHtml,
    authHeaders,
    getToken,
    showToast,
    triggerHaptic,
    formatTime
  };

})(window);
