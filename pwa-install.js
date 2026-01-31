/**
 * Cinq PWA Install Prompt
 * Smart install banner for mobile users
 */

(function() {
  'use strict';

  // Defer event for later use
  let deferredPrompt = null;
  let installBanner = null;
  
  // Don't show if already installed as PWA
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches 
    || window.navigator.standalone === true;
  
  // Storage key for dismiss tracking
  const DISMISS_KEY = 'cinq-pwa-dismiss';
  const DISMISS_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days

  // Check if user dismissed recently
  function wasRecentlyDismissed() {
    const dismissedAt = localStorage.getItem(DISMISS_KEY);
    if (!dismissedAt) return false;
    return Date.now() - parseInt(dismissedAt, 10) < DISMISS_DURATION;
  }

  // Mark as dismissed
  function markDismissed() {
    localStorage.setItem(DISMISS_KEY, Date.now().toString());
  }

  // Create and inject banner styles
  function injectStyles() {
    if (document.getElementById('pwa-install-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'pwa-install-styles';
    style.textContent = `
      .pwa-install-banner {
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
        border-top: 1px solid rgba(99, 102, 241, 0.3);
        padding: 16px;
        display: flex;
        align-items: center;
        gap: 12px;
        z-index: 10000;
        transform: translateY(100%);
        transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.4);
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      }
      
      .pwa-install-banner.visible {
        transform: translateY(0);
      }
      
      .pwa-install-banner.hiding {
        transform: translateY(100%);
      }
      
      .pwa-install-icon {
        width: 48px;
        height: 48px;
        border-radius: 12px;
        background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a855f7 100%);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 24px;
        font-weight: 800;
        color: white;
        flex-shrink: 0;
      }
      
      .pwa-install-content {
        flex: 1;
        min-width: 0;
      }
      
      .pwa-install-title {
        font-size: 15px;
        font-weight: 600;
        color: white;
        margin: 0 0 2px 0;
      }
      
      .pwa-install-subtitle {
        font-size: 13px;
        color: rgba(255, 255, 255, 0.7);
        margin: 0;
      }
      
      .pwa-install-actions {
        display: flex;
        gap: 8px;
        flex-shrink: 0;
      }
      
      .pwa-install-btn {
        padding: 10px 16px;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
        border: none;
        font-family: inherit;
      }
      
      .pwa-install-btn-primary {
        background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
        color: white;
      }
      
      .pwa-install-btn-primary:hover {
        transform: scale(1.02);
        box-shadow: 0 4px 12px rgba(99, 102, 241, 0.4);
      }
      
      .pwa-install-btn-secondary {
        background: rgba(255, 255, 255, 0.1);
        color: rgba(255, 255, 255, 0.8);
      }
      
      .pwa-install-btn-secondary:hover {
        background: rgba(255, 255, 255, 0.15);
      }
      
      /* iOS Safari hint */
      .pwa-ios-hint {
        position: fixed;
        bottom: 20px;
        left: 16px;
        right: 16px;
        background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
        border: 1px solid rgba(99, 102, 241, 0.3);
        border-radius: 16px;
        padding: 20px;
        z-index: 10000;
        transform: translateY(150%);
        transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
      }
      
      .pwa-ios-hint.visible {
        transform: translateY(0);
      }
      
      .pwa-ios-close {
        position: absolute;
        top: 12px;
        right: 12px;
        width: 28px;
        height: 28px;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.1);
        border: none;
        color: rgba(255, 255, 255, 0.6);
        font-size: 18px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      
      .pwa-ios-title {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 16px;
      }
      
      .pwa-ios-title h3 {
        font-size: 17px;
        font-weight: 600;
        color: white;
        margin: 0;
      }
      
      .pwa-ios-steps {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      
      .pwa-ios-step {
        display: flex;
        align-items: center;
        gap: 12px;
        color: rgba(255, 255, 255, 0.9);
        font-size: 14px;
      }
      
      .pwa-ios-step-icon {
        width: 32px;
        height: 32px;
        background: rgba(99, 102, 241, 0.2);
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 18px;
        flex-shrink: 0;
      }
      
      @media (max-width: 380px) {
        .pwa-install-subtitle { display: none; }
        .pwa-install-btn { padding: 8px 12px; font-size: 13px; }
      }
    `;
    document.head.appendChild(style);
  }

  // Create the banner element
  function createBanner() {
    const banner = document.createElement('div');
    banner.className = 'pwa-install-banner';
    banner.id = 'pwa-install-banner';
    banner.setAttribute('role', 'dialog');
    banner.setAttribute('aria-label', 'Installer l\'application');
    
    banner.innerHTML = `
      <div class="pwa-install-icon">5</div>
      <div class="pwa-install-content">
        <p class="pwa-install-title">Installer Cinq</p>
        <p class="pwa-install-subtitle">Accès rapide depuis ton écran d'accueil</p>
      </div>
      <div class="pwa-install-actions">
        <button class="pwa-install-btn pwa-install-btn-secondary" id="pwa-dismiss">
          Plus tard
        </button>
        <button class="pwa-install-btn pwa-install-btn-primary" id="pwa-install">
          Installer
        </button>
      </div>
    `;
    
    return banner;
  }

  // Create iOS hint modal
  function createIOSHint() {
    const hint = document.createElement('div');
    hint.className = 'pwa-ios-hint';
    hint.id = 'pwa-ios-hint';
    hint.setAttribute('role', 'dialog');
    hint.setAttribute('aria-label', 'Instructions d\'installation');
    
    hint.innerHTML = `
      <button class="pwa-ios-close" id="pwa-ios-close" aria-label="Fermer">×</button>
      <div class="pwa-ios-title">
        <div class="pwa-install-icon" style="width:40px;height:40px;font-size:20px;">5</div>
        <h3>Installer Cinq</h3>
      </div>
      <div class="pwa-ios-steps">
        <div class="pwa-ios-step">
          <span class="pwa-ios-step-icon">📤</span>
          <span>Appuie sur le bouton <strong>Partager</strong> en bas</span>
        </div>
        <div class="pwa-ios-step">
          <span class="pwa-ios-step-icon">➕</span>
          <span>Sélectionne <strong>Sur l'écran d'accueil</strong></span>
        </div>
        <div class="pwa-ios-step">
          <span class="pwa-ios-step-icon">✅</span>
          <span>Appuie sur <strong>Ajouter</strong></span>
        </div>
      </div>
    `;
    
    return hint;
  }

  // Show the banner
  function showBanner() {
    if (!installBanner) {
      injectStyles();
      installBanner = createBanner();
      document.body.appendChild(installBanner);
      
      // Install button
      document.getElementById('pwa-install').addEventListener('click', async () => {
        if (deferredPrompt) {
          deferredPrompt.prompt();
          const { outcome } = await deferredPrompt.userChoice;
          console.log('[PWA] Install outcome:', outcome);
          deferredPrompt = null;
        }
        hideBanner();
      });
      
      // Dismiss button
      document.getElementById('pwa-dismiss').addEventListener('click', () => {
        markDismissed();
        hideBanner();
      });
    }
    
    // Show with animation
    requestAnimationFrame(() => {
      installBanner.classList.add('visible');
    });
  }

  // Hide the banner
  function hideBanner() {
    if (installBanner) {
      installBanner.classList.remove('visible');
      installBanner.classList.add('hiding');
      setTimeout(() => {
        installBanner.remove();
        installBanner = null;
      }, 300);
    }
  }

  // Show iOS hint
  function showIOSHint() {
    injectStyles();
    const hint = createIOSHint();
    document.body.appendChild(hint);
    
    requestAnimationFrame(() => {
      hint.classList.add('visible');
    });
    
    document.getElementById('pwa-ios-close').addEventListener('click', () => {
      markDismissed();
      hint.classList.remove('visible');
      setTimeout(() => hint.remove(), 300);
    });
  }

  // Detect iOS Safari
  function isIOSSafari() {
    const ua = navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|OPiOS|EdgiOS/.test(ua);
    return isIOS && isSafari;
  }

  // Initialize
  function init() {
    // Skip if already installed or recently dismissed
    if (isStandalone || wasRecentlyDismissed()) {
      console.log('[PWA] Install prompt skipped (standalone or dismissed)');
      return;
    }

    // Listen for beforeinstallprompt (Chrome, Edge, Samsung Internet)
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt = e;
      console.log('[PWA] beforeinstallprompt fired');
      
      // Show after a short delay (don't interrupt first interaction)
      setTimeout(showBanner, 3000);
    });

    // iOS Safari doesn't fire beforeinstallprompt
    if (isIOSSafari()) {
      setTimeout(showIOSHint, 5000);
    }

    // Track successful install
    window.addEventListener('appinstalled', () => {
      console.log('[PWA] App installed successfully');
      deferredPrompt = null;
      hideBanner();
      
      // Optional: Track analytics
      if (typeof gtag === 'function') {
        gtag('event', 'pwa_install', { event_category: 'engagement' });
      }
    });
  }

  // Run when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
