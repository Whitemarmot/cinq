/**
 * Authentication API - Login, Register, Session management
 * 
 * Endpoints:
 * - POST ?action=register - Create new account (requires gift code)
 * - POST ?action=login - Login with email/password
 * - GET ?action=me - Get current user info
 */

import { supabase, getUser, handleCors } from './_supabase.js';
import { checkRateLimit, RATE_LIMITS } from './_rate-limit.js';
import { logError, logInfo, createErrorResponse } from './_error-logger.js';
import { logActivity } from './activity-log.js';

// Validation patterns
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_MIN_LENGTH = 8;
const GIFT_CODE_REGEX = /^CINQ-[A-Z0-9]{4}-[A-Z0-9]{4}$/;

export default async function handler(req, res) {
    if (handleCors(req, res, ['GET', 'POST', 'OPTIONS'])) return;

    const action = req.query.action || req.body?.action;

    // Stricter rate limiting for auth endpoints
    if (['register', 'login'].includes(action)) {
        if (!checkRateLimit(req, res, { ...RATE_LIMITS.AUTH, keyPrefix: `auth:${action}` })) {
            return;
        }
    }

    try {
        if (action === 'register') {
            return handleRegister(req, res);
        }

        if (action === 'login') {
            return handleLogin(req, res);
        }

        if (action === 'me') {
            return handleMe(req, res);
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

// ===== VALIDATION HELPERS =====

function validateEmail(email) {
    if (!email) return { valid: false, error: 'Email requis' };
    const clean = email.toLowerCase().trim();
    if (!EMAIL_REGEX.test(clean)) return { valid: false, error: 'Format email invalide' };
    return { valid: true, email: clean };
}

function validatePassword(password) {
    if (!password) return { valid: false, error: 'Mot de passe requis' };
    if (typeof password !== 'string') {
        return { valid: false, error: 'Format mot de passe invalide' };
    }
    if (password.length < PASSWORD_MIN_LENGTH) {
        return { valid: false, error: `Mot de passe trop court (min ${PASSWORD_MIN_LENGTH} caractères)` };
    }
    if (password.length > 128) {
        return { valid: false, error: 'Mot de passe trop long (max 128 caractères)' };
    }
    // Check for at least one letter and one number
    if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
        return { valid: false, error: 'Le mot de passe doit contenir au moins une lettre et un chiffre' };
    }
    return { valid: true };
}

function validateGiftCode(giftCode) {
    if (!giftCode) {
        return { valid: false, error: 'Code cadeau requis', hint: 'Tu as besoin d\'une invitation pour rejoindre Cinq' };
    }
    const code = giftCode.toUpperCase().trim();
    if (!GIFT_CODE_REGEX.test(code)) {
        return { valid: false, error: 'Format de code invalide', hint: 'Le code doit être au format CINQ-XXXX-XXXX' };
    }
    return { valid: true, code };
}

// ===== REGISTER =====

async function handleRegister(req, res) {
    const { email, password, giftCode } = req.body;
    
    // Validate inputs
    const emailResult = validateEmail(email);
    if (!emailResult.valid) {
        return res.status(400).json({ error: emailResult.error, field: 'email' });
    }

    const passwordResult = validatePassword(password);
    if (!passwordResult.valid) {
        return res.status(400).json({ 
            error: passwordResult.error,
            field: 'password',
            hint: 'Utilise au moins 8 caractères avec lettres et chiffres'
        });
    }

    const giftResult = validateGiftCode(giftCode);
    if (!giftResult.valid) {
        return res.status(400).json({ 
            error: giftResult.error, 
            field: 'giftCode', 
            hint: giftResult.hint 
        });
    }

    // Verify gift code
    const giftValidation = await verifyGiftCode(giftResult.code);
    if (!giftValidation.valid) {
        return res.status(400).json({ 
            error: giftValidation.error, 
            field: 'giftCode', 
            hint: giftValidation.hint 
        });
    }

    // Check if email already exists
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
        if (authErr.message.includes('already registered')) {
            return res.status(409).json({ error: 'Cet email est déjà inscrit', field: 'email' });
        }
        return res.status(400).json({ error: 'Erreur lors de la création du compte', details: authErr.message });
    }

    // Mark gift code as redeemed
    await supabase
        .from('gift_codes')
        .update({ 
            status: 'redeemed', 
            redeemed_by: authData.user.id, 
            redeemed_at: new Date().toISOString() 
        })
        .eq('id', giftValidation.giftId);

    // Create user profile
    await supabase.from('users').insert({
        id: authData.user.id,
        email: emailResult.email,
        gift_code_used: giftResult.code
    });

    // Auto-login
    const { data: loginData, error: loginErr } = await supabase.auth.signInWithPassword({
        email: emailResult.email,
        password
    });

    logInfo('User registered successfully', { 
        userId: authData.user.id, 
        giftCode: giftResult.code 
    });

    if (loginErr) {
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

async function verifyGiftCode(code) {
    const { data: gift, error } = await supabase
        .from('gift_codes')
        .select('id, status, expires_at')
        .eq('code', code)
        .single();

    if (error || !gift) {
        return { valid: false, error: 'Code cadeau introuvable', hint: 'Vérifie que tu as bien recopié le code' };
    }

    if (gift.status !== 'active') {
        return { valid: false, error: 'Code déjà utilisé', hint: 'Demande un nouveau code à ton ami' };
    }

    if (gift.expires_at && new Date(gift.expires_at) < new Date()) {
        return { valid: false, error: 'Code expiré', hint: 'Ce code a expiré. Demande un nouveau code à ton ami' };
    }

    return { valid: true, giftId: gift.id };
}

// ===== LOGIN =====

async function handleLogin(req, res) {
    const { email, password } = req.body;
    
    const emailResult = validateEmail(email);
    if (!emailResult.valid) {
        return res.status(400).json({ error: emailResult.error, field: 'email' });
    }

    if (!password) {
        return res.status(400).json({ error: 'Mot de passe requis', field: 'password' });
    }

    const { data, error } = await supabase.auth.signInWithPassword({
        email: emailResult.email,
        password
    });

    if (error) {
        // Don't reveal if email exists for security
        return res.status(401).json({ 
            error: 'Email ou mot de passe incorrect',
            hint: 'Vérifie tes identifiants et réessaie'
        });
    }

    // Log successful login
    logActivity(data.user.id, 'login', {}, req);

    return res.json({
        success: true,
        message: 'Connexion réussie !',
        user: data.user,
        session: data.session
    });
}

// ===== ME (Current User) =====

async function handleMe(req, res) {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Non authentifié' });
    }

    const token = authHeader.split(' ')[1];
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
        return res.status(401).json({ error: 'Token invalide' });
    }

    const { data: profile } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();

    return res.json({ user, profile });
}
