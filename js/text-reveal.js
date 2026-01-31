/**
 * CINQ — Text Reveal Animation
 * ============================
 * Dramatic character-by-character reveal
 * Like Apple or Linear landing pages
 */

(function() {
  'use strict';

  // Split text into characters with spans
  function splitTextIntoChars(element) {
    const text = element.textContent;
    element.innerHTML = '';
    element.setAttribute('aria-label', text);
    
    // Process words
    const words = text.split(' ');
    words.forEach((word, wordIndex) => {
      const wordSpan = document.createElement('span');
      wordSpan.className = 'word';
      wordSpan.style.display = 'inline-block';
      wordSpan.style.whiteSpace = 'nowrap';
      
      // Process characters
      [...word].forEach((char, charIndex) => {
        const charSpan = document.createElement('span');
        charSpan.className = 'char';
        charSpan.textContent = char;
        charSpan.style.cssText = `
          display: inline-block;
          opacity: 0;
          transform: translateY(40px) rotateX(90deg);
          transition: all 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
          transition-delay: ${(wordIndex * 5 + charIndex) * 30}ms;
        `;
        wordSpan.appendChild(charSpan);
      });
      
      element.appendChild(wordSpan);
      
      // Add space between words
      if (wordIndex < words.length - 1) {
        const space = document.createTextNode(' ');
        element.appendChild(space);
      }
    });
  }

  // Reveal animation
  function revealText(element) {
    const chars = element.querySelectorAll('.char');
    chars.forEach(char => {
      char.style.opacity = '1';
      char.style.transform = 'translateY(0) rotateX(0)';
    });
  }

  // Initialize text reveals
  function initTextReveal() {
    // Find hero headlines
    const headlines = document.querySelectorAll('.hero-headline, [data-text-reveal]');
    
    headlines.forEach(headline => {
      // Get the accent span if it exists
      const accentSpan = headline.querySelector('.accent');
      
      if (accentSpan) {
        // Only animate the accent part
        splitTextIntoChars(accentSpan);
        
        // Reveal after a delay
        setTimeout(() => {
          revealText(accentSpan);
        }, 500);
      } else {
        // Animate entire headline
        splitTextIntoChars(headline);
        
        setTimeout(() => {
          revealText(headline);
        }, 300);
      }
    });
  }

  // Smooth scroll with parallax
  function initSmoothParallax() {
    const heroContent = document.querySelector('.hero-content');
    const heroLogo = document.querySelector('.hero-logo, .five');
    
    if (!heroContent) return;
    
    let ticking = false;
    
    function updateParallax() {
      const scrollY = window.pageYOffset;
      const windowHeight = window.innerHeight;
      
      // Only apply within hero section
      if (scrollY < windowHeight) {
        const progress = scrollY / windowHeight;
        
        // Hero content moves up faster (disappears)
        if (heroContent) {
          heroContent.style.transform = `translateY(${scrollY * 0.3}px)`;
          heroContent.style.opacity = 1 - progress * 1.5;
        }
        
        // Logo/Five moves slower (stays longer)
        if (heroLogo) {
          heroLogo.style.transform = `translateY(${scrollY * 0.15}px) scale(${1 - progress * 0.2})`;
        }
      }
      
      ticking = false;
    }
    
    window.addEventListener('scroll', () => {
      if (!ticking) {
        requestAnimationFrame(updateParallax);
        ticking = true;
      }
    }, { passive: true });
  }

  // Counter animation for "847"
  function initCounterAnimation() {
    const headline = document.querySelector('.hero-headline');
    if (!headline) return;
    
    const text = headline.innerHTML;
    
    // Find the number in the text
    const numberMatch = text.match(/\d+/);
    if (!numberMatch) return;
    
    const targetNumber = parseInt(numberMatch[0]);
    const numberSpan = document.createElement('span');
    numberSpan.className = 'animated-number';
    numberSpan.textContent = '0';
    
    // Replace number in HTML
    headline.innerHTML = text.replace(numberMatch[0], numberSpan.outerHTML);
    
    // Get the new span reference
    const animatedNumber = headline.querySelector('.animated-number');
    if (!animatedNumber) return;
    
    // Animate the counter
    const duration = 2000;
    const startTime = performance.now();
    
    function updateCounter(currentTime) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing function (ease-out-expo)
      const eased = 1 - Math.pow(1 - progress, 4);
      const currentNumber = Math.round(eased * targetNumber);
      
      animatedNumber.textContent = currentNumber;
      
      if (progress < 1) {
        requestAnimationFrame(updateCounter);
      }
    }
    
    // Start counter after a delay
    setTimeout(() => {
      requestAnimationFrame(updateCounter);
    }, 800);
  }

  // Scroll indicator bounce
  function initScrollIndicator() {
    const scrollIndicator = document.querySelector('.scroll-indicator, [class*="scroll-down"]');
    if (scrollIndicator) {
      scrollIndicator.classList.add('scroll-indicator');
    }
  }

  // Initialize all
  function init() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }
    
    initTextReveal();
    initSmoothParallax();
    initCounterAnimation();
    initScrollIndicator();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
