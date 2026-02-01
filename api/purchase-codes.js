/**
 * Purchase Codes Retrieval API
 * 
 * Retrieve gift codes for a completed Stripe session
 */

import { supabase, handleCors } from './_supabase.js';
import { checkRateLimit, RATE_LIMITS } from './_rate-limit.js';
import { logError, logInfo, createErrorResponse } from './_error-logger.js';

export default async function handler(req, res) {
    if (handleCors(req, res, ['POST', 'OPTIONS'])) return;

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Rate limiting
    if (!checkRateLimit(req, res, { 
        ...RATE_LIMITS.READ, 
        keyPrefix: 'purchase:codes',
        windowMs: 60 * 1000, // Plus restrictif: 1 minute
        max: 10
    })) {
        return;
    }

    try {
        const { session_id } = req.body;

        if (!session_id) {
            return res.status(400).json({ 
                error: 'Session ID requis' 
            });
        }

        // Récupérer les informations de la purchase
        const { data: purchase, error: purchaseError } = await supabase
            .from('purchases')
            .select('id, codes, status, created_at, codes_count')
            .eq('stripe_session_id', session_id)
            .eq('status', 'completed')
            .single();

        if (purchaseError || !purchase) {
            logError(new Error('Purchase not found'), { 
                sessionId: session_id,
                error: purchaseError 
            });
            
            return res.status(404).json({ 
                error: 'Achat non trouvé ou en cours de traitement',
                hint: 'Attends quelques secondes et rafraîchis la page'
            });
        }

        // Vérifier que l'achat n'est pas trop ancien (sécurité)
        const purchaseDate = new Date(purchase.created_at);
        const now = new Date();
        const hoursDiff = (now - purchaseDate) / (1000 * 60 * 60);

        if (hoursDiff > 24) { // 24h de grace period
            return res.status(410).json({ 
                error: 'Cette session a expiré',
                hint: 'Contacte le support si tu as besoin d\'aide'
            });
        }

        // Récupérer les codes cadeau liés
        const { data: giftCodes, error: codesError } = await supabase
            .from('gift_codes')
            .select('code, status, expires_at')
            .eq('purchase_session_id', session_id)
            .eq('status', 'active')
            .order('created_at', { ascending: true });

        if (codesError) {
            throw codesError;
        }

        // Vérifier la cohérence
        if (!giftCodes || giftCodes.length === 0) {
            logError(new Error('No gift codes found for purchase'), { 
                purchaseId: purchase.id,
                sessionId: session_id
            });

            return res.status(500).json({
                error: 'Codes non trouvés',
                hint: 'Contacte le support'
            });
        }

        const codes = giftCodes.map(gc => gc.code);

        logInfo('Codes retrieved successfully', {
            sessionId: session_id,
            purchaseId: purchase.id,
            codesCount: codes.length
        });

        return res.json({
            success: true,
            codes,
            purchase: {
                id: purchase.id,
                codes_count: codes.length,
                purchased_at: purchase.created_at,
                expires_at: giftCodes[0]?.expires_at
            }
        });

    } catch (error) {
        logError(error, { 
            endpoint: '/api/purchase-codes',
            sessionId: req.body?.session_id
        });

        return res.status(500).json(
            createErrorResponse(error, { 
                includeDebug: process.env.NODE_ENV === 'development',
                hint: 'Réessaie dans quelques instants'
            })
        );
    }
}