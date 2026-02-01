/**
 * Stripe Checkout Session Creation
 * 
 * Creates a Stripe Checkout session for gift code packs
 */

import { handleCors } from './_supabase.js';
import { checkRateLimit, RATE_LIMITS } from './_rate-limit.js';
import { logError, logInfo, createErrorResponse } from './_error-logger.js';

// Initialize Stripe (lazy loaded to avoid startup cost)
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

const PRODUCTS = {
    '5_codes': {
        name: 'Pack de 5 codes cadeau Cinq',
        price: 500, // 5€ en centimes
        description: '5 codes d\'invitation pour Cinq, l\'anti-réseau social',
        codes_count: 5
    }
};

export default async function handler(req, res) {
    if (handleCors(req, res, ['POST', 'OPTIONS'])) return;

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Rate limiting
    if (!checkRateLimit(req, res, { 
        ...RATE_LIMITS.CHECKOUT, 
        keyPrefix: 'checkout:create' 
    })) {
        return;
    }

    try {
        const { pack_type = '5_codes', quantity = 1 } = req.body;

        // Validation
        if (!PRODUCTS[pack_type]) {
            return res.status(400).json({ 
                error: 'Type de pack invalide',
                available_packs: Object.keys(PRODUCTS)
            });
        }

        if (quantity < 1 || quantity > 10) {
            return res.status(400).json({ 
                error: 'Quantité invalide (1-10)' 
            });
        }

        const product = PRODUCTS[pack_type];
        const totalAmount = product.price * quantity;
        const totalCodes = product.codes_count * quantity;

        const stripe = await getStripe();

        // Créer la session Checkout
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [
                {
                    price_data: {
                        currency: 'eur',
                        product_data: {
                            name: product.name,
                            description: product.description,
                            images: ['https://cinq.app/og-image.png'],
                        },
                        unit_amount: product.price,
                    },
                    quantity: quantity,
                },
            ],
            mode: 'payment',
            success_url: `${process.env.SITE_URL || 'https://cinq.app'}/success.html?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${process.env.SITE_URL || 'https://cinq.app'}/buy.html?cancelled=true`,
            metadata: {
                pack_type,
                quantity: quantity.toString(),
                codes_count: totalCodes.toString(),
                source: 'cinq_gift_codes'
            },
            customer_email: req.body.email || undefined,
            billing_address_collection: 'auto',
            shipping_address_collection: null, // Digital product
            expires_at: Math.floor(Date.now() / 1000) + (30 * 60), // 30 minutes
        });

        logInfo('Checkout session created', {
            sessionId: session.id,
            packType: pack_type,
            quantity,
            amount: totalAmount,
            codesCount: totalCodes
        });

        return res.json({
            success: true,
            sessionId: session.id,
            url: session.url,
            purchase: {
                pack_type,
                quantity,
                codes_count: totalCodes,
                total_amount: totalAmount,
                currency: 'EUR'
            }
        });

    } catch (error) {
        logError(error, { 
            endpoint: '/api/create-checkout',
            method: req.method,
            body: req.body
        });

        // Erreurs Stripe spécifiques
        if (error.type && error.type.startsWith('Stripe')) {
            return res.status(400).json({
                error: 'Erreur de paiement',
                details: error.message,
                type: error.type
            });
        }

        return res.status(500).json(
            createErrorResponse(error, { 
                includeDebug: process.env.NODE_ENV === 'development',
                hint: 'Réessaie dans quelques instants'
            })
        );
    }
}