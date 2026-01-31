// API Route pour Vercel Serverless Functions
// POST /api/waitlist - Ajouter email
// GET /api/waitlist - Obtenir le compte

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

export default async function handler(req, res) {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // GET - Obtenir le compte
    if (req.method === 'GET') {
        try {
            const { count, error } = await supabase
                .from('waitlist')
                .select('*', { count: 'exact', head: true });

            if (error) throw error;

            return res.status(200).json({ count });
        } catch (error) {
            console.error('Error getting count:', error);
            return res.status(500).json({ error: 'Erreur serveur' });
        }
    }

    // POST - Ajouter un email
    if (req.method === 'POST') {
        try {
            const { email, referrer, utm_source, utm_medium, utm_campaign } = req.body;

            if (!email || !email.includes('@')) {
                return res.status(400).json({ error: 'Email invalide' });
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
                if (error.code === '23505') { // Unique violation
                    return res.status(409).json({ error: 'already_registered' });
                }
                throw error;
            }

            // Obtenir le nouveau compte
            const { count } = await supabase
                .from('waitlist')
                .select('*', { count: 'exact', head: true });

            return res.status(201).json({ 
                success: true, 
                message: 'Bienvenue dans le cercle !',
                count 
            });
        } catch (error) {
            console.error('Error adding email:', error);
            return res.status(500).json({ error: 'Erreur serveur' });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
