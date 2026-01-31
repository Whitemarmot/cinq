import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    if (req.method === 'OPTIONS') return res.status(200).end();

    const action = req.query.action || req.body?.action;

    try {
        // ============ REGISTER ============
        if (action === 'register') {
            const { email, password, giftCode } = req.body;
            
            if (!email || !password || !giftCode) {
                return res.status(400).json({ error: 'Email, password et code requis' });
            }

            // Validate gift code
            const code = giftCode.toUpperCase().trim();
            const { data: gift, error: giftErr } = await supabase
                .from('gift_codes')
                .select('id, status')
                .eq('code', code)
                .single();

            if (giftErr || !gift || gift.status !== 'active') {
                return res.status(400).json({ error: 'Code cadeau invalide ou déjà utilisé' });
            }

            // Create user
            const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
                email: email.toLowerCase().trim(),
                password,
                email_confirm: true
            });

            if (authErr) {
                return res.status(400).json({ error: authErr.message });
            }

            // Mark gift code as redeemed
            await supabase
                .from('gift_codes')
                .update({ status: 'redeemed', redeemed_by: authData.user.id, redeemed_at: new Date().toISOString() })
                .eq('id', gift.id);

            // Create user profile
            await supabase.from('users').insert({
                id: authData.user.id,
                email: email.toLowerCase().trim(),
                gift_code_used: code
            });

            return res.json({ 
                success: true, 
                message: 'Bienvenue sur Cinq ! 🎉',
                user: { id: authData.user.id, email: authData.user.email }
            });
        }

        // ============ LOGIN ============
        if (action === 'login') {
            const { email, password } = req.body;
            
            if (!email || !password) {
                return res.status(400).json({ error: 'Email et password requis' });
            }

            const { data, error } = await supabase.auth.signInWithPassword({
                email: email.toLowerCase().trim(),
                password
            });

            if (error) {
                return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
            }

            return res.json({
                success: true,
                user: data.user,
                session: data.session
            });
        }

        // ============ ME (get current user) ============
        if (action === 'me') {
            const authHeader = req.headers.authorization;
            if (!authHeader?.startsWith('Bearer ')) {
                return res.status(401).json({ error: 'Non authentifié' });
            }

            const token = authHeader.split(' ')[1];
            const { data: { user }, error } = await supabase.auth.getUser(token);

            if (error || !user) {
                return res.status(401).json({ error: 'Token invalide' });
            }

            // Get profile
            const { data: profile } = await supabase
                .from('users')
                .select('*')
                .eq('id', user.id)
                .single();

            return res.json({ user, profile });
        }

        return res.status(400).json({ error: 'Action invalide. Use: register, login, me' });

    } catch (e) {
        console.error('Auth error:', e);
        return res.status(500).json({ error: e.message });
    }
}
