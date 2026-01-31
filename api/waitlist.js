// Netlify Function pour la waitlist
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 
                     process.env.SUPABASE_SERVICE_KEY || 
                     process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('Missing Supabase configuration');
}

const supabase = SUPABASE_URL && SUPABASE_KEY 
    ? createClient(SUPABASE_URL, SUPABASE_KEY)
    : null;

exports.handler = async (event, context) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    // CORS preflight
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    // GET - Obtenir le compte
    if (event.httpMethod === 'GET') {
        try {
            if (!supabase) {
                return {
                    statusCode: 500,
                    headers,
                    body: JSON.stringify({ error: 'Database not configured', count: 0 })
                };
            }
            
            const { count, error } = await supabase
                .from('waitlist')
                .select('*', { count: 'exact', head: true });

            if (error) throw error;

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ count })
            };
        } catch (error) {
            console.error('Error:', error);
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ error: 'Erreur serveur' })
            };
        }
    }

    // POST - Ajouter un email
    if (event.httpMethod === 'POST') {
        try {
            if (!supabase) {
                return {
                    statusCode: 500,
                    headers,
                    body: JSON.stringify({ error: 'Database not configured' })
                };
            }
            
            const body = JSON.parse(event.body || '{}');
            const { email, referrer, utm_source, utm_medium, utm_campaign } = body;

            // Validation
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!email || !emailRegex.test(email)) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ error: 'Email invalide' })
                };
            }

            // Honeypot check (anti-bot)
            if (body.website) {
                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({ success: true, count: 42 })
                };
            }

            const { data, error } = await supabase
                .from('waitlist')
                .insert([{
                    email: email.toLowerCase().trim(),
                    referrer,
                    utm_source,
                    utm_medium,
                    utm_campaign
                }])
                .select();

            if (error) {
                if (error.code === '23505') {
                    return {
                        statusCode: 409,
                        headers,
                        body: JSON.stringify({ error: 'already_registered' })
                    };
                }
                throw error;
            }

            // Nouveau compte
            const { count } = await supabase
                .from('waitlist')
                .select('*', { count: 'exact', head: true });

            return {
                statusCode: 201,
                headers,
                body: JSON.stringify({
                    success: true,
                    message: 'Bienvenue dans le cercle !',
                    count
                })
            };
        } catch (error) {
            console.error('Error:', error);
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ error: 'Erreur serveur' })
            };
        }
    }

    return {
        statusCode: 405,
        headers,
        body: JSON.stringify({ error: 'Method not allowed' })
    };
};
