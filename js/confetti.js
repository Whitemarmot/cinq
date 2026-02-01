/**
 * CINQ - Confetti Celebrations Module
 * ====================================
 * Celebratory confetti animations for special events:
 * - First post 🎉
 * - 5th contact (complete circle) 🎊
 * - Birthday celebrations 🎂
 * 
 * Uses canvas-confetti library
 * @see https://github.com/catdad/canvas-confetti
 */

const CinqConfetti = (function() {
  'use strict';

  // ============================================
  // Configuration
  // ============================================
  const CONFIG = {
    // Check if user prefers reduced motion
    respectReducedMotion: true,
    
    // Default confetti options
    defaults: {
      spread: 70,
      startVelocity: 30,
      decay: 0.94,
      scalar: 1,
      ticks: 200,
      origin: { y: 0.6 }
    },
    
    // Brand colors
    colors: {
      brand: ['#ff6b4a', '#ff8a6a', '#6366f1', '#8b5cf6', '#a855f7'],
      birthday: ['#fbbf24', '#fb923c', '#f87171', '#a78bfa', '#22c55e', '#60a5fa'],
      gold: ['#fbbf24', '#f59e0b', '#d97706', '#fcd34d', '#fef3c7'],
      rainbow: ['#ff6b6b', '#feca57', '#48dbfb', '#ff9ff3', '#54a0ff', '#5f27cd']
    }
  };

  // State
  let confettiLoaded = false;
  let confettiLib = null;
  let loadPromise = null;

  // ============================================
  // Utility Functions
  // ============================================
  
  /**
   * Check if user prefers reduced motion
   */
  function prefersReducedMotion() {
    if (!CONFIG.respectReducedMotion) return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  /**
   * Load canvas-confetti library dynamically
   */
  async function loadConfetti() {
    if (confettiLoaded && confettiLib) return confettiLib;
    if (loadPromise) return loadPromise;

    loadPromise = new Promise((resolve, reject) => {
      // Check if already loaded globally
      if (window.confetti) {
        confettiLib = window.confetti;
        confettiLoaded = true;
        resolve(confettiLib);
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/canvas-confetti@1.9.3/dist/confetti.browser.min.js';
      script.async = true;
      
      script.onload = () => {
        confettiLib = window.confetti;
        confettiLoaded = true;
        resolve(confettiLib);
      };
      
      script.onerror = () => {
        console.warn('[CinqConfetti] Failed to load confetti library');
        reject(new Error('Failed to load confetti'));
      };
      
      document.head.appendChild(script);
    });

    return loadPromise;
  }

  /**
   * Random number in range
   */
  function randomInRange(min, max) {
    return Math.random() * (max - min) + min;
  }

  // ============================================
  // Confetti Effects
  // ============================================

  /**
   * Basic confetti burst
   */
  async function burst(options = {}) {
    if (prefersReducedMotion()) return;
    
    try {
      const confetti = await loadConfetti();
      
      confetti({
        ...CONFIG.defaults,
        particleCount: options.particleCount || 100,
        spread: options.spread || 70,
        colors: options.colors || CONFIG.colors.brand,
        origin: options.origin || { x: 0.5, y: 0.6 },
        ...options
      });
    } catch (e) {
      console.warn('[CinqConfetti] Burst failed:', e);
    }
  }

  /**
   * 🎉 First Post Celebration
   * Celebratory burst from center with brand colors
   */
  async function firstPost() {
    if (prefersReducedMotion()) {
      // Just show a toast instead
      return;
    }

    try {
      const confetti = await loadConfetti();
      
      // Double burst for extra celebration
      const count = 150;
      const defaults = {
        origin: { y: 0.7 },
        colors: CONFIG.colors.brand
      };

      // First burst - left side
      confetti({
        ...defaults,
        particleCount: Math.floor(count / 2),
        angle: 60,
        spread: 55,
        origin: { x: 0 }
      });

      // Second burst - right side
      confetti({
        ...defaults,
        particleCount: Math.floor(count / 2),
        angle: 120,
        spread: 55,
        origin: { x: 1 }
      });

      // Center burst after a small delay
      setTimeout(() => {
        confetti({
          particleCount: 80,
          spread: 100,
          origin: { y: 0.6, x: 0.5 },
          colors: CONFIG.colors.brand,
          startVelocity: 45
        });
      }, 200);

    } catch (e) {
      console.warn('[CinqConfetti] First post celebration failed:', e);
    }
  }

  /**
   * 🎊 Fifth Contact Celebration (Complete Circle)
   * Special "fireworks" effect for completing the circle
   */
  async function fifthContact() {
    if (prefersReducedMotion()) return;

    try {
      const confetti = await loadConfetti();
      
      const duration = 3000;
      const animationEnd = Date.now() + duration;
      const colors = CONFIG.colors.gold;

      // Continuous fireworks effect
      const frame = () => {
        confetti({
          particleCount: 3,
          angle: 60,
          spread: 55,
          origin: { x: 0 },
          colors: colors
        });
        
        confetti({
          particleCount: 3,
          angle: 120,
          spread: 55,
          origin: { x: 1 },
          colors: colors
        });

        if (Date.now() < animationEnd) {
          requestAnimationFrame(frame);
        }
      };

      frame();

      // Big center burst at the start
      confetti({
        particleCount: 200,
        spread: 160,
        origin: { y: 0.5, x: 0.5 },
        colors: CONFIG.colors.rainbow,
        startVelocity: 50,
        gravity: 0.8,
        scalar: 1.2
      });

      // Star shapes for extra flair
      setTimeout(() => {
        confetti({
          particleCount: 50,
          spread: 360,
          origin: { y: 0.5, x: 0.5 },
          colors: CONFIG.colors.gold,
          shapes: ['star'],
          scalar: 1.5,
          ticks: 300
        });
      }, 500);

    } catch (e) {
      console.warn('[CinqConfetti] Fifth contact celebration failed:', e);
    }
  }

  /**
   * 🎂 Birthday Celebration
   * Festive balloon-like effect with birthday colors
   */
  async function birthday(contactName = '') {
    if (prefersReducedMotion()) return;

    try {
      const confetti = await loadConfetti();
      
      const duration = 4000;
      const animationEnd = Date.now() + duration;
      const colors = CONFIG.colors.birthday;

      // Continuous gentle confetti
      const frame = () => {
        const timeLeft = animationEnd - Date.now();
        
        confetti({
          particleCount: 2,
          angle: randomInRange(55, 125),
          spread: randomInRange(50, 70),
          origin: { x: Math.random() },
          colors: colors,
          gravity: 0.6,
          drift: randomInRange(-1, 1),
          scalar: randomInRange(0.8, 1.2)
        });

        if (timeLeft > 0) {
          requestAnimationFrame(frame);
        }
      };

      frame();

      // Initial burst from bottom
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.9, x: 0.5 },
        colors: colors,
        startVelocity: 50,
        gravity: 1.2
      });

      // Delayed side bursts
      setTimeout(() => {
        confetti({
          particleCount: 50,
          angle: 60,
          spread: 50,
          origin: { x: 0, y: 0.8 },
          colors: colors
        });
        confetti({
          particleCount: 50,
          angle: 120,
          spread: 50,
          origin: { x: 1, y: 0.8 },
          colors: colors
        });
      }, 1000);

    } catch (e) {
      console.warn('[CinqConfetti] Birthday celebration failed:', e);
    }
  }

  /**
   * 🌟 Generic celebration (for achievements, milestones)
   */
  async function celebrate(options = {}) {
    if (prefersReducedMotion()) return;

    const type = options.type || 'standard';
    
    switch (type) {
      case 'firstPost':
        return firstPost();
      case 'fifthContact':
        return fifthContact();
      case 'birthday':
        return birthday(options.name);
      default:
        return burst(options);
    }
  }

  /**
   * 🎆 Realistic confetti (school pride style)
   */
  async function schoolPride() {
    if (prefersReducedMotion()) return;

    try {
      const confetti = await loadConfetti();
      
      const end = Date.now() + 3000;
      const colors = CONFIG.colors.brand;

      const frame = () => {
        confetti({
          particleCount: 2,
          angle: 60,
          spread: 55,
          origin: { x: 0 },
          colors: colors
        });
        confetti({
          particleCount: 2,
          angle: 120,
          spread: 55,
          origin: { x: 1 },
          colors: colors
        });

        if (Date.now() < end) {
          requestAnimationFrame(frame);
        }
      };

      frame();
    } catch (e) {
      console.warn('[CinqConfetti] School pride failed:', e);
    }
  }

  /**
   * Preload the confetti library (call on page load)
   */
  async function preload() {
    try {
      await loadConfetti();
      console.log('[CinqConfetti] Library preloaded');
    } catch (e) {
      // Silent fail - will retry on first use
    }
  }

  // ============================================
  // Local Storage Helpers (track celebrations)
  // ============================================
  
  const STORAGE_KEY = 'cinq_celebrations';

  function getCelebrations() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
    } catch {
      return {};
    }
  }

  function setCelebration(key, value = true) {
    try {
      const celebrations = getCelebrations();
      celebrations[key] = value;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(celebrations));
    } catch (e) {
      // Storage full or disabled
    }
  }

  function hasCelebrated(key) {
    return getCelebrations()[key] === true;
  }

  /**
   * Trigger first post celebration if not already done
   */
  async function triggerFirstPostIfNeeded() {
    if (!hasCelebrated('firstPost')) {
      setCelebration('firstPost');
      await firstPost();
      return true;
    }
    return false;
  }

  /**
   * Trigger fifth contact celebration if not already done
   */
  async function triggerFifthContactIfNeeded() {
    if (!hasCelebrated('fifthContact')) {
      setCelebration('fifthContact');
      await fifthContact();
      return true;
    }
    return false;
  }

  // ============================================
  // Public API
  // ============================================
  return {
    // Core methods
    preload,
    burst,
    celebrate,
    
    // Specific celebrations
    firstPost,
    fifthContact,
    birthday,
    schoolPride,
    
    // Conditional celebrations (once per user)
    triggerFirstPostIfNeeded,
    triggerFifthContactIfNeeded,
    
    // State helpers
    hasCelebrated,
    setCelebration,
    
    // Check reduced motion preference
    prefersReducedMotion
  };

})();

// Global access
window.CinqConfetti = CinqConfetti;

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CinqConfetti;
}
