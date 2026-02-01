/**
 * CINQ Design Auto-Enhancement Script
 * Automatically applies modern design improvements to all pages
 * Run this to instantly polish the remaining pages
 */

(function() {
    'use strict';
    
    console.log('🎨 Cinq Design Enhancement Script Loading...');
    
    // Add improvements CSS if not already present
    function addImprovementsCSS() {
        if (!document.querySelector('link[href*="improvements.css"]')) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = '/css/improvements.css';
            document.head.appendChild(link);
            console.log('✅ Enhanced CSS loaded');
        }
    }
    
    // Auto-enhance common UI elements
    function enhanceUIElements() {
        let enhancementCount = 0;
        
        // Enhance cards
        document.querySelectorAll('.card:not(.card-enhanced)').forEach(el => {
            el.classList.add('card-enhanced');
            enhancementCount++;
        });
        
        // Enhance buttons  
        document.querySelectorAll('.btn-primary:not(.btn-enhanced)').forEach(el => {
            el.classList.add('btn-enhanced');
            enhancementCount++;
        });
        
        document.querySelectorAll('.cta-button:not(.btn-enhanced)').forEach(el => {
            el.classList.add('btn-enhanced');
            enhancementCount++;
        });
        
        // Enhance inputs
        document.querySelectorAll('.input:not(.input-enhanced)').forEach(el => {
            el.classList.add('input-enhanced');
            enhancementCount++;
        });
        
        document.querySelectorAll('input[type="text"]:not(.input-enhanced)').forEach(el => {
            if (!el.classList.contains('input-enhanced')) {
                el.classList.add('input', 'input-enhanced');
                enhancementCount++;
            }
        });
        
        document.querySelectorAll('input[type="email"]:not(.input-enhanced)').forEach(el => {
            if (!el.classList.contains('input-enhanced')) {
                el.classList.add('input', 'input-enhanced');
                enhancementCount++;
            }
        });
        
        document.querySelectorAll('input[type="password"]:not(.input-enhanced)').forEach(el => {
            if (!el.classList.contains('input-enhanced')) {
                el.classList.add('input', 'input-enhanced');
                enhancementCount++;
            }
        });
        
        // Enhance avatars
        document.querySelectorAll('.contact-avatar:not(.avatar-enhanced)').forEach(el => {
            el.classList.add('avatar-enhanced');
            enhancementCount++;
        });
        
        document.querySelectorAll('.header-avatar:not(.avatar-enhanced)').forEach(el => {
            el.classList.add('avatar-enhanced');
            enhancementCount++;
        });
        
        // Enhance navigation
        document.querySelectorAll('.nav, .sidebar:not(.nav-enhanced)').forEach(el => {
            el.classList.add('nav-enhanced');
            enhancementCount++;
        });
        
        // Enhance messages
        document.querySelectorAll('.message-bubble:not(.message-enhanced)').forEach(el => {
            el.classList.add('message-enhanced');
            enhancementCount++;
        });
        
        console.log(`✅ Enhanced ${enhancementCount} UI elements`);
    }
    
    // Add scroll animations
    function addScrollAnimations() {
        let animationCount = 0;
        
        // Convert basic scroll-reveal to enhanced
        document.querySelectorAll('.scroll-reveal:not(.scroll-reveal-enhanced)').forEach(el => {
            el.classList.remove('scroll-reveal');
            el.classList.add('scroll-reveal-enhanced');
            animationCount++;
        });
        
        // Convert stagger children to enhanced
        document.querySelectorAll('.stagger-children:not(.stagger-enhanced)').forEach(el => {
            el.classList.remove('stagger-children');
            el.classList.add('stagger-enhanced');
            animationCount++;
        });
        
        // Auto-add scroll reveal to main content sections
        document.querySelectorAll('section:not(.scroll-reveal-enhanced)').forEach(el => {
            if (!el.closest('.hero')) { // Don't affect hero section
                el.classList.add('scroll-reveal-enhanced');
                animationCount++;
            }
        });
        
        console.log(`✅ Enhanced ${animationCount} animations`);
    }
    
    // Add glassmorphism to main containers
    function addGlassMorphism() {
        let glassCount = 0;
        
        // Enhance main containers
        document.querySelectorAll('.main-content, .content-wrapper:not(.glass-enhanced)').forEach(el => {
            el.classList.add('glass-enhanced');
            glassCount++;
        });
        
        // Enhance modal containers
        document.querySelectorAll('.modal:not(.card-enhanced)').forEach(el => {
            el.classList.add('card-enhanced');
            glassCount++;
        });
        
        console.log(`✅ Enhanced ${glassCount} glass elements`);
    }
    
    // Add floating action button if needed
    function addFloatingActionButton() {
        const currentPage = window.location.pathname;
        
        // Add FAB to app pages that need quick actions
        if (currentPage.includes('app.html') || currentPage.includes('feed')) {
            if (!document.querySelector('.fab-enhanced')) {
                const fab = document.createElement('button');
                fab.className = 'fab-enhanced';
                fab.innerHTML = `
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="12" y1="5" x2="12" y2="19"></line>
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                    </svg>
                `;
                fab.onclick = () => console.log('FAB clicked - implement your action');
                document.body.appendChild(fab);
                console.log('✅ Added floating action button');
            }
        }
    }
    
    // Initialize scroll reveal observer for enhanced animations
    function initScrollRevealObserver() {
        const observerOptions = {
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px'
        };
        
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('revealed');
                }
            });
        }, observerOptions);
        
        // Observe all enhanced scroll elements
        document.querySelectorAll('.scroll-reveal-enhanced, .stagger-enhanced').forEach(el => {
            observer.observe(el);
        });
        
        console.log('✅ Scroll animations initialized');
    }
    
    // Main enhancement function
    function enhanceDesign() {
        console.log('🚀 Starting design enhancement...');
        
        try {
            addImprovementsCSS();
            enhanceUIElements();
            addScrollAnimations();
            addGlassMorphism();
            addFloatingActionButton();
            
            // Initialize animations after DOM is ready
            setTimeout(() => {
                initScrollRevealObserver();
            }, 100);
            
            console.log('✨ Design enhancement complete!');
            
            // Show success notification
            if (window.showToast || window.CinqAnimations?.showToast) {
                const toastFn = window.showToast || window.CinqAnimations.showToast;
                toastFn({
                    title: 'Design Enhanced!',
                    message: 'Modern improvements applied successfully',
                    type: 'success',
                    duration: 3000
                });
            } else {
                console.log('🎉 Design successfully enhanced with modern improvements!');
            }
            
        } catch (error) {
            console.error('❌ Enhancement error:', error);
        }
    }
    
    // Run enhancement when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', enhanceDesign);
    } else {
        enhanceDesign();
    }
    
    // Export for manual usage
    window.CinqDesignEnhancer = {
        enhance: enhanceDesign,
        addCSS: addImprovementsCSS,
        enhanceElements: enhanceUIElements,
        addAnimations: addScrollAnimations,
        addGlass: addGlassMorphism
    };
    
})();

console.log(`
🎨 CINQ Design Enhancement Script Loaded!

Usage:
- Auto-runs on page load
- Manual: CinqDesignEnhancer.enhance()
- Specific: CinqDesignEnhancer.enhanceElements()

This will make any page look modern and cohesive! ✨
`);