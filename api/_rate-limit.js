/**
 * Enhanced rate limiter with Redis support for distributed serverless functions
 * Falls back to in-memory storage when Redis is unavailable
 */

import { get, set, CACHE_TTL } from './_cache.js';

const rateLimitStore = new Map();

// Clean old entries every 5 minutes
setInterval(() => {
    const now = Date.now();
    for (const [key, data] of rateLimitStore.entries()) {
        if (now - data.windowStart > data.windowMs * 2) {
            rateLimitStore.delete(key);
        }
    }
}, 5 * 60 * 1000);

/**
 * Enhanced rate limiter with Redis support
 * @param {string} key - Unique identifier (IP, userId, etc.)
 * @param {object} options - { max: number, windowMs: number }
 * @returns {Promise<{ success: boolean, remaining: number, resetMs: number }>}
 */
export async function rateLimit(key, options = {}) {
    const { max = 100, windowMs = 60 * 1000 } = options;
    const now = Date.now();
    const cacheKey = `ratelimit:${key}`;
    
    try {
        // Try to get from distributed cache first
        let data = await get(cacheKey);
        
        if (!data || now - data.windowStart > windowMs) {
            // New window
            data = { count: 1, windowStart: now, windowMs };
            await set(cacheKey, data, Math.ceil(windowMs / 1000));
            return { success: true, remaining: max - 1, resetMs: windowMs };
        }
        
        data.count++;
        
        if (data.count > max) {
            const resetMs = windowMs - (now - data.windowStart);
            // Still update cache to maintain count across requests
            await set(cacheKey, data, Math.ceil(resetMs / 1000));
            return { success: false, remaining: 0, resetMs };
        }
        
        // Update cache with new count
        const remainingMs = windowMs - (now - data.windowStart);
        await set(cacheKey, data, Math.ceil(remainingMs / 1000));
        return { success: true, remaining: max - data.count, resetMs: remainingMs };
        
    } catch (error) {
        console.warn('[RateLimit] Cache error, falling back to memory:', error.message);
        
        // Fallback to in-memory rate limiting
        let data = rateLimitStore.get(key);
        
        if (!data || now - data.windowStart > windowMs) {
            data = { count: 1, windowStart: now, windowMs };
            rateLimitStore.set(key, data);
            return { success: true, remaining: max - 1, resetMs: windowMs };
        }
        
        data.count++;
        
        if (data.count > max) {
            const resetMs = windowMs - (now - data.windowStart);
            return { success: false, remaining: 0, resetMs };
        }
        
        return { success: true, remaining: max - data.count, resetMs: windowMs - (now - data.windowStart) };
    }
}

/**
 * Get client IP from request
 */
export function getClientIP(req) {
    return req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
           req.headers['x-real-ip'] ||
           req.socket?.remoteAddress ||
           'unknown';
}

/**
 * Apply rate limit and return 429 if exceeded
 * @returns {Promise<boolean>} true if allowed, false if rate limited (response sent)
 */
export async function checkRateLimit(req, res, options = {}) {
    // SECURITY: Only allow test bypass if secret is explicitly set and non-empty
    // This prevents bypass when TEST_BYPASS_SECRET is undefined or empty
    const bypassSecret = process.env.TEST_BYPASS_SECRET;
    const bypassHeader = req.headers['x-test-bypass'];
    if (bypassSecret && bypassSecret.length >= 32 && bypassHeader === bypassSecret) {
        return true;
    }
    
    const { 
        max = 60,           // requests
        windowMs = 60000,   // per minute
        keyPrefix = 'api',
        userId = null 
    } = options;
    
    const ip = getClientIP(req);
    const key = userId ? `${keyPrefix}:user:${userId}` : `${keyPrefix}:ip:${ip}`;
    
    const result = await rateLimit(key, { max, windowMs });
    
    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, result.remaining));
    res.setHeader('X-RateLimit-Reset', Math.ceil((Date.now() + result.resetMs) / 1000));
    
    if (!result.success) {
        res.status(429).json({ 
            error: 'Trop de requêtes. Réessaie dans quelques instants.',
            retryAfter: Math.ceil(result.resetMs / 1000)
        });
        return false;
    }
    
    return true;
}

// Preset configurations
export const RATE_LIMITS = {
    // Strict: login/register (prevent brute force)
    AUTH: { max: 30, windowMs: 60 * 1000 },       // 30 per minute
    
    // Medium: creating resources
    CREATE: { max: 60, windowMs: 60 * 1000 },     // 60 per minute
    
    // Relaxed: reading data
    READ: { max: 200, windowMs: 60 * 1000 },      // 200 per minute
    
    // Public endpoints (waitlist)
    PUBLIC: { max: 30, windowMs: 60 * 1000 },     // 30 per minute
    
    // Strict: gift code creation (IP-based)
    GIFT_CREATE: { max: 10, windowMs: 60 * 60 * 1000 }, // 10 per hour
};
