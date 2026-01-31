/**
 * CINQ Auth Register - Netlify Function
 * SARAH Backend - Secure Registration with Gift Code
 * 
 * POST /api/auth-register
 * Body: { email, password, giftCode }
 * 
 * Flow:
 * 1. Validate gift code
 * 2. Create Supabase Auth user
 * 3. Mark gift code as redeemed
 * 4. Return session
 */

const { createClient } = require('@supabase/supabase-js');
const {
    normalizeCode,
    isValidCodeFormat,
    hashCode,
    success,
    error,
    rateLimited,
    getClientIP,
    headers,
} = require('./gift-utils');

// Supabase Admin Client (service role)
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

exports.handler = async (event, context) => {
    // CORS preflight
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers, body: '' };
    }

    if (event.httpMethod !== 'POST') {
        return error('Method not allowed', 405);
    }

    const supabase = getSupabaseAdmin();
    const clientIP = getClientIP(event);

    try {
        // Parse body
        const body = JSON.parse(event.body || '{}');
        const { email, password, giftCode } = body;

        // ========================================
        // 1. Input Validation
        // ========================================
        
        if (!email || !password || !giftCode) {
            return error('Email, password and gift code are required', 400);
        }

        // Email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return error('Invalid email format', 400);
        }

        // Password strength (min 8 chars, 1 number, 1 letter)
        if (password.length < 8) {
            return error('Password must be at least 8 characters', 400);
        }
        if (!/\d/.test(password) || !/[a-zA-Z]/.test(password)) {
            return error('Password must contain at least one letter and one number', 400);
        }

        // Gift code format
        const normalizedCode = normalizeCode(giftCode);
        if (!normalizedCode || !isValidCodeFormat(normalizedCode)) {
            return error('Invalid gift code format', 400);
        }

        // ========================================
        // 2. Rate Limiting
        // ========================================
        
        const { data: rateData, error: rateError } = await supabase
            .rpc('check_gift_code_rate_limit', { client_ip: clientIP });

        if (rateError) {
            console.error('Rate limit check error:', rateError);
            // Continue anyway - don't block on rate limit errors
        } else if (rateData && rateData.length > 0 && !rateData[0].allowed) {
            return rateLimited(rateData[0].wait_seconds);
        }

        // ========================================
        // 3. Validate Gift Code
        // ========================================
        
        const codeHash = hashCode(normalizedCode);
        
        const { data: codeData, error: codeError } = await supabase
            .from('gift_codes')
            .select('id, status, expires_at, amount_cents')
            .eq('code_hash', codeHash)
            .single();

        if (codeError || !codeData) {
            // Log attempt
            await supabase.from('gift_code_attempts').insert({
                ip_address: clientIP,
                attempted_code_hash: codeHash,
                success: false,
                failure_reason: 'code_not_found'
            });
            
            return error('Invalid or expired gift code', 400);
        }

        if (codeData.status !== 'active') {
            return error(`Gift code has already been ${codeData.status}`, 400);
        }

        if (new Date(codeData.expires_at) < new Date()) {
            // Mark as expired
            await supabase
                .from('gift_codes')
                .update({ status: 'expired' })
                .eq('id', codeData.id);
            
            return error('Gift code has expired', 400);
        }

        // ========================================
        // 4. Check if email already exists
        // ========================================
        
        const { data: existingUsers } = await supabase.auth.admin.listUsers();
        const emailExists = existingUsers?.users?.some(
            u => u.email?.toLowerCase() === email.toLowerCase()
        );
        
        if (emailExists) {
            return error('An account with this email already exists', 409);
        }

        // ========================================
        // 5. Create Supabase Auth User
        // ========================================
        
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
            email: email.toLowerCase().trim(),
            password,
            email_confirm: true, // Auto-confirm since they have gift code
            user_metadata: {
                gift_code_used: normalizedCode,
                registered_at: new Date().toISOString()
            }
        });

        if (authError) {
            console.error('Auth creation error:', authError);
            return error('Failed to create account: ' + authError.message, 500);
        }

        // ========================================
        // 6. Mark Gift Code as Redeemed
        // ========================================
        
        const { error: redeemError } = await supabase
            .from('gift_codes')
            .update({
                status: 'redeemed',
                redeemed_by: authData.user.id,
                redeemed_at: new Date().toISOString()
            })
            .eq('id', codeData.id);

        if (redeemError) {
            console.error('Gift code redeem error:', redeemError);
            // Don't fail - user is created, just log the issue
        }

        // Update users table with gift code
        await supabase
            .from('users')
            .update({ gift_code_used: normalizedCode })
            .eq('id', authData.user.id);

        // Log successful attempt
        await supabase.from('gift_code_attempts').insert({
            ip_address: clientIP,
            attempted_code_hash: codeHash,
            success: true
        });

        // Reset rate limit on success
        await supabase.rpc('reset_gift_code_rate_limit', { client_ip: clientIP });

        // ========================================
        // 7. Generate Session Token
        // ========================================
        
        // Sign in the user to get a session
        const { data: sessionData, error: sessionError } = await supabase.auth.admin.generateLink({
            type: 'magiclink',
            email: email.toLowerCase().trim()
        });

        // ========================================
        // 8. Return Success
        // ========================================
        
        return success({
            message: 'Welcome to CINQ! 🎉',
            user: {
                id: authData.user.id,
                email: authData.user.email,
                created_at: authData.user.created_at
            },
            // Client should use this to complete login
            requiresLogin: true
        }, 201);

    } catch (err) {
        console.error('Registration error:', err);
        return error('Server error during registration', 500);
    }
};
