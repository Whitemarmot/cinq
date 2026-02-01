/**
 * CINQ Premium 5² — Stripe Webhook Handler
 * Receives payment confirmations and activates premium
 * 
 * POST /api/stripe-webhook
 * Headers: stripe-signature
 */

const Stripe = require('stripe');
const { createClient } = require('@supabase/supabase-js');

// ============================================
// Configuration
// ============================================

const headers = {
    'Content-Type': 'application/json',
    'X-Content-Type-Options': 'nosniff'
};

// ============================================
// Supabase Admin Client
// ============================================

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
// Activate Premium
// ============================================

async function activatePremium(supabase, userId, purchaseId, sessionData) {
    console.log(`Activating premium for user ${userId}`);
    
    // 1. Update user to premium
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
        throw new Error('Failed to activate premium: user update failed');
    }
    
    // 2. Update purchase record
    const { error: purchaseError } = await supabase
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
    
    if (purchaseError) {
        console.error('Failed to update purchase record:', purchaseError);
        // Don't throw - premium is already activated
    }
    
    console.log(`✅ Premium activated for user ${userId}`);
    return true;
}

// ============================================
// Handler
// ============================================

exports.handler = async (event, context) => {
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }
    
    // Check configuration
    if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
        console.error('Stripe not configured (STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET missing)');
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Webhook not configured' })
        };
    }
    
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const supabase = getSupabaseAdmin();
    
    // ========================================
    // 1. Verify Stripe Signature
    // ========================================
    
    const sig = event.headers['stripe-signature'];
    
    if (!sig) {
        console.error('No stripe-signature header');
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Missing stripe-signature header' })
        };
    }
    
    let stripeEvent;
    
    try {
        stripeEvent = stripe.webhooks.constructEvent(
            event.body,
            sig,
            process.env.STRIPE_WEBHOOK_SECRET
        );
    } catch (err) {
        console.error('Webhook signature verification failed:', err.message);
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: `Webhook Error: ${err.message}` })
        };
    }
    
    console.log(`📥 Stripe webhook received: ${stripeEvent.type}`);
    
    // ========================================
    // 2. Handle Events
    // ========================================
    
    try {
        switch (stripeEvent.type) {
            case 'checkout.session.completed': {
                const session = stripeEvent.data.object;
                
                // Only process successful payments
                if (session.payment_status !== 'paid') {
                    console.log(`Session ${session.id} not yet paid, status: ${session.payment_status}`);
                    break;
                }
                
                const userId = session.metadata?.user_id;
                const purchaseId = session.metadata?.purchase_id;
                const productId = session.metadata?.product_id;
                
                if (!userId || !purchaseId) {
                    console.error('Missing user_id or purchase_id in session metadata:', session.metadata);
                    return {
                        statusCode: 400,
                        headers,
                        body: JSON.stringify({ error: 'Missing required metadata' })
                    };
                }
                
                // Verify product is 5squared
                if (productId !== '5squared') {
                    console.log(`Unknown product: ${productId}`);
                    break;
                }
                
                // Activate premium!
                await activatePremium(supabase, userId, purchaseId, session);
                
                console.log(`🎉 5² Premium activated for ${session.customer_details?.email || userId}`);
                break;
            }
            
            case 'checkout.session.async_payment_succeeded': {
                // For payment methods that are async (bank transfers, etc)
                const session = stripeEvent.data.object;
                const userId = session.metadata?.user_id;
                const purchaseId = session.metadata?.purchase_id;
                
                if (userId && purchaseId && session.metadata?.product_id === '5squared') {
                    await activatePremium(supabase, userId, purchaseId, session);
                }
                break;
            }
            
            case 'checkout.session.async_payment_failed': {
                const session = stripeEvent.data.object;
                const purchaseId = session.metadata?.purchase_id;
                
                if (purchaseId) {
                    await supabase
                        .from('purchases')
                        .update({
                            status: 'failed',
                            metadata: {
                                failure_reason: 'async_payment_failed',
                                stripe_session_id: session.id
                            }
                        })
                        .eq('id', purchaseId);
                }
                break;
            }
            
            case 'checkout.session.expired': {
                // Session expired without payment
                const session = stripeEvent.data.object;
                const purchaseId = session.metadata?.purchase_id;
                
                if (purchaseId) {
                    await supabase
                        .from('purchases')
                        .update({
                            status: 'failed',
                            metadata: {
                                failure_reason: 'session_expired',
                                stripe_session_id: session.id
                            }
                        })
                        .eq('id', purchaseId);
                }
                break;
            }
            
            case 'charge.refunded': {
                // Handle refunds - revoke premium
                const charge = stripeEvent.data.object;
                const paymentIntent = charge.payment_intent;
                
                // Find the purchase by payment intent
                const { data: purchase } = await supabase
                    .from('purchases')
                    .select('id, user_id')
                    .eq('provider_payment_id', paymentIntent)
                    .single();
                
                if (purchase) {
                    // Mark as refunded
                    await supabase
                        .from('purchases')
                        .update({
                            status: 'refunded',
                            refunded_at: new Date().toISOString()
                        })
                        .eq('id', purchase.id);
                    
                    // Revoke premium
                    await supabase
                        .from('users')
                        .update({
                            is_premium: false,
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', purchase.user_id);
                    
                    console.log(`❌ Premium revoked for user ${purchase.user_id} (refund)`);
                }
                break;
            }
            
            default:
                console.log(`Unhandled event type: ${stripeEvent.type}`);
        }
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ received: true })
        };
        
    } catch (err) {
        console.error('Error processing webhook:', err);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Webhook processing failed' })
        };
    }
};
