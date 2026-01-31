/**
 * CINQ Gift Code - VERIFY Endpoint
 * GET /api/gift/verify/:code
 * 
 * Vérifie la validité d'un code sans le consommer.
 * Utilisé pour afficher le montant avant checkout.
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

    // GET only
    if (event.httpMethod !== 'GET') {
        return error('Method not allowed', 405);
    }

    const clientIP = getClientIP(event);
    let supabase;

    try {
        supabase = createSupabaseClient();

        // ============================================
        // Rate Limiting Check (moins strict que redeem)
        // ============================================
        
        const { data: rateCheck } = await supabase
            .rpc('check_gift_code_rate_limit', { client_ip: clientIP });

        if (rateCheck && rateCheck.length > 0 && !rateCheck[0].allowed) {
            return rateLimited(rateCheck[0].wait_seconds);
        }

        // ============================================
        // Extract Code from Path
        // ============================================
        
        // Path: /.netlify/functions/gift-verify/CINQ-XXXX-XXXX-XXXX
        // ou via redirect: /api/gift/verify/CINQ-XXXX-XXXX-XXXX
        const pathParts = event.path.split('/');
        const rawCode = pathParts[pathParts.length - 1];

        // Aussi accepter en query param
        const queryCode = event.queryStringParameters?.code;
        
        const codeToVerify = rawCode && rawCode !== 'gift-verify' ? rawCode : queryCode;

        if (!codeToVerify) {
            return error('Code parameter is required', 400);
        }

        // Décoder URL encoding
        const decodedCode = decodeURIComponent(codeToVerify);
        const code = normalizeCode(decodedCode);

        if (!code || !isValidCodeFormat(code)) {
            await logVerifyAttempt(supabase, clientIP, false, 'invalid_format');
            return error('Invalid gift code format', 400, {
                expected_format: 'CINQ-XXXX-XXXX-XXXX',
            });
        }

        // ============================================
        // Find Gift Code
        // ============================================
        
        const codeHash = hashCode(code);

        const { data: giftCode, error: findError } = await supabase
            .from('gift_codes')
            .select('id, amount_cents, currency, status, expires_at, created_at, code_prefix')
            .eq('code_hash', codeHash)
            .single();

        if (findError || !giftCode) {
            await logVerifyAttempt(supabase, clientIP, false, 'not_found');
            return error('Gift code not found', 404);
        }

        // ============================================
        // Build Response Based on Status
        // ============================================
        
        const now = new Date();
        const expiresAt = new Date(giftCode.expires_at);
        const isExpired = expiresAt < now;

        // Mettre à jour le statut si expiré
        if (giftCode.status === 'active' && isExpired) {
            await supabase
                .from('gift_codes')
                .update({ status: 'expired' })
                .eq('id', giftCode.id);
            giftCode.status = 'expired';
        }

        const response = {
            valid: giftCode.status === 'active',
            code_prefix: giftCode.code_prefix,
            status: giftCode.status,
            amount: {
                cents: giftCode.amount_cents,
                formatted: `${(giftCode.amount_cents / 100).toFixed(2)} ${giftCode.currency}`,
            },
            currency: giftCode.currency,
            expires_at: giftCode.expires_at,
        };

        // Ajouter des détails selon le statut
        switch (giftCode.status) {
            case 'active':
                response.message = 'Gift code is valid and ready to use';
                response.days_until_expiry = Math.ceil((expiresAt - now) / (1000 * 60 * 60 * 24));
                break;
            
            case 'redeemed':
                response.message = 'This gift code has already been used';
                break;
            
            case 'expired':
                response.message = 'This gift code has expired';
                break;
            
            case 'revoked':
                response.message = 'This gift code is no longer valid';
                break;
        }

        await logVerifyAttempt(supabase, clientIP, true, null);

        // Reset rate limit on success
        if (giftCode.status === 'active') {
            await supabase.rpc('reset_gift_code_rate_limit', { client_ip: clientIP });
        }

        return success(response);

    } catch (err) {
        console.error('Gift verify error:', err);
        return error('Internal server error', 500);
    }
};

// ============================================
// Helper: Log Verify Attempt
// ============================================

async function logVerifyAttempt(supabase, ip, success, failureReason) {
    try {
        // Pour verify, on ne log que les échecs (moins invasif)
        if (!success) {
            await supabase
                .from('gift_code_attempts')
                .insert({
                    ip_address: ip,
                    attempted_code_hash: 'verify_attempt',
                    success: false,
                    failure_reason: failureReason,
                });
        }
    } catch (err) {
        console.error('Failed to log verify attempt:', err);
    }
}
