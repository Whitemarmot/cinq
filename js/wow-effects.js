/**
 * CINQ — WOW Effects JavaScript
 * =============================
 * Custom cursor, parallax, magnetic buttons, easter eggs
 */

(function() {
  'use strict';

  // ============================================
  // CUSTOM CURSOR
  // ============================================
  function initCustomCursor() {
    // Skip on touch devices
    if (!window.matchMedia('(hover: hover)').matches) return;
    
    // Create cursor elements
    const cursorDot = document.createElement('div');
    cursorDot.className = 'cursor-dot';
    
    const cursorOutline = document.createElement('div');
    cursorOutline.className = 'cursor-outline';
    
    document.body.appendChild(cursorDot);
    document.body.appendChild(cursorOutline);
    
    let mouseX = 0, mouseY = 0;
    let outlineX = 0, outlineY = 0;
    
    // Track mouse position
    document.addEventListener('mousemove', (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      
      // Dot follows immediately
      cursorDot.style.left = mouseX + 'px';
      cursorDot.style.top = mouseY + 'px';
    });
    
    // Outline follows with delay (smooth)
    function animateOutline() {
      outlineX += (mouseX - outlineX) * 0.15;
      outlineY += (mouseY - outlineY) * 0.15;
      
      cursorOutline.style.left = outlineX + 'px';
      cursorOutline.style.top = outlineY + 'px';
      
      requestAnimationFrame(animateOutline);
    }
    animateOutline();
    
    // Hover effects on interactive elements
    const interactiveElements = document.querySelectorAll('a, button, input, textarea, [role="button"], .card, .feature-card');
    
    interactiveElements.forEach(el => {
      el.addEventListener('mouseenter', () => {
        cursorOutline.classList.add('hovering');
        cursorDot.style.transform = 'translate(-50%, -50%) scale(1.5)';
      });
      
      el.addEventListener('mouseleave', () => {
        cursorOutline.classList.remove('hovering');
        cursorDot.style.transform = 'translate(-50%, -50%) scale(1)';
      });
    });
    
    // Hide cursor when leaving window
    document.addEventListener('mouseout', (e) => {
      if (!e.relatedTarget) {
        cursorDot.style.opacity = '0';
        cursorOutline.style.opacity = '0';
      }
    });
    
    document.addEventListener('mouseover', () => {
      cursorDot.style.opacity = '1';
      cursorOutline.style.opacity = '0.6';
    });
  }

  // ============================================
  // PENTAGON BACKGROUND PATTERN
  // ============================================
  function initPentagonBackground() {
    const bg = document.createElement('div');
    bg.className = 'pentagon-bg';
    document.body.insertBefore(bg, document.body.firstChild);
  }

  // ============================================
  // FLOATING PENTAGONS
  // ============================================
  function initFloatingPentagons() {
    const hero = document.querySelector('.hero, [class*="hero"]');
    if (!hero) return;
    
    const container = document.createElement('div');
    container.className = 'floating-pentagons';
    
    // Create 5 pentagons (for "5" theme)
    for (let i = 0; i < 5; i++) {
      const pentagon = document.createElement('div');
      pentagon.className = 'floating-pentagon';
      pentagon.innerHTML = `
        <svg viewBox="0 0 100 100">
          <polygon 
            points="50,5 95,35 82,90 18,90 5,35" 
            fill="none" 
            stroke="#FF6B5B" 
            stroke-width="1"
          />
        </svg>
      `;
      container.appendChild(pentagon);
    }
    
    hero.style.position = 'relative';
    hero.appendChild(container);
  }

  // ============================================
  // PARALLAX EFFECT
  // ============================================
  function initParallax() {
    const parallaxElements = document.querySelectorAll('[data-parallax]');
    if (parallaxElements.length === 0) return;
    
    let ticking = false;
    
    function updateParallax() {
      const scrollY = window.pageYOffset;
      
      parallaxElements.forEach(el => {
        const speed = parseFloat(el.dataset.parallax) || 0.5;
        const offset = scrollY * speed;
        el.style.transform = `translateY(${offset}px)`;
      });
      
      ticking = false;
    }
    
    window.addEventListener('scroll', () => {
      if (!ticking) {
        requestAnimationFrame(updateParallax);
        ticking = true;
      }
    });
  }

  // ============================================
  // MAGNETIC BUTTONS
  // ============================================
  function initMagneticButtons() {
    const buttons = document.querySelectorAll('.btn-primary, .magnetic');
    
    buttons.forEach(btn => {
      btn.addEventListener('mousemove', (e) => {
        const rect = btn.getBoundingClientRect();
        const x = e.clientX - rect.left - rect.width / 2;
        const y = e.clientY - rect.top - rect.height / 2;
        
        btn.style.transform = `translate(${x * 0.2}px, ${y * 0.2}px) scale(1.02)`;
      });
      
      btn.addEventListener('mouseleave', () => {
        btn.style.transform = '';
      });
    });
  }

  // ============================================
  // NOISE OVERLAY
  // ============================================
  function initNoiseOverlay() {
    const noise = document.createElement('div');
    noise.className = 'noise-overlay';
    document.body.appendChild(noise);
  }

  // ============================================
  // HERO NUMBER GLOW
  // ============================================
  function initHeroGlow() {
    const heroNumber = document.querySelector('.hero-number, .hero-logo-number, [class*="hero"] [class*="number"]');
    if (heroNumber) {
      heroNumber.classList.add('hero-number-container');
    }
  }

  // ============================================
  // RIPPLE EFFECT ON CLICK
  // ============================================
  function initRippleEffect() {
    document.addEventListener('click', (e) => {
      const target = e.target.closest('button, .btn, [role="button"]');
      if (!target) return;
      
      const ripple = document.createElement('span');
      ripple.className = 'ripple';
      ripple.style.cssText = `
        position: absolute;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.4);
        pointer-events: none;
        transform: scale(0);
        animation: rippleAnim 0.6s ease-out forwards;
      `;
      
      const rect = target.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height);
      ripple.style.width = ripple.style.height = size + 'px';
      ripple.style.left = (e.clientX - rect.left - size / 2) + 'px';
      ripple.style.top = (e.clientY - rect.top - size / 2) + 'px';
      
      target.style.position = 'relative';
      target.style.overflow = 'hidden';
      target.appendChild(ripple);
      
      setTimeout(() => ripple.remove(), 600);
    });
    
    // Add keyframes if not exists
    if (!document.querySelector('#ripple-keyframes')) {
      const style = document.createElement('style');
      style.id = 'ripple-keyframes';
      style.textContent = `
        @keyframes rippleAnim {
          to { transform: scale(4); opacity: 0; }
        }
      `;
      document.head.appendChild(style);
    }
  }

  // ============================================
  // EASTER EGG: KONAMI CODE
  // ============================================
  function initKonamiCode() {
    const konami = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'KeyB', 'KeyA'];
    let konamiIndex = 0;
    
    document.addEventListener('keydown', (e) => {
      if (e.code === konami[konamiIndex]) {
        konamiIndex++;
        if (konamiIndex === konami.length) {
          activateKonami();
          konamiIndex = 0;
        }
      } else {
        konamiIndex = 0;
      }
    });
    
    function activateKonami() {
      document.body.classList.add('konami-active');
      
      // Spawn confetti-like pentagons
      for (let i = 0; i < 50; i++) {
        setTimeout(() => {
          const confetti = document.createElement('div');
          confetti.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 100 100">
              <polygon points="50,5 95,35 82,90 18,90 5,35" fill="#FF6B5B"/>
            </svg>
          `;
          confetti.style.cssText = `
            position: fixed;
            left: ${Math.random() * 100}vw;
            top: -20px;
            z-index: 99999;
            pointer-events: none;
            animation: confettiFall ${2 + Math.random() * 2}s linear forwards;
          `;
          document.body.appendChild(confetti);
          setTimeout(() => confetti.remove(), 4000);
        }, i * 50);
      }
      
      // Add confetti keyframes
      if (!document.querySelector('#confetti-keyframes')) {
        const style = document.createElement('style');
        style.id = 'confetti-keyframes';
        style.textContent = `
          @keyframes confettiFall {
            to {
              transform: translateY(110vh) rotate(720deg);
              opacity: 0;
            }
          }
        `;
        document.head.appendChild(style);
      }
      
      setTimeout(() => {
        document.body.classList.remove('konami-active');
      }, 5000);
    }
  }

  // ============================================
  // SCROLL-TRIGGERED ANIMATIONS
  // ============================================
  function initScrollAnimations() {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('animate-in');
        }
      });
    }, { threshold: 0.1 });
    
    document.querySelectorAll('.feature-card, .card, [data-animate]').forEach(el => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(30px)';
      el.style.transition = 'all 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)';
      observer.observe(el);
    });
    
    // Add animation class styles
    const style = document.createElement('style');
    style.textContent = `
      .animate-in {
        opacity: 1 !important;
        transform: translateY(0) !important;
      }
    `;
    document.head.appendChild(style);
  }

  // ============================================
  // INITIALIZE ALL EFFECTS
  // ============================================
  function init() {
    // Respect reduced motion
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }
    
    initPentagonBackground();
    initFloatingPentagons();
    initCustomCursor();
    initParallax();
    initMagneticButtons();
    initNoiseOverlay();
    initHeroGlow();
    initRippleEffect();
    initScrollAnimations();
    initKonamiCode();
    
    console.log('🎨 Cinq WOW Effects loaded! Try the Konami code for a surprise 🎮');
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
