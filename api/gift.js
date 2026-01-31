/**
 * Gift Codes API - Create and verify invitation codes
 * 
 * Endpoints:
 * - POST ?action=create - Generate new gift code
 * - GET ?action=verify&code=xxx - Check if code is valid
 * - GET ?action=list - List user's gift codes
 */

import crypto from 'crypto';
import { supabase, getUser, handleCors } from './_supabase.js';
import { checkRateLimit, RATE_LIMITS } from './_rate-limit.js';
import { logError, createErrorResponse } from './_error-logger.js';

const MAX_ACTIVE_CODES_PER_USER = 5;
const CODE_VALIDITY_DAYS = 30;
const GIFT_CODE_REGEX = /^CINQ-[A-Z0-9]{4}-[A-Z0-9]{4}$/;

// Exclude ambiguous characters: I, O, 0, 1
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export default async function handler(req, res) {
    if (handleCors(req, res, ['GET', 'POST', 'OPTIONS'])) return;

    const action = req.query.action || req.body?.action;

    try {
        if (action === 'create') {
            return handleCreateGift(req, res);
        }

        if (action === 'verify') {
            return handleVerifyGift(req, res);
        }

        if (action === 'list') {
            return handleListGifts(req, res);
        }

        return res.status(400).json({ error: 'Action invalide. Use: create, verify, list' });

    } catch (e) {
        logError(e, { 
            endpoint: '/api/gift',
            action,
            method: req.method 
        });
        return res.status(500).json(
            createErrorResponse(e, { 
                includeDebug: process.env.NODE_ENV === 'development',
                hint: 'Réessaie dans quelques instants'
            })
        );
    }
}

// ===== HELPERS =====

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
    date.setDate(date.getDate() + CODE_VALIDITY_DAYS);
    return date.toISOString();
}

// ===== CREATE =====

async function handleCreateGift(req, res) {
    // Strict rate limiting (IP-based)
    if (!checkRateLimit(req, res, { ...RATE_LIMITS.GIFT_CREATE, keyPrefix: 'gift:create' })) {
        return;
    }

    // Auth is optional - track creator if logged in
    const user = await getUser(req);

    // If logged in, check limit per user
    if (user) {
        const { count } = await supabase
            .from('gift_codes')
            .select('*', { count: 'exact', head: true })
            .eq('created_by', user.id)
            .eq('status', 'active');

        if (count >= MAX_ACTIVE_CODES_PER_USER) {
            return res.status(400).json({ 
                error: `Tu as déjà ${MAX_ACTIVE_CODES_PER_USER} invitations actives` 
            });
        }
    }

    const code = generateCode();
    const expiresAt = getExpirationDate();

    const { data, error } = await supabase
        .from('gift_codes')
        .insert({
            code,
            created_by: user?.id || null,
            status: 'active',
            expires_at: expiresAt
        })
        .select()
        .single();

    if (error) throw error;

    return res.json({
        success: true,
        code: data.code,
        gift: {
            code: data.code,
            expiresAt: data.expires_at,
            shareUrl: `https://cinq-three.vercel.app/register.html?code=${data.code}`
        }
    });
}

// ===== VERIFY =====

async function handleVerifyGift(req, res) {
    if (!checkRateLimit(req, res, { ...RATE_LIMITS.READ, keyPrefix: 'gift:verify' })) {
        return;
    }

    const code = (req.query.code || req.body?.code || '').toUpperCase().trim();
    
    if (!code) {
        return res.status(400).json({ error: 'Code requis' });
    }

    // Validate format before DB query
    if (!GIFT_CODE_REGEX.test(code)) {
        return res.json({ valid: false, reason: 'Format invalide' });
    }

    const { data, error } = await supabase
        .from('gift_codes')
        .select('id, status, expires_at, created_by')
        .eq('code', code)
        .single();

    if (error || !data) {
        return res.json({ valid: false, reason: 'Code introuvable' });
    }

    if (data.status !== 'active') {
        return res.json({ valid: false, reason: 'Code déjà utilisé' });
    }

    if (new Date(data.expires_at) < new Date()) {
        return res.json({ valid: false, reason: 'Code expiré' });
    }

    // Get gifter name for nice UX
    let gifterName = 'Un ami';
    if (data.created_by) {
        const { data: gifter } = await supabase
            .from('users')
            .select('display_name, email')
            .eq('id', data.created_by)
            .single();
        
        gifterName = gifter?.display_name || gifter?.email?.split('@')[0] || 'Un ami';
    }

    return res.json({ valid: true, gifter: gifterName });
}

// ===== LIST =====

async function handleListGifts(req, res) {
    const user = await getUser(req);
    if (!user) {
        return res.status(401).json({ error: 'Non authentifié' });
    }

    if (!checkRateLimit(req, res, { ...RATE_LIMITS.READ, keyPrefix: 'gift:list', userId: user.id })) {
        return;
    }

    const { data, error } = await supabase
        .from('gift_codes')
        .select('code, status, created_at, expires_at, redeemed_by')
        .eq('created_by', user.id)
        .order('created_at', { ascending: false });

    if (error) throw error;

    return res.json({ gifts: data || [] });
}
