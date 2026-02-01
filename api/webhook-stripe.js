/**
 * Stripe Webhook Handler
 * 
 * Handles Stripe webhook events, particularly successful payments
 * to generate and store gift codes
 */

import crypto from 'crypto';
import { supabase } from './_supabase.js';
import { logError, logInfo, createErrorResponse } from './_error-logger.js';

// Initialize Stripe (lazy loaded)
let stripe = null;
async function getStripe() {
    if (!stripe) {
        const { default: Stripe } = await import('stripe');
        stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
            apiVersion: '2024-12-18.acacia',
        });
    }
    return stripe;
}

// Gift code generation (from existing gift.js)
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateCode() {
    let code = 'CINQ-';
    for (let i = 0; i < 8; i++) {
        if (i === 4) code += '-';
        code += CODE_CHARS[crypto.randomInt(CODE_CHARS.length)];
    }
    return code;
}

function getExpirationDate() {
    const date = new Date();
    date.setDate(date.getDate() + 30); // 30 jours de validité
    return date.toISOString();
}

export default async function handler(req, res) {
    // Webhook doit être POST seulement
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
        logError(new Error('STRIPE_WEBHOOK_SECRET not configured'), { endpoint: '/api/webhook-stripe' });
        return res.status(500).json({ error: 'Webhook not properly configured' });
    }

    let event;

    try {
        const stripe = await getStripe();
        
        // Vérifier la signature Stripe
        event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err) {
        logError(err, { 
            endpoint: '/api/webhook-stripe',
            signature: sig?.substring(0, 20) + '...',
            message: 'Webhook signature verification failed'
        });
        return res.status(400).json({ error: `Webhook signature verification failed: ${err.message}` });
    }

    try {
        // Handle différents types d'événements
        switch (event.type) {
            case 'checkout.session.completed':
                await handleCheckoutCompleted(event.data.object);
                break;
            
            case 'payment_intent.succeeded':
                logInfo('Payment confirmed', { paymentIntentId: event.data.object.id });
                break;
            
            case 'payment_intent.payment_failed':
                logError(new Error('Payment failed'), { 
                    paymentIntentId: event.data.object.id,
                    error: event.data.object.last_payment_error 
                });
                break;
            
            default:
                logInfo('Unhandled webhook event', { type: event.type, id: event.id });
        }

        return res.json({ received: true, event_type: event.type });

    } catch (error) {
        logError(error, { 
            endpoint: '/api/webhook-stripe',
            eventType: event.type,
            eventId: event.id
        });

        return res.status(500).json(
            createErrorResponse(error, { 
                includeDebug: process.env.NODE_ENV === 'development'
            })
        );
    }
}

/**
 * Handle successful checkout session
 */
async function handleCheckoutCompleted(session) {
    const { id: sessionId, metadata, customer_email, amount_total } = session;
    
    logInfo('Processing completed checkout', {
        sessionId,
        metadata,
        customerEmail: customer_email,
        amount: amount_total
    });

    // Vérifier qu'on n'a pas déjà traité cette session
    const { data: existingPurchase } = await supabase
        .from('purchases')
        .select('id')
        .eq('stripe_session_id', sessionId)
        .single();

    if (existingPurchase) {
        logInfo('Purchase already processed', { sessionId, purchaseId: existingPurchase.id });
        return;
    }

    // Extraire les metadata
    const packType = metadata.pack_type || '5_codes';
    const quantity = parseInt(metadata.quantity) || 1;
    const codesCount = parseInt(metadata.codes_count) || 5;

    // Générer les codes cadeau
    const codes = [];
    const expiresAt = getExpirationDate();

    for (let i = 0; i < codesCount; i++) {
        let code;
        let attempts = 0;
        const maxAttempts = 10;

        // Générer un code unique
        do {
            code = generateCode();
            attempts++;
            
            // Vérifier l'unicité
            const { data: existing } = await supabase
                .from('gift_codes')
                .select('id')
                .eq('code', code)
                .single();
                
            if (!existing) break;
            
            if (attempts >= maxAttempts) {
                throw new Error(`Failed to generate unique code after ${maxAttempts} attempts`);
            }
        } while (attempts < maxAttempts);

        codes.push(code);

        // Créer le code en DB
        const { error: codeError } = await supabase
            .from('gift_codes')
            .insert({
                code,
                created_by: null, // Créé via achat, pas par un utilisateur
                status: 'active',
                expires_at: expiresAt,
                purchase_session_id: sessionId
            });

        if (codeError) {
            throw new Error(`Failed to create gift code ${code}: ${codeError.message}`);
        }
    }

    // Créer l'enregistrement de la purchase
    const { data: purchase, error: purchaseError } = await supabase
        .from('purchases')
        .insert({
            stripe_session_id: sessionId,
            customer_email,
            pack_type: packType,
            quantity,
            codes_count: codesCount,
            amount_cents: amount_total,
            currency: 'EUR',
            codes: codes,
            status: 'completed'
        })
        .select()
        .single();

    if (purchaseError) {
        throw new Error(`Failed to create purchase record: ${purchaseError.message}`);
    }

    logInfo('Gift codes generated successfully', {
        purchaseId: purchase.id,
        sessionId,
        codesGenerated: codes.length,
        codes: codes // Pour debug uniquement
    });

    // TODO: Optionnel - Envoyer email avec les codes
    // await sendCodesByEmail(customer_email, codes);
}

/**
 * Send codes by email (optionnel)
 */
async function sendCodesByEmail(email, codes) {
    // TODO: Implémenter l'envoi d'email
    // Peut utiliser SendGrid, Postmark, ou autre service
    logInfo('Email sending not implemented yet', { 
        recipient: email, 
        codesCount: codes.length 
    });
}