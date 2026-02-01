/**
 * CINQ Premium 5² — Stripe Webhook Handler (Vercel)
 * Receives payment confirmations and activates premium
 * 
 * POST /api/stripe-webhook
 * Headers: stripe-signature
 */

import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { buffer } from 'micro';

// Disable body parsing for raw webhook data
export const config = {
    api: {
        bodyParser: false,
    },
};

function getSupabaseAdmin() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    return createClient(url, key, {
        auth: { autoRefreshToken: false, persistSession: false }
    });
}

async function activatePremium(supabase, userId, purchaseId, sessionData) {
    console.log(`Activating premium for user ${userId}`);
    
    // Update user to premium
    const { error: userError } = await supabase
        .from('users')
        .update({
            is_premium: true,
            premium_since: new Date().toISOString(),
            updated_at: new Date().toISOString()
        })
        .eq('id', userId);
    
    if (userError) {
        console.error('Failed to update user premium status:', userError);
        throw new Error('Failed to activate premium');
    }
    
    // Update purchase record
    await supabase
        .from('purchases')
        .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            provider_payment_id: sessionData.payment_intent || sessionData.id,
            provider_customer_id: sessionData.customer,
            metadata: {
                stripe_session_id: sessionData.id,
                amount_total: sessionData.amount_total,
                currency: sessionData.currency,
                payment_status: sessionData.payment_status,
                customer_email: sessionData.customer_details?.email
            }
        })
        .eq('id', purchaseId);
    
    console.log(`✅ Premium activated for user ${userId}`);
    return true;
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
        console.error('Stripe not configured');
        return res.status(500).json({ error: 'Webhook not configured' });
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const supabase = getSupabaseAdmin();

    // Get raw body for signature verification
    const buf = await buffer(req);
    const sig = req.headers['stripe-signature'];

    if (!sig) {
        return res.status(400).json({ error: 'Missing stripe-signature header' });
    }

    let stripeEvent;
    try {
        stripeEvent = stripe.webhooks.constructEvent(buf, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
        console.error('Webhook signature verification failed:', err.message);
        return res.status(400).json({ error: `Webhook Error: ${err.message}` });
    }

    console.log(`📥 Stripe webhook: ${stripeEvent.type}`);

    try {
        switch (stripeEvent.type) {
            case 'checkout.session.completed': {
                const session = stripeEvent.data.object;
                
                if (session.payment_status !== 'paid') {
                    console.log(`Session ${session.id} not paid yet`);
                    break;
                }
                
                const userId = session.metadata?.user_id;
                const purchaseId = session.metadata?.purchase_id;
                const productId = session.metadata?.product_id;
                
                if (!userId || !purchaseId || productId !== '5squared') {
                    console.log('Missing metadata or not 5squared product');
                    break;
                }
                
                await activatePremium(supabase, userId, purchaseId, session);
                console.log(`🎉 5² Premium activated!`);
                break;
            }
            
            case 'checkout.session.expired': {
                const session = stripeEvent.data.object;
                const purchaseId = session.metadata?.purchase_id;
                
                if (purchaseId) {
                    await supabase
                        .from('purchases')
                        .update({ status: 'failed', metadata: { failure_reason: 'expired' } })
                        .eq('id', purchaseId);
                }
                break;
            }
            
            case 'charge.refunded': {
                const charge = stripeEvent.data.object;
                const paymentIntent = charge.payment_intent;
                
                const { data: purchase } = await supabase
                    .from('purchases')
                    .select('id, user_id')
                    .eq('provider_payment_id', paymentIntent)
                    .single();
                
                if (purchase) {
                    await supabase
                        .from('purchases')
                        .update({ status: 'refunded', refunded_at: new Date().toISOString() })
                        .eq('id', purchase.id);
                    
                    await supabase
                        .from('users')
                        .update({ is_premium: false, updated_at: new Date().toISOString() })
                        .eq('id', purchase.user_id);
                    
                    console.log(`❌ Premium revoked (refund)`);
                }
                break;
            }
        }

        return res.status(200).json({ received: true });

    } catch (err) {
        console.error('Webhook error:', err);
        return res.status(500).json({ error: 'Webhook processing failed' });
    }
}
