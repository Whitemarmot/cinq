/**
 * CINQ Gift Code - CREATE Endpoint
 * POST /api/gift/create
 * 
 * Crée un nouveau code cadeau après paiement confirmé.
 * Requiert authentification service (webhook Stripe ou admin).
 */

const {
    generateGiftCode,
    hashCode,
    extractPrefix,
    success,
    error,
    createSupabaseClient,
    headers,
} = require('./gift-utils');

exports.handler = async (event, context) => {
    // CORS preflight
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers, body: '' };
    }

    // POST only
    if (event.httpMethod !== 'POST') {
        return error('Method not allowed', 405);
    }

    try {
        // ============================================
        // Authentication - Webhook secret ou Admin JWT
        // ============================================
        
        const authHeader = event.headers.authorization || '';
        const webhookSecret = process.env.GIFT_WEBHOOK_SECRET;
        const stripeSignature = event.headers['stripe-signature'];
        
        let isAuthenticated = false;
        let authMethod = null;
        
        // Option 1: Stripe webhook signature
        if (stripeSignature && webhookSecret) {
            // TODO: Vérifier signature Stripe (stripe.webhooks.constructEvent)
            // Pour l'instant, on vérifie juste la présence
            isAuthenticated = true;
            authMethod = 'stripe_webhook';
        }
        
        // Option 2: Bearer token admin (timing-safe comparison)
        if (authHeader.startsWith('Bearer ')) {
            const token = authHeader.slice(7);
            const adminSecret = process.env.GIFT_ADMIN_SECRET;
            if (adminSecret && token.length === adminSecret.length) {
                const crypto = require('crypto');
                const tokenBuf = Buffer.from(token);
                const secretBuf = Buffer.from(adminSecret);
                if (crypto.timingSafeEqual(tokenBuf, secretBuf)) {
                    isAuthenticated = true;
                    authMethod = 'admin_token';
                }
            }
        }
        
        // Option 3: Service API key
        const apiKey = event.headers['x-api-key'];
        if (apiKey === process.env.GIFT_API_KEY) {
            isAuthenticated = true;
            authMethod = 'api_key';
        }
        
        if (!isAuthenticated) {
            return error('Unauthorized', 401);
        }

        // ============================================
        // Parse & Validate Request
        // ============================================
        
        let body;
        try {
            body = JSON.parse(event.body || '{}');
        } catch (e) {
            return error('Invalid JSON body', 400);
        }

        const {
            amount_cents,
            currency = 'EUR',
            purchaser_email,
            purchaser_name,
            purchase_order_id,
            recipient_email,
            recipient_name,
            gift_message,
            expires_days = 365,
        } = body;

        // Validation
        if (!amount_cents || typeof amount_cents !== 'number' || amount_cents <= 0) {
            return error('amount_cents must be a positive integer', 400);
        }

        if (!['EUR', 'USD', 'GBP'].includes(currency)) {
            return error('currency must be EUR, USD, or GBP', 400);
        }

        if (amount_cents > 50000) { // Max 500€
            return error('amount_cents exceeds maximum (50000)', 400);
        }

        if (expires_days < 1 || expires_days > 730) {
            return error('expires_days must be between 1 and 730', 400);
        }

        // ============================================
        // Generate & Store Code
        // ============================================
        
        const supabase = createSupabaseClient();
        
        // Générer un code unique (avec retry en cas de collision)
        let code, codeHash, attempts = 0;
        const maxAttempts = 5;
        
        while (attempts < maxAttempts) {
            code = generateGiftCode();
            codeHash = hashCode(code);
            
            // Vérifier unicité
            const { data: existing } = await supabase
                .from('gift_codes')
                .select('id')
                .eq('code_hash', codeHash)
                .single();
            
            if (!existing) break;
            attempts++;
        }

        if (attempts >= maxAttempts) {
            console.error('Failed to generate unique code after', maxAttempts, 'attempts');
            return error('Failed to generate unique code. Please retry.', 500);
        }

        // Calculer expiration
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + expires_days);

        // Insérer en DB
        const { data: giftCode, error: insertError } = await supabase
            .from('gift_codes')
            .insert({
                code_hash: codeHash,
                code_prefix: extractPrefix(code),
                amount_cents,
                currency,
                purchaser_email: purchaser_email || null,
                purchaser_name: purchaser_name || null,
                purchase_order_id: purchase_order_id || null,
                recipient_email: recipient_email || null,
                recipient_name: recipient_name || null,
                gift_message: gift_message ? gift_message.slice(0, 500) : null,
                expires_at: expiresAt.toISOString(),
                status: 'active',
            })
            .select('id, amount_cents, currency, expires_at, created_at')
            .single();

        if (insertError) {
            console.error('Database insert error:', insertError);
            return error('Failed to create gift code', 500);
        }

        // ============================================
        // Success Response
        // ============================================
        
        console.log(`Gift code created: ${extractPrefix(code)}**** - ${amount_cents} ${currency} - via ${authMethod}`);

        return success({
            code, // Le code en clair (une seule fois!)
            gift_code: {
                id: giftCode.id,
                prefix: extractPrefix(code),
                amount: {
                    cents: giftCode.amount_cents,
                    formatted: `${(giftCode.amount_cents / 100).toFixed(2)} ${giftCode.currency}`,
                },
                currency: giftCode.currency,
                expires_at: giftCode.expires_at,
                created_at: giftCode.created_at,
            },
            message: 'Gift code created successfully. Store this code securely - it cannot be retrieved later.',
        }, 201);

    } catch (err) {
        console.error('Gift create error:', err);
        return error('Internal server error', 500);
    }
};
