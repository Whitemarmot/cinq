/**
 * Heartbeat API - Update user's last_seen timestamp
 * 
 * Endpoints:
 * - POST / - Update last_seen_at timestamp (called periodically by frontend)
 * - GET / - Get current user's last_seen status
 */

import { supabase, requireAuth, handleCors } from './_supabase.js';
import { checkRateLimit } from './_rate-limit.js';

// Rate limit: 1 request per 30 seconds per user
const HEARTBEAT_RATE_LIMIT = {
    maxRequests: 2,
    windowMs: 60000, // 1 minute
    keyPrefix: 'heartbeat'
};

export default async function handler(req, res) {
    if (handleCors(req, res, ['GET', 'POST', 'OPTIONS'])) return;

    const user = await requireAuth(req, res);
    if (!user) return;

    // Rate limiting
    if (!checkRateLimit(req, res, { ...HEARTBEAT_RATE_LIMIT, userId: user.id })) {
        return;
    }

    try {
        if (req.method === 'POST') {
            return handleHeartbeat(req, res, user);
        }

        if (req.method === 'GET') {
            return handleGetStatus(req, res, user);
        }

        return res.status(405).json({ error: 'Method not allowed' });

    } catch (e) {
        console.error('Heartbeat error:', e);
        return res.status(500).json({ error: 'Erreur serveur' });
    }
}

// ===== POST - Update last_seen =====

async function handleHeartbeat(req, res, user) {
    const now = new Date().toISOString();
    
    const { error } = await supabase
        .from('users')
        .update({ last_seen_at: now })
        .eq('id', user.id);

    if (error) throw error;

    return res.json({ 
        success: true, 
        last_seen_at: now 
    });
}

// ===== GET - Get current status =====

async function handleGetStatus(req, res, user) {
    const { data, error } = await supabase
        .from('users')
        .select('last_seen_at, hide_last_seen')
        .eq('id', user.id)
        .single();

    if (error) throw error;

    return res.json({
        last_seen_at: data.last_seen_at,
        hide_last_seen: data.hide_last_seen || false
    });
}
