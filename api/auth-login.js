/**
 * CINQ Auth Login - Netlify Function
 * Simplified version that just works
 */

const { createClient } = require('@supabase/supabase-js');

const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Content-Type': 'application/json'
};

function getSupabase() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_ANON_KEY;
    
    if (!url || !key) {
        throw new Error('Missing Supabase configuration');
    }
    
    return createClient(url, key);
}

exports.handler = async (event) => {
    // CORS preflight
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers, body: '' };
    }

    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ success: false, error: 'Method not allowed' })
        };
    }

    try {
        const body = JSON.parse(event.body || '{}');
        const { email, password } = body;

        if (!email || !password) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ success: false, error: 'Email and password required' })
            };
        }

        const supabase = getSupabase();

        // Sign in with Supabase Auth
        const { data, error } = await supabase.auth.signInWithPassword({
            email: email.toLowerCase().trim(),
            password
        });

        if (error) {
            return {
                statusCode: 401,
                headers,
                body: JSON.stringify({ success: false, error: 'Invalid email or password' })
            };
        }

        // Return session
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                session: {
                    access_token: data.session.access_token,
                    refresh_token: data.session.refresh_token,
                    expires_at: data.session.expires_at,
                    token_type: 'bearer'
                },
                user: {
                    id: data.user.id,
                    email: data.user.email,
                    created_at: data.user.created_at
                }
            })
        };

    } catch (err) {
        console.error('Login error:', err);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ success: false, error: 'Server error: ' + err.message })
        };
    }
};
