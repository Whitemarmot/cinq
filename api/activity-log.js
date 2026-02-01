/**
 * Activity Log API - User activity history
 * 
 * Endpoints:
 * - GET ?action=list - Get user's activity log (paginated)
 * - POST ?action=log - Log a new activity (internal use)
 * 
 * Activity types:
 * - login: User logged in
 * - profile_update: Profile was modified
 * - password_change: Password was changed
 * - email_change: Email change requested
 * - contact_added: New contact added
 * - contact_removed: Contact removed
 * - vacation_toggle: Vacation mode toggled
 * - push_enabled: Push notifications enabled
 * - push_disabled: Push notifications disabled
 * - data_export: Data export requested
 */

import { supabase, getUser, handleCors } from './_supabase.js';
import { logError, logInfo, createErrorResponse } from './_error-logger.js';

// Activity type labels and icons
const ACTIVITY_LABELS = {
    login: { label: 'Connexion', icon: '🔐', description: 'Tu t\'es connecté' },
    profile_update: { label: 'Profil modifié', icon: '✏️', description: 'Tu as mis à jour ton profil' },
    password_change: { label: 'Mot de passe', icon: '🔒', description: 'Mot de passe modifié' },
    email_change: { label: 'Email modifié', icon: '📧', description: 'Changement d\'email demandé' },
    contact_added: { label: 'Nouveau contact', icon: '👤', description: 'Tu as ajouté un contact' },
    contact_removed: { label: 'Contact retiré', icon: '👋', description: 'Tu as retiré un contact' },
    vacation_enabled: { label: 'Mode vacances', icon: '🌴', description: 'Mode vacances activé' },
    vacation_disabled: { label: 'Mode vacances', icon: '🏠', description: 'Mode vacances désactivé' },
    push_enabled: { label: 'Notifications', icon: '🔔', description: 'Notifications push activées' },
    push_disabled: { label: 'Notifications', icon: '🔕', description: 'Notifications push désactivées' },
    data_export: { label: 'Export données', icon: '📦', description: 'Export de données demandé' },
    account_deletion_request: { label: 'Suppression', icon: '⚠️', description: 'Demande de suppression de compte' },
    account_deletion_cancel: { label: 'Annulation', icon: '✅', description: 'Suppression annulée' }
};

export default async function handler(req, res) {
    if (handleCors(req, res, ['GET', 'POST', 'OPTIONS'])) return;

    const action = req.query.action || req.body?.action;

    try {
        if (action === 'list' || (req.method === 'GET' && !action)) {
            return handleList(req, res);
        }

        if (action === 'log' && req.method === 'POST') {
            return handleLog(req, res);
        }

        return res.status(400).json({ 
            error: 'Action invalide',
            hint: 'Actions disponibles: list, log',
            received: action
        });

    } catch (e) {
        logError(e, { 
            endpoint: '/api/activity-log',
            action,
            method: req.method 
        });
        return res.status(500).json(
            createErrorResponse(e, { includeDebug: process.env.NODE_ENV === 'development' })
        );
    }
}

// ===== LIST ACTIVITIES =====

async function handleList(req, res) {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Non authentifié' });
    }

    const token = authHeader.split(' ')[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
        return res.status(401).json({ error: 'Token invalide' });
    }

    // Pagination
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const offset = parseInt(req.query.offset) || 0;

    // Fetch activities
    const { data: activities, error, count } = await supabase
        .from('activity_log')
        .select('*', { count: 'exact' })
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

    if (error) {
        logError(error, { endpoint: '/api/activity-log', action: 'list', userId: user.id });
        return res.status(500).json({ error: 'Erreur lors de la récupération des activités' });
    }

    // Enrich activities with labels and icons
    const enrichedActivities = activities.map(activity => {
        const meta = ACTIVITY_LABELS[activity.activity_type] || {
            label: activity.activity_type,
            icon: '📝',
            description: activity.activity_type
        };

        return {
            id: activity.id,
            type: activity.activity_type,
            label: meta.label,
            icon: meta.icon,
            description: activity.metadata?.description || meta.description,
            metadata: activity.metadata || {},
            ip_hash: activity.ip_hash,
            user_agent: activity.user_agent,
            created_at: activity.created_at,
            relative_time: getRelativeTime(activity.created_at)
        };
    });

    return res.json({
        success: true,
        activities: enrichedActivities,
        pagination: {
            total: count,
            limit,
            offset,
            has_more: offset + limit < count
        }
    });
}

