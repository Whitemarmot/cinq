// Input validation helpers

export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const GIFT_CODE_REGEX = /^CINQ-[A-Z0-9]{4}-[A-Z0-9]{4}$/;

/**
 * Validate UUID format
 */
export function isValidUUID(str) {
    return typeof str === 'string' && UUID_REGEX.test(str);
}

/**
 * Validate email format
 */
export function isValidEmail(str) {
    return typeof str === 'string' && EMAIL_REGEX.test(str.trim());
}

/**
 * Sanitize text input - remove dangerous characters, limit length
 * @param {string} str - Input string
 * @param {object} options - { maxLength, allowNewlines }
 */
export function sanitizeText(str, options = {}) {
    const { maxLength = 1000, allowNewlines = false } = options;
    
    if (typeof str !== 'string') return '';
    
    let clean = str
        // Remove null bytes
        .replace(/\0/g, '')
        // Remove control characters except newlines/tabs
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
        // Trim whitespace
        .trim();
    
    if (!allowNewlines) {
        clean = clean.replace(/[\r\n]+/g, ' ');
    }
    
    // Limit length
    if (clean.length > maxLength) {
        clean = clean.substring(0, maxLength);
    }
    
    return clean;
}

/**
 * Validate and sanitize message content
 */
export function validateMessageContent(content, options = {}) {
    const { maxLength = 2000, required = true } = options;
    
    if (!content && required) {
        return { valid: false, error: 'Contenu requis' };
    }
    
    if (!content) {
        return { valid: true, content: null };
    }
    
    const sanitized = sanitizeText(content, { maxLength, allowNewlines: true });
    
    if (sanitized.length === 0 && required) {
        return { valid: false, error: 'Contenu vide après nettoyage' };
    }
    
    return { valid: true, content: sanitized };
}

/**
 * Validate display name
 */
export function validateDisplayName(name) {
    if (!name) return { valid: true, name: null };
    
    const sanitized = sanitizeText(name, { maxLength: 50, allowNewlines: false });
    
    if (sanitized.length < 2) {
        return { valid: false, error: 'Nom trop court (min 2 caractères)' };
    }
    
    return { valid: true, name: sanitized };
}

/**
 * Validate bio
 */
export function validateBio(bio) {
    if (!bio) return { valid: true, bio: null };
    
    const sanitized = sanitizeText(bio, { maxLength: 500, allowNewlines: true });
    return { valid: true, bio: sanitized };
}

/**
 * Validate URL (for avatar, etc.)
 */
export function validateURL(url) {
    if (!url) return { valid: true, url: null };
    
    try {
        const parsed = new URL(url);
        // Only allow https
        if (parsed.protocol !== 'https:') {
            return { valid: false, error: 'URL doit être HTTPS' };
        }
        // Max length
        if (url.length > 500) {
            return { valid: false, error: 'URL trop longue' };
        }
        return { valid: true, url: url };
    } catch {
        return { valid: false, error: 'Format URL invalide' };
    }
}

/**
 * Validate location string
 */
export function validateLocation(location) {
    if (!location) return { valid: true, location: null };
    
    const sanitized = sanitizeText(location, { maxLength: 200, allowNewlines: false });
    return { valid: true, location: sanitized };
}
