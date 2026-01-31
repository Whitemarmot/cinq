/**
 * CINQ Push Send - Netlify Function
 * Envoie des notifications push aux utilisateurs
 * 
 * Usage interne: appelé par d'autres fonctions (messages, pings, etc.)
 * Peut aussi être appelé manuellement pour tester
 */

const { createClient } = require('@supabase/supabase-js');
const webpush = require('web-push');

const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Internal-Key',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
};

// Configure web-push avec les clés VAPID
function configureWebPush() {
    const publicKey = process.env.VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    const email = process.env.VAPID_EMAIL || 'mailto:hello@cinq.app';
    
    if (!publicKey || !privateKey) {
        throw new Error('VAPID keys not configured');
    }
    
    webpush.setVapidDetails(email, publicKey, privateKey);
}

function getSupabaseAdmin() {
    const url = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!url || !serviceKey) {
        throw new Error('Missing Supabase admin configuration');
    }
    
    return createClient(url, serviceKey);
}

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

/**
 * Envoie une notification push à un utilisateur
 */
async function sendPushToUser(supabaseAdmin, userId, notification) {
    // Récupérer toutes les subscriptions de l'utilisateur
    const { data: subscriptions, error: fetchError } = await supabaseAdmin
        .from('push_subscriptions')
        .select('*')
        .eq('user_id', userId);

    if (fetchError) {
        console.error('Error fetching subscriptions:', fetchError);
        return { sent: 0, failed: 0, errors: [fetchError.message] };
    }

    if (!subscriptions || subscriptions.length === 0) {
        return { sent: 0, failed: 0, errors: ['No subscriptions found'] };
    }

    const results = { sent: 0, failed: 0, errors: [] };
    const expiredEndpoints = [];

    // Préparer le payload
    const payload = JSON.stringify({
        title: notification.title || 'Cinq',
        body: notification.body || 'Tu as une notification',
        icon: notification.icon || '/assets/icons/icon-192x192.png',
        badge: notification.badge || '/assets/icons/icon-72x72.png',
        url: notification.url || '/app.html',
        tag: notification.tag || 'cinq-notification',
        data: notification.data || {}
    });

    // Envoyer à chaque subscription
    for (const sub of subscriptions) {
        try {
            const pushSubscription = {
                endpoint: sub.endpoint,
                keys: sub.keys
            };

            await webpush.sendNotification(pushSubscription, payload);
            results.sent++;
        } catch (err) {
            results.failed++;
            results.errors.push(err.message);

            // Si la subscription a expiré (410 Gone), la marquer pour suppression
            if (err.statusCode === 410 || err.statusCode === 404) {
                expiredEndpoints.push(sub.endpoint);
            }
        }
    }

    // Nettoyer les subscriptions expirées
    if (expiredEndpoints.length > 0) {
        await supabaseAdmin
            .from('push_subscriptions')
            .delete()
            .in('endpoint', expiredEndpoints);
    }

    return results;
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
            body: JSON.stringify({ success: false, error: 'Méthode non autorisée' })
        };
    }

    try {
        configureWebPush();
        
        const body = JSON.parse(event.body || '{}');
        const { target_user_id, notification, type } = body;

        // Vérifier l'authentification
        // Soit une clé interne (pour les appels entre fonctions)
        // Soit un token utilisateur (pour les tests)
        const internalKey = event.headers['x-internal-key'];
        const token = getAuthToken(event);
        
        let supabaseAdmin;
        
        if (internalKey === process.env.INTERNAL_API_KEY) {
            // Appel interne autorisé
            supabaseAdmin = getSupabaseAdmin();
        } else if (token) {
            // Vérifier que l'utilisateur est authentifié
            const supabase = getSupabase(token);
            const { data: { user }, error: authError } = await supabase.auth.getUser();
            
            if (authError || !user) {
                return {
                    statusCode: 401,
                    headers,
                    body: JSON.stringify({ success: false, error: 'Non autorisé' })
                };
            }
            
            // Pour les utilisateurs normaux, on utilise le service role
            // car ils ont besoin d'accéder aux subscriptions d'autres users
            supabaseAdmin = getSupabaseAdmin();
            
            // Vérifier que l'utilisateur peut envoyer à cette cible
            // (doit être dans ses contacts)
            if (target_user_id && target_user_id !== user.id) {
                const { data: contact } = await supabaseAdmin
                    .from('contacts')
                    .select('id')
                    .or(`and(user_id.eq.${user.id},contact_id.eq.${target_user_id}),and(user_id.eq.${target_user_id},contact_id.eq.${user.id})`)
                    .single();
                    
                if (!contact) {
                    return {
                        statusCode: 403,
                        headers,
                        body: JSON.stringify({ success: false, error: 'Destinataire non autorisé' })
                    };
                }
            }
        } else {
            return {
                statusCode: 401,
                headers,
                body: JSON.stringify({ success: false, error: 'Non autorisé' })
            };
        }

        if (!target_user_id) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ success: false, error: 'target_user_id requis' })
            };
        }

        if (!notification || !notification.body) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ success: false, error: 'notification.body requis' })
            };
        }

        // Envoyer la notification
        const result = await sendPushToUser(supabaseAdmin, target_user_id, notification);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ 
                success: true,
                ...result
            })
        };

    } catch (err) {
        console.error('Push send error:', err);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ success: false, error: 'Erreur serveur: ' + err.message })
        };
    }
};

/**
 * Helper function pour envoyer des notifications depuis d'autres fonctions
 * Usage: const { sendNotification } = require('./push-send');
 */
module.exports.sendNotification = async function(targetUserId, notification) {
    const webpushModule = require('web-push');
    const { createClient } = require('@supabase/supabase-js');
    
    const publicKey = process.env.VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    const email = process.env.VAPID_EMAIL || 'mailto:hello@cinq.app';
    
    if (!publicKey || !privateKey) {
        console.warn('VAPID keys not configured, skipping push notification');
        return { sent: 0, failed: 0, errors: ['VAPID not configured'] };
    }
    
    webpushModule.setVapidDetails(email, publicKey, privateKey);
    
    const supabaseAdmin = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    
    return sendPushToUser(supabaseAdmin, targetUserId, notification);
};
