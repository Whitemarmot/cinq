import { createClient } from '@supabase/supabase-js';
import { trackEvent, logRequest, logError, logStructured, EventType } from './_analytics.js';

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    logRequest(req, '/api/waitlist');

    // GET = count
    if (req.method === 'GET') {
        try {
            const { count, error } = await supabase
                .from('waitlist')
                .select('*', { count: 'exact', head: true });
            
            if (error) throw error;
            return res.json({ count: count || 0 });
        } catch (e) {
            return res.status(500).json({ error: e.message });
        }
    }

    // POST = signup
    if (req.method === 'POST') {
        try {
            const { email } = req.body;
            
            if (!email) {
                return res.status(400).json({ error: 'Email requis' });
            }

            const { data, error } = await supabase
                .from('waitlist')
                .insert([{ email }])
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

            // Track waitlist signup
            trackEvent(EventType.WAITLIST_SIGNUP, { count: count || 1 });
            logStructured('info', 'Waitlist signup', { count: count || 1 });

            return res.json({ success: true, count: count || 1 });
        } catch (e) {
            logError(e, '/api/waitlist');
            return res.status(500).json({ error: e.message });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
