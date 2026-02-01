/**
 * User Profile API - Profile management and GDPR compliance
 * 
 * Endpoints:
 * - GET / - Get profile
 * - GET ?action=export - GDPR data export
 * - PUT - Update profile
 * - DELETE - Delete account (requires confirmation)
 */

import { supabase, requireAuth, handleCors } from './_supabase.js';
import { checkRateLimit, RATE_LIMITS } from './_rate-limit.js';
import { validateDisplayName, validateBio, validateURL, validateVacationMessage } from './_validation.js';
import { logError, logInfo, logWarn, createErrorResponse } from './_error-logger.js';

export default async function handler(req, res) {
    if (handleCors(req, res, ['GET', 'PUT', 'DELETE', 'OPTIONS'])) return;

    const user = await requireAuth(req, res);
    if (!user) return;

    // Rate limiting
    const rateLimitConfig = req.method === 'GET' ? RATE_LIMITS.READ : RATE_LIMITS.CREATE;
    if (!checkRateLimit(req, res, { ...rateLimitConfig, keyPrefix: 'profile', userId: user.id })) {
        return;
    }

    try {
        if (req.method === 'GET') {
            return handleGetProfile(req, res, user);
        }

        if (req.method === 'PUT') {
            return handleUpdateProfile(req, res, user);
        }

        if (req.method === 'DELETE') {
            return handleDeleteAccount(req, res, user);
        }

        return res.status(405).json({ error: 'Method not allowed' });

    } catch (e) {
        logError(e, { 
            endpoint: '/api/user-profile',
            method: req.method,
            userId: user?.id 
        });
        return res.status(500).json(
            createErrorResponse(e, { 
                includeDebug: process.env.NODE_ENV === 'development',
                hint: 'Impossible de mettre à jour ton profil. Réessaie.'
            })
        );
    }
}

// ===== GET PROFILE =====

async function handleGetProfile(req, res, user) {
    const action = req.query.action;

    if (action === 'export') {
        return handleGdprExport(res, user);
    }

    const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();

    if (error) throw error;

    const { count } = await supabase
        .from('contacts')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

    return res.json({ 
        profile: data,
        stats: {
            contactCount: count || 0,
            maxContacts: 5
        }
    });
}

// ===== GDPR DATA EXPORT =====