// ===== LOG NEW ACTIVITY =====

async function handleLog(req, res) {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Non authentifié' });
    }

    const token = authHeader.split(' ')[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
        return res.status(401).json({ error: 'Token invalide' });
    }

    const { activity_type, metadata } = req.body;

    if (!activity_type) {
        return res.status(400).json({ error: 'Type d\'activité requis' });
    }

    // Validate activity type
    if (!ACTIVITY_LABELS[activity_type]) {
        return res.status(400).json({ 
            error: 'Type d\'activité invalide',
            valid_types: Object.keys(ACTIVITY_LABELS)
        });
    }

    // Get IP and user agent (hashed for privacy)
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
               req.headers['x-real-ip'] || 
               req.socket?.remoteAddress || 
               'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';
    const ipHash = await hashString(ip);

    // Insert activity
    const { data: activity, error } = await supabase
        .from('activity_log')
        .insert({
            user_id: user.id,
            activity_type,
            metadata: metadata || {},
            ip_hash: ipHash,
            user_agent: userAgent.substring(0, 500) // Limit length
        })
        .select()
        .single();

    if (error) {
        logError(error, { 
            endpoint: '/api/activity-log', 
            action: 'log', 
            userId: user.id,
            activity_type 
        });
        return res.status(500).json({ error: 'Erreur lors de l\'enregistrement de l\'activité' });
    }

    logInfo('Activity logged', { userId: user.id, activity_type });

    return res.json({
        success: true,
        activity: {
            id: activity.id,
            type: activity.activity_type,
            created_at: activity.created_at
        }
    });
}

// ===== HELPER: Log activity from other APIs =====

export async function logActivity(userId, activityType, metadata = {}, req = null) {
    try {
        let ipHash = null;
        let userAgent = null;

        if (req) {
            const ip = req.headers?.['x-forwarded-for']?.split(',')[0]?.trim() || 
                       req.headers?.['x-real-ip'] || 
                       req.socket?.remoteAddress || 
                       'unknown';
            userAgent = req.headers?.['user-agent']?.substring(0, 500) || null;
            ipHash = await hashString(ip);
        }

        const { error } = await supabase
            .from('activity_log')
            .insert({
                user_id: userId,
                activity_type: activityType,
                metadata,
                ip_hash: ipHash,
                user_agent: userAgent
            });

        if (error) {
            logError(error, { helper: 'logActivity', userId, activityType });
        }
    } catch (e) {
        // Don't throw - activity logging should never break the main flow
        logError(e, { helper: 'logActivity', userId, activityType });
    }
}

// ===== HELPER FUNCTIONS =====

async function hashString(str) {
    if (!str || str === 'unknown') return null;
    
    // Simple hash for privacy - we don't need to reverse it
    const encoder = new TextEncoder();
    const data = encoder.encode(str + 'cinq-salt-2024');
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.slice(0, 8).map(b => b.toString(16).padStart(2, '0')).join('');
}

function getRelativeTime(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffSec < 60) return 'À l\'instant';
    if (diffMin < 60) return `Il y a ${diffMin} min`;
    if (diffHour < 24) return `Il y a ${diffHour}h`;
    if (diffDay === 1) return 'Hier';
    if (diffDay < 7) return `Il y a ${diffDay} jours`;
    if (diffDay < 30) return `Il y a ${Math.floor(diffDay / 7)} sem.`;
    
    return date.toLocaleDateString('fr-FR', { 
        day: 'numeric', 
        month: 'short' 
    });
}
