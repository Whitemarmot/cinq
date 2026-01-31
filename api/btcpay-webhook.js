/**
 * CINQ - BTCPay Webhook Handler
 * POST /.netlify/functions/btcpay-webhook
 * 
 * Reçoit les notifications de paiement BTCPay Server.
 * Vérifie signature HMAC, crée/active le code cadeau correspondant.
 * 
 * BTCPay Events: https://docs.btcpayserver.org/Development/Webhooks/
 */

const crypto = require('crypto');
const {
    generateGiftCode,
    hashCode,
    extractPrefix,
    success,
    error,
    createSupabaseClient,
    headers,
} = require('./gift-utils');

// ============================================
// HMAC Signature Verification
// ============================================

/**
 * Vérifie la signature HMAC-SHA256 de BTCPay
 * Header: BTCPay-Sig: sha256=XXXXX
 * 
 * @param {string} payload - Raw request body
 * @param {string} signature - BTCPay-Sig header value
 * @param {string} secret - Webhook secret from BTCPay
 * @returns {boolean}
 */
function verifyBTCPaySignature(payload, signature, secret) {
    if (!payload || !signature || !secret) {
        return false;
    }

    // BTCPay format: sha256=XXXX
    const match = signature.match(/^sha256=(.+)$/i);
    if (!match) {
        console.error('Invalid BTCPay-Sig format:', signature.slice(0, 20));
        return false;
    }

    const providedHash = match[1].toLowerCase();
    
    // Compute expected HMAC
    const expectedHash = crypto
        .createHmac('sha256', secret)
        .update(payload, 'utf8')
        .digest('hex')
        .toLowerCase();

    // Timing-safe comparison
    try {
        return crypto.timingSafeEqual(
            Buffer.from(providedHash, 'hex'),
            Buffer.from(expectedHash, 'hex')
        );
    } catch (e) {
        // Length mismatch or invalid hex
        console.error('Signature comparison failed:', e.message);
        return false;
    }
}

// ============================================
// BTCPay Event Types
// ============================================

const BTCPAY_EVENTS = {
    INVOICE_CREATED: 'InvoiceCreated',
    INVOICE_RECEIVED_PAYMENT: 'InvoiceReceivedPayment',
    INVOICE_PROCESSING: 'InvoiceProcessing',       // Payment received, waiting confirmations
    INVOICE_EXPIRED: 'InvoiceExpired',
    INVOICE_SETTLED: 'InvoiceSettled',             // ✅ Payment confirmed!
    INVOICE_INVALID: 'InvoiceInvalid',
    INVOICE_PAYMENT_SETTLED: 'InvoicePaymentSettled',
};

// Events that trigger code creation/activation
const ACTIVATION_EVENTS = [
    BTCPAY_EVENTS.INVOICE_SETTLED,
    BTCPAY_EVENTS.INVOICE_PAYMENT_SETTLED,
];

// ============================================
// Main Handler
// ============================================