async function handleGdprExport(res, user) {
    const exportData = {
        exportDate: new Date().toISOString(),
        user: null,
        contacts: [],
        messages: [],
        proposals: [],
        giftCodesCreated: [],
        pushSubscriptions: []
    };

    // User profile
    const { data: profile } = await supabase
        .from('users')
        .select('id, email, display_name, bio, avatar_url, created_at, updated_at, gift_code_used')
        .eq('id', user.id)
        .single();
    exportData.user = profile;

    // Contacts
    const { data: contacts } = await supabase
        .from('contacts')
        .select('id, contact_user_id, nickname, created_at')
        .eq('user_id', user.id);
    exportData.contacts = contacts || [];

    // Messages
    const { data: messages } = await supabase
        .from('messages')
        .select('id, sender_id, receiver_id, content, is_ping, read_at, created_at')
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order('created_at', { ascending: true });
    exportData.messages = messages || [];

    // Proposals
    const { data: proposals } = await supabase
        .from('proposals')
        .select('id, sender_id, receiver_id, proposed_at, location, message, status, responded_at, created_at')
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order('created_at', { ascending: true });
    exportData.proposals = proposals || [];

    // Gift codes
    const { data: giftCodes } = await supabase
        .from('gift_codes')
        .select('id, code, status, redeemed_at, expires_at, created_at')
        .eq('created_by', user.id);
    exportData.giftCodesCreated = giftCodes || [];

    // Push subscriptions
    const { data: pushSubs } = await supabase
        .from('push_subscriptions')
        .select('id, endpoint, created_at')
        .eq('user_id', user.id);
    exportData.pushSubscriptions = pushSubs || [];

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="cinq-data-export-${new Date().toISOString().split('T')[0]}.json"`);
    
    return res.json(exportData);
}

// ===== UPDATE PROFILE =====

async function handleUpdateProfile(req, res, user) {
    const { display_name, avatar_url, bio, birthday, vacation_mode, vacation_message, focus_mode, focus_start, focus_end, auto_reply_enabled, auto_reply_message, status_emoji, status_text, hide_last_seen } = req.body;

    const updates = {};
    
    // Birthday (date of birth)
    if (birthday !== undefined) {
        if (birthday === null || birthday === '') {
            updates.birthday = null;
        } else {
            // Validate date format (YYYY-MM-DD)
            const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
            if (!dateRegex.test(birthday)) {
                return res.status(400).json({ error: 'Format de date invalide (AAAA-MM-JJ)', field: 'birthday' });
            }
            // Validate it's a real date
            const date = new Date(birthday);
            if (isNaN(date.getTime())) {
                return res.status(400).json({ error: 'Date invalide', field: 'birthday' });
            }
            // Ensure date is not in the future
            if (date > new Date()) {
                return res.status(400).json({ error: 'La date de naissance ne peut pas être dans le futur', field: 'birthday' });
            }
            // Ensure reasonable age (not older than 150 years)
            const minDate = new Date();
            minDate.setFullYear(minDate.getFullYear() - 150);
            if (date < minDate) {
                return res.status(400).json({ error: 'Date de naissance invalide', field: 'birthday' });
            }
            updates.birthday = birthday;
        }
    }
    
    if (display_name !== undefined) {
        const result = validateDisplayName(display_name);
        if (!result.valid) {
            return res.status(400).json({ error: result.error, field: 'display_name' });
        }
        updates.display_name = result.name;
    }
    
    if (avatar_url !== undefined) {
        const result = validateURL(avatar_url);
        if (!result.valid) {
            return res.status(400).json({ error: result.error, field: 'avatar_url' });
        }
        updates.avatar_url = result.url;
    }
    
    if (bio !== undefined) {
        const result = validateBio(bio);
        if (!result.valid) {
            return res.status(400).json({ error: result.error, field: 'bio' });
        }
        updates.bio = result.bio;
    }
    
    // Vacation mode
    if (vacation_mode !== undefined) {
        updates.vacation_mode = Boolean(vacation_mode);
        logInfo('Vacation mode toggled', { userId: user.id, vacationMode: updates.vacation_mode });
    }
    
    if (vacation_message !== undefined) {
        const result = validateVacationMessage(vacation_message);
        if (!result.valid) {
            return res.status(400).json({ error: result.error, field: 'vacation_message' });
        }
        updates.vacation_message = result.message;
    }
    
    // Focus mode
    if (focus_mode !== undefined) {
        updates.focus_mode = Boolean(focus_mode);
        logInfo('Focus mode toggled', { userId: user.id, focusMode: updates.focus_mode });
    }
    
    if (focus_start !== undefined) {
        // Validate time format (HH:MM)
        if (!/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(focus_start)) {
            return res.status(400).json({ error: 'Format d\'heure invalide (HH:MM)', field: 'focus_start' });
        }
        updates.focus_start = focus_start;
    }
    
    if (focus_end !== undefined) {
        // Validate time format (HH:MM)
        if (!/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(focus_end)) {
            return res.status(400).json({ error: 'Format d\'heure invalide (HH:MM)', field: 'focus_end' });
        }
        updates.focus_end = focus_end;
    }
    
    // Auto-reply mode (busy mode - different from vacation)
    if (auto_reply_enabled !== undefined) {
        updates.auto_reply_enabled = Boolean(auto_reply_enabled);
        logInfo('Auto-reply mode toggled', { userId: user.id, autoReplyEnabled: updates.auto_reply_enabled });
    }
    
    if (auto_reply_message !== undefined) {
        // Validate auto-reply message (same as vacation message)
        const result = validateVacationMessage(auto_reply_message);
        if (!result.valid) {
            return res.status(400).json({ error: result.error, field: 'auto_reply_message' });
        }
        updates.auto_reply_message = result.message;
    }
    
    // User status (WhatsApp-style)
    if (status_emoji !== undefined) {
        // Allow null to clear status, or validate emoji (simple check: not too long)
        if (status_emoji === null || status_emoji === '') {
            updates.status_emoji = null;
        } else if (typeof status_emoji === 'string' && status_emoji.length <= 10) {
            updates.status_emoji = status_emoji;
        } else {
            return res.status(400).json({ error: 'Emoji de statut invalide', field: 'status_emoji' });
        }
    }
    
    if (status_text !== undefined) {
        // Allow null to clear status, or validate text (max 60 chars)
        if (status_text === null || status_text === '') {
            updates.status_text = null;
        } else if (typeof status_text === 'string') {
            const trimmed = status_text.trim();
            if (trimmed.length > 60) {
                return res.status(400).json({ error: 'Le texte du statut ne peut pas dépasser 60 caractères', field: 'status_text' });
            }
            updates.status_text = trimmed.length > 0 ? trimmed : null;
        } else {
            return res.status(400).json({ error: 'Texte de statut invalide', field: 'status_text' });
        }
    }
    
    // Hide last seen (privacy setting)
    if (hide_last_seen !== undefined) {
        updates.hide_last_seen = Boolean(hide_last_seen);
        logInfo('Hide last seen toggled', { userId: user.id, hideLastSeen: updates.hide_last_seen });
    }
    
    // Mood indicator (😊😐😔🎉🤒)
    const { mood } = req.body;
    if (mood !== undefined) {
        const validMoods = ['😊', '😐', '😔', '🎉', '🤒', null, ''];
        if (mood === null || mood === '') {
            updates.mood = null;
            updates.mood_updated_at = null;
        } else if (validMoods.includes(mood)) {
            updates.mood = mood;
            updates.mood_updated_at = new Date().toISOString();
            logInfo('Mood updated', { userId: user.id, mood });
        } else {
            return res.status(400).json({ error: 'Humeur invalide. Choisis parmi: 😊😐😔🎉🤒', field: 'mood' });
        }
    }

    if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: 'Aucun champ à mettre à jour' });
    }

    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
        .from('users')
        .update(updates)
        .eq('id', user.id)
        .select()
        .single();

    if (error) throw error;
    return res.json({ success: true, profile: data });
}

// ===== DELETE ACCOUNT =====

async function handleDeleteAccount(req, res, user) {
    const { confirmation } = req.body || {};

    if (confirmation !== 'SUPPRIMER') {
        return res.status(400).json({ 
            error: 'Confirmation requise',
            hint: 'Envoie { "confirmation": "SUPPRIMER" } pour confirmer la suppression définitive'
        });
    }

    logWarn('Account deletion initiated', { userId: user.id, email: user.email });

    // Delete in order (respecting foreign key constraints)
    const deleteOps = [
        supabase.from('push_subscriptions').delete().eq('user_id', user.id),
        supabase.from('proposals').delete().or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`),
        supabase.from('messages').delete().or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`),
        supabase.from('contacts').delete().or(`user_id.eq.${user.id},contact_user_id.eq.${user.id}`),
        supabase.from('gift_codes').update({ created_by: null }).eq('created_by', user.id),
        supabase.from('users').delete().eq('id', user.id)
    ];

    for (const op of deleteOps) {
        await op;
    }

    // Delete auth user
    await supabase.auth.admin.deleteUser(user.id);

    logInfo('Account deleted successfully', { userId: user.id });

    return res.json({ 
        success: true, 
        message: 'Compte supprimé définitivement. Adieu ! 👋'
    });
}
