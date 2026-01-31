/**
 * CINQ - Elite Animation Engine
 * ==============================
 * Awwwards-level interactive animations
 * Zero dependencies, pure vanilla JS
 */

const CinqAnimations = (function() {
  'use strict';

  // ============================================
  // Configuration
  // ============================================
  const CONFIG = {
    // Intersection Observer thresholds
    revealThreshold: 0.15,
    // Parallax intensity
    parallaxIntensity: 0.02,
    // Magnetic button strength
    magneticStrength: 0.3,
    // Tilt card max angle
    tiltMaxAngle: 8,
    // Ripple duration
    rippleDuration: 600,
  };

  // Track mouse position for effects
  let mouseX = 0;
  let mouseY = 0;

  // ============================================
  // Utility Functions
  // ============================================
  
  function lerp(start, end, factor) {
    return start + (end - start) * factor;
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function prefersReducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  // ============================================
  // Ripple Effect
  // ============================================
  function createRipple(event) {
    const button = event.currentTarget;
    
    // Remove existing ripples
    const existingRipple = button.querySelector('.ripple');
    if (existingRipple) existingRipple.remove();
    
    const rect = button.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height) * 2;
    
    const ripple = document.createElement('span');
    ripple.className = 'ripple';
    ripple.style.width = ripple.style.height = `${size}px`;
    ripple.style.left = `${event.clientX - rect.left - size / 2}px`;
    ripple.style.top = `${event.clientY - rect.top - size / 2}px`;
    
    button.appendChild(ripple);
    
    // Clean up after animation
    setTimeout(() => ripple.remove(), CONFIG.rippleDuration);
  }

  function initRipples() {
    document.querySelectorAll('.btn-ripple').forEach(button => {
      button.addEventListener('click', createRipple);
    });
  }

  // ============================================
  // Magnetic Button Effect
  // ============================================
  function initMagneticButtons() {
    if (prefersReducedMotion()) return;

    document.querySelectorAll('.btn-magnetic').forEach(button => {
      button.addEventListener('mousemove', (e) => {
        const rect = button.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        
        const deltaX = (e.clientX - centerX) * CONFIG.magneticStrength;
        const deltaY = (e.clientY - centerY) * CONFIG.magneticStrength;
        
        button.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
      });
      
      button.addEventListener('mouseleave', () => {
        button.style.transform = 'translate(0, 0)';
      });
    });
  }

  // ============================================
  // Card Tilt Effect
  // ============================================
  function initTiltCards() {
    if (prefersReducedMotion()) return;

    document.querySelectorAll('.card-tilt').forEach(card => {
      card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        
        const angleX = ((e.clientY - centerY) / rect.height) * CONFIG.tiltMaxAngle;
        const angleY = ((e.clientX - centerX) / rect.width) * -CONFIG.tiltMaxAngle;
        
        card.style.transform = `perspective(1000px) rotateX(${angleX}deg) rotateY(${angleY}deg)`;
      });
      
      card.addEventListener('mouseleave', () => {
        card.style.transform = 'perspective(1000px) rotateX(0) rotateY(0)';
      });
    });
  }

  // ============================================
  // Parallax Background Circles
  // ============================================
  function initParallaxCircles() {
    if (prefersReducedMotion()) return;

    const circles = document.querySelectorAll('.circle-parallax, .circle-animated');
    if (circles.length === 0) return;

    let ticking = false;

    function updateParallax() {
      const scrollY = window.scrollY;
      const windowHeight = window.innerHeight;

      circles.forEach((circle, index) => {
        // Different speed for each circle
        const speed = (index + 1) * CONFIG.parallaxIntensity;
        const yOffset = scrollY * speed;
        const xOffset = (mouseX - window.innerWidth / 2) * speed * 0.01;
        
        circle.style.transform = `translate(${xOffset}px, ${yOffset}px)`;
      });

      ticking = false;
    }

    window.addEventListener('scroll', () => {
      if (!ticking) {
        requestAnimationFrame(updateParallax);
        ticking = true;
      }
    });

    window.addEventListener('mousemove', (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      
      if (!ticking) {
        requestAnimationFrame(updateParallax);
        ticking = true;
      }
    });
  }

  // ============================================
  // Scroll Reveal Animations
  // ============================================
  function initScrollReveal() {
    if (prefersReducedMotion()) return;

    const revealElements = document.querySelectorAll('.reveal, .reveal-left, .reveal-scale, .list-stagger');
    
    if (revealElements.length === 0) return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible', 'in-view');
          // Optional: stop observing after reveal
          // observer.unobserve(entry.target);
        }
      });
    }, {
      threshold: CONFIG.revealThreshold,
      rootMargin: '0px 0px -50px 0px'
    });

    revealElements.forEach(el => observer.observe(el));
  }

  // ============================================
  // Hero Particles
  // ============================================
  function initHeroParticles() {
    if (prefersReducedMotion()) return;

    const heroContainer = document.querySelector('.hero-container, .hero-logo')?.parentElement;
    if (!heroContainer) return;

    heroContainer.style.position = 'relative';

    // Create particles
    for (let i = 0; i < 8; i++) {
      const particle = document.createElement('div');
      particle.className = 'hero-particle';
      
      // Random position around the hero
      const angle = (i / 8) * Math.PI * 2;
      const radius = 60 + Math.random() * 30;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      
      particle.style.left = `calc(50% + ${x}px)`;
      particle.style.top = `calc(50% + ${y}px)`;
      particle.style.animationDelay = `${i * 0.4}s`;
      
      heroContainer.appendChild(particle);
    }
  }

  // ============================================
  // Smooth Counter Animation
  // ============================================
  function animateCounter(element, targetValue, duration = 1200) {
    if (!element) return;

    const startValue = parseInt(element.textContent) || 0;
    const startTime = performance.now();

    function update(currentTime) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Ease out quart
      const eased = 1 - Math.pow(1 - progress, 4);
      const current = Math.floor(startValue + (targetValue - startValue) * eased);
      
      element.textContent = current.toLocaleString('fr-FR');
      
      // Subtle scale effect
      const scalePulse = 1 + Math.sin(progress * Math.PI * 4) * 0.02;
      element.style.transform = `scale(${scalePulse})`;
      
      if (progress < 1) {
        requestAnimationFrame(update);
      } else {
        element.style.transform = 'scale(1)';
        // Final bounce
        element.classList.add('counter-animated');
        setTimeout(() => element.classList.remove('counter-animated'), 400);
      }
    }

    requestAnimationFrame(update);
  }

  // ============================================
  // Stagger Animation on Load
  // ============================================
  function initStaggerOnLoad() {
    const staggerContainers = document.querySelectorAll('[data-animate="stagger"]');
    
    staggerContainers.forEach(container => {
      // Trigger animation by adding class
      requestAnimationFrame(() => {
        container.classList.add('stagger-active');
      });
    });
  }

  // ============================================
  // Screen Transition
  // ============================================
  function transitionScreen(fromId, toId, direction = 'forward') {
    const fromScreen = document.getElementById(fromId);
    const toScreen = document.getElementById(toId);
    
    if (!fromScreen || !toScreen) return;

    // Animate out
    fromScreen.classList.add('screen-exit');
    
    setTimeout(() => {
      fromScreen.classList.add('hidden');
      fromScreen.classList.remove('screen-exit');
      
      // Animate in
      toScreen.classList.remove('hidden');
      toScreen.classList.add('screen-enter');
      
      // Focus first interactive element
      const focusable = toScreen.querySelector('button, input, a');
      if (focusable) focusable.focus();
      
      setTimeout(() => {
        toScreen.classList.remove('screen-enter');
      }, 500);
    }, 300);
  }

  // ============================================
  // Typing Text Effect
  // ============================================
  function typeText(element, text, speed = 50) {
    if (!element) return Promise.resolve();

    return new Promise(resolve => {
      let index = 0;
      element.textContent = '';
      
      function type() {
        if (index < text.length) {
          element.textContent += text[index];
          index++;
          setTimeout(type, speed);
        } else {
          resolve();
        }
      }
      
      type();
    });
  }

  // ============================================
  // Confetti Effect (for success screens)
  // ============================================
  function createConfetti(container, count = 30) {
    if (prefersReducedMotion()) return;
    if (!container) container = document.body;

    const colors = ['#6366f1', '#8b5cf6', '#a855f7', '#22c55e', '#f59e0b'];
    
    for (let i = 0; i < count; i++) {
      const confetti = document.createElement('div');
      confetti.style.cssText = `
        position: fixed;
        width: ${Math.random() * 10 + 5}px;
        height: ${Math.random() * 10 + 5}px;
        background: ${colors[Math.floor(Math.random() * colors.length)]};
        left: ${Math.random() * 100}%;
        top: -20px;
        border-radius: ${Math.random() > 0.5 ? '50%' : '2px'};
        pointer-events: none;
        z-index: 9999;
        animation: confettiFall ${Math.random() * 2 + 2}s linear forwards;
        animation-delay: ${Math.random() * 0.5}s;
      `;
      
      container.appendChild(confetti);
      
      // Clean up
      setTimeout(() => confetti.remove(), 4000);
    }
  }

  // ============================================
  // Loading Skeleton
  // ============================================
  function createSkeleton(container, options = {}) {
    const { lines = 3, circle = false, width = '100%' } = options;
    
    const skeleton = document.createElement('div');
    skeleton.className = 'skeleton-container';
    skeleton.style.width = width;
    
    if (circle) {
      const circleEl = document.createElement('div');
      circleEl.className = 'skeleton skeleton-circle';
      circleEl.style.width = circleEl.style.height = '48px';
      skeleton.appendChild(circleEl);
    }
    
    for (let i = 0; i < lines; i++) {
      const line = document.createElement('div');
      line.className = 'skeleton skeleton-text';
      if (i === lines - 1) {
        line.style.width = '60%';
      }
      skeleton.appendChild(line);
    }
    
    if (container) {
      container.appendChild(skeleton);
    }
    
    return skeleton;
  }

  function removeSkeleton(skeleton) {
    if (skeleton) {
      skeleton.style.opacity = '0';
      skeleton.style.transition = 'opacity 0.3s ease';
      setTimeout(() => skeleton.remove(), 300);
    }
  }

  // ============================================
  // Ping Effect
  // ============================================
  function createPingEffect(element) {
    if (!element || prefersReducedMotion()) return;
    
    element.classList.add('ping-animated');
    
    setTimeout(() => {
      element.classList.remove('ping-animated');
    }, 600);
  }

  // ============================================
  // Initialize All Animations
  // ============================================
  function init() {
    // Wait for DOM
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initAll);
    } else {
      initAll();
    }
  }

  function initAll() {
    initRipples();
    initMagneticButtons();
    initTiltCards();
    initParallaxCircles();
    initScrollReveal();
    initHeroParticles();
    initStaggerOnLoad();
    
    // Add page-enter animation to main content
    const mainContent = document.querySelector('main, .main-content');
    if (mainContent) {
      mainContent.classList.add('page-enter');
    }
  }

  // ============================================
  // Public API
  // ============================================
  return {
    init,
    createRipple,
    animateCounter,
    transitionScreen,
    typeText,
    createConfetti,
    createSkeleton,
    removeSkeleton,
    createPingEffect,
    // Re-init functions (for dynamic content)
    initRipples,
    initScrollReveal,
    // Config
    prefersReducedMotion
  };

})();

// Auto-initialize
CinqAnimations.init();

// Export for module usage if needed
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CinqAnimations;
}
