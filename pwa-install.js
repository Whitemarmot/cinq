/**
 * ==========================================================================
 * CINQ - PWA Install Prompt v2.0
 * ==========================================================================
 * 
 * Elegant install experience with:
 * - Animated install banner with glassmorphism
 * - iOS Safari instructions
 * - Install benefits preview
 * - Smart timing (engagement-based)
 * - A11y compliant
 * 
 * @author Cinq Team
 * @version 2.0.0
 */

(function() {
  'use strict';

  // ============================================
  // Configuration
  // ============================================
  
  const CONFIG = {
    // Timing
    SHOW_DELAY: 2000,           // Initial delay before showing (ms)
    ENGAGEMENT_TIME: 15000,      // Time user must be active before showing
    DISMISS_DURATION: 7 * 24 * 60 * 60 * 1000, // 7 days
    
    // Storage keys
    DISMISS_KEY: 'cinq-pwa-dismiss-v2',
    INSTALL_COUNT_KEY: 'cinq-pwa-prompt-count',
    
    // Limits
    MAX_PROMPTS: 3  // Max times to show after dismissal
  };

  // ============================================
  // State
  // ============================================
  
  let deferredPrompt = null;
  let installUI = null;
  let engagementTimer = null;
  let isEngaged = false;
  
  // Detect environment
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches 
    || window.navigator.standalone === true;
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) 
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isIOSSafari = isIOS && /Safari/.test(navigator.userAgent) 
    && !/CriOS|FxiOS|OPiOS|EdgiOS/.test(navigator.userAgent);

  // ============================================
  // Styles
  // ============================================
  
  function injectStyles() {
    if (document.getElementById('pwa-install-styles-v2')) return;
    
    const style = document.createElement('style');
    style.id = 'pwa-install-styles-v2';
    style.textContent = `
      /* ===== PWA Install Modal ===== */
      .pwa-install-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.6);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        z-index: 10000;
        opacity: 0;
        visibility: hidden;
        transition: all 0.3s ease;
      }
      
      .pwa-install-overlay.visible {
        opacity: 1;
        visibility: visible;
      }
      
      .pwa-install-modal {
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        max-width: 420px;
        margin: 0 auto;
        background: linear-gradient(135deg, rgba(26, 26, 46, 0.98) 0%, rgba(22, 33, 62, 0.98) 100%);
        border: 1px solid rgba(99, 102, 241, 0.2);
        border-bottom: none;
        border-radius: 24px 24px 0 0;
        padding: 24px 24px 32px;
        z-index: 10001;
        transform: translateY(100%);
        transition: transform 0.4s cubic-bezier(0.32, 0.72, 0, 1);
        box-shadow: 0 -8px 40px rgba(0, 0, 0, 0.5);
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      }
      
      .pwa-install-overlay.visible .pwa-install-modal {
        transform: translateY(0);
      }
      
      /* Handle bar */
      .pwa-modal-handle {
        width: 40px;
        height: 4px;
        background: rgba(255, 255, 255, 0.2);
        border-radius: 2px;
        margin: 0 auto 20px;
      }
      
      /* Header */
      .pwa-modal-header {
        display: flex;
        align-items: center;
        gap: 16px;
        margin-bottom: 20px;
      }
      
      .pwa-app-icon {
        width: 64px;
        height: 64px;
        border-radius: 16px;
        background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a855f7 100%);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 32px;
        font-weight: 800;
        color: white;
        box-shadow: 0 4px 16px rgba(99, 102, 241, 0.4);
        flex-shrink: 0;
      }
      
      .pwa-app-info h2 {
        font-size: 20px;
        font-weight: 700;
        color: white;
        margin: 0 0 4px 0;
      }
      
      .pwa-app-info p {
        font-size: 14px;
        color: rgba(255, 255, 255, 0.6);
        margin: 0;
      }
      
      /* Benefits */
      .pwa-benefits {
        display: flex;
        flex-direction: column;
        gap: 12px;
        margin-bottom: 24px;
        padding: 16px;
        background: rgba(255, 255, 255, 0.03);
        border-radius: 16px;
        border: 1px solid rgba(255, 255, 255, 0.05);
      }
      
      .pwa-benefit {
        display: flex;
        align-items: center;
        gap: 12px;
        color: rgba(255, 255, 255, 0.9);
        font-size: 14px;
      }
      
      .pwa-benefit-icon {
        width: 36px;
        height: 36px;
        background: rgba(99, 102, 241, 0.15);
        border-radius: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 18px;
        flex-shrink: 0;
      }
      
      .pwa-benefit-text strong {
        color: white;
        display: block;
        margin-bottom: 2px;
      }
      
      .pwa-benefit-text span {
        color: rgba(255, 255, 255, 0.5);
        font-size: 12px;
      }
      
      /* Actions */
      .pwa-modal-actions {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      
      .pwa-btn {
        width: 100%;
        padding: 16px 24px;
        border-radius: 14px;
        font-size: 16px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
        border: none;
        font-family: inherit;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
      }
      
      .pwa-btn-primary {
        background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
        color: white;
        box-shadow: 0 4px 16px rgba(99, 102, 241, 0.4);
      }
      
      .pwa-btn-primary:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 20px rgba(99, 102, 241, 0.5);
      }
      
      .pwa-btn-primary:active {
        transform: translateY(0);
      }
      
      .pwa-btn-secondary {
        background: transparent;
        color: rgba(255, 255, 255, 0.6);
        padding: 12px;
      }
      
      .pwa-btn-secondary:hover {
        color: rgba(255, 255, 255, 0.8);
      }
      
      /* ===== iOS Instructions ===== */
      .pwa-ios-modal {
        text-align: center;
      }
      
      .pwa-ios-illustration {
        margin: 0 auto 24px;
        width: 200px;
        height: 120px;
        background: rgba(255, 255, 255, 0.03);
        border-radius: 16px;
        display: flex;
        align-items: center;
        justify-content: center;
        position: relative;
        overflow: hidden;
      }
      
      .pwa-ios-phone {
        width: 80px;
        height: 100px;
        background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
        border: 2px solid rgba(255, 255, 255, 0.2);
        border-radius: 12px;
        position: relative;
      }
      
      .pwa-ios-share-icon {
        position: absolute;
        bottom: -10px;
        left: 50%;
        transform: translateX(-50%);
        font-size: 28px;
        animation: bounceUp 1.5s ease-in-out infinite;
      }
      
      @keyframes bounceUp {
        0%, 100% { transform: translateX(-50%) translateY(0); }
        50% { transform: translateX(-50%) translateY(-8px); }
      }
      
      .pwa-ios-steps {
        text-align: left;
        margin-bottom: 24px;
      }
      
      .pwa-ios-step {
        display: flex;
        align-items: flex-start;
        gap: 16px;
        padding: 16px 0;
        border-bottom: 1px solid rgba(255, 255, 255, 0.05);
      }
      
      .pwa-ios-step:last-child {
        border-bottom: none;
      }
      
      .pwa-ios-step-num {
        width: 32px;
        height: 32px;
        background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 14px;
        font-weight: 700;
        color: white;
        flex-shrink: 0;
      }
      
      .pwa-ios-step-content {
        flex: 1;
        padding-top: 4px;
      }
      
      .pwa-ios-step-content strong {
        color: white;
        font-size: 15px;
        display: block;
        margin-bottom: 4px;
      }
      
      .pwa-ios-step-content span {
        color: rgba(255, 255, 255, 0.5);
        font-size: 13px;
      }
      
      .pwa-ios-step-icon {
        font-size: 20px;
        margin-left: auto;
        align-self: center;
      }
      
      /* ===== Compact Banner (alternative) ===== */
      .pwa-banner-compact {
        position: fixed;
        bottom: 20px;
        left: 16px;
        right: 16px;
        max-width: 400px;
        margin: 0 auto;
        background: linear-gradient(135deg, rgba(26, 26, 46, 0.95) 0%, rgba(22, 33, 62, 0.95) 100%);
        border: 1px solid rgba(99, 102, 241, 0.3);
        border-radius: 16px;
        padding: 16px;
        z-index: 9999;
        display: flex;
        align-items: center;
        gap: 12px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        transform: translateY(120%);
        transition: transform 0.4s cubic-bezier(0.32, 0.72, 0, 1);
      }
      
      .pwa-banner-compact.visible {
        transform: translateY(0);
      }
      
      .pwa-banner-icon {
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
      
      .pwa-banner-content {
        flex: 1;
        min-width: 0;
      }
      
      .pwa-banner-title {
        font-size: 15px;
        font-weight: 600;
        color: white;
        margin: 0 0 2px 0;
      }
      
      .pwa-banner-subtitle {
        font-size: 13px;
        color: rgba(255, 255, 255, 0.6);
        margin: 0;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      
      .pwa-banner-actions {
        display: flex;
        gap: 8px;
        flex-shrink: 0;
      }
      
      .pwa-banner-btn {
        padding: 10px 16px;
        border-radius: 10px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
        border: none;
        font-family: inherit;
      }
      
      .pwa-banner-btn-primary {
        background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
        color: white;
      }
      
      .pwa-banner-btn-dismiss {
        background: transparent;
        color: rgba(255, 255, 255, 0.4);
        padding: 10px;
        font-size: 18px;
      }
      
      /* ===== Success Animation ===== */
      .pwa-success-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.8);
        z-index: 10002;
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0;
        visibility: hidden;
        transition: all 0.3s ease;
      }
      
      .pwa-success-overlay.visible {
        opacity: 1;
        visibility: visible;
      }
      
      .pwa-success-content {
        text-align: center;
        color: white;
      }
      
      .pwa-success-icon {
        font-size: 80px;
        animation: successPop 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
      }
      
      .pwa-success-text {
        font-size: 24px;
        font-weight: 700;
        margin-top: 16px;
      }
      
      @keyframes successPop {
        0% { transform: scale(0); }
        50% { transform: scale(1.2); }
        100% { transform: scale(1); }
      }
      
      /* ===== Responsive ===== */
      @media (max-width: 380px) {
        .pwa-install-modal {
          padding: 20px 16px 28px;
        }
        .pwa-app-icon {
          width: 52px;
          height: 52px;
          font-size: 26px;
        }
        .pwa-app-info h2 {
          font-size: 18px;
        }
        .pwa-benefit {
          font-size: 13px;
        }
        .pwa-benefit-icon {
          width: 32px;
          height: 32px;
          font-size: 16px;
        }
      }
    `;
    document.head.appendChild(style);
  }

  // ============================================
  // Storage Helpers
  // ============================================
  
  function wasRecentlyDismissed() {
    const dismissedAt = localStorage.getItem(CONFIG.DISMISS_KEY);
    if (!dismissedAt) return false;
    return Date.now() - parseInt(dismissedAt, 10) < CONFIG.DISMISS_DURATION;
  }

  function markDismissed() {
    localStorage.setItem(CONFIG.DISMISS_KEY, Date.now().toString());
    
    const count = parseInt(localStorage.getItem(CONFIG.INSTALL_COUNT_KEY) || '0', 10);
    localStorage.setItem(CONFIG.INSTALL_COUNT_KEY, (count + 1).toString());
  }
  
  function hasExceededPrompts() {
    const count = parseInt(localStorage.getItem(CONFIG.INSTALL_COUNT_KEY) || '0', 10);
    return count >= CONFIG.MAX_PROMPTS;
  }

  // ============================================
  // UI Creation
  // ============================================
  
  function createInstallModal() {
    const overlay = document.createElement('div');
    overlay.className = 'pwa-install-overlay';
    overlay.id = 'pwa-install-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'pwa-modal-title');
    
    overlay.innerHTML = `
      <div class="pwa-install-modal">
        <div class="pwa-modal-handle"></div>
        
        <div class="pwa-modal-header">
          <div class="pwa-app-icon">5</div>
          <div class="pwa-app-info">
            <h2 id="pwa-modal-title">Installer Cinq</h2>
            <p>L'anti-réseau social</p>
          </div>
        </div>
        
        <div class="pwa-benefits">
          <div class="pwa-benefit">
            <span class="pwa-benefit-icon">⚡</span>
            <div class="pwa-benefit-text">
              <strong>Accès instantané</strong>
              <span>Depuis ton écran d'accueil</span>
            </div>
          </div>
          <div class="pwa-benefit">
            <span class="pwa-benefit-icon">🔔</span>
            <div class="pwa-benefit-text">
              <strong>Notifications</strong>
              <span>Sois alerté quand tes proches t'écrivent</span>
            </div>
          </div>
          <div class="pwa-benefit">
            <span class="pwa-benefit-icon">📴</span>
            <div class="pwa-benefit-text">
              <strong>Fonctionne hors ligne</strong>
              <span>Tes messages sont envoyés dès que tu es connecté</span>
            </div>
          </div>
        </div>
        
        <div class="pwa-modal-actions">
          <button class="pwa-btn pwa-btn-primary" id="pwa-install-btn">
            <span>📲</span> Installer l'application
          </button>
          <button class="pwa-btn pwa-btn-secondary" id="pwa-dismiss-btn">
            Plus tard
          </button>
        </div>
      </div>
    `;
    
    return overlay;
  }
  
  function createIOSModal() {
    const overlay = document.createElement('div');
    overlay.className = 'pwa-install-overlay';
    overlay.id = 'pwa-install-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'pwa-ios-title');
    
    overlay.innerHTML = `
      <div class="pwa-install-modal pwa-ios-modal">
        <div class="pwa-modal-handle"></div>
        
        <div class="pwa-modal-header" style="justify-content: center;">
          <div class="pwa-app-icon">5</div>
          <div class="pwa-app-info">
            <h2 id="pwa-ios-title">Installer Cinq</h2>
            <p>Ajoute l'app à ton écran d'accueil</p>
          </div>
        </div>
        
        <div class="pwa-ios-illustration">
          <div class="pwa-ios-phone"></div>
          <span class="pwa-ios-share-icon">📤</span>
        </div>
        
        <div class="pwa-ios-steps">
          <div class="pwa-ios-step">
            <span class="pwa-ios-step-num">1</span>
            <div class="pwa-ios-step-content">
              <strong>Appuie sur Partager</strong>
              <span>Le bouton en bas de Safari</span>
            </div>
            <span class="pwa-ios-step-icon">📤</span>
          </div>
          <div class="pwa-ios-step">
            <span class="pwa-ios-step-num">2</span>
            <div class="pwa-ios-step-content">
              <strong>Sur l'écran d'accueil</strong>
              <span>Fais défiler et trouve cette option</span>
            </div>
            <span class="pwa-ios-step-icon">➕</span>
          </div>
          <div class="pwa-ios-step">
            <span class="pwa-ios-step-num">3</span>
            <div class="pwa-ios-step-content">
              <strong>Appuie sur Ajouter</strong>
              <span>Et voilà, Cinq est installé !</span>
            </div>
            <span class="pwa-ios-step-icon">✅</span>
          </div>
        </div>
        
        <div class="pwa-modal-actions">
          <button class="pwa-btn pwa-btn-primary" id="pwa-ios-ok-btn">
            J'ai compris
          </button>
        </div>
      </div>
    `;
    
    return overlay;
  }
  
  function createSuccessOverlay() {
    const overlay = document.createElement('div');
    overlay.className = 'pwa-success-overlay';
    overlay.id = 'pwa-success-overlay';
    
    overlay.innerHTML = `
      <div class="pwa-success-content">
        <div class="pwa-success-icon">🎉</div>
        <div class="pwa-success-text">C'est installé !</div>
      </div>
    `;
    
    return overlay;
  }

  // ============================================
  // UI Control
  // ============================================
  
  function showInstallUI() {
    injectStyles();
    
    if (installUI) return;
    
    installUI = isIOSSafari ? createIOSModal() : createInstallModal();
    document.body.appendChild(installUI);
    
    // Trap focus
    const firstBtn = installUI.querySelector('button');
    firstBtn?.focus();
    
    // Show with animation
    requestAnimationFrame(() => {
      installUI.classList.add('visible');
    });
    
    // Event listeners
    if (isIOSSafari) {
      document.getElementById('pwa-ios-ok-btn')?.addEventListener('click', () => {
        markDismissed();
        hideInstallUI();
      });
    } else {
      document.getElementById('pwa-install-btn')?.addEventListener('click', handleInstall);
      document.getElementById('pwa-dismiss-btn')?.addEventListener('click', () => {
        markDismissed();
        hideInstallUI();
      });
    }
    
    // Close on overlay click
    installUI.addEventListener('click', (e) => {
      if (e.target === installUI) {
        markDismissed();
        hideInstallUI();
      }
    });
    
    // Close on Escape
    document.addEventListener('keydown', handleEscape);
  }
  
  function hideInstallUI() {
    if (!installUI) return;
    
    installUI.classList.remove('visible');
    document.removeEventListener('keydown', handleEscape);
    
    setTimeout(() => {
      installUI?.remove();
      installUI = null;
    }, 400);
  }
  
  function handleEscape(e) {
    if (e.key === 'Escape') {
      markDismissed();
      hideInstallUI();
    }
  }
  
  async function handleInstall() {
    if (!deferredPrompt) return;
    
    try {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      
      console.log('[PWA] Install outcome:', outcome);
      
      if (outcome === 'accepted') {
        showSuccessAnimation();
      }
      
      deferredPrompt = null;
      hideInstallUI();
      
    } catch (err) {
      console.error('[PWA] Install error:', err);
    }
  }
  
  function showSuccessAnimation() {
    const success = createSuccessOverlay();
    document.body.appendChild(success);
    
    requestAnimationFrame(() => {
      success.classList.add('visible');
    });
    
    setTimeout(() => {
      success.classList.remove('visible');
      setTimeout(() => success.remove(), 300);
    }, 2000);
  }

  // ============================================
  // Engagement Tracking
  // ============================================
  
  function startEngagementTimer() {
    if (engagementTimer) return;
    
    engagementTimer = setTimeout(() => {
      isEngaged = true;
      
      // If we have a deferred prompt, show UI
      if (deferredPrompt) {
        showInstallUI();
      }
    }, CONFIG.ENGAGEMENT_TIME);
    
    // Reset timer on user activity
    ['click', 'scroll', 'keydown', 'touchstart'].forEach(event => {
      document.addEventListener(event, resetEngagementTimer, { once: true, passive: true });
    });
  }
  
  function resetEngagementTimer() {
    if (engagementTimer) {
      clearTimeout(engagementTimer);
      engagementTimer = null;
    }
    startEngagementTimer();
  }

  // ============================================
  // Initialization
  // ============================================
  
  function init() {
    // Skip if already installed
    if (isStandalone) {
      console.log('[PWA] Already installed as standalone');
      return;
    }
    
    // Skip if recently dismissed or exceeded prompts
    if (wasRecentlyDismissed() || hasExceededPrompts()) {
      console.log('[PWA] Prompt skipped (dismissed or exceeded)');
      return;
    }
    
    // Listen for beforeinstallprompt (Chrome, Edge, Samsung)
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt = e;
      console.log('[PWA] beforeinstallprompt received');
      
      // If user is already engaged, show immediately after delay
      if (isEngaged) {
        setTimeout(showInstallUI, CONFIG.SHOW_DELAY);
      }
    });
    
    // Start engagement tracking
    startEngagementTimer();
    
    // iOS Safari: show after engagement
    if (isIOSSafari) {
      const engagementCheck = setInterval(() => {
        if (isEngaged) {
          clearInterval(engagementCheck);
          setTimeout(showInstallUI, CONFIG.SHOW_DELAY);
        }
      }, 1000);
    }
    
    // Track successful install
    window.addEventListener('appinstalled', () => {
      console.log('[PWA] App installed successfully');
      deferredPrompt = null;
      hideInstallUI();
      showSuccessAnimation();
      
      // Analytics
      if (typeof gtag === 'function') {
        gtag('event', 'pwa_install', { 
          event_category: 'engagement',
          event_label: 'success'
        });
      }
    });
  }

  // ============================================
  // Public API
  // ============================================
  
  window.CinqPWA = {
    show: showInstallUI,
    hide: hideInstallUI,
    isInstallable: () => !!deferredPrompt || isIOSSafari,
    isInstalled: () => isStandalone
  };

  // Initialize
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
