/**
 * CINQ Premium 5² — Create Stripe Checkout Session (Vercel)
 * One-time payment of 4.99€ for lifetime access to 25 slots
 * 
 * POST /api/create-checkout
 * Requires: Authorization: Bearer <access_token>
 */

import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { handleCors } from './_supabase.js';

const PRODUCT_NAME = '5² Premium';
const PRODUCT_DESCRIPTION = '25 contacts à vie — L\'upgrade définitif de Cinq';
const PRICE_CENTS = 499;
const CURRENCY = 'eur';

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
    if (handleCors(req, res, ['POST', 'OPTIONS'])) return;

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    if (!process.env.STRIPE_SECRET_KEY) {
        return res.status(500).json({ error: 'Payment system not configured' });
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

    // Auth
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

    // Check if already premium
    const { data: userData } = await supabaseAdmin
        .from('users')
        .select('is_premium')
        .eq('id', user.id)
        .single();

    if (userData?.is_premium) {
        return res.status(400).json({ error: 'Tu es déjà premium ! 🎉', code: 'ALREADY_PREMIUM' });
    }

    const body = req.body || {};
    const origin = req.headers['origin'] || 'https://cinq-three.vercel.app';
    const successUrl = body.successUrl || `${origin}/settings.html?premium=success`;
    const cancelUrl = body.cancelUrl || `${origin}/settings.html?premium=cancelled`;

    // Create pending purchase
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
        console.error('Failed to create purchase:', purchaseError);
        return res.status(500).json({ error: 'Failed to initiate purchase' });
    }

    try {
        const session = await stripe.checkout.sessions.create({
            mode: 'payment',
            payment_method_types: ['card'],
            customer_email: user.email,
            line_items: [{
                price_data: {
                    currency: CURRENCY,
                    unit_amount: PRICE_CENTS,
                    product_data: {
                        name: PRODUCT_NAME,
                        description: PRODUCT_DESCRIPTION,
                        images: ['https://cinq-three.vercel.app/assets/icons/icon-512x512.png'],
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
            expires_at: Math.floor(Date.now() / 1000) + 1800,
            billing_address_collection: 'auto',
            allow_promotion_codes: true
        });

        await supabaseAdmin
            .from('purchases')
            .update({ provider_payment_id: session.id })
            .eq('id', purchase.id);

        return res.status(200).json({
            checkoutUrl: session.url,
            sessionId: session.id,
            purchaseId: purchase.id
        });

    } catch (stripeError) {
        console.error('Stripe error:', stripeError);
        await supabaseAdmin
            .from('purchases')
            .update({ status: 'failed' })
            .eq('id', purchase.id);
        return res.status(500).json({ error: 'Erreur lors de la création du paiement' });
    }
}
