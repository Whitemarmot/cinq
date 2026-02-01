/**
 * Caching layer for Cinq API
 * 
 * Supports both Redis (production) and in-memory (development) caching
 * with automatic fallback and TTL management.
 */

// In-memory cache fallback
const memoryCache = new Map();

// Redis client (lazy initialization)
let redis = null;
let redisConnected = false;

/**
 * Initialize Redis client if available
 */
async function initRedis() {
    if (redis) return redis;
    
    try {
        // Only try Redis if URL is configured
        const redisUrl = process.env.REDIS_URL || process.env.REDIS_TLS_URL;
        if (!redisUrl) {
            console.log('[Cache] Redis URL not configured, using in-memory cache');
            return null;
        }

        // Dynamic import to avoid errors when redis is not installed
        const { createClient } = await import('redis');
        
        redis = createClient({
            url: redisUrl,
            socket: {
                tls: redisUrl.includes('rediss://'),
                rejectUnauthorized: false
            }
        });

        redis.on('error', (err) => {
            console.error('[Cache] Redis error:', err);
            redisConnected = false;
        });

        redis.on('connect', () => {
            console.log('[Cache] Redis connected');
            redisConnected = true;
        });

        await redis.connect();
        return redis;
        
    } catch (error) {
        console.warn('[Cache] Failed to initialize Redis:', error.message);
        console.log('[Cache] Falling back to in-memory cache');
        return null;
    }
}

/**
 * Get value from cache (Redis or memory fallback)
 * @param {string} key - Cache key
 * @returns {Promise<any|null>} Cached value or null
 */
export async function get(key) {
    try {
        // Try Redis first
        if (!redis) redis = await initRedis();
        
        if (redis && redisConnected) {
            const value = await redis.get(key);
            if (value) {
                return JSON.parse(value);
            }
        }
    } catch (error) {
        console.warn('[Cache] Redis get failed:', error.message);
    }

    // Fallback to memory cache
    const memItem = memoryCache.get(key);
    if (memItem && Date.now() < memItem.expiry) {
        return memItem.value;
    }
    
    // Clean expired memory items
    if (memItem && Date.now() >= memItem.expiry) {
        memoryCache.delete(key);
    }
    
    return null;
}

/**
 * Set value in cache with TTL
 * @param {string} key - Cache key
 * @param {any} value - Value to cache
 * @param {number} ttl - Time to live in seconds
 */
export async function set(key, value, ttl = 300) {
    try {
        // Try Redis first
        if (!redis) redis = await initRedis();
        
        if (redis && redisConnected) {
            await redis.setEx(key, ttl, JSON.stringify(value));
            return;
        }
    } catch (error) {
        console.warn('[Cache] Redis set failed:', error.message);
    }

    // Fallback to memory cache
    const expiry = Date.now() + (ttl * 1000);
    memoryCache.set(key, { value, expiry });
}

/**
 * Delete value from cache
 * @param {string} key - Cache key to delete
 */
export async function del(key) {
    try {
        if (redis && redisConnected) {
            await redis.del(key);
        }
    } catch (error) {
        console.warn('[Cache] Redis del failed:', error.message);
    }

    memoryCache.delete(key);
}

/**
 * Cache wrapper for functions - memoization with TTL
 * @param {string} key - Cache key
 * @param {Function} fn - Function to cache
 * @param {number} ttl - TTL in seconds
 * @returns {Promise<any>} Cached or fresh result
 */
export async function cached(key, fn, ttl = 300) {
    // Try to get from cache first
    const cached = await get(key);
    if (cached !== null) {
        return cached;
    }

    // Execute function and cache result
    const result = await fn();
    await set(key, result, ttl);
    return result;
}

/**
 * Invalidate cache by pattern (memory only, Redis requires lua script)
 * @param {string} pattern - Pattern to match (simple string matching)
 */
export async function invalidatePattern(pattern) {
    // Memory cache - simple pattern matching
    for (const key of memoryCache.keys()) {
        if (key.includes(pattern)) {
            memoryCache.delete(key);
        }
    }

    // Redis - for production, would need lua script for pattern matching
    // For now, we rely on TTL and manual invalidation of known keys
}

/**
 * Cache key builders for consistent naming
 */
export const CACHE_KEYS = {
    userProfile: (userId) => `cinq:user:${userId}:profile`,
    userContacts: (userId) => `cinq:user:${userId}:contacts`,
    userFeed: (userId, page = 0) => `cinq:posts:feed:${userId}:${page}`,
    userNotifications: (userId) => `cinq:notifications:${userId}:unread_count`,
    postDetails: (postId) => `cinq:post:${postId}:details`,
    publicPosts: (page = 0) => `cinq:posts:public:${page}`,
    userStats: (userId) => `cinq:user:${userId}:stats`,
    contactsCount: (userId) => `cinq:user:${userId}:contacts_count`
};

/**
 * Cache TTL configuration (in seconds)
 */
export const CACHE_TTL = {
    USER_PROFILE: parseInt(process.env.CACHE_TTL_USER_PROFILE) || 900,    // 15 minutes
    CONTACTS: 3600,                                                       // 1 hour
    POSTS_FEED: parseInt(process.env.CACHE_TTL_POSTS_FEED) || 300,       // 5 minutes
    NOTIFICATIONS: parseInt(process.env.CACHE_TTL_NOTIFICATIONS) || 30,   // 30 seconds
    PUBLIC_DATA: 3600,                                                    // 1 hour
    USER_STATS: 1800,                                                     // 30 minutes
    SHORT: 300,                                                          // 5 minutes
    LONG: 7200                                                          // 2 hours
};

/**
 * Clean up expired memory cache entries (called periodically)
 */
function cleanupMemoryCache() {
    const now = Date.now();
    for (const [key, item] of memoryCache.entries()) {
        if (now >= item.expiry) {
            memoryCache.delete(key);
        }
    }
}

// Cleanup expired memory cache every 5 minutes
setInterval(cleanupMemoryCache, 5 * 60 * 1000);

export default {
    get,
    set,
    del,
    cached,
    invalidatePattern,
    CACHE_KEYS,
    CACHE_TTL
};