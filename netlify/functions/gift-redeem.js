/**
 * CINQ Gift Code - REDEEM Endpoint
 * POST /api/gift/redeem
 * 
 * Active un code cadeau lors d'une commande.
 * Protection anti-bruteforce incluse.
 */

const {
    normalizeCode,
    isValidCodeFormat,
    hashCode,
    extractPrefix,
    success,
    error,
    rateLimited,
    getClientIP,
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

    const clientIP = getClientIP(event);
    let supabase;

    try {
        supabase = createSupabaseClient();

        // ============================================
        // Rate Limiting Check
        // ============================================
        
        const { data: rateCheck, error: rateError } = await supabase
            .rpc('check_gift_code_rate_limit', { client_ip: clientIP });

        if (rateError) {
            console.error('Rate limit check error:', rateError);
            // Continue anyway - fail open for availability
        } else if (rateCheck && rateCheck.length > 0 && !rateCheck[0].allowed) {
            console.warn(`Rate limited: ${clientIP}`);
            return rateLimited(rateCheck[0].wait_seconds);
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
            code: rawCode,
            order_id,
            user_id,
        } = body;

        // Normaliser le code
        const code = normalizeCode(rawCode);
        
        if (!code || !isValidCodeFormat(code)) {
            // Log la tentative
            await logAttempt(supabase, clientIP, rawCode, false, 'invalid_format');
            return error('Invalid gift code format', 400);
        }

        if (!order_id) {
            return error('order_id is required', 400);
        }

        // ============================================
        // Find & Validate Gift Code
        // ============================================
        
        const codeHash = hashCode(code);

        const { data: giftCode, error: findError } = await supabase
            .from('gift_codes')
            .select('*')
            .eq('code_hash', codeHash)
            .single();

        if (findError || !giftCode) {
            await logAttempt(supabase, clientIP, codeHash, false, 'not_found');
            return error('Gift code not found', 404);
        }

        // Vérifier le statut
        if (giftCode.status === 'redeemed') {
            await logAttempt(supabase, clientIP, codeHash, false, 'already_redeemed');
            return error('This gift code has already been used', 400, {
                redeemed_at: giftCode.redeemed_at,
            });
        }

        if (giftCode.status === 'expired') {
            await logAttempt(supabase, clientIP, codeHash, false, 'expired');
            return error('This gift code has expired', 400, {
                expired_at: giftCode.expires_at,
            });
        }

        if (giftCode.status === 'revoked') {
            await logAttempt(supabase, clientIP, codeHash, false, 'revoked');
            return error('This gift code has been revoked', 400);
        }

        // Vérifier expiration
        if (new Date(giftCode.expires_at) < new Date()) {
            // Marquer comme expiré
            await supabase
                .from('gift_codes')
                .update({ status: 'expired' })
                .eq('id', giftCode.id);
            
            await logAttempt(supabase, clientIP, codeHash, false, 'expired');
            return error('This gift code has expired', 400, {
                expired_at: giftCode.expires_at,
            });
        }

        // ============================================
        // Redeem the Code (Atomic Update)
        // ============================================
        
        const { data: updated, error: updateError } = await supabase
            .from('gift_codes')
            .update({
                status: 'redeemed',
                redeemed_at: new Date().toISOString(),
                redeemed_by: user_id || null,
                redeemed_order_id: order_id,
            })
            .eq('id', giftCode.id)
            .eq('status', 'active') // Condition atomique
            .select()
            .single();

        if (updateError || !updated) {
            // Race condition - code utilisé entre-temps
            console.error('Redemption race condition:', giftCode.id);
            await logAttempt(supabase, clientIP, codeHash, false, 'race_condition');
            return error('This gift code was just used. Please try another.', 409);
        }

        // ============================================
        // Success - Reset Rate Limit
        // ============================================
        
        await supabase.rpc('reset_gift_code_rate_limit', { client_ip: clientIP });
        await logAttempt(supabase, clientIP, codeHash, true, null);

        console.log(`Gift code redeemed: ${extractPrefix(code)}**** - ${updated.amount_cents} ${updated.currency} - Order: ${order_id}`);

        return success({
            redemption: {
                id: updated.id,
                amount: {
                    cents: updated.amount_cents,
                    formatted: `${(updated.amount_cents / 100).toFixed(2)} ${updated.currency}`,
                },
                currency: updated.currency,
                redeemed_at: updated.redeemed_at,
                order_id: order_id,
            },
            discount: {
                type: 'fixed_amount',
                amount_cents: updated.amount_cents,
                currency: updated.currency,
            },
            message: 'Gift code successfully redeemed!',
        });

    } catch (err) {
        console.error('Gift redeem error:', err);
        return error('Internal server error', 500);
    }
};

// ============================================
// Helper: Log Attempt
// ============================================

async function logAttempt(supabase, ip, codeHash, success, failureReason) {
    try {
        await supabase
            .from('gift_code_attempts')
            .insert({
                ip_address: ip,
                attempted_code_hash: typeof codeHash === 'string' ? codeHash.slice(0, 64) : 'invalid',
                success,
                failure_reason: failureReason,
            });
    } catch (err) {
        console.error('Failed to log attempt:', err);
    }
}
