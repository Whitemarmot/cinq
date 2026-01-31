/**
 * CINQ Theme Manager
 * Handles dark/light/auto theme switching with smooth transitions
 * 
 * @version 1.0
 * @description Complete theme management system with system preference detection
 */

(function() {
  'use strict';

  const STORAGE_KEY = 'cinq_theme';
  const THEME_COLOR_DARK = '#0e0e12';
  const THEME_COLOR_LIGHT = '#faf9f7';
  
  // Theme values: 'dark', 'light', 'auto'
  const THEMES = ['dark', 'light', 'auto'];

  /**
   * Get the current system color scheme preference
   * @returns {'dark'|'light'}
   */
  function getSystemPreference() {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
      return 'light';
    }
    return 'dark';
  }

  /**
   * Get the saved theme preference from localStorage
   * @returns {'dark'|'light'|'auto'|null}
   */
  function getSavedTheme() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && THEMES.includes(saved)) {
        return saved;
      }
    } catch (e) {
      // localStorage not available
    }
    return null;
  }

  /**
   * Save theme preference to localStorage
   * @param {'dark'|'light'|'auto'} theme
   */
  function saveTheme(theme) {
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch (e) {
      // localStorage not available
    }
  }

  /**
   * Get the effective theme (resolving 'auto' to actual theme)
   * @param {'dark'|'light'|'auto'} preference
   * @returns {'dark'|'light'}
   */
  function getEffectiveTheme(preference) {
    if (preference === 'auto') {
      return getSystemPreference();
    }
    return preference || 'dark';
  }

  /**
   * Apply theme to the document
   * @param {'dark'|'light'|'auto'} preference - User preference (including auto)
   * @param {boolean} [withTransition=true] - Whether to animate the transition
   */
  function applyTheme(preference, withTransition = true) {
    const html = document.documentElement;
    const effectiveTheme = getEffectiveTheme(preference);
    
    // Store the preference (including auto)
    html.setAttribute('data-theme-preference', preference);
    
    // Add transition class for smooth switch
    if (withTransition && !html.classList.contains('theme-loading')) {
      html.classList.add('theme-transitioning');
      
      // Remove transition class after animation completes
      setTimeout(() => {
        html.classList.remove('theme-transitioning');
      }, 400);
    }
    
    // Apply the effective theme
    html.setAttribute('data-theme', effectiveTheme);
    
    // Update theme-color meta tag
    updateThemeColor(effectiveTheme);
    
    // Dispatch custom event for any listeners
    window.dispatchEvent(new CustomEvent('themechange', {
      detail: { preference, effective: effectiveTheme }
    }));
  }

  /**
   * Update the theme-color meta tag for browser UI
   * @param {'dark'|'light'} theme
   */
  function updateThemeColor(theme) {
    let meta = document.getElementById('theme-color-meta');
    if (!meta) {
      meta = document.querySelector('meta[name="theme-color"]');
    }
    if (meta) {
      meta.setAttribute('content', theme === 'light' ? THEME_COLOR_LIGHT : THEME_COLOR_DARK);
    }
  }

  /**
   * Toggle between themes (dark -> light -> auto -> dark)
   */
  function toggleTheme() {
    const current = getSavedTheme() || 'dark';
    const currentIndex = THEMES.indexOf(current);
    const nextIndex = (currentIndex + 1) % THEMES.length;
    const next = THEMES[nextIndex];
    
    saveTheme(next);
    applyTheme(next, true);
    
    return next;
  }

  /**
   * Set a specific theme
   * @param {'dark'|'light'|'auto'} theme
   */
  function setTheme(theme) {
    if (!THEMES.includes(theme)) {
      console.warn('Invalid theme:', theme);
      return;
    }
    
    saveTheme(theme);
    applyTheme(theme, true);
  }

  /**
   * Get current theme info
   * @returns {{preference: string, effective: string}}
   */
  function getTheme() {
    const preference = getSavedTheme() || 'dark';
    return {
      preference,
      effective: getEffectiveTheme(preference)
    };
  }

  /**
   * Initialize theme on page load
   * Call this as early as possible to prevent flash
   */
  function initTheme() {
    const html = document.documentElement;
    
    // Mark as loading to prevent transitions during init
    html.classList.add('theme-loading');
    
    // Get saved preference or default to 'dark'
    const saved = getSavedTheme();
    const preference = saved || 'dark';
    
    // Apply theme without transition
    applyTheme(preference, false);
    
    // Listen for system preference changes (for auto mode)
    if (window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: light)');
      
      const handleChange = () => {
        const currentPref = getSavedTheme();
        if (currentPref === 'auto') {
          applyTheme('auto', true);
        }
      };
      
      // Use the modern API if available
      if (mediaQuery.addEventListener) {
        mediaQuery.addEventListener('change', handleChange);
      } else if (mediaQuery.addListener) {
        mediaQuery.addListener(handleChange);
      }
    }
    
    // Remove loading class after a short delay to enable transitions
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        html.classList.remove('theme-loading');
      });
    });
  }

  /**
   * Update theme selector UI (for settings page)
   * @param {string} preference - Current theme preference
   */
  function updateThemeSelector(preference) {
    const options = document.querySelectorAll('.theme-selector-option');
    options.forEach(option => {
      const theme = option.getAttribute('data-theme');
      option.classList.toggle('active', theme === preference);
      option.setAttribute('aria-pressed', theme === preference);
    });
  }

  // Auto-initialize if script is loaded after DOM is ready
  if (document.readyState === 'loading') {
    // DOM not ready, wait for it
    document.addEventListener('DOMContentLoaded', () => {
      // Update any theme selectors on the page
      const theme = getTheme();
      updateThemeSelector(theme.preference);
    });
  } else {
    // DOM already ready
    const theme = getTheme();
    updateThemeSelector(theme.preference);
  }

  // Initialize theme immediately (runs synchronously)
  initTheme();

  // Expose API globally
  window.CinqTheme = {
    toggle: toggleTheme,
    set: setTheme,
    get: getTheme,
    init: initTheme,
    getSystemPreference,
    updateSelector: updateThemeSelector,
    THEMES
  };

  // Also expose simple toggleTheme function for onclick handlers
  window.toggleTheme = toggleTheme;
  window.setTheme = setTheme;

})();
