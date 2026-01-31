/**
 * CINQ — Page Transitions & Section Reveals
 * ==========================================
 * Smooth transitions, section animations
 * The polish that makes everything feel premium
 */

(function() {
  'use strict';

  // ============================================
  // PAGE LOADER - Pentagon Animation
  // ============================================
  function initPageLoader() {
    // Create loader
    const loader = document.createElement('div');
    loader.id = 'cinq-loader';
    loader.innerHTML = `
      <div class="loader-pentagon">
        <svg viewBox="0 0 100 100">
          <polygon 
            class="pentagon-path"
            points="50,5 95,35 82,90 18,90 5,35"
            fill="none"
            stroke="#FF6B5B"
            stroke-width="2"
          />
        </svg>
        <span class="loader-number">5</span>
      </div>
    `;
    
    const style = document.createElement('style');
    style.textContent = `
      #cinq-loader {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: var(--color-bg-primary, #faf9f7);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 99999;
        transition: opacity 0.5s ease, visibility 0.5s ease;
      }
      
      [data-theme="dark"] #cinq-loader {
        background: #0c0c0f;
      }
      
      #cinq-loader.loaded {
        opacity: 0;
        visibility: hidden;
        pointer-events: none;
      }
      
      .loader-pentagon {
        position: relative;
        width: 80px;
        height: 80px;
      }
      
      .loader-pentagon svg {
        width: 100%;
        height: 100%;
        animation: loaderSpin 2s linear infinite;
      }
      
      .pentagon-path {
        stroke-dasharray: 300;
        stroke-dashoffset: 300;
        animation: loaderDraw 1.5s ease-in-out infinite;
      }
      
      .loader-number {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        font-size: 24px;
        font-weight: 700;
        color: #FF6B5B;
        animation: loaderPulse 1s ease-in-out infinite;
      }
      
      @keyframes loaderSpin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
      
      @keyframes loaderDraw {
        0% { stroke-dashoffset: 300; }
        50% { stroke-dashoffset: 0; }
        100% { stroke-dashoffset: -300; }
      }
      
      @keyframes loaderPulse {
        0%, 100% { opacity: 0.5; transform: translate(-50%, -50%) scale(0.9); }
        50% { opacity: 1; transform: translate(-50%, -50%) scale(1.1); }
      }
    `;
    
    document.head.appendChild(style);
    document.body.insertBefore(loader, document.body.firstChild);
    
    // Hide loader when page is ready
    window.addEventListener('load', () => {
      setTimeout(() => {
        loader.classList.add('loaded');
        setTimeout(() => loader.remove(), 500);
      }, 500);
    });
  }

  // ============================================
  // SECTION REVEAL ANIMATIONS
  // ============================================
  function initSectionReveals() {
    const sections = document.querySelectorAll('section, .section, [class*="section"]');
    
    const observerOptions = {
      root: null,
      rootMargin: '0px',
      threshold: 0.1
    };
    
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('section-visible');
          
          // Animate children with stagger
          const children = entry.target.querySelectorAll('[data-reveal]');
          children.forEach((child, i) => {
            setTimeout(() => {
              child.classList.add('revealed');
            }, i * 100);
          });
        }
      });
    }, observerOptions);
    
    sections.forEach(section => {
      section.classList.add('section-hidden');
      observer.observe(section);
    });
    
    // Add reveal styles
    const style = document.createElement('style');
    style.textContent = `
      .section-hidden {
        opacity: 0;
        transform: translateY(40px);
        transition: opacity 0.8s cubic-bezier(0.34, 1.56, 0.64, 1),
                    transform 0.8s cubic-bezier(0.34, 1.56, 0.64, 1);
      }
      
      .section-visible {
        opacity: 1;
        transform: translateY(0);
      }
      
      [data-reveal] {
        opacity: 0;
        transform: translateY(20px);
        transition: opacity 0.6s ease, transform 0.6s ease;
      }
      
      [data-reveal].revealed {
        opacity: 1;
        transform: translateY(0);
      }
      
      /* Prevent hero from hiding */
      .hero.section-hidden,
      [class*="hero"].section-hidden {
        opacity: 1;
        transform: none;
      }
    `;
    document.head.appendChild(style);
  }

  // ============================================
  // SMOOTH PAGE TRANSITIONS (SPA-like)
  // ============================================
  function initPageTransitions() {
    // Create transition overlay
    const overlay = document.createElement('div');
    overlay.id = 'page-transition';
    overlay.innerHTML = `
      <div class="transition-pentagon">
        <svg viewBox="0 0 100 100">
          <polygon points="50,5 95,35 82,90 18,90 5,35" fill="#FF6B5B"/>
        </svg>
      </div>
    `;
    
    const style = document.createElement('style');
    style.textContent = `
      #page-transition {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: var(--color-bg-primary, #faf9f7);
        z-index: 99998;
        display: flex;
        align-items: center;
        justify-content: center;
        clip-path: circle(0% at 50% 50%);
        transition: clip-path 0.6s cubic-bezier(0.77, 0, 0.175, 1);
        pointer-events: none;
      }
      
      [data-theme="dark"] #page-transition {
        background: #0c0c0f;
      }
      
      #page-transition.active {
        clip-path: circle(150% at 50% 50%);
        pointer-events: all;
      }
      
      .transition-pentagon {
        width: 60px;
        height: 60px;
        opacity: 0;
        transform: scale(0) rotate(-180deg);
        transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
      }
      
      #page-transition.active .transition-pentagon {
        opacity: 1;
        transform: scale(1) rotate(0deg);
        transition-delay: 0.2s;
      }
    `;
    
    document.head.appendChild(style);
    document.body.appendChild(overlay);
    
    // Intercept internal links
    document.addEventListener('click', (e) => {
      const link = e.target.closest('a');
      if (!link) return;
      
      const href = link.getAttribute('href');
      if (!href || href.startsWith('#') || href.startsWith('http') || href.startsWith('mailto:')) return;
      
      e.preventDefault();
      
      overlay.classList.add('active');
      
      setTimeout(() => {
        window.location.href = href;
      }, 600);
    });
  }

  // ============================================
  // SCROLL PROGRESS INDICATOR
  // ============================================
  function initScrollProgress() {
    const progress = document.createElement('div');
    progress.id = 'scroll-progress';
    
    const style = document.createElement('style');
    style.textContent = `
      #scroll-progress {
        position: fixed;
        top: 0;
        left: 0;
        width: 0%;
        height: 3px;
        background: linear-gradient(90deg, #FF6B5B, #FF8A7D, #FFB199);
        z-index: 9999;
        transition: width 0.1s linear;
        box-shadow: 0 0 10px rgba(255, 107, 91, 0.5);
      }
    `;
    
    document.head.appendChild(style);
    document.body.appendChild(progress);
    
    window.addEventListener('scroll', () => {
      const scrollTop = window.pageYOffset;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const scrollPercent = (scrollTop / docHeight) * 100;
      progress.style.width = scrollPercent + '%';
    }, { passive: true });
  }

  // ============================================
  // HOVER GLOW ON CARDS
  // ============================================
  function initCardGlow() {
    const cards = document.querySelectorAll('.card, .feature-card, [class*="card"]');
    
    cards.forEach(card => {
      card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        card.style.setProperty('--glow-x', `${x}px`);
        card.style.setProperty('--glow-y', `${y}px`);
      });
    });
    
    // Add glow styles
    const style = document.createElement('style');
    style.textContent = `
      .card, .feature-card, [class*="card"] {
        position: relative;
        overflow: hidden;
      }
      
      .card::before, .feature-card::before {
        content: '';
        position: absolute;
        top: var(--glow-y, 50%);
        left: var(--glow-x, 50%);
        width: 300px;
        height: 300px;
        background: radial-gradient(circle, rgba(255, 107, 91, 0.15) 0%, transparent 70%);
        transform: translate(-50%, -50%);
        pointer-events: none;
        opacity: 0;
        transition: opacity 0.3s ease;
      }
      
      .card:hover::before, .feature-card:hover::before {
        opacity: 1;
      }
    `;
    document.head.appendChild(style);
  }

  // ============================================
  // INITIALIZE
  // ============================================
  function init() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }
    
    initPageLoader();
    initSectionReveals();
    initPageTransitions();
    initScrollProgress();
    initCardGlow();
  }

  // Run immediately for loader
  init();
})();
