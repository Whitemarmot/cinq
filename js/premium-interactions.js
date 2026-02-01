/**
 * CINQ - Premium Interactions Controller
 * ======================================
 * Gère les micro-interactions premium, haptic feedback et animations
 * Léger, performant, accessible
 */

const CinqPremiumInteractions = (function() {
  'use strict';

  // ============================================
  // Configuration
  // ============================================
  const CONFIG = {
    // Respecter les préférences de mouvement réduit
    respectReducedMotion: true,
    
    // Support du haptic feedback
    hapticSupport: 'vibrate' in navigator,
    
    // Délais pour les animations
    delays: {
      fast: 150,
      normal: 250,
      slow: 400
    },
    
    // Patterns de vibration pour haptic feedback
    hapticPatterns: {
      light: [10],
      medium: [20],
      heavy: [30, 20, 30],
      success: [10, 50, 10],
      error: [100, 50, 100]
    }
  };

  // ============================================
  // État global
  // ============================================
  let isReducedMotion = false;
  let interactionQueue = new Map();
  let animationFrameId = null;

  // ============================================
  // Utilitaires
  // ============================================
  
  /**
   * Vérifie si l'utilisateur préfère un mouvement réduit
   */
  function checkReducedMotion() {
    if (CONFIG.respectReducedMotion) {
      const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      isReducedMotion = mediaQuery.matches;
      
      // Écouter les changements
      mediaQuery.addEventListener('change', (e) => {
        isReducedMotion = e.matches;
      });
    }
    return isReducedMotion;
  }

  /**
   * Déclenche un haptic feedback
   */
  function triggerHaptic(pattern = 'light') {
    if (!CONFIG.hapticSupport || isReducedMotion) return;
    
    const vibrationPattern = CONFIG.hapticPatterns[pattern] || CONFIG.hapticPatterns.light;
    
    try {
      navigator.vibrate(vibrationPattern);
    } catch (error) {
      console.warn('Haptic feedback non supporté:', error);
    }
  }

  /**
   * Ajoute une classe temporairement
   */
  function addTemporaryClass(element, className, duration = CONFIG.delays.normal) {
    if (!element || isReducedMotion) return;
    
    element.classList.add(className);
    setTimeout(() => {
      element.classList.remove(className);
    }, duration);
  }

  /**
   * Anime un élément avec une promesse
   */
  function animateElement(element, animation, options = {}) {
    return new Promise((resolve) => {
      if (!element || isReducedMotion) {
        resolve();
        return;
      }

      const defaultOptions = {
        duration: CONFIG.delays.normal,
        easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
        fill: 'forwards'
      };

      const finalOptions = { ...defaultOptions, ...options };
      
      const anim = element.animate(animation, finalOptions);
      
      anim.addEventListener('finish', () => resolve());
      anim.addEventListener('cancel', () => resolve());
    });
  }

  // ============================================
  // 🚀 Animations d'envoi de message
  // ============================================
  
  /**
   * Animation whoosh pour l'envoi de message
   */
  function animateMessageSend(messageElement, inputElement) {
    if (!messageElement) return Promise.resolve();

    return new Promise(async (resolve) => {
      // 1. Animation de préparation sur l'input
      if (inputElement) {
        addTemporaryClass(inputElement, 'haptic-light');
        triggerHaptic('light');
      }

      // 2. Clone du message pour l'animation
      const messageClone = messageElement.cloneNode(true);
      messageClone.style.position = 'absolute';
      messageClone.style.zIndex = '9999';
      
      const rect = messageElement.getBoundingClientRect();
      messageClone.style.left = rect.left + 'px';
      messageClone.style.top = rect.top + 'px';
      messageClone.style.width = rect.width + 'px';
      
      document.body.appendChild(messageClone);

      // 3. Animation whoosh
      await animateElement(messageClone, [
        { 
          transform: 'scale(1) translateY(0)', 
          opacity: 1 
        },
        { 
          transform: 'scale(0.8) translateY(-30px)', 
          opacity: 0 
        }
      ], { 
        duration: CONFIG.delays.slow,
        easing: 'cubic-bezier(0.16, 1, 0.3, 1)'
      });

      // 4. Nettoyage
      document.body.removeChild(messageClone);
      
      // 5. Animation d'apparition du vrai message
      messageElement.style.transform = 'scale(1.1)';
      messageElement.style.opacity = '0';
      
      await animateElement(messageElement, [
        { transform: 'scale(1.1)', opacity: 0 },
        { transform: 'scale(1)', opacity: 1 }
      ], {
        duration: CONFIG.delays.normal,
        easing: 'cubic-bezier(0.34, 1.25, 0.64, 1)'
      });

      // Haptic feedback de succès
      triggerHaptic('success');
      
      resolve();
    });
  }

  /**
   * Affiche l'indicateur de frappe
   */
  function showTypingIndicator(container, userName = 'Quelqu\'un') {
    if (!container) return null;

    const indicator = document.createElement('div');
    indicator.className = 'typing-indicator';
    indicator.innerHTML = `
      <span class="typing-text">${userName} écrit...</span>
      <div class="typing-dots">
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
      </div>
    `;

    container.appendChild(indicator);

    // Animation d'entrée
    animateElement(indicator, [
      { opacity: 0, transform: 'translateY(10px)' },
      { opacity: 1, transform: 'translateY(0)' }
    ], { duration: CONFIG.delays.fast });

    return indicator;
  }

  /**
   * Masque l'indicateur de frappe
   */
  function hideTypingIndicator(indicator) {
    if (!indicator) return Promise.resolve();

    return animateElement(indicator, [
      { opacity: 1, transform: 'translateY(0)' },
      { opacity: 0, transform: 'translateY(-10px)' }
    ], { duration: CONFIG.delays.fast }).then(() => {
      indicator.remove();
    });
  }

  // ============================================
  // 👥 Animations de contacts
  // ============================================
  
  /**
   * Animation d'ajout de contact
   */
  function animateContactAdd(contactElement) {
    if (!contactElement) return Promise.resolve();

    triggerHaptic('medium');
    
    return animateElement(contactElement, [
      { 
        transform: 'scale(0) rotate(180deg)', 
        opacity: 0 
      },
      { 
        transform: 'scale(1.15) rotate(-10deg)', 
        opacity: 1,
        offset: 0.6
      },
      { 
        transform: 'scale(1) rotate(0deg)', 
        opacity: 1 
      }
    ], {
      duration: 600,
      easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)'
    });
  }

  /**
   * Animation de suppression de contact
   */
  function animateContactRemove(contactElement) {
    if (!contactElement) return Promise.resolve();

    triggerHaptic('heavy');
    
    return animateElement(contactElement, [
      { 
        transform: 'scale(1) rotate(0deg)', 
        opacity: 1 
      },
      { 
        transform: 'scale(1.1) rotate(5deg)', 
        opacity: 0.7,
        offset: 0.5
      },
      { 
        transform: 'scale(0) rotate(45deg)', 
        opacity: 0 
      }
    ], {
      duration: 400,
      easing: 'cubic-bezier(0.16, 1, 0.3, 1)'
    }).then(() => {
      contactElement.remove();
    });
  }

  /**
   * Animation de hover sur contact
   */
  function setupContactHover(contactElement) {
    if (!contactElement) return;

    const avatar = contactElement.querySelector('.contact-avatar, .avatar');
    
    contactElement.addEventListener('mouseenter', () => {
      if (isReducedMotion) return;
      
      triggerHaptic('light');
      addTemporaryClass(contactElement, 'contact-hover-active', 200);
    });

    contactElement.addEventListener('mouseleave', () => {
      contactElement.classList.remove('contact-hover-active');
    });

    // Animation sur l'avatar
    if (avatar) {
      avatar.addEventListener('click', () => {
        triggerHaptic('medium');
        addTemporaryClass(avatar, 'haptic-medium', CONFIG.delays.fast);
      });
    }
  }

  // ============================================
  // 💀 Loading Skeletons
  // ============================================
  
  /**
   * Crée un skeleton loader
   */
  function createSkeleton(type = 'text', options = {}) {
    const skeleton = document.createElement('div');
    skeleton.className = `skeleton skeleton-${type}`;
    
    // Options spécifiques par type
    switch (type) {
      case 'text':
        skeleton.classList.add(options.width || 'medium');
        break;
      case 'avatar':
        if (options.size) skeleton.style.setProperty('--size', options.size);
        break;
      case 'card':
        if (options.height) skeleton.style.height = options.height;
        break;
      case 'message':
        skeleton.innerHTML = `
          <div class="skeleton skeleton-avatar"></div>
          <div class="skeleton-content">
            <div class="skeleton skeleton-text short"></div>
            <div class="skeleton skeleton-text medium"></div>
          </div>
        `;
        break;
    }

    return skeleton;
  }

  /**
   * Remplace un skeleton par le contenu réel
   */
  function replaceSkeleton(skeletonElement, realElement) {
    if (!skeletonElement || !realElement) return Promise.resolve();

    return new Promise((resolve) => {
      // Animation de fondu
      animateElement(skeletonElement, [
        { opacity: 1 },
        { opacity: 0 }
      ], { duration: CONFIG.delays.fast }).then(() => {
        
        // Remplace le skeleton par le vrai contenu
        skeletonElement.parentNode.replaceChild(realElement, skeletonElement);
        
        // Animation d'apparition du contenu
        realElement.style.opacity = '0';
        animateElement(realElement, [
          { opacity: 0, transform: 'translateY(5px)' },
          { opacity: 1, transform: 'translateY(0)' }
        ], { duration: CONFIG.delays.normal }).then(() => {
          resolve();
        });
      });
    });
  }

  // ============================================
  // 🎯 Interactions spéciales
  // ============================================
  
  /**
   * Animation de like/favori
   */
  function animateLike(buttonElement) {
    if (!buttonElement) return;

    triggerHaptic('medium');
    addTemporaryClass(buttonElement, 'heart-animation', 300);
    
    // Particules de coeur (optionnel)
    if (typeof CinqConfetti !== 'undefined') {
      CinqConfetti.fireHearts(buttonElement.getBoundingClientRect());
    }
  }

  /**
   * Animation de bookmark
   */
  function animateBookmark(buttonElement) {
    if (!buttonElement) return;

    triggerHaptic('light');
    addTemporaryClass(buttonElement, 'bookmark-animation', 400);
  }

  /**
   * Animation de notification
   */
  function animateNotification(notificationElement) {
    if (!notificationElement) return;

    triggerHaptic('heavy');
    addTemporaryClass(notificationElement, 'notification-bounce', 800);
  }

  // ============================================
  // 🎨 Effets visuels
  // ============================================
  
  /**
   * Effet ripple sur click
   */
  function addRippleEffect(element, event) {
    if (!element || isReducedMotion) return;

    const ripple = document.createElement('div');
    ripple.className = 'ripple-effect';
    
    const rect = element.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const x = event.clientX - rect.left - size / 2;
    const y = event.clientY - rect.top - size / 2;
    
    ripple.style.cssText = `
      position: absolute;
      width: ${size}px;
      height: ${size}px;
      left: ${x}px;
      top: ${y}px;
      background: radial-gradient(circle, rgba(255,255,255,0.3) 0%, transparent 70%);
      border-radius: 50%;
      transform: scale(0);
      pointer-events: none;
      z-index: 1000;
    `;
    
    element.appendChild(ripple);
    
    // Animation du ripple
    animateElement(ripple, [
      { transform: 'scale(0)', opacity: 1 },
      { transform: 'scale(2)', opacity: 0 }
    ], { duration: 500 }).then(() => {
      ripple.remove();
    });
  }

  // ============================================
  // 🚀 Auto-setup et bindings
  // ============================================
  
  /**
   * Configuration automatique des interactions
   */
  function autoSetup() {
    // Setup des contacts
    document.querySelectorAll('.contact-card, [data-contact]').forEach(setupContactHover);
    
    // Setup des boutons avec haptic feedback
    document.querySelectorAll('button, [role="button"]').forEach(button => {
      button.addEventListener('click', (e) => {
        triggerHaptic('light');
        addTemporaryClass(button, 'haptic-light', CONFIG.delays.fast);
        
        // Ripple effect pour certains boutons
        if (button.classList.contains('ripple') || button.dataset.ripple !== undefined) {
          addRippleEffect(button, e);
        }
      });
    });

    // Setup des liens avec feedback
    document.querySelectorAll('a[href], [data-link]').forEach(link => {
      link.addEventListener('click', () => {
        triggerHaptic('light');
      });
    });

    // Setup des inputs avec feedback
    document.querySelectorAll('input, textarea, select').forEach(input => {
      input.addEventListener('focus', () => {
        triggerHaptic('light');
      });
      
      input.addEventListener('input', () => {
        if (input.value.length % 10 === 0 && input.value.length > 0) {
          triggerHaptic('light');
        }
      });
    });

    // Setup des éléments interactifs
    document.querySelectorAll('[data-interactive]').forEach(element => {
      element.classList.add('interactive-hint');
    });
  }

  // ============================================
  // 🎬 API publique
  // ============================================
  
  /**
   * Initialisation du module
   */
  function init() {
    checkReducedMotion();
    
    // Setup automatique si le DOM est prêt
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', autoSetup);
    } else {
      autoSetup();
    }

    console.log('🎯 Cinq Premium Interactions initialized');
  }

  // API publique
  return {
    init,
    
    // Animations
    animateMessageSend,
    showTypingIndicator,
    hideTypingIndicator,
    animateContactAdd,
    animateContactRemove,
    setupContactHover,
    
    // Skeletons
    createSkeleton,
    replaceSkeleton,
    
    // Interactions
    animateLike,
    animateBookmark,
    animateNotification,
    addRippleEffect,
    
    // Haptic
    triggerHaptic,
    
    // Utilitaires
    addTemporaryClass,
    animateElement,
    
    // Configuration
    config: CONFIG
  };

})();

// Auto-initialisation
if (typeof window !== 'undefined') {
  CinqPremiumInteractions.init();
}

// Export pour les modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CinqPremiumInteractions;
}