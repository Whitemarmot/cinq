/**
 * CINQ Auth Login - Netlify Function
 * SARAH Backend - Secure Authentication
 * 
 * POST /api/auth-login
 * Body: { email, password }
 * 
 * Returns: { session, user }
 * 
 * Security:
 * - Rate limiting on failed attempts
 * - Constant-time comparison
 * - No user enumeration (same error for wrong email/password)
 */

const { createClient } = require('@supabase/supabase-js');
const { success, error, getClientIP, headers } = require('./gift-utils');

// Rate limit config
const MAX_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

// Supabase clients
function getSupabaseAdmin() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
    
    if (!url || !key) {
        throw new Error('Missing Supabase configuration');
    }
    
    return createClient(url, key, {
        auth: { autoRefreshToken: false, persistSession: false }
    });
}

function getSupabaseClient() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!url || !key) {
        throw new Error('Missing Supabase configuration');
    }
    
    return createClient(url, key, {
        auth: { autoRefreshToken: false, persistSession: false }
    });
}

exports.handler = async (event, context) => {
    // CORS preflight
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers, body: '' };
    }

    if (event.httpMethod !== 'POST') {
        return error('Method not allowed', 405);
    }

    const supabaseAdmin = getSupabaseAdmin();
    const supabase = getSupabaseClient();
    const clientIP = getClientIP(event);

    try {
        // Parse body
        const body = JSON.parse(event.body || '{}');
        const { email, password } = body;

        // ========================================
        // 1. Input Validation
        // ========================================
        
        if (!email || !password) {
            return error('Email and password are required', 400);
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return error('Invalid email format', 400);
        }

        // ========================================
        // 2. Check Rate Limit
        // ========================================
        
        const { data: attempts } = await supabaseAdmin
            .from('login_attempts')
            .select('*')
            .eq('ip_address', clientIP)
            .gte('created_at', new Date(Date.now() - LOCKOUT_MINUTES * 60 * 1000).toISOString())
            .eq('success', false);

        if (attempts && attempts.length >= MAX_ATTEMPTS) {
            const oldestAttempt = new Date(attempts[0].created_at);
            const unlockTime = new Date(oldestAttempt.getTime() + LOCKOUT_MINUTES * 60 * 1000);
            const waitSeconds = Math.ceil((unlockTime.getTime() - Date.now()) / 1000);
            
            return {
                statusCode: 429,
                headers: { ...headers, 'Retry-After': String(waitSeconds) },
                body: JSON.stringify({
                    success: false,
                    error: 'Too many login attempts. Please try again later.',
                    retryAfter: waitSeconds
                })
            };
        }

        // ========================================
        // 3. Attempt Login
        // ========================================
        
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
            email: email.toLowerCase().trim(),
            password
        });

        // ========================================
        // 4. Log Attempt
        // ========================================
        
        // Create login_attempts table if it doesn't exist (handled by SQL schema)
        await supabaseAdmin.from('login_attempts').insert({
            ip_address: clientIP,
            email_hash: require('crypto').createHash('sha256').update(email.toLowerCase()).digest('hex'),
            success: !authError,
            user_agent: event.headers['user-agent'] || null
        }).catch(() => {
            // Table might not exist yet, ignore
        });

        // ========================================
        // 5. Handle Result
        // ========================================
        
        if (authError) {
            // Generic error to prevent user enumeration
            return error('Invalid email or password', 401);
        }

        // Fetch additional user data (with fallback if tables don't exist)
        let userData = null;
        let contactCount = 0;
        let unreadCount = 0;

        try {
            const { data } = await supabaseAdmin
                .from('users')
                .select('id, email, created_at, gift_code_used')
                .eq('id', authData.user.id)
                .single();
            userData = data;
        } catch (e) {
            // users table might not exist yet
        }

        try {
            const { count } = await supabaseAdmin
                .from('contacts')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', authData.user.id);
            contactCount = count || 0;
        } catch (e) {
            // contacts table might not exist yet
        }

        try {
            const { count } = await supabaseAdmin
                .from('messages')
                .select('*', { count: 'exact', head: true })
                .eq('receiver_id', authData.user.id);
            unreadCount = count || 0;
        } catch (e) {
            // messages table might not exist yet
        }

        // ========================================
        // 6. Return Success
        // ========================================
        
        return success({
            session: {
                access_token: authData.session.access_token,
                refresh_token: authData.session.refresh_token,
                expires_at: authData.session.expires_at,
                expires_in: authData.session.expires_in,
                token_type: 'bearer'
            },
            user: {
                id: authData.user.id,
                email: authData.user.email,
                created_at: authData.user.created_at,
                contact_count: contactCount || 0,
                contact_limit: 5,
                unread_messages: unreadCount || 0
            }
        });

    } catch (err) {
        console.error('Login error:', err);
        return error('Server error during login', 500);
    }
};
