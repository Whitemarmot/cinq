/**
 * CINQ Premium 5² — Create Stripe Checkout Session
 * One-time payment of 4.99€ for lifetime access to 25 slots
 * 
 * POST /api/create-checkout
 * Body: { email?: string, successUrl?: string, cancelUrl?: string }
 * Requires: Authorization: Bearer <access_token>
 */

const Stripe = require('stripe');
const { createClient } = require('@supabase/supabase-js');
const { success, error, headers } = require('./gift-utils');

// ============================================
// Configuration
// ============================================

const PRODUCT_NAME = '5² Premium';
const PRODUCT_DESCRIPTION = '25 contacts à vie — L\'upgrade définitif de Cinq';
const PRICE_CENTS = 499; // 4.99€
const CURRENCY = 'eur';

// ============================================
// Supabase Client
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
    
    if (event.httpMethod !== 'POST') {
        return error('Method not allowed', 405);
    }
    
    // Check Stripe configuration
    if (!process.env.STRIPE_SECRET_KEY) {
        console.error('STRIPE_SECRET_KEY not configured');
        return error('Payment system not configured', 500);
    }
    
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    
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
    
    // ========================================
    // 2. Check if already premium
    // ========================================
    
    const { data: userData, error: userError } = await supabaseAdmin
        .from('users')
        .select('is_premium')
        .eq('id', user.id)
        .single();
    
    if (userData?.is_premium) {
        return error('Tu es déjà premium ! 🎉', 400, { code: 'ALREADY_PREMIUM' });
    }
    
    // ========================================
    // 3. Parse request body
    // ========================================
    
    let body = {};
    try {
        body = JSON.parse(event.body || '{}');
    } catch (e) {
        // Empty body is fine
    }
    
    const origin = event.headers['origin'] || 'https://cinq.app';
    const successUrl = body.successUrl || `${origin}/settings?premium=success`;
    const cancelUrl = body.cancelUrl || `${origin}/settings?premium=cancelled`;
    
    // ========================================
    // 4. Create pending purchase record
    // ========================================
    
    const { data: purchase, error: purchaseError } = await supabaseAdmin
        .from('purchases')
        .insert({
            user_id: user.id,
            product_id: '5squared',
            amount_cents: PRICE_CENTS,
            currency: CURRENCY,
            provider: 'stripe',
            status: 'pending',
            metadata: { email: user.email }
        })
        .select()
        .single();
    
    if (purchaseError) {
        console.error('Failed to create purchase record:', purchaseError);
        return error('Failed to initiate purchase', 500);
    }
    
    // ========================================
    // 5. Create Stripe Checkout Session
    // ========================================
    
    try {
        const session = await stripe.checkout.sessions.create({
            mode: 'payment', // One-time payment, NOT subscription
            payment_method_types: ['card'],
            customer_email: user.email,
            line_items: [{
                price_data: {
                    currency: CURRENCY,
                    unit_amount: PRICE_CENTS,
                    product_data: {
                        name: PRODUCT_NAME,
                        description: PRODUCT_DESCRIPTION,
                        images: ['https://cinq.app/assets/icons/icon-512x512.png'],
                        metadata: {
                            product_id: '5squared'
                        }
                    }
                },
                quantity: 1
            }],
            metadata: {
                user_id: user.id,
                purchase_id: purchase.id,
                product_id: '5squared'
            },
            success_url: successUrl + '&session_id={CHECKOUT_SESSION_ID}',
            cancel_url: cancelUrl,
            // Expire after 30 minutes
            expires_at: Math.floor(Date.now() / 1000) + 1800,
            // Collect billing address for tax compliance
            billing_address_collection: 'auto',
            // Allow promotion codes if we create any
            allow_promotion_codes: true
        });
        
        // Update purchase with session ID
        await supabaseAdmin
            .from('purchases')
            .update({ 
                provider_payment_id: session.id,
                metadata: { 
                    email: user.email,
                    checkout_url: session.url 
                }
            })
            .eq('id', purchase.id);
        
        return success({
            checkoutUrl: session.url,
            sessionId: session.id,
            purchaseId: purchase.id
        });
        
    } catch (stripeError) {
        console.error('Stripe error:', stripeError);
        
        // Mark purchase as failed
        await supabaseAdmin
            .from('purchases')
            .update({ status: 'failed', metadata: { error: stripeError.message } })
            .eq('id', purchase.id);
        
        return error('Erreur lors de la création du paiement', 500, { 
            code: 'STRIPE_ERROR',
            message: stripeError.message 
        });
    }
};
