/**
 * Shared Supabase client and authentication helpers
 * 
 * Single source of truth for database access across all API endpoints.
 * Eliminates duplicated initialization and auth logic.
 */

import { createClient } from '@supabase/supabase-js';

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
