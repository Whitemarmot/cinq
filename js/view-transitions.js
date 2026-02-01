/**
 * CINQ - View Transitions Engine
 * ===============================
 * Smooth page transitions using View Transitions API
 * With graceful fallback for unsupported browsers
 */

const ViewTransitions = (function() {
  'use strict';

  // ============================================
  // Configuration
  // ============================================
  const CONFIG = {
    // Transition durations (ms)
    outDuration: 200,
    inDuration: 300,
    
    // Easing functions
    easeOut: 'cubic-bezier(0.22, 1, 0.36, 1)',
    
    // Selectors
    linkSelector: 'a[href]:not([href^="#"]):not([href^="javascript"]):not([href^="mailto"]):not([href^="tel"]):not([target="_blank"]):not(.no-transition):not([data-no-transition])',
    
    // History tracking
    historyStack: [],
    
    // Debug mode
    debug: false,
  };

  // State
  let isTransitioning = false;
  let supportsViewTransitions = false;
  let navigationHistory = [];

  // ============================================
  // Feature Detection
  // ============================================
  
  function detectSupport() {
    // Check for View Transitions API support
    supportsViewTransitions = 'startViewTransition' in document;
    
    if (CONFIG.debug) {
      console.log('[ViewTransitions] API supported:', supportsViewTransitions);
    }
    
    return supportsViewTransitions;
  }

  // ============================================
  // Navigation Helpers
  // ============================================
  
  function isInternalLink(href) {
    try {
      const url = new URL(href, window.location.origin);
      return url.origin === window.location.origin;
    } catch {
      return false;
    }
  }

  function isSamePage(href) {
    try {
      const url = new URL(href, window.location.origin);
      return url.pathname === window.location.pathname && 
             url.search === window.location.search;
    } catch {
      return true;
    }
  }

  function getTransitionType(fromPath, toPath) {
    // Determine transition direction based on navigation
    const isBack = navigationHistory.length > 1 && 
                   navigationHistory[navigationHistory.length - 2] === toPath;
    
    // Check for specific page types
    const modalPages = ['/login', '/register', '/gift', '/redeem'];
    const isToModal = modalPages.some(p => toPath.includes(p));
    const isFromModal = modalPages.some(p => fromPath.includes(p));
    
    if (isBack) return 'back';
    if (isToModal) return 'modal';
    if (isFromModal) return 'modal-close';
    return 'forward';
  }

  // ============================================
  // Fallback Animation (no View Transitions API)
  // ============================================
  
  async function fallbackTransition(href, transitionType) {
    return new Promise((resolve) => {
      // Add transitioning class
      document.body.classList.add('page-transitioning-out');
      
      // Wait for exit animation
      setTimeout(() => {
        // Navigate
        window.location.href = href;
        resolve();
      }, CONFIG.outDuration);
    });
  }

  // ============================================
  // View Transitions API Navigation
  // ============================================
  
  async function navigateWithViewTransition(href, transitionType) {
    if (isTransitioning) return;
    isTransitioning = true;

    const currentPath = window.location.pathname;
    
    try {
      // Use View Transitions API
      const transition = document.startViewTransition(async () => {
        // Fetch new page
        const response = await fetch(href);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        
        const html = await response.text();
        const parser = new DOMParser();
        const newDoc = parser.parseFromString(html, 'text/html');
        
        // Update document
        // Update title
        document.title = newDoc.title;
        
        // Update meta tags
        const newMeta = newDoc.querySelectorAll('meta[name], meta[property]');
        newMeta.forEach(meta => {
          const name = meta.getAttribute('name') || meta.getAttribute('property');
          const existing = document.querySelector(`meta[name="${name}"], meta[property="${name}"]`);
          if (existing) {
            existing.setAttribute('content', meta.getAttribute('content') || '');
          }
        });
        
        // Replace body content
        const newBody = newDoc.body;
        
        // Preserve scripts that shouldn't be reloaded
        const persistentScripts = document.querySelectorAll('script[data-persistent]');
        
        // Apply transition type class
        if (transitionType === 'back') {
          document.documentElement.classList.add('back-transition');
        }
        
        // Swap body content
        document.body.innerHTML = newBody.innerHTML;
        document.body.className = newBody.className;
        
        // Re-append persistent scripts
        persistentScripts.forEach(script => document.body.appendChild(script));
        
        // Update URL
        history.pushState({ path: href }, '', href);
        
        // Track navigation
        navigationHistory.push(href);
        if (navigationHistory.length > 50) {
          navigationHistory.shift();
        }
        
        // Re-initialize page scripts
        reinitializePage();
      });

      // Wait for transition to complete
      await transition.finished;
      
      // Cleanup
      document.documentElement.classList.remove('back-transition');
      
    } catch (error) {
      if (CONFIG.debug) {
        console.error('[ViewTransitions] Error:', error);
      }
      // Fallback to normal navigation on error
      window.location.href = href;
    } finally {
      isTransitioning = false;
    }
  }

  // ============================================
  // Page Reinitialization
  // ============================================
  
  function reinitializePage() {
    // Dispatch event for other scripts to reinitialize
    window.dispatchEvent(new CustomEvent('page:loaded'));
    
    // Re-attach link handlers
    attachLinkHandlers();
    
    // Reinit animations if available
    if (typeof CinqAnimations !== 'undefined' && CinqAnimations.init) {
      CinqAnimations.init();
    }
    
    // Scroll to top (unless anchor)
    if (!window.location.hash) {
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
    
    // Focus management for accessibility
    const main = document.querySelector('main, [role="main"]');
    if (main) {
      main.setAttribute('tabindex', '-1');
      main.focus({ preventScroll: true });
      main.removeAttribute('tabindex');
    }
  }

  // ============================================
  // Link Click Handler
  // ============================================
  
  function handleLinkClick(event) {
    const link = event.target.closest('a');
    if (!link) return;
    
    const href = link.getAttribute('href');
    if (!href) return;
    
    // Skip if modifier keys pressed
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }
    
    // Skip external links
    if (!isInternalLink(href)) return;
    
    // Skip same-page anchors
    if (isSamePage(href) && href.includes('#')) return;
    
    // Skip if marked no-transition
    if (link.classList.contains('no-transition') || link.hasAttribute('data-no-transition')) {
      return;
    }
    
    // Prevent default navigation
    event.preventDefault();
    
    // Determine transition type
    const transitionType = getTransitionType(window.location.pathname, new URL(href, window.location.origin).pathname);
    
    // Perform transition
    if (supportsViewTransitions) {
      navigateWithViewTransition(href, transitionType);
    } else {
      fallbackTransition(href, transitionType);
    }
  }

  // ============================================
  // Browser Back/Forward Handler
  // ============================================
  
  function handlePopState(event) {
    if (!supportsViewTransitions) {
      // Let browser handle it naturally
      return;
    }
    
    const href = window.location.href;
    
    document.startViewTransition(async () => {
      try {
        const response = await fetch(href);
        const html = await response.text();
        const parser = new DOMParser();
        const newDoc = parser.parseFromString(html, 'text/html');
        
        // Add back transition class
        document.documentElement.classList.add('back-transition');
        
        document.title = newDoc.title;
        document.body.innerHTML = newDoc.body.innerHTML;
        document.body.className = newDoc.body.className;
        
        reinitializePage();
      } catch (error) {
        window.location.reload();
      }
    }).finished.then(() => {
      document.documentElement.classList.remove('back-transition');
    });
  }

  // ============================================
  // Prefetch on Hover
  // ============================================
  
  const prefetchedUrls = new Set();
  
  function prefetchUrl(href) {
    if (prefetchedUrls.has(href)) return;
    if (!isInternalLink(href)) return;
    
    // Create prefetch link
    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.href = href;
    link.as = 'document';
    document.head.appendChild(link);
    
    prefetchedUrls.add(href);
    
    if (CONFIG.debug) {
      console.log('[ViewTransitions] Prefetched:', href);
    }
  }

  function handleLinkHover(event) {
    const link = event.target.closest('a');
    if (!link) return;
    
    const href = link.getAttribute('href');
    if (href && isInternalLink(href)) {
      prefetchUrl(href);
    }
  }

  // ============================================
  // Attach Handlers
  // ============================================
  
  function attachLinkHandlers() {
    // Use event delegation on document
    document.removeEventListener('click', handleLinkClick);
    document.addEventListener('click', handleLinkClick);
    
    // Prefetch on hover (desktop only)
    if (!('ontouchstart' in window)) {
      document.removeEventListener('mouseover', handleLinkHover);
      document.addEventListener('mouseover', handleLinkHover);
    }
  }

  // ============================================
  // Public API
  // ============================================
  
  function init() {
    // Check for reduced motion preference
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      if (CONFIG.debug) {
        console.log('[ViewTransitions] Reduced motion preferred, using minimal transitions');
      }
      // Still initialize but with reduced animation
    }
    
    detectSupport();
    attachLinkHandlers();
    
    // Handle browser back/forward
    window.addEventListener('popstate', handlePopState);
    
    // Track initial page
    navigationHistory.push(window.location.pathname);
    
    // Add loaded class for CSS
    document.body.classList.add('view-transitions-ready');
    
    if (CONFIG.debug) {
      console.log('[ViewTransitions] Initialized');
    }
  }

  // ============================================
  // Programmatic Navigation
  // ============================================
  
  function navigate(href, options = {}) {
    const transitionType = options.transitionType || 'forward';
    
    if (supportsViewTransitions) {
      return navigateWithViewTransition(href, transitionType);
    } else {
      return fallbackTransition(href, transitionType);
    }
  }

  // Auto-initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Public API
  return {
    init,
    navigate,
    isSupported: () => supportsViewTransitions,
    prefetch: prefetchUrl,
  };

})();

// Export for ES modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ViewTransitions;
}
