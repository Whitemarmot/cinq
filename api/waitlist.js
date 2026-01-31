import { createClient } from '@supabase/supabase-js';
import { checkRateLimit, RATE_LIMITS } from './_rate-limit.js';
import { isValidEmail } from './_validation.js';
import { logError, createErrorResponse } from './_error-logger.js';
import { cors } from './_cors.js';

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
    // SECURITY: Validate CORS origin
    if (!cors(req, res)) return;

    // Rate limiting for public endpoint
    if (!checkRateLimit(req, res, { ...RATE_LIMITS.PUBLIC, keyPrefix: 'waitlist' })) {
        return;
    }

    // GET = count
    if (req.method === 'GET') {
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

    // POST = signup
    if (req.method === 'POST') {
        try {
            const { email } = req.body;
            
            if (!email) {
                return res.status(400).json({ error: 'Email requis' });
            }

            // SECURITY FIX: Validate email format
            const cleanEmail = email.toLowerCase().trim();
            if (!isValidEmail(cleanEmail)) {
                return res.status(400).json({ error: 'Format email invalide' });
            }

            // Additional validation: max length
            if (cleanEmail.length > 254) {
                return res.status(400).json({ error: 'Email trop long' });
            }

            const { data, error } = await supabase
                .from('waitlist')
                .insert([{ email: cleanEmail }])
                .select();

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

    return res.status(405).json({ error: 'Method not allowed' });
}