exports.handler = async (event, context) => {
    // CORS preflight (shouldn't be needed for webhooks, but safe)
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers, body: '' };
    }

    // POST only
    if (event.httpMethod !== 'POST') {
        return error('Method not allowed', 405);
    }

    const requestId = crypto.randomBytes(8).toString('hex');
    const timestamp = new Date().toISOString();

    try {
        // ============================================
        // 1. Verify HMAC Signature
        // ============================================
        
        const btcpaySignature = event.headers['btcpay-sig'];
        const webhookSecret = process.env.BTCPAY_WEBHOOK_SECRET;

        if (!webhookSecret) {
            console.error(`[${requestId}] BTCPAY_WEBHOOK_SECRET not configured`);
            return error('Webhook not configured', 500);
        }

        if (!btcpaySignature) {
            console.warn(`[${requestId}] Missing BTCPay-Sig header`);
            return error('Missing signature', 401);
        }

        // Use raw body for signature verification
        const rawBody = event.body;
        
        if (!verifyBTCPaySignature(rawBody, btcpaySignature, webhookSecret)) {
            console.error(`[${requestId}] Invalid BTCPay signature`);
            return error('Invalid signature', 401);
        }

        // ============================================
        // 2. Parse & Validate Payload
        // ============================================
        
        let payload;
        try {
            payload = JSON.parse(rawBody);
        } catch (e) {
            console.error(`[${requestId}] Invalid JSON:`, e.message);
            return error('Invalid JSON payload', 400);
        }

        const {
            type: eventType,
            invoiceId,
            storeId,
            metadata = {},
            timestamp: eventTimestamp,
        } = payload;

        // Log incoming webhook
        console.log(`[${requestId}] BTCPay webhook received`, {
            type: eventType,
            invoiceId,
            storeId,
            timestamp: eventTimestamp,
        });

        // Validate required fields
        if (!eventType || !invoiceId) {
            console.error(`[${requestId}] Missing required fields`);
            return error('Missing required fields: type, invoiceId', 400);
        }

        // ============================================
        // 3. Store Webhook Event (Audit Log)
        // ============================================
        
        const supabase = createSupabaseClient();

        // Log all webhook events for debugging/audit
        const { error: logError } = await supabase
            .from('btcpay_webhook_logs')
            .insert({
                request_id: requestId,
                invoice_id: invoiceId,
                store_id: storeId || null,
                event_type: eventType,
                payload: payload,
                received_at: timestamp,
                processed: false,
            });

        if (logError) {
            console.warn(`[${requestId}] Failed to log webhook:`, logError.message);
            // Continue processing - logging failure shouldn't block payment
        }

        // ============================================
        // 4. Handle Event Types
        // ============================================
        
        // Only process activation events
        if (!ACTIVATION_EVENTS.includes(eventType)) {
            console.log(`[${requestId}] Event ${eventType} - acknowledged, no action needed`);
            
            return success({
                message: 'Event acknowledged',
                requestId,
                eventType,
                action: 'none',
            });
        }

        // ============================================
        // 5. Check for Duplicate Processing
        // ============================================
        
        const { data: existingCode } = await supabase
            .from('gift_codes')
            .select('id, code_prefix, status')
            .eq('purchase_order_id', `btcpay:${invoiceId}`)
            .single();

        if (existingCode) {
            console.log(`[${requestId}] Invoice ${invoiceId} already processed - code ${existingCode.code_prefix}****`);
            
            // Update webhook log
            await supabase
                .from('btcpay_webhook_logs')
                .update({ processed: true, notes: 'duplicate' })
                .eq('request_id', requestId);

            return success({
                message: 'Invoice already processed',
                requestId,
                invoiceId,
                codePrefix: existingCode.code_prefix,
                action: 'skip_duplicate',
            });
        }

        // ============================================
        // 6. Fetch Invoice Details from BTCPay API
        // ============================================
        
        const invoiceDetails = await fetchBTCPayInvoice(invoiceId, storeId);
        
        if (!invoiceDetails) {
            console.error(`[${requestId}] Failed to fetch invoice ${invoiceId}`);
            return error('Failed to fetch invoice details', 500);
        }

        // Extract payment info
        const {
            amount: amountStr,
            currency,
            status: invoiceStatus,
            metadata: invoiceMetadata = {},
        } = invoiceDetails;

        const amountCents = Math.round(parseFloat(amountStr) * 100);

        // Verify invoice is actually settled
        if (invoiceStatus !== 'Settled' && invoiceStatus !== 'Complete') {
            console.warn(`[${requestId}] Invoice ${invoiceId} status is ${invoiceStatus}, not settled`);
            return error('Invoice not yet settled', 400);
        }

        // ============================================
        // 7. Create Gift Code
        // ============================================
        
        // Generate unique code
        let code, codeHash, attempts = 0;
        const maxAttempts = 5;
        
        while (attempts < maxAttempts) {
            code = generateGiftCode();
            codeHash = hashCode(code);
            
            const { data: existing } = await supabase
                .from('gift_codes')
                .select('id')
                .eq('code_hash', codeHash)
                .single();
            
            if (!existing) break;
            attempts++;
        }

        if (attempts >= maxAttempts) {
            console.error(`[${requestId}] Failed to generate unique code`);
            return error('Failed to generate code', 500);
        }

        // Calculate expiration (1 year default)
        const expiresDays = parseInt(invoiceMetadata.expires_days) || 365;
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + expiresDays);

        // Insert gift code
        const { data: giftCode, error: insertError } = await supabase
            .from('gift_codes')
            .insert({
                code_hash: codeHash,
                code_prefix: extractPrefix(code),
                amount_cents: amountCents,
                currency: currency || 'EUR',
                purchaser_email: invoiceMetadata.buyerEmail || metadata.buyerEmail || null,
                purchaser_name: invoiceMetadata.buyerName || metadata.buyerName || null,
                purchase_order_id: `btcpay:${invoiceId}`,
                recipient_email: invoiceMetadata.recipientEmail || null,
                recipient_name: invoiceMetadata.recipientName || null,
                gift_message: invoiceMetadata.giftMessage?.slice(0, 500) || null,
                expires_at: expiresAt.toISOString(),
                status: 'active',
                payment_method: 'btcpay',
                payment_details: {
                    invoiceId,
                    storeId,
                    eventType,
                    processedAt: timestamp,
                },
            })
            .select('id, code_prefix, amount_cents, currency, expires_at, created_at')
            .single();

        if (insertError) {
            console.error(`[${requestId}] Database insert error:`, insertError);
            return error('Failed to create gift code', 500);
        }

        // Update webhook log as processed
        await supabase
            .from('btcpay_webhook_logs')
            .update({ 
                processed: true, 
                gift_code_id: giftCode.id,
                notes: 'success',
            })
            .eq('request_id', requestId);

        // ============================================
        // 8. Send Notification (optional)
        // ============================================
        
        // If buyer email provided, queue email with code
        const buyerEmail = invoiceMetadata.buyerEmail || metadata.buyerEmail;
        if (buyerEmail) {
            await queueGiftCodeEmail(supabase, {
                email: buyerEmail,
                code: code, // Plain code - only time it's available!
                amount: amountCents,
                currency: currency || 'EUR',
                expiresAt: expiresAt.toISOString(),
                recipientName: invoiceMetadata.recipientName,
            });
        }

        // ============================================
        // 9. Success Response
        // ============================================
        
        console.log(`[${requestId}] ✅ Gift code created: ${giftCode.code_prefix}**** - ${amountCents/100} ${currency || 'EUR'} - Invoice: ${invoiceId}`);

        return success({
            message: 'Gift code created successfully',
            requestId,
            invoiceId,
            giftCode: {
                id: giftCode.id,
                prefix: giftCode.code_prefix,
                amount: {
                    cents: giftCode.amount_cents,
                    formatted: `${(giftCode.amount_cents / 100).toFixed(2)} ${giftCode.currency}`,
                },
                expiresAt: giftCode.expires_at,
            },
            action: 'created',
        });

    } catch (err) {
        console.error(`[${requestId}] Unhandled error:`, err);
        return error('Internal server error', 500);
    }
};

