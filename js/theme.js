/**
 * CINQ Theme Manager
 * Handles dark/light/auto/sunrise theme switching with smooth transitions
 * Also manages accent color customization
 * 
 * @version 1.2
 * @description Complete theme management system with system preference detection and sunrise/sunset mode
 */

(function() {
  'use strict';

  const STORAGE_KEY = 'cinq_theme';
  const ACCENT_STORAGE_KEY = 'cinq_accent';
  const SUNRISE_CACHE_KEY = 'cinq_sunrise_data';
  const THEME_COLOR_DARK = '#0e0e12';
  const THEME_COLOR_LIGHT = '#faf9f7';
  
  // Available accent colors
  const ACCENTS = ['indigo', 'violet', 'rose', 'green', 'orange'];
  const ACCENT_NAMES = {
    'indigo': 'Indigo',
    'violet': 'Violet',
    'rose': 'Rose',
    'green': 'Vert',
    'orange': 'Orange'
  };
  
  // Default sunrise/sunset times (fallback)
  const DEFAULT_SUNRISE = 7; // 7:00 AM
  const DEFAULT_SUNSET = 19; // 7:00 PM
  
  // Theme values: 'dark', 'light', 'auto', 'sunrise'
  const THEMES = ['dark', 'light', 'auto', 'sunrise'];

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
   * Get cached sunrise/sunset data
   * @returns {Object|null}
   */
  function getCachedSunriseData() {
    try {
      const cached = localStorage.getItem(SUNRISE_CACHE_KEY);
      if (cached) {
        const data = JSON.parse(cached);
        // Check if cache is from today
        const today = new Date().toDateString();
        if (data.date === today) {
          return data;
        }
      }
    } catch (e) {}
    return null;
  }

  /**
   * Cache sunrise/sunset data
   * @param {number} sunrise - Hour of sunrise (0-23)
   * @param {number} sunset - Hour of sunset (0-23)
   */
  function cacheSunriseData(sunrise, sunset) {
    try {
      localStorage.setItem(SUNRISE_CACHE_KEY, JSON.stringify({
        date: new Date().toDateString(),
        sunrise,
        sunset
      }));
    } catch (e) {}
  }

  /**
   * Fetch sunrise/sunset times from API
   * @param {number} lat - Latitude
   * @param {number} lng - Longitude
   * @returns {Promise<{sunrise: number, sunset: number}>}
   */
  async function fetchSunriseSunset(lat, lng) {
    try {
      const response = await fetch(
        `https://api.sunrise-sunset.org/json?lat=${lat}&lng=${lng}&formatted=0`
      );
      const data = await response.json();
      
      if (data.status === 'OK') {
        const sunriseDate = new Date(data.results.sunrise);
        const sunsetDate = new Date(data.results.sunset);
        
        return {
          sunrise: sunriseDate.getHours() + sunriseDate.getMinutes() / 60,
          sunset: sunsetDate.getHours() + sunsetDate.getMinutes() / 60
        };
      }
    } catch (e) {
      console.warn('Failed to fetch sunrise/sunset data:', e);
    }
    return null;
  }

  /**
   * Get sunrise/sunset times (with geolocation and caching)
   * @returns {Promise<{sunrise: number, sunset: number}>}
   */
  async function getSunriseSunset() {
    // Check cache first
    const cached = getCachedSunriseData();
    if (cached) {
      return { sunrise: cached.sunrise, sunset: cached.sunset };
    }

    // Try geolocation
    if ('geolocation' in navigator) {
      try {
        const position = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            timeout: 5000,
            maximumAge: 86400000 // 24 hours
          });
        });
        
        const { latitude, longitude } = position.coords;
        const times = await fetchSunriseSunset(latitude, longitude);
        
        if (times) {
          cacheSunriseData(times.sunrise, times.sunset);
          return times;
        }
      } catch (e) {
        // Geolocation failed, use defaults
      }
    }

    // Return default values
    return { sunrise: DEFAULT_SUNRISE, sunset: DEFAULT_SUNSET };
  }

  /**
   * Get theme based on current time vs sunrise/sunset
   * @param {number} sunrise - Hour of sunrise
   * @param {number} sunset - Hour of sunset
   * @returns {'dark'|'light'}
   */
  function getThemeByTime(sunrise = DEFAULT_SUNRISE, sunset = DEFAULT_SUNSET) {
    const now = new Date();
    const currentHour = now.getHours() + now.getMinutes() / 60;
    
    // Light theme during daytime (between sunrise and sunset)
    if (currentHour >= sunrise && currentHour < sunset) {
      return 'light';
    }
    return 'dark';
  }

  /**
   * Check and update sunrise theme if needed
   */
  async function updateSunriseTheme() {
    const pref = getSavedTheme();
    if (pref !== 'sunrise') return;

    const times = await getSunriseSunset();
    const effective = getThemeByTime(times.sunrise, times.sunset);
    
    const html = document.documentElement;
    const currentEffective = html.getAttribute('data-theme');
    
    if (currentEffective !== effective) {
      applyTheme('sunrise', true);
    }
  }

  // Timer for sunrise mode updates
  let sunriseTimer = null;

  /**
   * Start/stop sunrise mode timer
   * @param {boolean} enable
   */
  function manageSunriseTimer(enable) {
    if (sunriseTimer) {
      clearInterval(sunriseTimer);
      sunriseTimer = null;
    }
    
    if (enable) {
      // Check every minute for theme changes
      sunriseTimer = setInterval(updateSunriseTheme, 60000);
    }
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
   * Get the effective theme (resolving 'auto' and 'sunrise' to actual theme)
   * @param {'dark'|'light'|'auto'|'sunrise'} preference
   * @returns {'dark'|'light'}
   */
  function getEffectiveTheme(preference) {
    if (preference === 'auto') {
      return getSystemPreference();
    }
    if (preference === 'sunrise') {
      const cached = getCachedSunriseData();
      if (cached) {
        return getThemeByTime(cached.sunrise, cached.sunset);
      }
      return getThemeByTime();
    }
    return preference || 'dark';
  }

  /**
   * Apply theme to the document
   * @param {'dark'|'light'|'auto'|'sunrise'} preference - User preference (including auto/sunrise)
   * @param {boolean} [withTransition=true] - Whether to animate the transition
   */
  function applyTheme(preference, withTransition = true) {
    const html = document.documentElement;
    const effectiveTheme = getEffectiveTheme(preference);
    
    // Store the preference (including auto/sunrise)
    html.setAttribute('data-theme-preference', preference);
    
    // Manage sunrise timer
    manageSunriseTimer(preference === 'sunrise');
    
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
    
    // If sunrise mode, fetch real sunrise/sunset data asynchronously
    if (preference === 'sunrise') {
      getSunriseSunset().then(times => {
        const newEffective = getThemeByTime(times.sunrise, times.sunset);
        if (newEffective !== effectiveTheme) {
          html.classList.add('theme-transitioning');
          html.setAttribute('data-theme', newEffective);
          updateThemeColor(newEffective);
          setTimeout(() => html.classList.remove('theme-transitioning'), 400);
        }
      });
    }
    
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

  // ===== ACCENT COLOR MANAGEMENT =====

  /**
   * Get the saved accent color from localStorage
   * @returns {string}
   */
  function getSavedAccent() {
    try {
      const saved = localStorage.getItem(ACCENT_STORAGE_KEY);
      if (saved && ACCENTS.includes(saved)) {
        return saved;
      }
    } catch (e) {}
    return 'indigo'; // Default accent
  }

  /**
   * Save accent color to localStorage
   * @param {string} accent
   */
  function saveAccent(accent) {
    try {
      localStorage.setItem(ACCENT_STORAGE_KEY, accent);
    } catch (e) {}
  }

  /**
   * Apply accent color to the document
   * @param {string} accent - Accent color name
   * @param {boolean} [withTransition=true] - Whether to animate the transition
   */
  function applyAccent(accent, withTransition = true) {
    if (!ACCENTS.includes(accent)) {
      console.warn('Invalid accent color:', accent);
      return;
    }

    const html = document.documentElement;

    if (withTransition && !html.classList.contains('theme-loading')) {
      html.classList.add('theme-transitioning');
      setTimeout(() => html.classList.remove('theme-transitioning'), 400);
    }

    html.setAttribute('data-accent', accent);

    // Dispatch custom event for any listeners
    window.dispatchEvent(new CustomEvent('accentchange', {
      detail: { accent }
    }));
  }

  /**
   * Set a specific accent color
   * @param {string} accent - Accent color name
   */
  function setAccent(accent) {
    if (!ACCENTS.includes(accent)) {
      console.warn('Invalid accent color:', accent);
      return;
    }

    saveAccent(accent);
    applyAccent(accent, true);
    updateAccentSelector(accent);
  }

  /**
   * Get current accent color
   * @returns {string}
   */
  function getAccent() {
    return getSavedAccent();
  }

  /**
   * Update accent selector UI (for settings page)
   * @param {string} accent - Current accent color
   */
  function updateAccentSelector(accent) {
    const options = document.querySelectorAll('.accent-option');
    options.forEach(option => {
      const a = option.getAttribute('data-accent');
      option.classList.toggle('active', a === accent);
      option.setAttribute('aria-pressed', a === accent);
    });

    // Update description if present
    const desc = document.getElementById('accent-description');
    if (desc) {
      const name = ACCENT_NAMES[accent] || 'Indigo';
      desc.textContent = `Couleur ${name} appliquée aux boutons et éléments interactifs.`;
    }
  }

  /**
   * Initialize accent color on page load
   */
  function initAccent() {
    const accent = getSavedAccent();
    applyAccent(accent, false);
  }

  // Auto-initialize if script is loaded after DOM is ready
  if (document.readyState === 'loading') {
    // DOM not ready, wait for it
    document.addEventListener('DOMContentLoaded', () => {
      // Update any theme selectors on the page
      const theme = getTheme();
      updateThemeSelector(theme.preference);
      
      // Update any accent selectors on the page
      const accent = getAccent();
      updateAccentSelector(accent);
    });
  } else {
    // DOM already ready
    const theme = getTheme();
    updateThemeSelector(theme.preference);
    
    const accent = getAccent();
    updateAccentSelector(accent);
  }

  // Initialize theme and accent immediately (runs synchronously)
  initTheme();
  initAccent();

  // Expose API globally
  window.CinqTheme = {
    toggle: toggleTheme,
    set: setTheme,
    get: getTheme,
    init: initTheme,
    getSystemPreference,
    getSunriseSunset,
    updateSelector: updateThemeSelector,
    THEMES,
    // Accent API
    setAccent,
    getAccent,
    updateAccentSelector,
    ACCENTS,
    ACCENT_NAMES
  };

  // Also expose simple toggleTheme function for onclick handlers
  window.toggleTheme = toggleTheme;
  window.setTheme = setTheme;
  window.setAccent = setAccent;

})();
