/**
 * Shared Supabase client and authentication helpers
 * 
 * Single source of truth for database access across all API endpoints.
 * Eliminates duplicated initialization and auth logic.
 * Enhanced with caching and query optimization.
 */

import { createClient } from '@supabase/supabase-js';
import { cached, CACHE_KEYS, CACHE_TTL, del } from './_cache.js';

// ===== SINGLETON SUPABASE CLIENT =====
export const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
);

// ===== AUTHENTICATION =====

/**
 * Extract and validate user from request Authorization header
 * @param {Request} req - HTTP request object
 * @returns {Promise<Object|null>} User object or null if not authenticated
 */
export async function getUser(req) {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) return null;
    
    try {
        const token = auth.split(' ')[1];
        const { data: { user }, error } = await supabase.auth.getUser(token);
        if (error || !user) return null;
        return user;
    } catch {
        return null;
    }
}

/**
 * Require authentication - returns 401 response if not authenticated
 * @param {Request} req - HTTP request
 * @param {Response} res - HTTP response
 * @returns {Promise<Object|null>} User object or null (response already sent)
 */
export async function requireAuth(req, res) {
    const user = await getUser(req);
    if (!user) {
        res.status(401).json({ error: 'Non authentifié' });
        return null;
    }
    return user;
}

// ===== USER DATA HELPERS =====

/**
 * Get user email from auth.users (admin API)
 * @param {string} userId - User UUID
 * @returns {Promise<string|null>} Email or null
 */
export async function getUserEmail(userId) {
    try {
        const { data } = await supabase.auth.admin.getUserById(userId);
        return data?.user?.email || null;
    } catch {
        return null;
    }
}

/**
 * Get user profile (display_name, avatar_url, bio, status) from public.users
 * @param {string} userId - User UUID
 * @returns {Promise<Object>} Profile object (may be empty)
 */
export async function getUserProfile(userId) {
    try {
        const { data } = await supabase
            .from('users')
            .select('display_name, avatar_url, bio, email, status_emoji, status_text')
            .eq('id', userId)
            .single();
        return data || {};
    } catch {
        return {};
    }
}

/**
 * Get complete user info (email + profile) for display
 * @param {string} userId - User UUID  
 * @returns {Promise<Object>} Combined user info
 */
export async function getUserInfo(userId) {
    const profile = await getUserProfile(userId);
    
    // If profile has email, use it. Otherwise fetch from auth.
    const email = profile.email || await getUserEmail(userId);
    
    return {
        id: userId,
        email,
        display_name: profile.display_name || null,
        avatar_url: profile.avatar_url || null,
        status_emoji: profile.status_emoji || null,
        status_text: profile.status_text || null
    };
}

// ===== CORS HELPER =====
// SECURITY: Restrict origins to prevent unauthorized cross-origin requests

const ALLOWED_ORIGINS = [
    'https://cinq-three.vercel.app',
    'https://cinq.app',
    'https://www.cinq.app',
];

// Allow localhost in development
if (process.env.NODE_ENV === 'development' || process.env.VERCEL_ENV === 'preview') {
    ALLOWED_ORIGINS.push(
        'http://localhost:3000',
        'http://localhost:5173',
        'http://localhost:8080',
        'http://127.0.0.1:3000',
        'http://127.0.0.1:5173',
        'http://127.0.0.1:8080'
    );
}

/**
 * Set CORS headers with origin validation
 * @param {Request} req - HTTP request object
 * @param {Response} res - HTTP response object
 * @param {string[]} methods - Allowed HTTP methods
 * @returns {boolean} true if origin is allowed
 */
export function setCorsHeaders(req, res, methods = ['GET', 'POST', 'OPTIONS']) {
    const origin = req.headers.origin;
    
    // For same-origin requests (no Origin header), allow
    if (!origin) {
        res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGINS[0]);
        res.setHeader('Access-Control-Allow-Methods', methods.join(', '));
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        res.setHeader('Access-Control-Max-Age', '86400');
        return true;
    }
    
    // Check if origin is in allowed list
    if (ALLOWED_ORIGINS.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Methods', methods.join(', '));
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Access-Control-Max-Age', '86400');
        return true;
    }
    
    // Origin not allowed
    console.warn(`[CORS] Blocked request from origin: ${origin}`);
    return false;
}

/**
 * Handle OPTIONS preflight request with origin validation
 * @param {Request} req - HTTP request
 * @param {Response} res - HTTP response  
 * @param {string[]} methods - Allowed methods
 * @returns {boolean} True if request was handled (OPTIONS or blocked)
 */
export function handleCors(req, res, methods = ['GET', 'POST', 'OPTIONS']) {
    const allowed = setCorsHeaders(req, res, methods);
    
    if (!allowed) {
        res.status(403).json({ error: 'Origin not allowed' });
        return true; // Handled (blocked)
    }
    
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return true; // Handled (preflight)
    }
    
    return false; // Continue processing
}

// ===== OPTIMIZED QUERY HELPERS =====

/**
 * Get user profile with caching - optimized for frequent access
 * @param {string} userId - User UUID
 * @param {boolean} forceRefresh - Bypass cache
 * @returns {Promise<Object>} Profile object
 */
