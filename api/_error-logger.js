/**
 * Structured Error Logger for Cinq API
 * 
 * Provides consistent, structured error logging and user-friendly error responses.
 */

/**
 * Log a structured error to console
 * @param {Error} error - The error object
 * @param {Object} context - Additional context (endpoint, userId, etc.)
 */
export function logError(error, context = {}) {
    const timestamp = new Date().toISOString();
    const errorInfo = {
        timestamp,
        level: 'error',
        message: error.message,
        name: error.name,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
        code: error.code,
        ...context
    };

    // Structured JSON log for production (easier to parse)
    console.error(JSON.stringify(errorInfo));
}

/**
 * Log a warning
 * @param {string} message - Warning message
 * @param {Object} context - Additional context
 */
export function logWarn(message, context = {}) {
    const timestamp = new Date().toISOString();
    console.warn(JSON.stringify({
        timestamp,
        level: 'warn',
        message,
        ...context
    }));
}

/**
 * Log an info message
 * @param {string} message - Info message  
 * @param {Object} context - Additional context
 */
export function logInfo(message, context = {}) {
    const timestamp = new Date().toISOString();
    console.log(JSON.stringify({
        timestamp,
        level: 'info',
        message,
        ...context
    }));
}

/**
 * User-friendly error messages mapping
 */
const USER_FRIENDLY_ERRORS = {
    // Database errors
    '23505': 'Cette ressource existe déjà',
    '23503': 'Référence invalide',
    '42501': 'Permission refusée',
    'PGRST116': 'Ressource non trouvée',
    
    // Supabase auth errors
    'invalid_credentials': 'Email ou mot de passe incorrect',
    'email_not_confirmed': 'Vérifie ton email pour confirmer ton compte',
    'user_already_exists': 'Cet email est déjà inscrit',
    'weak_password': 'Mot de passe trop faible',
    
    // Network/timeout
    'ECONNREFUSED': 'Service temporairement indisponible',
    'ETIMEDOUT': 'La requête a pris trop de temps',
    'ENOTFOUND': 'Service inaccessible',
    
    // Rate limiting
    'rate_limit': 'Trop de requêtes. Réessaie dans quelques instants.',
};

/**
 * Get user-friendly error message
 * @param {Error} error - The error object
 * @returns {string} User-friendly message
 */
export function getUserFriendlyMessage(error) {
    // Check error code
    if (error.code && USER_FRIENDLY_ERRORS[error.code]) {
        return USER_FRIENDLY_ERRORS[error.code];
    }
    
    // Check error message for known patterns
    const msg = error.message?.toLowerCase() || '';
    
    if (msg.includes('network') || msg.includes('fetch')) {
        return 'Problème de connexion. Vérifie ta connexion internet.';
    }
    if (msg.includes('timeout')) {
        return 'La requête a pris trop de temps. Réessaie.';
    }
    if (msg.includes('duplicate') || msg.includes('already exists')) {
        return 'Cette ressource existe déjà';
    }
    if (msg.includes('not found')) {
        return 'Ressource non trouvée';
    }
    if (msg.includes('unauthorized') || msg.includes('jwt')) {
        return 'Session expirée. Reconnecte-toi.';
    }
    
    // Default
    return 'Une erreur est survenue. Réessaie dans quelques instants.';
}

/**
 * Create a standardized error response
 * @param {Error} error - The error object
 * @param {Object} options - Options for the response
 * @returns {Object} Standardized error response object
 */
export function createErrorResponse(error, options = {}) {
    const { includeDebug = false, hint } = options;
    
    const response = {
        error: getUserFriendlyMessage(error),
        code: error.code || 'INTERNAL_ERROR'
    };
    
    if (hint) {
        response.hint = hint;
    }
    
    // Include debug info only in development
    if (includeDebug && process.env.NODE_ENV === 'development') {
        response.debug = {
            message: error.message,
            stack: error.stack
        };
    }
    
    return response;
}

/**
 * Wrapper for API handlers with automatic error handling
 * @param {Function} handler - The API handler function
 * @param {string} endpoint - Endpoint name for logging
 * @returns {Function} Wrapped handler
 */
export function withErrorHandling(handler, endpoint) {
    return async (req, res) => {
        const startTime = Date.now();
        
        try {
            await handler(req, res);
            
            // Log successful request (only in development or for slow requests)
            const duration = Date.now() - startTime;
            if (process.env.NODE_ENV === 'development' || duration > 1000) {
                logInfo('Request completed', {
                    endpoint,
                    method: req.method,
                    duration: `${duration}ms`
                });
            }
        } catch (error) {
            const duration = Date.now() - startTime;
            
            // Log the error with full context
            logError(error, {
                endpoint,
                method: req.method,
                query: req.query,
                duration: `${duration}ms`,
                userAgent: req.headers['user-agent'],
                ip: req.headers['x-forwarded-for'] || req.socket?.remoteAddress
            });
            
            // Don't send response if already sent
            if (res.headersSent) {
                return;
            }
            
            // Determine status code
            let status = 500;
            if (error.code === '23505') status = 409; // Conflict
            if (error.code === 'PGRST116') status = 404; // Not found
            if (error.message?.includes('unauthorized')) status = 401;
            if (error.message?.includes('forbidden')) status = 403;
            
            // Send user-friendly error response
            return res.status(status).json(
                createErrorResponse(error, { 
                    includeDebug: process.env.NODE_ENV === 'development'
                })
            );
        }
    };
}

export default {
    logError,
    logWarn,
    logInfo,
    getUserFriendlyMessage,
    createErrorResponse,
    withErrorHandling
};
