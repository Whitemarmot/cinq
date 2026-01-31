import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
);

// Generate gift code: CINQ-XXXX-XXXX
function generateCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No I/O/0/1
    let code = 'CINQ-';
    for (let i = 0; i < 8; i++) {
        if (i === 4) code += '-';
        code += chars[crypto.randomInt(chars.length)];
    }
    return code;
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    if (req.method === 'OPTIONS') return res.status(200).end();

    const action = req.query.action || req.body?.action;

    try {
        // ============ CREATE (authenticated user creates gift) ============
        if (action === 'create') {
            const authHeader = req.headers.authorization;
            if (!authHeader?.startsWith('Bearer ')) {
                return res.status(401).json({ error: 'Non authentifié' });
            }

            const token = authHeader.split(' ')[1];
            const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
            if (authErr || !user) {
                return res.status(401).json({ error: 'Token invalide' });
            }

            // Check how many active gifts user has
            const { count } = await supabase
                .from('gift_codes')
                .select('*', { count: 'exact', head: true })
                .eq('created_by', user.id)
                .eq('status', 'active');

            if (count >= 5) {
                return res.status(400).json({ error: 'Tu as déjà 5 invitations actives' });
            }

            // Create gift code
            const code = generateCode();
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + 30); // 30 days

            const { data, error } = await supabase
                .from('gift_codes')
                .insert({
                    code,
                    created_by: user.id,
                    status: 'active',
                    expires_at: expiresAt.toISOString()
                })
                .select()
                .single();

            if (error) throw error;

            return res.json({
                success: true,
                gift: {
                    code: data.code,
                    expiresAt: data.expires_at,
                    shareUrl: `https://cinq-three.vercel.app/gift.html?code=${data.code}`
                }
            });
        }

        // ============ VERIFY (check if code is valid) ============
        if (action === 'verify') {
            const code = (req.query.code || req.body?.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
            
            if (!code) {
                return res.status(400).json({ error: 'Code requis' });
            }

            const { data, error } = await supabase
                .from('gift_codes')
                .select('id, status, expires_at, created_by')
                .eq('code', code)
                .single();

            if (error || !data) {
                return res.json({ valid: false, reason: 'Code introuvable' });
            }

            if (data.status !== 'active') {
                return res.json({ valid: false, reason: 'Code déjà utilisé' });
            }

            if (new Date(data.expires_at) < new Date()) {
                return res.json({ valid: false, reason: 'Code expiré' });
            }

            // Get gifter name
            const { data: gifter } = await supabase
                .from('users')
                .select('display_name, email')
                .eq('id', data.created_by)
                .single();

            return res.json({
                valid: true,
                gifter: gifter?.display_name || gifter?.email?.split('@')[0] || 'Un ami'
            });
        }

        // ============ LIST (user's gifts) ============
        if (action === 'list') {
            const authHeader = req.headers.authorization;
            if (!authHeader?.startsWith('Bearer ')) {
                return res.status(401).json({ error: 'Non authentifié' });
            }

            const token = authHeader.split(' ')[1];
            const { data: { user } } = await supabase.auth.getUser(token);
            if (!user) return res.status(401).json({ error: 'Token invalide' });

            const { data, error } = await supabase
                .from('gift_codes')
                .select('code, status, created_at, expires_at, redeemed_by')
                .eq('created_by', user.id)
                .order('created_at', { ascending: false });

            return res.json({ gifts: data || [] });
        }

        return res.status(400).json({ error: 'Action invalide. Use: create, verify, list' });

    } catch (e) {
        console.error('Gift error:', e);
        return res.status(500).json({ error: e.message });
    }
}
