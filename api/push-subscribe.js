/**
 * Push Subscription API - Manage push notification subscriptions
 * 
 * Endpoints:
 * - POST - Subscribe to push notifications
 * - DELETE - Unsubscribe from push notifications
 */

import { supabase, requireAuth, handleCors } from './_supabase.js';
import { checkRateLimit, RATE_LIMITS } from './_rate-limit.js';
import { logError, createErrorResponse } from './_error-logger.js';

export default async function handler(req, res) {
    if (handleCors(req, res, ['POST', 'DELETE', 'OPTIONS'])) return;

    const user = await requireAuth(req, res);
    if (!user) return;

    // Rate limiting
    if (!checkRateLimit(req, res, { ...RATE_LIMITS.CREATE, keyPrefix: 'push', userId: user.id })) {
        return;
    }

    try {
        if (req.method === 'POST') {
            return handleSubscribe(req, res, user);
        }

        if (req.method === 'DELETE') {
            return handleUnsubscribe(req, res, user);
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

// ===== SUBSCRIBE =====

async function handleSubscribe(req, res, user) {
    const { subscription } = req.body;

    if (!subscription?.endpoint) {
        return res.status(400).json({ error: 'subscription requis' });
    }

    // Validate endpoint URL
    try {
        const url = new URL(subscription.endpoint);
        if (!['https:', 'http:'].includes(url.protocol)) {
            return res.status(400).json({ error: 'endpoint invalide' });
        }
    } catch {
        return res.status(400).json({ error: 'Format endpoint invalide' });
    }

    // Validate keys if provided
    if (subscription.keys && typeof subscription.keys !== 'object') {
        return res.status(400).json({ error: 'Format keys invalide' });
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

// ===== UNSUBSCRIBE =====

async function handleUnsubscribe(req, res, user) {
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
