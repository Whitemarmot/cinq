/**
 * CINQ Premium 5² — Check Premium Status
 * 
 * GET /api/premium-status
 * Requires: Authorization: Bearer <access_token>
 * 
 * Returns user's premium status, contact limits, and purchase history
 */

const { createClient } = require('@supabase/supabase-js');
const { success, error, headers } = require('./gift-utils');

// ============================================
// Supabase Clients
// ============================================

function getSupabaseWithToken(token) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!url || !key) {
        throw new Error('Missing Supabase configuration');
    }
    
    return createClient(url, key, {
        global: {
            headers: { Authorization: `Bearer ${token}` }
        },
        auth: { autoRefreshToken: false, persistSession: false }
    });
}

function getSupabaseAdmin() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!url || !key) {
        throw new Error('Missing Supabase admin configuration');
    }
    
    return createClient(url, key, {
        auth: { autoRefreshToken: false, persistSession: false }
    });
}

// ============================================
// Auth Helper
// ============================================

function getAuthToken(event) {
    const authHeader = event.headers['authorization'] || event.headers['Authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null;
    }
    return authHeader.slice(7);
}

// ============================================
// Handler
// ============================================

exports.handler = async (event, context) => {
    // CORS preflight
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers, body: '' };
    }
    
    if (event.httpMethod !== 'GET') {
        return error('Method not allowed', 405);
    }
    
    // ========================================
    // 1. Authentication
    // ========================================
    
    const token = getAuthToken(event);
    if (!token) {
        return error('Authorization required', 401);
    }
    
    const supabase = getSupabaseWithToken(token);
    const supabaseAdmin = getSupabaseAdmin();
    
    // Verify token and get user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
        return error('Invalid or expired token', 401);
    }
    
    try {
        // ========================================
        // 2. Get user premium status
        // ========================================
        
        const { data: userData, error: userError } = await supabaseAdmin
            .from('users')
            .select('is_premium, premium_since')
            .eq('id', user.id)
            .single();
        
        if (userError) {
            console.error('Error fetching user:', userError);
            return error('Failed to fetch user data', 500);
        }
        
        const isPremium = userData?.is_premium || false;
        const premiumSince = userData?.premium_since || null;
        const contactLimit = isPremium ? 25 : 5;
        
        // ========================================
        // 3. Get contact count
        // ========================================
        
        const { count: contactCount } = await supabaseAdmin
            .from('contacts')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.id);
        
        // ========================================
        // 4. Get purchase history (if premium)
        // ========================================
        
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
        
        // ========================================
        // 5. Return status
        // ========================================
        
        return success({
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
        return error('Server error', 500);
    }
};