// ============================================
// Helper: Fetch Invoice from BTCPay API
// ============================================

async function fetchBTCPayInvoice(invoiceId, storeId) {
    const btcpayUrl = process.env.BTCPAY_URL;
    const btcpayApiKey = process.env.BTCPAY_API_KEY;
    const defaultStoreId = process.env.BTCPAY_STORE_ID;

    if (!btcpayUrl || !btcpayApiKey) {
        console.error('BTCPay API not configured');
        return null;
    }

    const store = storeId || defaultStoreId;
    if (!store) {
        console.error('No store ID available');
        return null;
    }

    try {
        const response = await fetch(
            `${btcpayUrl}/api/v1/stores/${store}/invoices/${invoiceId}`,
            {
                method: 'GET',
                headers: {
                    'Authorization': `token ${btcpayApiKey}`,
                    'Content-Type': 'application/json',
                },
            }
        );

        if (!response.ok) {
            console.error(`BTCPay API error: ${response.status} ${response.statusText}`);
            return null;
        }

        return await response.json();
    } catch (err) {
        console.error('BTCPay API request failed:', err.message);
        return null;
    }
}

// ============================================
// Helper: Queue Gift Code Email
// ============================================

async function queueGiftCodeEmail(supabase, data) {
    try {
        await supabase
            .from('email_queue')
            .insert({
                template: 'gift_code_purchased',
                to_email: data.email,
                payload: {
                    code: data.code,
                    amount: data.amount,
                    currency: data.currency,
                    expires_at: data.expiresAt,
                    recipient_name: data.recipientName,
                },
                status: 'pending',
                created_at: new Date().toISOString(),
            });
        
        console.log(`Email queued for ${data.email}`);
    } catch (err) {
        // Non-fatal - log but don't fail the webhook
        console.warn('Failed to queue email:', err.message);
    }
}
