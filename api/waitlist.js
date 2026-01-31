const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = SUPABASE_URL && SUPABASE_KEY ? createClient(SUPABASE_URL, SUPABASE_KEY) : null;

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    if (!supabase) {
        return res.status(500).json({ error: 'Database not configured', count: 0 });
    }

    if (req.method === 'GET') {
        const { count, error } = await supabase
            .from('waitlist')
            .select('*', { count: 'exact', head: true });
        
        if (error) return res.status(500).json({ error: error.message });
        return res.status(200).json({ count });
    }

    if (req.method === 'POST') {
        const { email } = req.body || {};
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        
        if (!email || !emailRegex.test(email)) {
            return res.status(400).json({ error: 'Email invalide' });
        }

        const { error } = await supabase
            .from('waitlist')
            .insert({ email: email.toLowerCase().trim() });

        if (error) {
            if (error.code === '23505') {
                return res.status(200).json({ success: true, message: 'Déjà inscrit' });
            }
            return res.status(500).json({ error: error.message });
        }

        return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
};
