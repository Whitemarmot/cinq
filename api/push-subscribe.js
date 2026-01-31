/**
 * CINQ Push Subscribe - Netlify Function
 * Enregistre les subscriptions push des utilisateurs
 */

const { createClient } = require('@supabase/supabase-js');

const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Content-Type': 'application/json'
};

function getSupabase(accessToken = null) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_ANON_KEY;
    
    if (!url || !key) {
        throw new Error('Missing Supabase configuration');
    }
    
    const options = accessToken ? {
        global: { headers: { Authorization: `Bearer ${accessToken}` } }
    } : {};
    
    return createClient(url, key, options);
}

function getAuthToken(event) {
    const authHeader = event.headers.authorization || event.headers.Authorization;
    if (!authHeader) return null;
    return authHeader.replace('Bearer ', '');
}

exports.handler = async (event) => {
    // CORS preflight
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers, body: '' };
    }

    // Get auth token
    const token = getAuthToken(event);
    if (!token) {
        return {
            statusCode: 401,
            headers,
            body: JSON.stringify({ success: false, error: 'Non autorisé' })
        };
    }

    const supabase = getSupabase(token);
    
    // Verify user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
        return {
            statusCode: 401,
            headers,
            body: JSON.stringify({ success: false, error: 'Session invalide' })
        };
    }

    try {
        // POST - Subscribe
        if (event.httpMethod === 'POST') {
            const body = JSON.parse(event.body || '{}');
            const { subscription } = body;

            if (!subscription || !subscription.endpoint) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ success: false, error: 'Subscription invalide' })
                };
            }

            // Upsert subscription (update if endpoint exists, insert otherwise)
            const { error: upsertError } = await supabase
                .from('push_subscriptions')
                .upsert({
                    user_id: user.id,
                    endpoint: subscription.endpoint,
                    keys: subscription.keys,
                    user_agent: event.headers['user-agent'] || 'unknown',
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                }, {
                    onConflict: 'endpoint',
                    ignoreDuplicates: false
                });

            if (upsertError) {
                console.error('Subscription error:', upsertError);
                return {
                    statusCode: 500,
                    headers,
                    body: JSON.stringify({ success: false, error: 'Erreur lors de l\'enregistrement' })
                };
            }

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ 
                    success: true, 
                    message: 'Notifications activées ! 🔔' 
                })
            };
        }

        // DELETE - Unsubscribe
        if (event.httpMethod === 'DELETE') {
            const body = JSON.parse(event.body || '{}');
            const { endpoint } = body;

            if (!endpoint) {
                // Delete all subscriptions for user
                const { error: deleteError } = await supabase
                    .from('push_subscriptions')
                    .delete()
                    .eq('user_id', user.id);

                if (deleteError) {
                    console.error('Unsubscribe error:', deleteError);
                    return {
                        statusCode: 500,
                        headers,
                        body: JSON.stringify({ success: false, error: 'Erreur lors de la désinscription' })
                    };
                }
            } else {
                // Delete specific endpoint
                const { error: deleteError } = await supabase
                    .from('push_subscriptions')
                    .delete()
                    .eq('endpoint', endpoint)
                    .eq('user_id', user.id);

                if (deleteError) {
                    console.error('Unsubscribe error:', deleteError);
                    return {
                        statusCode: 500,
                        headers,
                        body: JSON.stringify({ success: false, error: 'Erreur lors de la désinscription' })
                    };
                }
            }

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ 
                    success: true, 
                    message: 'Notifications désactivées' 
                })
            };
        }

        // GET - Check subscription status
        if (event.httpMethod === 'GET') {
            const { data: subscriptions, error: fetchError } = await supabase
                .from('push_subscriptions')
                .select('endpoint, created_at')
                .eq('user_id', user.id);

            if (fetchError) {
                console.error('Fetch error:', fetchError);
                return {
                    statusCode: 500,
                    headers,
                    body: JSON.stringify({ success: false, error: 'Erreur serveur' })
                };
            }

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ 
                    success: true, 
                    subscribed: subscriptions.length > 0,
                    count: subscriptions.length
                })
            };
        }

        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ success: false, error: 'Méthode non autorisée' })
        };

    } catch (err) {
        console.error('Push subscribe error:', err);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ success: false, error: 'Erreur serveur: ' + err.message })
        };
    }
};