export async function getCachedUserProfile(userId, forceRefresh = false) {
    const cacheKey = CACHE_KEYS.userProfile(userId);
    
    if (forceRefresh) {
        await del(cacheKey);
    }
    
    return await cached(cacheKey, async () => {
        const { data } = await supabase
            .from('users')
            .select('display_name, avatar_url, bio, email, status_emoji, status_text, created_at')
            .eq('id', userId)
            .single();
        return data || {};
    }, CACHE_TTL.USER_PROFILE);
}

/**
 * Get user contacts with caching
 * @param {string} userId - User UUID
 * @returns {Promise<Array>} Array of contacts
 */
export async function getCachedUserContacts(userId) {
    const cacheKey = CACHE_KEYS.userContacts(userId);
    
    return await cached(cacheKey, async () => {
        const { data } = await supabase
            .from('contacts')
            .select(`
                id,
                contact_id,
                status,
                created_at,
                users!contacts_contact_id_fkey(
                    id,
                    display_name,
                    avatar_url,
                    status_emoji,
                    status_text
                )
            `)
            .eq('user_id', userId)
            .eq('status', 'accepted')
            .order('created_at', { ascending: false });
        
        return data || [];
    }, CACHE_TTL.CONTACTS);
}

/**
 * Get optimized posts feed with minimal data and caching
 * @param {string} userId - User UUID
 * @param {number} page - Page number (0-based)
 * @param {number} limit - Items per page
 * @returns {Promise<Array>} Array of posts
 */
export async function getCachedPostsFeed(userId, page = 0, limit = 20) {
    const cacheKey = CACHE_KEYS.userFeed(userId, page);
    
    return await cached(cacheKey, async () => {
        // Get user's contacts first
        const contacts = await getCachedUserContacts(userId);
        const contactIds = contacts.map(c => c.contact_id);
        const allUserIds = [userId, ...contactIds];
        
        // Optimized query - only select needed fields
        const { data } = await supabase
            .from('posts')
            .select(`
                id,
                content,
                created_at,
                user_id,
                image_url,
                is_private,
                reply_to_id,
                users!posts_user_id_fkey(
                    display_name,
                    avatar_url
                )
            `)
            .in('user_id', allUserIds)
            .eq('is_private', false)
            .order('created_at', { ascending: false })
            .range(page * limit, (page + 1) * limit - 1);
        
        return data || [];
    }, CACHE_TTL.POSTS_FEED);
}

/**
 * Get unread notifications count with short caching
 * @param {string} userId - User UUID
 * @returns {Promise<number>} Count of unread notifications
 */
export async function getCachedNotificationCount(userId) {
    const cacheKey = CACHE_KEYS.userNotifications(userId);
    
    return await cached(cacheKey, async () => {
        const { count } = await supabase
            .from('notifications')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId)
            .is('read_at', null);
        
        return count || 0;
    }, CACHE_TTL.NOTIFICATIONS);
}

/**
 * Get user statistics with caching
 * @param {string} userId - User UUID
 * @returns {Promise<Object>} User stats object
 */
export async function getCachedUserStats(userId) {
    const cacheKey = CACHE_KEYS.userStats(userId);
    
    return await cached(cacheKey, async () => {
        // Execute multiple queries in parallel
        const [postsCount, contactsCount, messagesCount] = await Promise.all([
            supabase.from('posts').select('*', { count: 'exact', head: true }).eq('user_id', userId),
            supabase.from('contacts').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('status', 'accepted'),
            supabase.from('messages').select('*', { count: 'exact', head: true }).eq('sender_id', userId)
        ]);
        
        return {
            postsCount: postsCount.count || 0,
            contactsCount: contactsCount.count || 0,
            messagesCount: messagesCount.count || 0
        };
    }, CACHE_TTL.USER_STATS);
}

/**
 * Invalidate user-related caches when data changes
 * @param {string} userId - User UUID
 * @param {string[]} types - Types to invalidate ['profile', 'contacts', 'feed', 'stats']
 */
export async function invalidateUserCache(userId, types = ['profile', 'contacts', 'feed', 'stats']) {
    const promises = [];
    
    if (types.includes('profile')) {
        promises.push(del(CACHE_KEYS.userProfile(userId)));
    }
    
    if (types.includes('contacts')) {
        promises.push(del(CACHE_KEYS.userContacts(userId)));
    }
    
    if (types.includes('feed')) {
        // Invalidate all feed pages
        for (let page = 0; page < 5; page++) {
            promises.push(del(CACHE_KEYS.userFeed(userId, page)));
        }
    }
    
    if (types.includes('stats')) {
        promises.push(del(CACHE_KEYS.userStats(userId)));
        promises.push(del(CACHE_KEYS.userNotifications(userId)));
    }
    
    await Promise.all(promises);
}

// ===== CONNECTION OPTIMIZATION =====

/**
 * Batch multiple Supabase queries into a single transaction where possible
 * @param {Array} operations - Array of { table, operation, data } objects
 * @returns {Promise<Array>} Results array
 */
export async function batchQueries(operations) {
    // For now, execute in parallel since Supabase doesn't support transactions in JS
    // In the future, could use stored procedures for true transactions
    return await Promise.all(
        operations.map(op => {
            const query = supabase.from(op.table);
            
            switch (op.operation) {
                case 'insert':
                    return query.insert(op.data);
                case 'update':
                    return query.update(op.data).match(op.match);
                case 'delete':
                    return query.delete().match(op.match);
                case 'select':
                    return query.select(op.select).match(op.match);
                default:
                    throw new Error(`Unknown operation: ${op.operation}`);
            }
        })
    );
}
