/**
 * CINQ Premium 5² — Check Premium Status (Vercel)
 * 
 * GET /api/premium-status
 * Requires: Authorization: Bearer <access_token>
 */

import { createClient } from '@supabase/supabase-js';
import { handleCors } from './_supabase.js';

function getSupabaseWithToken(token) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    return createClient(url, key, {
        global: { headers: { Authorization: `Bearer ${token}` } },
        auth: { autoRefreshToken: false, persistSession: false }
    });
}

function getSupabaseAdmin() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    return createClient(url, key, {
        auth: { autoRefreshToken: false, persistSession: false }
    });
}

export default async function handler(req, res) {
    if (handleCors(req, res, ['GET', 'OPTIONS'])) return;

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const authHeader = req.headers['authorization'];
    if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Authorization required' });
    }
    const token = authHeader.slice(7);

    const supabase = getSupabaseWithToken(token);
    const supabaseAdmin = getSupabaseAdmin();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }

    try {
        // Get user premium status
        const { data: userData } = await supabaseAdmin
            .from('users')
            .select('is_premium, premium_since')
            .eq('id', user.id)
            .single();

        const isPremium = userData?.is_premium || false;
        const premiumSince = userData?.premium_since || null;
        const contactLimit = isPremium ? 25 : 5;

        // Get contact count
        const { count: contactCount } = await supabaseAdmin
            .from('contacts')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.id);

        // Get purchases if premium
        let purchases = [];
        if (isPremium) {
            const { data: purchaseData } = await supabaseAdmin
                .from('purchases')
                .select('id, product_id, amount_cents, currency, provider, status, completed_at')
                .eq('user_id', user.id)
                .eq('status', 'completed')
                .order('completed_at', { ascending: false })
                .limit(5);
            purchases = purchaseData || [];
        }

        return res.status(200).json({
            isPremium,
            premiumSince,
            plan: isPremium ? '5squared' : 'free',
            planName: isPremium ? '5² Premium' : 'Gratuit',
            contactLimit,
            contactCount: contactCount || 0,
            slotsRemaining: contactLimit - (contactCount || 0),
            features: isPremium ? {
                contacts: 25,
                badge: true,
                themes: 8
            } : {
                contacts: 5,
                badge: false,
                themes: 2
            },
            purchases: purchases.map(p => ({
                id: p.id,
                product: p.product_id,
                amount: `${(p.amount_cents / 100).toFixed(2)}€`,
                provider: p.provider,
                date: p.completed_at
            })),
            upgrade: !isPremium ? {
                available: true,
                product: '5squared',
                price: '4.99€',
                priceDescription: 'Paiement unique, à vie',
                features: [
                    '25 contacts au lieu de 5',
                    'Badge ✨ sur ton profil',
                    'Thèmes exclusifs',
                    'Soutenir Cinq ❤️'
                ]
            } : null
        });

    } catch (err) {
        console.error('Error in premium-status:', err);
        return res.status(500).json({ error: 'Server error' });
    }
}
