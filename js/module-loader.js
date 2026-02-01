
/**
 * Modular JavaScript Loader for Cinq
 * Loads scripts on demand to improve initial page load
 */

class ModuleLoader {
    constructor() {
        this.loadedModules = new Set();
        this.loadingPromises = new Map();
    }
    
    async loadModule(src) {
        if (this.loadedModules.has(src)) {
            return true;
        }
        
        if (this.loadingPromises.has(src)) {
            return this.loadingPromises.get(src);
        }
        
        const promise = new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.defer = true;
            
            script.onload = () => {
                this.loadedModules.add(src);
                resolve(true);
            };
            
            script.onerror = () => reject(new Error(`Failed to load ${src}`));
            
            document.head.appendChild(script);
        });
        
        this.loadingPromises.set(src, promise);
        return promise;
    }
    
    // Load modules when user interacts
    async loadOnInteraction(modules) {
        const loadModules = () => {
            modules.forEach(module => this.loadModule(module));
            // Remove listeners after first interaction
            ['mousedown', 'touchstart', 'keydown'].forEach(event => {
                document.removeEventListener(event, loadModules, { passive: true });
            });
        };
        
        ['mousedown', 'touchstart', 'keydown'].forEach(event => {
            document.addEventListener(event, loadModules, { passive: true });
        });
        
        // Fallback: load after 3 seconds
        setTimeout(() => loadModules(), 3000);
    }
    
    // Load modules when in viewport
    async loadOnIntersection(modules, target) {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    modules.forEach(module => this.loadModule(module));
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.1 });
        
        const element = document.querySelector(target);
        if (element) observer.observe(element);
    }
}

// Initialize module loader
const moduleLoader = new ModuleLoader();

// Load non-critical modules on first user interaction
moduleLoader.loadOnInteraction([
    '/js/easter-eggs.min.js',
    '/js/confetti.min.js',
    '/js/view-transitions.min.js'
]);

// Load feature modules when sections become visible
moduleLoader.loadOnIntersection(['/js/wow-effects.js'], '#testimonials');
