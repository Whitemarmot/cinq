/**
 * Cinq Analytics - Privacy-friendly tracking with Plausible
 * 
 * RGPD compliant: No cookies, no personal data, no tracking across sites
 * Tracks: page views, waitlist signups, gift purchases
 * 
 * @see https://plausible.io/docs
 */

(function() {
    'use strict';

    // Configuration - Set your Plausible domain here
    // For self-hosted: change PLAUSIBLE_HOST
    // For cloud: use 'https://plausible.io'
    const CONFIG = {
        DOMAIN: 'cinq.app',
        PLAUSIBLE_HOST: 'https://plausible.io',
        DEBUG: false  // Set to true for console logs
    };

    // Plausible script loader
    function loadPlausible() {
        if (document.querySelector('script[data-domain="' + CONFIG.DOMAIN + '"]')) {
            return; // Already loaded
        }

        const script = document.createElement('script');
        script.defer = true;
        script.setAttribute('data-domain', CONFIG.DOMAIN);
        script.src = CONFIG.PLAUSIBLE_HOST + '/js/script.js';
        
        // Optional: Enable hash-based routing tracking
        // script.src = CONFIG.PLAUSIBLE_HOST + '/js/script.hash.js';
        
        document.head.appendChild(script);

        if (CONFIG.DEBUG) {
            console.log('[Cinq Analytics] Plausible loaded for:', CONFIG.DOMAIN);
        }
    }

    // Custom event tracking wrapper
    function trackEvent(eventName, props = {}) {
        if (typeof window.plausible === 'undefined') {
            // Queue events if plausible not loaded yet
            window.plausible = window.plausible || function() {
                (window.plausible.q = window.plausible.q || []).push(arguments);
            };
        }

        window.plausible(eventName, { props });

        if (CONFIG.DEBUG) {
            console.log('[Cinq Analytics] Event:', eventName, props);
        }
    }

    // Public API
    window.CinqAnalytics = {
        /**
         * Track waitlist signup
         * @param {Object} data - { utm_source, utm_medium, utm_campaign }
         */
        trackWaitlistSignup: function(data = {}) {
            trackEvent('Waitlist Signup', {
                source: data.utm_source || 'direct',
                medium: data.utm_medium || 'none',
                campaign: data.utm_campaign || 'none'
            });
        },

        /**
         * Track gift purchase initiated
         * @param {Object} data - { price, currency, recipient_type }
         */
        trackGiftInitiated: function(data = {}) {
            trackEvent('Gift Initiated', {
                price: data.price || 'unknown',
                currency: data.currency || 'EUR'
            });
        },

        /**
         * Track gift purchase completed (payment success)
         * @param {Object} data - { price, currency, payment_method }
         */
        trackGiftPurchased: function(data = {}) {
            trackEvent('Gift Purchased', {
                price: data.price || 'unknown',
                currency: data.currency || 'EUR',
                method: data.payment_method || 'btcpay'
            });
        },

        /**
         * Track gift redemption
         * @param {Object} data - { source }
         */
        trackGiftRedeemed: function(data = {}) {
            trackEvent('Gift Redeemed', {
                source: data.source || 'link'
            });
        },

        /**
         * Track CTA clicks
         * @param {string} ctaName - Name of the CTA button
         * @param {string} location - Where on the page
         */
        trackCTAClick: function(ctaName, location = 'unknown') {
            trackEvent('CTA Click', {
                cta: ctaName,
                location: location
            });
        },

        /**
         * Track page section views (for scroll depth)
         * @param {string} section - Section name
         */
        trackSectionView: function(section) {
            trackEvent('Section View', {
                section: section
            });
        },

        /**
         * Track errors for debugging
         * @param {string} errorType - Type of error
         * @param {string} message - Error message
         */
        trackError: function(errorType, message) {
            trackEvent('Error', {
                type: errorType,
                message: message.substring(0, 100) // Truncate
            });
        },

        /**
         * Raw event tracking
         * @param {string} eventName 
         * @param {Object} props 
         */
        track: trackEvent,

        /**
         * Check if analytics is loaded
         */
        isLoaded: function() {
            return typeof window.plausible !== 'undefined';
        }
    };

    // Auto-initialize on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', loadPlausible);
    } else {
        loadPlausible();
    }

    // Auto-track outbound links
    document.addEventListener('click', function(e) {
        const link = e.target.closest('a[href^="http"]');
        if (link && !link.href.includes(window.location.hostname)) {
            trackEvent('Outbound Link', {
                url: link.href
            });
        }
    });

})();
