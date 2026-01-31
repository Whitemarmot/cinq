// CORS helper - restrict to allowed origins
// SECURITY: Do NOT use '*' for Access-Control-Allow-Origin

const ALLOWED_ORIGINS = [
    'https://cinq-three.vercel.app',
    'https://cinq.app',
    'https://www.cinq.app',
];

// Allow localhost in development
if (process.env.NODE_ENV === 'development' || process.env.VERCEL_ENV === 'preview') {
    ALLOWED_ORIGINS.push(
        'http://localhost:3000',
        'http://localhost:5173',
        'http://localhost:8080',
        'http://127.0.0.1:3000',
        'http://127.0.0.1:5173',
        'http://127.0.0.1:8080'
    );
}

/**
 * Set CORS headers with origin validation
 * @param {Request} req - The request object
 * @param {Response} res - The response object
 * @returns {boolean} true if origin is allowed, false if blocked
 */
export function setCorsHeaders(req, res) {
    const origin = req.headers.origin;
    
    // For same-origin requests (no Origin header), allow
    if (!origin) {
        res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGINS[0]);
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        res.setHeader('Access-Control-Max-Age', '86400');
        return true;
    }
    
    // Check if origin is in allowed list
    if (ALLOWED_ORIGINS.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Access-Control-Max-Age', '86400');
        return true;
    }
    
    // Origin not allowed
    console.warn(`[CORS] Blocked request from origin: ${origin}`);
    return false;
}

/**
 * Handle preflight OPTIONS request
 * @param {Request} req
 * @param {Response} res
 * @returns {boolean} true if this was an OPTIONS request (handled)
 */
export function handlePreflight(req, res) {
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return true;
    }
    return false;
}

/**
 * Combined CORS middleware
 * Sets headers and handles OPTIONS
 * @returns {boolean} true if request should continue, false if blocked/handled
 */
export function cors(req, res) {
    const allowed = setCorsHeaders(req, res);
    
    if (!allowed) {
        res.status(403).json({ error: 'Origin not allowed' });
        return false;
    }
    
    if (handlePreflight(req, res)) {
        return false; // Handled, don't continue
    }
    
    return true; // Continue processing
}

export default cors;
