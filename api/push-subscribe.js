import { createClient } from '@supabase/supabase-js';
import { checkRateLimit, RATE_LIMITS } from './_rate-limit.js';
import { logError, logInfo, createErrorResponse } from './_error-logger.js';
import { cors } from './_cors.js';

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
);

async function getUser(req) {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) return null;
    const { data: { user } } = await supabase.auth.getUser(auth.split(' ')[1]);
    return user;
}

export default async function handler(req, res) {
    // SECURITY: Validate CORS origin
    if (!cors(req, res)) return;

    const user = await getUser(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });

    // Rate limiting
    if (!checkRateLimit(req, res, { ...RATE_LIMITS.CREATE, keyPrefix: 'push', userId: user.id })) {
        return;
    }

    try {
        // ============ POST - Subscribe to push ============
        if (req.method === 'POST') {
            const { subscription } = req.body;

            if (!subscription?.endpoint) {
                return res.status(400).json({ error: 'subscription requis' });
            }

            // Validate endpoint is a valid URL
            try {
                const url = new URL(subscription.endpoint);
                if (!['https:', 'http:'].includes(url.protocol)) {
                    return res.status(400).json({ error: 'endpoint invalide' });
                }
            } catch {
                return res.status(400).json({ error: 'Format endpoint invalide' });
            }

            // Validate keys if provided
            if (subscription.keys) {
                if (typeof subscription.keys !== 'object') {
                    return res.status(400).json({ error: 'Format keys invalide' });
                }
            }

            // Upsert subscription
            const { error } = await supabase
                .from('push_subscriptions')
                .upsert({
                    user_id: user.id,
                    endpoint: subscription.endpoint,
                    keys: subscription.keys,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'endpoint' });

            if (error) throw error;
            return res.json({ success: true, message: 'Notifications activées' });
        }

        // ============ DELETE - Unsubscribe ============
        if (req.method === 'DELETE') {
            const { endpoint } = req.body;

            if (!endpoint) {
                return res.status(400).json({ error: 'endpoint requis' });
            }

            const { error } = await supabase
                .from('push_subscriptions')
                .delete()
                .eq('user_id', user.id)
                .eq('endpoint', endpoint);

            if (error) throw error;
            return res.json({ success: true, message: 'Notifications désactivées' });
        }

        return res.status(405).json({ error: 'Method not allowed' });

    } catch (e) {
        logError(e, { 
            endpoint: '/api/push-subscribe',
            method: req.method,
            userId: user?.id 
        });
        return res.status(500).json(
            createErrorResponse(e, { 
                includeDebug: process.env.NODE_ENV === 'development',
                hint: 'Impossible d\'activer les notifications. Réessaie.'
            })
        );
    }
}
