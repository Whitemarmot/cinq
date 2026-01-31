import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { checkRateLimit, RATE_LIMITS } from './_rate-limit.js';
import { logError, logInfo, createErrorResponse } from './_error-logger.js';

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

async function getUser(req) {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) return null;
    
    try {
        const { data: { user }, error } = await supabase.auth.getUser(auth.split(' ')[1]);
        if (error) return null;
        return user;
    } catch {
        return null;
    }
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    if (req.method === 'OPTIONS') return res.status(200).end();

    const action = req.query.action || req.body?.action;

    try {
        // ============ CREATE (auth optional for MVP) ============
        if (action === 'create') {
            // Rate limit - very strict for gift creation (IP-based)
            if (!checkRateLimit(req, res, { ...RATE_LIMITS.GIFT_CREATE, keyPrefix: 'gift:create' })) {
                return;
            }

            // Auth is optional - if logged in, track who created it
            const user = await getUser(req);

            // If logged in, check limit per user
            if (user) {
                const { count } = await supabase
                    .from('gift_codes')
                    .select('*', { count: 'exact', head: true })
                    .eq('created_by', user.id)
                    .eq('status', 'active');

                if (count >= 5) {
                    return res.status(400).json({ error: 'Tu as déjà 5 invitations actives' });
                }
            }

            // Create gift code
            const code = generateCode();
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + 30); // 30 days

            const { data, error } = await supabase
                .from('gift_codes')
                .insert({
                    code,
                    created_by: user?.id || null,
                    status: 'active',
                    expires_at: expiresAt.toISOString()
                })
                .select()
                .single();

            if (error) throw error;

            return res.json({
                success: true,
                code: data.code,
                gift: {
                    code: data.code,
                    expiresAt: data.expires_at,
                    shareUrl: `https://cinq-three.vercel.app/register.html?code=${data.code}`
                }
            });
        }

        // ============ VERIFY (check if code is valid) ============
        if (action === 'verify') {
            // Rate limit
            if (!checkRateLimit(req, res, { ...RATE_LIMITS.READ, keyPrefix: 'gift:verify' })) {
                return;
            }

            const code = (req.query.code || req.body?.code || '').toUpperCase().trim();
            
            if (!code) {
                return res.status(400).json({ error: 'Code requis' });
            }

            // Validate format before querying
            if (!/^CINQ-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code)) {
                return res.json({ valid: false, reason: 'Format invalide' });
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
            const user = await getUser(req);
            if (!user) {
                return res.status(401).json({ error: 'Non authentifié' });
            }

            // Rate limit
            if (!checkRateLimit(req, res, { ...RATE_LIMITS.READ, keyPrefix: 'gift:list', userId: user.id })) {
                return;
            }

            const { data, error } = await supabase
                .from('gift_codes')
                .select('code, status, created_at, expires_at, redeemed_by')
                .eq('created_by', user.id)
                .order('created_at', { ascending: false });

            return res.json({ gifts: data || [] });
        }

        return res.status(400).json({ error: 'Action invalide. Use: create, verify, list' });

    } catch (e) {
        logError(e, { 
            endpoint: '/api/gift',
            action,
            method: req.method 
        });
        return res.status(500).json(
            createErrorResponse(e, { 
                includeDebug: process.env.NODE_ENV === 'development',
                hint: 'Réessaie dans quelques instants'
            })
        );
    }
}
