/**
 * Waitlist API - Public signup for interest list
 * 
 * Endpoints:
 * - GET - Get waitlist count
 * - POST - Add email to waitlist
 */

import { supabase, handleCors } from './_supabase.js';
import { checkRateLimit, RATE_LIMITS } from './_rate-limit.js';
import { isValidEmail } from './_validation.js';
import { logError, createErrorResponse } from './_error-logger.js';

const MAX_EMAIL_LENGTH = 254;

export default async function handler(req, res) {
    if (handleCors(req, res, ['GET', 'POST', 'OPTIONS'])) return;

    // Rate limiting for public endpoint
    if (!checkRateLimit(req, res, { ...RATE_LIMITS.PUBLIC, keyPrefix: 'waitlist' })) {
        return;
    }

    if (req.method === 'GET') {
        return handleGetCount(res);
    }

    if (req.method === 'POST') {
        return handleSignup(req, res);
    }

    return res.status(405).json({ error: 'Method not allowed' });
}

// ===== GET COUNT =====

async function handleGetCount(res) {
    try {
        const { count, error } = await supabase
            .from('waitlist')
            .select('*', { count: 'exact', head: true });
        
        if (error) throw error;
        return res.json({ count: count || 0 });
    } catch (e) {
        logError(e, { endpoint: '/api/waitlist', method: 'GET' });
        return res.status(500).json(createErrorResponse(e));
    }
}

// ===== SIGNUP =====

async function handleSignup(req, res) {
    try {
        const { email } = req.body;
        
        if (!email) {
            return res.status(400).json({ error: 'Email requis' });
        }

        const cleanEmail = email.toLowerCase().trim();
        
        if (!isValidEmail(cleanEmail)) {
            return res.status(400).json({ error: 'Format email invalide' });
        }

        if (cleanEmail.length > MAX_EMAIL_LENGTH) {
            return res.status(400).json({ error: 'Email trop long' });
        }

        const { error } = await supabase
            .from('waitlist')
            .insert([{ email: cleanEmail }]);

        if (error) {
            if (error.code === '23505') {
                return res.status(409).json({ error: 'Déjà inscrit !' });
            }
            throw error;
        }

        // Get new count
        const { count } = await supabase
            .from('waitlist')
            .select('*', { count: 'exact', head: true });

        return res.json({ success: true, count: count || 1 });
    } catch (e) {
        logError(e, { endpoint: '/api/waitlist', method: 'POST' });
        return res.status(500).json(
            createErrorResponse(e, { hint: 'Inscription impossible. Réessaie plus tard.' })
        );
    }
}
