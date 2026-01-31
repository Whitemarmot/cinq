/**
 * CINQ - Elite Animation Engine v2
 * ==================================
 * Awwwards-level interactive animations
 * Zero dependencies, pure vanilla JS
 * GPU-accelerated, performance-first
 */

const CinqAnimations = (function() {
  'use strict';

  // ============================================
  // Configuration
  // ============================================
  const CONFIG = {
    // Intersection Observer
    revealThreshold: 0.15,
    revealRootMargin: '0px 0px -50px 0px',
    
    // Parallax
    parallaxIntensity: 0.03,
    parallaxSmoothing: 0.1,
    
    // Magnetic effect
    magneticStrength: 0.35,
    magneticRadius: 100,
    
    // Tilt effect
    tiltMaxAngle: 10,
    tiltPerspective: 1000,
    
    // Ripple
    rippleDuration: 600,
    
    // Text reveal
    letterDelay: 30,
    wordDelay: 80,
    
    // Particles
    heroParticleCount: 12,
  };

  // State
  let mouseX = 0;
  let mouseY = 0;
  let scrollY = 0;
  let isReducedMotion = false;
  let rafId = null;

  // ============================================
  // Utility Functions
  // ============================================
  
  function lerp(start, end, factor) {
    return start + (end - start) * factor;
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function mapRange(value, inMin, inMax, outMin, outMax) {
    return ((value - inMin) * (outMax - outMin)) / (inMax - inMin) + outMin;
  }

  function prefersReducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function debounce(func, wait) {
    let timeout;
    return function(...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  }

  function throttle(func, limit) {
    let inThrottle;
    return function(...args) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }

  // ============================================
  // 🌟 Hero Particles
  // ============================================
  function initHeroParticles() {
    if (isReducedMotion) return;

    const heroContainer = document.querySelector('.hero-logo, .five')?.parentElement;
    if (!heroContainer) return;

    heroContainer.style.position = 'relative';

    // Clear existing particles
    heroContainer.querySelectorAll('.hero-particle').forEach(p => p.remove());

    // Create orbital particles
    for (let i = 0; i < CONFIG.heroParticleCount; i++) {
      const particle = document.createElement('div');
      particle.className = 'hero-particle';
      
      const angle = (i / CONFIG.heroParticleCount) * Math.PI * 2;
      const radius = 70 + Math.random() * 40;
      const size = 4 + Math.random() * 4;
      const duration = 3 + Math.random() * 2;
      const delay = (i / CONFIG.heroParticleCount) * duration;
      
      particle.style.cssText = `
        position: absolute;
        width: ${size}px;
        height: ${size}px;
        left: 50%;
        top: 50%;
        margin-left: -${size/2}px;
        margin-top: -${size/2}px;
        background: radial-gradient(circle, rgba(255, 107, 74, 0.9) 0%, transparent 70%);
        border-radius: 50%;
        pointer-events: none;
        animation: particleOrbit ${duration}s linear infinite;
        animation-delay: ${delay}s;
        --orbit-radius: ${radius}px;
      `;
      
      heroContainer.appendChild(particle);
    }

    // Add custom CSS for particle orbit
    if (!document.getElementById('particle-orbit-style')) {
      const style = document.createElement('style');
      style.id = 'particle-orbit-style';
      style.textContent = `
        @keyframes particleOrbit {
          0% {
            transform: rotate(0deg) translateX(var(--orbit-radius)) rotate(0deg);
            opacity: 0;
          }
          10% { opacity: 0.8; }
          90% { opacity: 0.8; }
          100% {
            transform: rotate(360deg) translateX(var(--orbit-radius)) rotate(-360deg);
            opacity: 0;
          }
        }
      `;
      document.head.appendChild(style);
    }
  }

  // ============================================
  // ✨ Text Reveal Animations
  // ============================================
  function splitTextToSpans(element, type = 'word') {
    if (!element || element.dataset.split) return;
    
    const text = element.textContent;
    element.dataset.split = 'true';
    element.dataset.originalText = text;
    
    if (type === 'letter') {
      element.innerHTML = text.split('').map((char, i) => 
        char === ' ' ? ' ' : `<span style="animation-delay: ${i * CONFIG.letterDelay}ms">${char}</span>`
      ).join('');
    } else {
      element.innerHTML = text.split(' ').map((word, i) => 
        `<span style="animation-delay: ${i * CONFIG.wordDelay}ms">${word}</span>`
      ).join(' ');
    }
  }

  function initTextReveal() {
    if (isReducedMotion) return;

    // Word-by-word reveal
    document.querySelectorAll('[data-text-reveal="word"]').forEach(el => {
      splitTextToSpans(el, 'word');
      el.classList.add('text-reveal-word');
    });

    // Letter-by-letter reveal
    document.querySelectorAll('[data-text-reveal="letter"]').forEach(el => {
      splitTextToSpans(el, 'letter');
      el.classList.add('text-reveal-letter');
    });
  }

  // Typewriter effect
  function typeText(element, text, speed = 50) {
    if (!element) return Promise.resolve();
    
    return new Promise(resolve => {
      let index = 0;
      element.textContent = '';
      element.classList.add('typewriter');
      
      function type() {
        if (index < text.length) {
          element.textContent += text[index];
          index++;
          setTimeout(type, speed);
        } else {
          element.classList.remove('typewriter');
          resolve();
        }
      }
      
      type();
    });
  }

  // ============================================
  // 🧲 Magnetic Button Effect
  // ============================================
  function initMagneticButtons() {
    if (isReducedMotion) return;

    const buttons = document.querySelectorAll('.btn-magnetic, .cta-button');
    
    buttons.forEach(button => {
      let bounds;
      let isHovering = false;

      const updateBounds = () => {
        bounds = button.getBoundingClientRect();
      };

      button.addEventListener('mouseenter', () => {
        updateBounds();
        isHovering = true;
      });

      button.addEventListener('mouseleave', () => {
        isHovering = false;
        // Spring back to center
        button.style.transform = 'translate(0, 0)';
      });

      button.addEventListener('mousemove', (e) => {
        if (!isHovering) return;
        
        const centerX = bounds.left + bounds.width / 2;
        const centerY = bounds.top + bounds.height / 2;
        
        const deltaX = e.clientX - centerX;
        const deltaY = e.clientY - centerY;
        
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        const maxDistance = CONFIG.magneticRadius;
        
        if (distance < maxDistance) {
          const strength = mapRange(distance, 0, maxDistance, CONFIG.magneticStrength, 0);
          const moveX = deltaX * strength;
          const moveY = deltaY * strength;
          
          button.style.transform = `translate(${moveX}px, ${moveY}px)`;
        }
      });
    });
  }

  // ============================================
  // 🎴 Card Tilt Effect
  // ============================================
  function initTiltCards() {
    if (isReducedMotion) return;

    const cards = document.querySelectorAll('.card-tilt, .post-card');
    
    cards.forEach(card => {
      let bounds;
      let isHovering = false;

      card.addEventListener('mouseenter', () => {
        bounds = card.getBoundingClientRect();
        isHovering = true;
      });

      card.addEventListener('mouseleave', () => {
        isHovering = false;
        card.style.transform = 'perspective(1000px) rotateX(0) rotateY(0)';
      });

      card.addEventListener('mousemove', (e) => {
        if (!isHovering || !bounds) return;
        
        const x = e.clientX - bounds.left;
        const y = e.clientY - bounds.top;
        
        const centerX = bounds.width / 2;
        const centerY = bounds.height / 2;
        
        const angleX = ((y - centerY) / centerY) * CONFIG.tiltMaxAngle;
        const angleY = ((x - centerX) / centerX) * -CONFIG.tiltMaxAngle;
        
        card.style.transform = `
          perspective(${CONFIG.tiltPerspective}px) 
          rotateX(${angleX}deg) 
          rotateY(${angleY}deg)
          scale3d(1.02, 1.02, 1.02)
        `;
      });
    });
  }

  // ============================================
  // 🌊 Ripple Effect
  // ============================================
  function createRipple(event) {
    const button = event.currentTarget;
    
    // Remove existing ripples
    const existingRipple = button.querySelector('.ripple');
    if (existingRipple) existingRipple.remove();
    
    const rect = button.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height) * 2.5;
    
    const ripple = document.createElement('span');
    ripple.className = 'ripple';
    ripple.style.cssText = `
      width: ${size}px;
      height: ${size}px;
      left: ${event.clientX - rect.left - size / 2}px;
      top: ${event.clientY - rect.top - size / 2}px;
    `;
    
    button.appendChild(ripple);
    
    setTimeout(() => ripple.remove(), CONFIG.rippleDuration);
  }

  function initRipples() {
    document.querySelectorAll('.btn-ripple, .cta-button, .post-btn, .save-btn').forEach(button => {
      button.addEventListener('click', createRipple);
    });
  }

  // ============================================
  // 📜 Parallax Effects
  // ============================================
  function initParallax() {
    if (isReducedMotion) return;

    const parallaxElements = document.querySelectorAll(
      '.gradient-orb, .circle-animated, .circle-parallax, .parallax-layer, .pentagon-pattern'
    );
    
    if (parallaxElements.length === 0) return;

    let currentScrollY = 0;
    let currentMouseX = 0;
    let currentMouseY = 0;
    let targetScrollY = 0;
    let targetMouseX = 0;
    let targetMouseY = 0;

    function updateParallax() {
      // Smooth interpolation
      currentScrollY = lerp(currentScrollY, targetScrollY, CONFIG.parallaxSmoothing);
      currentMouseX = lerp(currentMouseX, targetMouseX, CONFIG.parallaxSmoothing);
      currentMouseY = lerp(currentMouseY, targetMouseY, CONFIG.parallaxSmoothing);

      parallaxElements.forEach((element, index) => {
        const speed = (index + 1) * CONFIG.parallaxIntensity;
        const yOffset = currentScrollY * speed * 0.5;
        const xOffset = (currentMouseX - window.innerWidth / 2) * speed * 0.02;
        const mouseYOffset = (currentMouseY - window.innerHeight / 2) * speed * 0.01;
        
        element.style.transform = `translate3d(${xOffset}px, ${yOffset + mouseYOffset}px, 0)`;
      });

      rafId = requestAnimationFrame(updateParallax);
    }

    window.addEventListener('scroll', throttle(() => {
      targetScrollY = window.scrollY;
    }, 16));

    window.addEventListener('mousemove', throttle((e) => {
      targetMouseX = e.clientX;
      targetMouseY = e.clientY;
    }, 16));

    updateParallax();
  }

  // ============================================
  // 👁️ Scroll Reveal (Intersection Observer)
  // ============================================
  function initScrollReveal() {
    if (isReducedMotion) return;

    const revealElements = document.querySelectorAll(
      '.reveal, .reveal-left, .reveal-scale, .reveal-stagger, .list-stagger, [data-reveal]'
    );
    
    if (revealElements.length === 0) return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible', 'in-view');
          // Keep observing for repeat animations, or unobserve:
          // observer.unobserve(entry.target);
        }
      });
    }, {
      threshold: CONFIG.revealThreshold,
      rootMargin: CONFIG.revealRootMargin
    });

    revealElements.forEach(el => observer.observe(el));
  }

  // ============================================
  // 📊 Counter Animation
  // ============================================
  function animateCounter(element, targetValue, duration = 1200) {
    if (!element || isReducedMotion) {
      if (element) element.textContent = targetValue.toLocaleString('fr-FR');
      return;
    }

    const startValue = parseInt(element.textContent.replace(/\s/g, '')) || 0;
    const startTime = performance.now();

    function update(currentTime) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Ease out quart for smooth deceleration
      const eased = 1 - Math.pow(1 - progress, 4);
      const current = Math.floor(startValue + (targetValue - startValue) * eased);
      
      element.textContent = current.toLocaleString('fr-FR');
      
      // Subtle scale pulse
      const scalePulse = 1 + Math.sin(progress * Math.PI * 6) * 0.015;
      element.style.transform = `scale(${scalePulse})`;
      
      if (progress < 1) {
        requestAnimationFrame(update);
      } else {
        element.style.transform = 'scale(1)';
        // Final pop
        element.classList.add('counter-animated');
        setTimeout(() => element.classList.remove('counter-animated'), 400);
      }
    }

    requestAnimationFrame(update);
  }

  // ============================================
  // 🎬 Screen Transitions
  // ============================================
  function transitionScreen(fromId, toId, animation = 'slide') {
    const fromScreen = document.getElementById(fromId);
    const toScreen = document.getElementById(toId);
    
    if (!fromScreen || !toScreen) return;

    const animations = {
      slide: { out: 'screen-exit', in: 'page-slide-enter' },
      fade: { out: 'screen-exit', in: 'page-enter' },
      scale: { out: 'screen-exit', in: 'page-scale-enter' }
    };

    const anim = animations[animation] || animations.slide;

    // Animate out
    fromScreen.classList.add(anim.out);
    
    setTimeout(() => {
      fromScreen.classList.add('hidden');
      fromScreen.classList.remove(anim.out);
      
      // Animate in
      toScreen.classList.remove('hidden');
      toScreen.classList.add(anim.in);
      
      // Focus management for a11y
      const focusable = toScreen.querySelector('button, input, a, [tabindex="0"]');
      if (focusable) focusable.focus();
      
      setTimeout(() => toScreen.classList.remove(anim.in), 500);
    }, 300);
  }

  // ============================================
  // 🎊 Confetti
  // ============================================
  function createConfetti(container = document.body, count = 50) {
    if (isReducedMotion) return;

    const colors = ['#ff6b4a', '#ff8a6a', '#fbbf24', '#a78bfa', '#22c55e', '#6366f1'];
    const shapes = ['circle', 'square', 'triangle'];
    
    for (let i = 0; i < count; i++) {
      const confetti = document.createElement('div');
      const color = colors[Math.floor(Math.random() * colors.length)];
      const shape = shapes[Math.floor(Math.random() * shapes.length)];
      const size = Math.random() * 10 + 5;
      const duration = Math.random() * 2 + 2;
      
      let borderRadius = '50%';
      let clipPath = 'none';
      
      if (shape === 'square') borderRadius = '2px';
      if (shape === 'triangle') clipPath = 'polygon(50% 0%, 0% 100%, 100% 100%)';
      
      confetti.style.cssText = `
        position: fixed;
        width: ${size}px;
        height: ${size}px;
        background: ${color};
        left: ${Math.random() * 100}%;
        top: -20px;
        border-radius: ${borderRadius};
        clip-path: ${clipPath};
        pointer-events: none;
        z-index: 9999;
        animation: confettiFall ${duration}s linear forwards;
        animation-delay: ${Math.random() * 0.5}s;
        transform: rotate(${Math.random() * 360}deg);
      `;
      
      container.appendChild(confetti);
      setTimeout(() => confetti.remove(), (duration + 0.5) * 1000);
    }
  }

  // ============================================
  // 💀 Skeleton Loaders
  // ============================================
  function createSkeleton(container, options = {}) {
    const { 
      lines = 3, 
      circle = false, 
      width = '100%',
      circleSize = '48px'
    } = options;
    
    const skeleton = document.createElement('div');
    skeleton.className = 'skeleton-container';
    skeleton.style.width = width;
    
    if (circle) {
      const circleEl = document.createElement('div');
      circleEl.className = 'skeleton skeleton-circle';
      circleEl.style.width = circleEl.style.height = circleSize;
      skeleton.appendChild(circleEl);
    }
    
    const textContainer = document.createElement('div');
    textContainer.style.flex = '1';
    
    for (let i = 0; i < lines; i++) {
      const line = document.createElement('div');
      line.className = 'skeleton skeleton-text';
      if (i === lines - 1) line.style.width = '60%';
      textContainer.appendChild(line);
    }
    
    if (circle) {
      skeleton.style.display = 'flex';
      skeleton.style.gap = '12px';
      skeleton.style.alignItems = 'center';
    }
    
    skeleton.appendChild(textContainer);
    
    if (container) container.appendChild(skeleton);
    
    return skeleton;
  }

  function removeSkeleton(skeleton, fadeOut = true) {
    if (!skeleton) return;
    
    if (fadeOut) {
      skeleton.style.transition = 'opacity 0.3s ease';
      skeleton.style.opacity = '0';
      setTimeout(() => skeleton.remove(), 300);
    } else {
      skeleton.remove();
    }
  }

  // ============================================
  // 🍞 Toast Notifications
  // ============================================
  let toastContainer;

  function getToastContainer() {
    if (!toastContainer) {
      toastContainer = document.createElement('div');
      toastContainer.className = 'toast-container';
      document.body.appendChild(toastContainer);
    }
    return toastContainer;
  }

  function showToast(options = {}) {
    const {
      title = '',
      message = '',
      type = 'default', // success, error, notification
      duration = 4000,
      icon = null,
      onClick = null
    } = options;

    const container = getToastContainer();
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icons = {
      success: '✓',
      error: '✕',
      notification: '🔔',
      default: 'ℹ️'
    };
    
    // SECURITY: Use DOM methods instead of innerHTML to prevent XSS
    const iconSpan = document.createElement('span');
    iconSpan.className = 'toast-icon';
    iconSpan.textContent = icon || icons[type] || icons.default;
    toast.appendChild(iconSpan);
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'toast-content';
    
    if (title) {
      const titleDiv = document.createElement('div');
      titleDiv.className = 'toast-title';
      titleDiv.textContent = title;  // textContent = XSS safe
      contentDiv.appendChild(titleDiv);
    }
    
    if (message) {
      const messageDiv = document.createElement('div');
      messageDiv.className = 'toast-message';
      messageDiv.textContent = message;  // textContent = XSS safe
      contentDiv.appendChild(messageDiv);
    }
    
    toast.appendChild(contentDiv);
    
    if (onClick) {
      toast.style.cursor = 'pointer';
      toast.addEventListener('click', () => {
        onClick();
        dismissToast(toast);
      });
    }
    
    container.appendChild(toast);
    
    // Auto-dismiss
    setTimeout(() => dismissToast(toast), duration);
    
    return toast;
  }

  function dismissToast(toast) {
    if (!toast) return;
    toast.classList.add('toast-out');
    setTimeout(() => toast.remove(), 300);
  }

  // ============================================
  // 🔔 Ping Effect
  // ============================================
  function createPingEffect(element) {
    if (!element || isReducedMotion) return;
    
    element.classList.add('ping-animated');
    setTimeout(() => element.classList.remove('ping-animated'), 600);
  }

  // ============================================
  // 🎯 Post Slide-In Animation
  // ============================================
  function initPostAnimations() {
    const posts = document.querySelectorAll('.post-card');
    posts.forEach((post, index) => {
      post.style.animationDelay = `${index * 80}ms`;
    });
  }

  // ============================================
  // 🔀 Tab Switch Animation
  // ============================================
  function initTabAnimations() {
    const navItems = document.querySelectorAll('.nav-item');
    const tabPanels = document.querySelectorAll('.tab-panel');
    
    navItems.forEach(item => {
      item.addEventListener('click', () => {
        // Update nav items
        navItems.forEach(nav => nav.classList.remove('active'));
        item.classList.add('active');
        
        // The tab panel animation is handled by CSS
      });
    });
  }

  // ============================================
  // 👤 Avatar Ring Animation
  // ============================================
  function initAvatarAnimations() {
    // Add ring animation CSS if not present
    if (!document.getElementById('avatar-ring-style')) {
      const style = document.createElement('style');
      style.id = 'avatar-ring-style';
      style.textContent = `
        .avatar-ring-animate::before {
          content: '';
          position: absolute;
          inset: -4px;
          border-radius: 50%;
          background: conic-gradient(
            from 0deg,
            transparent 0deg,
            var(--color-brand) 60deg,
            transparent 120deg
          );
          animation: ringRotate 2s linear infinite;
          opacity: 1;
        }
        @keyframes ringRotate {
          to { transform: rotate(360deg); }
        }
      `;
      document.head.appendChild(style);
    }
    
    const avatars = document.querySelectorAll('.header-avatar, .post-avatar, .contact-avatar-slot');
    
    avatars.forEach(avatar => {
      avatar.addEventListener('mouseenter', () => {
        if (!isReducedMotion) {
          avatar.classList.add('avatar-ring-animate');
        }
      });
      
      avatar.addEventListener('mouseleave', () => {
        avatar.classList.remove('avatar-ring-animate');
      });
    });
  }

  // ============================================
  // 📝 Composer Expand Animation
  // ============================================
  function initComposerAnimation() {
    const composer = document.querySelector('.composer');
    const textarea = document.querySelector('.composer-textarea');
    
    if (!composer || !textarea) return;
    
    textarea.addEventListener('focus', () => {
      composer.classList.add('composer-focused');
    });
    
    textarea.addEventListener('blur', () => {
      if (!textarea.value.trim()) {
        composer.classList.remove('composer-focused');
      }
    });
  }

  // ============================================
  // 🎬 Initialize Everything
  // ============================================
  function init() {
    // Check reduced motion preference
    isReducedMotion = prefersReducedMotion();
    
    // Listen for changes
    window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', (e) => {
      isReducedMotion = e.matches;
    });

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initAll);
    } else {
      initAll();
    }
  }

  function initAll() {
    // Core animations
    initRipples();
    initMagneticButtons();
    initTiltCards();
    initParallax();
    initScrollReveal();
    initHeroParticles();
    initTextReveal();
    
    // App-specific
    initPostAnimations();
    initTabAnimations();
    initAvatarAnimations();
    initComposerAnimation();
    
    // Page enter animation
    const mainContent = document.querySelector('main, .main-content, .app-content');
    if (mainContent && !isReducedMotion) {
      mainContent.classList.add('page-enter');
    }
  }

  // Cleanup on page unload
  window.addEventListener('unload', () => {
    if (rafId) cancelAnimationFrame(rafId);
  });

  // ============================================
  // Public API
  // ============================================
  return {
    init,
    
    // Effects
    createRipple,
    createConfetti,
    createPingEffect,
    
    // Text
    typeText,
    
    // Counters
    animateCounter,
    
    // Transitions
    transitionScreen,
    
    // Skeletons
    createSkeleton,
    removeSkeleton,
    
    // Toasts
    showToast,
    dismissToast,
    
    // Re-init (for dynamic content)
    initRipples,
    initScrollReveal,
    initPostAnimations,
    initHeroParticles,
    initAvatarAnimations,
    
    // Utils
    prefersReducedMotion: () => isReducedMotion,
    
    // Config access
    CONFIG
  };

})();

// Auto-initialize
CinqAnimations.init();

// Global access
window.CinqAnimations = CinqAnimations;

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CinqAnimations;
}
