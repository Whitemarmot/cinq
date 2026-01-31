import { createClient } from '@supabase/supabase-js';
import { checkRateLimit, RATE_LIMITS, getClientIP } from './_rate-limit.js';
import { logError, logInfo, createErrorResponse } from './_error-logger.js';

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
);

// Validation helpers
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_MIN_LENGTH = 8;
const GIFT_CODE_REGEX = /^CINQ-[A-Z0-9]{4}-[A-Z0-9]{4}$/;

function validateEmail(email) {
    if (!email) return { valid: false, error: 'Email requis' };
    const clean = email.toLowerCase().trim();
    if (!EMAIL_REGEX.test(clean)) return { valid: false, error: 'Format email invalide' };
    return { valid: true, email: clean };
}

function validatePassword(password) {
    if (!password) return { valid: false, error: 'Mot de passe requis' };
    if (password.length < PASSWORD_MIN_LENGTH) {
        return { valid: false, error: `Mot de passe trop court (min ${PASSWORD_MIN_LENGTH} caractères)` };
    }
    return { valid: true };
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    if (req.method === 'OPTIONS') return res.status(200).end();

    const action = req.query.action || req.body?.action;

    // Rate limiting - stricter for auth endpoints
    if (['register', 'login'].includes(action)) {
        if (!checkRateLimit(req, res, { ...RATE_LIMITS.AUTH, keyPrefix: `auth:${action}` })) {
            return; // Response already sent by checkRateLimit
        }
    }

    try {
        // ============ REGISTER ============
        if (action === 'register') {
            const { email, password, giftCode } = req.body;
            
            // Validate email
            const emailResult = validateEmail(email);
            if (!emailResult.valid) {
                return res.status(400).json({ 
                    error: emailResult.error,
                    field: 'email'
                });
            }

            // Validate password
            const passwordResult = validatePassword(password);
            if (!passwordResult.valid) {
                return res.status(400).json({ 
                    error: passwordResult.error,
                    field: 'password',
                    hint: 'Utilise au moins 8 caractères avec lettres et chiffres'
                });
            }

            // Validate gift code format
            if (!giftCode) {
                return res.status(400).json({ 
                    error: 'Code cadeau requis',
                    field: 'giftCode',
                    hint: 'Tu as besoin d\'une invitation pour rejoindre Cinq'
                });
            }

            const code = giftCode.toUpperCase().trim();
            if (!GIFT_CODE_REGEX.test(code)) {
                return res.status(400).json({ 
                    error: 'Format de code invalide',
                    field: 'giftCode',
                    hint: 'Le code doit être au format CINQ-XXXX-XXXX'
                });
            }

            // Verify gift code in database
            const { data: gift, error: giftErr } = await supabase
                .from('gift_codes')
                .select('id, status, expires_at')
                .eq('code', code)
                .single();

            if (giftErr || !gift) {
                return res.status(400).json({ 
                    error: 'Code cadeau introuvable',
                    field: 'giftCode',
                    hint: 'Vérifie que tu as bien recopié le code'
                });
            }

            if (gift.status !== 'active') {
                return res.status(400).json({ 
                    error: 'Code déjà utilisé',
                    field: 'giftCode',
                    hint: 'Demande un nouveau code à ton ami'
                });
            }

            if (gift.expires_at && new Date(gift.expires_at) < new Date()) {
                return res.status(400).json({ 
                    error: 'Code expiré',
                    field: 'giftCode',
                    hint: 'Ce code a expiré. Demande un nouveau code à ton ami'
                });
            }

            // Check if email already registered
            const { data: existingUser } = await supabase
                .from('users')
                .select('id')
                .eq('email', emailResult.email)
                .single();

            if (existingUser) {
                return res.status(409).json({ 
                    error: 'Cet email est déjà inscrit',
                    field: 'email',
                    hint: 'Essaie de te connecter ou utilise un autre email'
                });
            }

            // Create user
            const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
                email: emailResult.email,
                password,
                email_confirm: true
            });

            if (authErr) {
                // Parse common Supabase errors
                if (authErr.message.includes('already registered')) {
                    return res.status(409).json({ 
                        error: 'Cet email est déjà inscrit',
                        field: 'email'
                    });
                }
                return res.status(400).json({ 
                    error: 'Erreur lors de la création du compte',
                    details: authErr.message
                });
            }

            // Mark gift code as redeemed
            await supabase
                .from('gift_codes')
                .update({ status: 'redeemed', redeemed_by: authData.user.id, redeemed_at: new Date().toISOString() })
                .eq('id', gift.id);

            // Create user profile
            await supabase.from('users').insert({
                id: authData.user.id,
                email: email.toLowerCase().trim(),
                gift_code_used: code
            });

            // Auto-login: create a session for the new user
            const { data: loginData, error: loginErr } = await supabase.auth.signInWithPassword({
                email: emailResult.email,
                password
            });

            if (loginErr) {
                // User created but login failed - they can login manually
                return res.json({ 
                    success: true, 
                    message: 'Bienvenue sur Cinq ! 🎉',
                    user: { id: authData.user.id, email: authData.user.email },
                    autoLoginFailed: true
                });
            }

            return res.json({ 
                success: true, 
                message: 'Bienvenue sur Cinq ! 🎉',
                user: loginData.user,
                session: loginData.session,
                isNewUser: true
            });
        }

        // ============ LOGIN ============
        if (action === 'login') {
            const { email, password } = req.body;
            
            // Validate email
            const emailResult = validateEmail(email);
            if (!emailResult.valid) {
                return res.status(400).json({ 
                    error: emailResult.error,
                    field: 'email'
                });
            }

            if (!password) {
                return res.status(400).json({ 
                    error: 'Mot de passe requis',
                    field: 'password'
                });
            }

            const { data, error } = await supabase.auth.signInWithPassword({
                email: emailResult.email,
                password
            });

            if (error) {
                // Don't reveal if email exists or not for security
                return res.status(401).json({ 
                    error: 'Email ou mot de passe incorrect',
                    hint: 'Vérifie tes identifiants et réessaie'
                });
            }

            return res.json({
                success: true,
                message: 'Connexion réussie !',
                user: data.user,
                session: data.session
            });
        }

        // ============ ME (get current user) ============
        if (action === 'me') {
            const authHeader = req.headers.authorization;
            if (!authHeader?.startsWith('Bearer ')) {
                return res.status(401).json({ error: 'Non authentifié' });
            }

            const token = authHeader.split(' ')[1];
            const { data: { user }, error } = await supabase.auth.getUser(token);

            if (error || !user) {
                return res.status(401).json({ error: 'Token invalide' });
            }

            // Get profile
            const { data: profile } = await supabase
                .from('users')
                .select('*')
                .eq('id', user.id)
                .single();

            return res.json({ user, profile });
        }

        return res.status(400).json({ 
            error: 'Action invalide',
            hint: 'Actions disponibles: register, login, me',
            received: action
        });

    } catch (e) {
        logError(e, { 
            endpoint: '/api/auth',
            action,
            method: req.method 
        });
        return res.status(500).json(
            createErrorResponse(e, { includeDebug: process.env.NODE_ENV === 'development' })
        );
    }
}
