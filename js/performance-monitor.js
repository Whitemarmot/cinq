
/**
 * Cinq Performance Monitor
 * Tracks Core Web Vitals and sends to analytics
 */

class PerformanceMonitor {
    constructor() {
        this.metrics = {};
        this.init();
    }
    
    init() {
        // Largest Contentful Paint (LCP)
        this.observeLCP();
        
        // Cumulative Layout Shift (CLS)
        this.observeCLS();
        
        // First Input Delay (FID)
        this.observeFID();
        
        // Time to Interactive (TTI)
        this.measureTTI();
        
        // Send metrics after page load
        window.addEventListener('load', () => {
            setTimeout(() => this.sendMetrics(), 1000);
        });
    }
    
    observeLCP() {
        if ('PerformanceObserver' in window) {
            const observer = new PerformanceObserver((list) => {
                const entries = list.getEntries();
                const lastEntry = entries[entries.length - 1];
                this.metrics.lcp = lastEntry.startTime;
            });
            observer.observe({ type: 'largest-contentful-paint', buffered: true });
        }
    }
    
    observeCLS() {
        if ('PerformanceObserver' in window) {
            let clsScore = 0;
            const observer = new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) {
                    if (!entry.hadRecentInput) {
                        clsScore += entry.value;
                    }
                }
                this.metrics.cls = clsScore;
            });
            observer.observe({ type: 'layout-shift', buffered: true });
        }
    }
    
    observeFID() {
        if ('PerformanceObserver' in window) {
            const observer = new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) {
                    this.metrics.fid = entry.processingStart - entry.startTime;
                    observer.disconnect();
                    break;
                }
            });
            observer.observe({ type: 'first-input', buffered: true });
        }
    }
    
    measureTTI() {
        // Simple TTI approximation
        const navigationStart = performance.timeOrigin;
        window.addEventListener('load', () => {
            // Wait for main thread to be idle
            requestIdleCallback(() => {
                this.metrics.tti = performance.now();
            });
        });
    }
    
    sendMetrics() {
        // Only send if we have meaningful data
        if (Object.keys(this.metrics).length > 0) {
            console.log('📊 Core Web Vitals:', this.metrics);
            
            // Send to analytics endpoint (if available)
            if (typeof gtag === 'function') {
                gtag('event', 'core_web_vitals', {
                    lcp: this.metrics.lcp,
                    cls: this.metrics.cls,
                    fid: this.metrics.fid,
                    tti: this.metrics.tti
                });
            }
        }
    }
}

// Initialize performance monitoring
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        new PerformanceMonitor();
    });
} else {
    new PerformanceMonitor();
}
