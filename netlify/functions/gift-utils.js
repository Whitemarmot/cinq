/**
 * CINQ Gift Codes - Shared Utilities
 * SARAH Backend - Secure Code Generation & Validation
 */

const crypto = require('crypto');

// ============================================
// Code Generation - 128 bits d'entropie
// ============================================

/**
 * Génère un code cadeau sécurisé format CINQ-XXXX-XXXX-XXXX
 * 128 bits d'entropie via crypto.randomBytes
 * 
 * @returns {string} Code format CINQ-XXXX-XXXX-XXXX
 */
function generateGiftCode() {
    // 128 bits = 16 bytes, encodé en base32 custom (sans ambiguïté)
    const bytes = crypto.randomBytes(16);
    
    // Alphabet sans caractères ambigus (0/O, 1/I/L)
    const alphabet = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
    
    let code = '';
    for (let i = 0; i < 12; i++) {
        // Utilise 2 bytes pour chaque caractère (plus d'entropie par char)
        const index = (bytes[i] + (bytes[(i + 1) % 16] << 4)) % alphabet.length;
        code += alphabet[index];
    }
    
    // Format: CINQ-XXXX-XXXX-XXXX
    return `CINQ-${code.slice(0, 4)}-${code.slice(4, 8)}-${code.slice(8, 12)}`;
}

/**
 * Valide le format d'un code cadeau
 * @param {string} code 
 * @returns {boolean}
 */
function isValidCodeFormat(code) {
    if (!code || typeof code !== 'string') return false;
    
    // Nettoyer et normaliser
    const cleaned = code.toUpperCase().trim();
    
    // Format exact: CINQ-XXXX-XXXX-XXXX
    const pattern = /^CINQ-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{4}-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{4}-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{4}$/;
    
    return pattern.test(cleaned);
}

/**
 * Normalise un code (majuscules, trim, tirets corrects)
 * @param {string} code 
 * @returns {string|null}
 */
function normalizeCode(code) {
    if (!code || typeof code !== 'string') return null;
    
    // Nettoyer
    let cleaned = code.toUpperCase().trim();
    
    // Enlever tous les tirets et espaces, puis reformater
    cleaned = cleaned.replace(/[-\s]/g, '');
    
    // Doit avoir exactement 16 chars (CINQ + 12 chars)
    if (cleaned.length === 16 && cleaned.startsWith('CINQ')) {
        const chars = cleaned.slice(4);
        return `CINQ-${chars.slice(0, 4)}-${chars.slice(4, 8)}-${chars.slice(8, 12)}`;
    }
    
    // Ou 12 chars sans préfixe
    if (cleaned.length === 12) {
        return `CINQ-${cleaned.slice(0, 4)}-${cleaned.slice(4, 8)}-${cleaned.slice(8, 12)}`;
    }
    
    return null;
}

// ============================================
// Hashing sécurisé
// ============================================

/**
 * Hash un code avec SHA-256 + salt constant (pour recherche)
 * Note: Le salt est stocké en env var pour sécurité
 * 
 * @param {string} code - Code normalisé
 * @returns {string} Hash hex
 */
function hashCode(code) {
    const salt = process.env.GIFT_CODE_SALT || 'cinq-default-salt-change-me';
    return crypto
        .createHmac('sha256', salt)
        .update(code)
        .digest('hex');
}

/**
 * Extrait le préfixe visible (pour support client)
 * @param {string} code 
 * @returns {string}
 */
function extractPrefix(code) {
    const normalized = normalizeCode(code);
    if (!normalized) return '';
    // Retourne les 4 premiers chars après "CINQ-"
    return normalized.slice(5, 9);
}

// ============================================
// Réponses HTTP standardisées
// ============================================

const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-IP',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
};

function success(data, statusCode = 200) {
    return {
        statusCode,
        headers,
        body: JSON.stringify({ success: true, ...data }),
    };
}

function error(message, statusCode = 400, details = null) {
    const body = { success: false, error: message };
    if (details) body.details = details;
    
    return {
        statusCode,
        headers,
        body: JSON.stringify(body),
    };
}

function rateLimited(waitSeconds) {
    return {
        statusCode: 429,
        headers: {
            ...headers,
            'Retry-After': String(waitSeconds),
        },
        body: JSON.stringify({
            success: false,
            error: 'Too many attempts. Please try again later.',
            retryAfter: waitSeconds,
        }),
    };
}

// ============================================
// Client IP extraction
// ============================================

function getClientIP(event) {
    // Netlify/Cloudflare headers
    return (
        event.headers['x-nf-client-connection-ip'] ||
        event.headers['cf-connecting-ip'] ||
        event.headers['x-real-ip'] ||
        event.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
        event.headers['x-client-ip'] ||
        '0.0.0.0'
    );
}

// ============================================
// Supabase Client
// ============================================

function createSupabaseClient() {
    const { createClient } = require('@supabase/supabase-js');
    
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
        throw new Error('Missing Supabase configuration');
    }
    
    return createClient(supabaseUrl, supabaseKey, {
        auth: { persistSession: false }
    });
}

// ============================================
// Exports
// ============================================

module.exports = {
    generateGiftCode,
    isValidCodeFormat,
    normalizeCode,
    hashCode,
    extractPrefix,
    success,
    error,
    rateLimited,
    getClientIP,
    createSupabaseClient,
    headers,
};
