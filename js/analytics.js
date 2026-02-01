/**
 * Cinq Analytics - Lightweight client-side analytics
 * 
 * Features:
 * - Page views tracking
 * - Click tracking
 * - Custom events
 * - Local storage queue
 * - Batch sending
 * 
 * Privacy-friendly: No cookies, minimal data collection
 */

(function() {
    'use strict';

    const CONFIG = {
        ENDPOINT: '/api/analytics',
        BATCH_SIZE: 10,           // Send when queue reaches this size
        FLUSH_INTERVAL: 30000,    // Flush every 30 seconds
        STORAGE_KEY: 'cinq_analytics_queue',
        SESSION_KEY: 'cinq_session_id',
        DEBUG: false,
        MAX_QUEUE_SIZE: 100,      // Max events to store locally
        RETRY_ATTEMPTS: 3
    };

    // Generate unique session ID
    function getSessionId() {
        let sessionId = sessionStorage.getItem(CONFIG.SESSION_KEY);
        if (!sessionId) {
            sessionId = 'ses_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
            sessionStorage.setItem(CONFIG.SESSION_KEY, sessionId);
        }
        return sessionId;
    }

    // Get anonymous visitor ID (persisted across sessions)
    function getVisitorId() {
        let visitorId = localStorage.getItem('cinq_visitor_id');
        if (!visitorId) {
            visitorId = 'vis_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('cinq_visitor_id', visitorId);
        }
        return visitorId;
    }

    // Get stored event queue
    function getQueue() {
        try {
            const stored = localStorage.getItem(CONFIG.STORAGE_KEY);
            return stored ? JSON.parse(stored) : [];
        } catch (e) {
            return [];
        }
    }

    // Save event queue
    function saveQueue(queue) {
        try {
            // Trim if too large
            if (queue.length > CONFIG.MAX_QUEUE_SIZE) {
                queue = queue.slice(-CONFIG.MAX_QUEUE_SIZE);
            }
            localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(queue));
        } catch (e) {
            if (CONFIG.DEBUG) console.warn('[Analytics] Storage error:', e);
        }
    }

    // Add event to queue
    function queueEvent(event) {
        const queue = getQueue();
        queue.push(event);
        saveQueue(queue);

        if (CONFIG.DEBUG) {
            console.log('[Analytics] Queued:', event.type, event);
        }

        // Check if we should flush
        if (queue.length >= CONFIG.BATCH_SIZE) {
            flushQueue();
        }
    }

    // Send queued events to server
    async function flushQueue() {
        const queue = getQueue();
        if (queue.length === 0) return;

        const events = queue.slice(0, CONFIG.BATCH_SIZE);
        
        if (CONFIG.DEBUG) {
            console.log('[Analytics] Flushing', events.length, 'events');
        }

        try {
            const response = await fetch(CONFIG.ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ events }),
                keepalive: true // Allow sending even on page unload
            });

            if (response.ok) {
                // Remove sent events from queue
                const remainingQueue = queue.slice(events.length);
                saveQueue(remainingQueue);

                if (CONFIG.DEBUG) {
                    console.log('[Analytics] Sent successfully');
                }
            } else {
                throw new Error(`HTTP ${response.status}`);
            }
        } catch (e) {
            if (CONFIG.DEBUG) {
                console.warn('[Analytics] Send failed, keeping in queue:', e.message);
            }
            // Events stay in queue for next attempt
        }
    }

    // Create base event object
    function createEvent(type, data = {}) {
        return {
            type,
            timestamp: Date.now(),
            sessionId: getSessionId(),
            visitorId: getVisitorId(),
            page: {
                url: window.location.pathname,
                hash: window.location.hash,
                title: document.title,
                referrer: document.referrer
            },
            device: {
                screenWidth: window.screen.width,
                screenHeight: window.screen.height,
                viewport: `${window.innerWidth}x${window.innerHeight}`,
                language: navigator.language,
                platform: navigator.platform
            },
            data
        };
    }

    // Track page view
    function trackPageView(customData = {}) {
        const event = createEvent('pageview', {
            loadTime: performance.now(),
            ...customData
        });
        queueEvent(event);
    }

    // Track click
    function trackClick(element, customData = {}) {
        const target = element.closest('[data-track], a, button');
        if (!target) return;

        const data = {
            tag: target.tagName.toLowerCase(),
            text: (target.textContent || '').trim().substring(0, 50),
            trackId: target.dataset?.track || null,
            href: target.href || null,
            classes: target.className?.substring?.(0, 100) || '',
            ...customData
        };

        const event = createEvent('click', data);
        queueEvent(event);
    }

    // Track custom event
    function trackEvent(eventName, eventData = {}) {
        const event = createEvent('custom', {
            name: eventName,
            ...eventData
        });
        queueEvent(event);
    }

    // Track form submission
    function trackFormSubmit(form, customData = {}) {
        const data = {
            formId: form.id || null,
            formName: form.name || null,
            formAction: form.action || null,
            ...customData
        };

        const event = createEvent('form_submit', data);
        queueEvent(event);
    }

    // Track scroll depth
    let maxScrollDepth = 0;
    function trackScrollDepth() {
        const scrollTop = window.scrollY || document.documentElement.scrollTop;
        const docHeight = document.documentElement.scrollHeight - window.innerHeight;
        const scrollPercent = docHeight > 0 ? Math.round((scrollTop / docHeight) * 100) : 0;

        if (scrollPercent > maxScrollDepth) {
            maxScrollDepth = scrollPercent;
        }
    }

    // Track time on page
    let pageLoadTime = Date.now();
    function getTimeOnPage() {
        return Math.round((Date.now() - pageLoadTime) / 1000);
    }

    // Track page exit
    function trackPageExit() {
        const event = createEvent('page_exit', {
            timeOnPage: getTimeOnPage(),
            scrollDepth: maxScrollDepth
        });
        
        // Use sendBeacon for reliability on page unload
        if (navigator.sendBeacon) {
            const blob = new Blob([JSON.stringify({ events: [event] })], { type: 'application/json' });
            navigator.sendBeacon(CONFIG.ENDPOINT, blob);
        } else {
            // Fallback: synchronous XHR
            const xhr = new XMLHttpRequest();
            xhr.open('POST', CONFIG.ENDPOINT, false);
            xhr.setRequestHeader('Content-Type', 'application/json');
            xhr.send(JSON.stringify({ events: [event] }));
        }
    }

    // Setup automatic tracking
    function setupAutoTracking() {
        // Track initial page view
        if (document.readyState === 'complete') {
            trackPageView();
        } else {
            window.addEventListener('load', () => trackPageView());
        }

        // Track clicks
        document.addEventListener('click', (e) => {
            trackClick(e.target);
        }, { passive: true });

        // Track form submissions
        document.addEventListener('submit', (e) => {
            if (e.target.tagName === 'FORM') {
                trackFormSubmit(e.target);
            }
        }, { passive: true });

        // Track scroll depth (throttled)
        let scrollTimeout;
        window.addEventListener('scroll', () => {
            if (!scrollTimeout) {
                scrollTimeout = setTimeout(() => {
                    trackScrollDepth();
                    scrollTimeout = null;
                }, 100);
            }
        }, { passive: true });

        // Track page exit
        window.addEventListener('beforeunload', trackPageExit);
        window.addEventListener('pagehide', trackPageExit);

        // Track hash changes (SPA navigation)
        window.addEventListener('hashchange', () => {
            maxScrollDepth = 0;
            pageLoadTime = Date.now();
            trackPageView({ navigationType: 'hash' });
        });

        // Track visibility changes
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') {
                flushQueue();
            }
        });

        // Periodic flush
        setInterval(flushQueue, CONFIG.FLUSH_INTERVAL);

        // Flush on startup if there are queued events
        setTimeout(flushQueue, 1000);
    }

    // Performance metrics tracking
    function trackPerformance() {
        if (!window.performance || !window.performance.timing) return;

        // Wait for load to complete
        window.addEventListener('load', () => {
            setTimeout(() => {
                const timing = performance.timing;
                const metrics = {
                    dns: timing.domainLookupEnd - timing.domainLookupStart,
                    tcp: timing.connectEnd - timing.connectStart,
                    ttfb: timing.responseStart - timing.requestStart,
                    domLoad: timing.domContentLoadedEventEnd - timing.navigationStart,
                    windowLoad: timing.loadEventEnd - timing.navigationStart
                };

                // Get Core Web Vitals if available
                if (window.PerformanceObserver) {
                    try {
                        // LCP
                        new PerformanceObserver((list) => {
                            const entries = list.getEntries();
                            const lcp = entries[entries.length - 1];
                            if (lcp) {
                                trackEvent('performance', { 
                                    metric: 'lcp',
                                    value: Math.round(lcp.startTime)
                                });
                            }
                        }).observe({ type: 'largest-contentful-paint', buffered: true });

                        // FID
                        new PerformanceObserver((list) => {
                            const entries = list.getEntries();
                            entries.forEach((entry) => {
                                trackEvent('performance', {
                                    metric: 'fid',
                                    value: Math.round(entry.processingStart - entry.startTime)
                                });
                            });
                        }).observe({ type: 'first-input', buffered: true });

                        // CLS
                        let clsValue = 0;
                        new PerformanceObserver((list) => {
                            for (const entry of list.getEntries()) {
                                if (!entry.hadRecentInput) {
                                    clsValue += entry.value;
                                }
                            }
                        }).observe({ type: 'layout-shift', buffered: true });

                        // Report CLS on page hide
                        window.addEventListener('visibilitychange', () => {
                            if (document.visibilityState === 'hidden' && clsValue > 0) {
                                trackEvent('performance', {
                                    metric: 'cls',
                                    value: Math.round(clsValue * 1000) / 1000
                                });
                            }
                        });
                    } catch (e) {
                        // PerformanceObserver not fully supported
                    }
                }

                trackEvent('performance', {
                    metric: 'timing',
                    ...metrics
                });
            }, 0);
        });
    }

    // Error tracking
    function setupErrorTracking() {
        window.addEventListener('error', (e) => {
            trackEvent('error', {
                message: e.message?.substring(0, 200),
                filename: e.filename?.substring(0, 100),
                line: e.lineno,
                column: e.colno
            });
        });

        window.addEventListener('unhandledrejection', (e) => {
            trackEvent('error', {
                type: 'unhandled_promise',
                message: String(e.reason)?.substring(0, 200)
            });
        });
    }

    // Public API
    window.CinqAnalytics = {
        // Core tracking methods
        trackPageView,
        trackClick,
        trackEvent,
        trackFormSubmit,

        // Manual flush
        flush: flushQueue,

        // Get current queue size
        getQueueSize: () => getQueue().length,

        // Clear queue (for testing)
        clearQueue: () => saveQueue([]),

        // Get session info
        getSession: () => ({
            sessionId: getSessionId(),
            visitorId: getVisitorId(),
            timeOnPage: getTimeOnPage(),
            scrollDepth: maxScrollDepth
        }),

        // Enable/disable debug mode
        debug: (enabled) => { CONFIG.DEBUG = enabled; },

        // Check if initialized
        isReady: true,

        // Version
        version: '1.0.0'
    };

    // Initialize
    setupAutoTracking();
    trackPerformance();
    setupErrorTracking();

    if (CONFIG.DEBUG) {
        console.log('[Analytics] Cinq Analytics initialized');
    }

})();
