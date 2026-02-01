/**
 * Notifications API - Mention notifications for Cinq
 * 
 * Endpoints:
 * - GET / - Get user's notifications (with pagination)
 * - GET ?unread=true - Get unread count only
 * - PATCH ?id=xxx - Mark notification as read
 * - PATCH ?all=true - Mark all as read
 * - DELETE ?id=xxx - Delete notification
 */

import { supabase, requireAuth, getUserInfo, handleCors } from './_supabase.js';
import { checkRateLimit, RATE_LIMITS } from './_rate-limit.js';
import { isValidUUID } from './_validation.js';
import { logError, logInfo, createErrorResponse } from './_error-logger.js';
import { sendPushNotification } from './_push-helper.js';

const MAX_FETCH_LIMIT = 50;
const DEFAULT_FETCH_LIMIT = 20;

export default async function handler(req, res) {
    if (handleCors(req, res, ['GET', 'PATCH', 'DELETE', 'OPTIONS'])) return;

    const user = await requireAuth(req, res);
    if (!user) return;

    // Rate limiting
    const rateLimitConfig = RATE_LIMITS.READ;
    if (!checkRateLimit(req, res, { ...rateLimitConfig, keyPrefix: 'notifications', userId: user.id })) {
        return;
    }

    try {
        if (req.method === 'GET') {
            return handleGetNotifications(req, res, user);
        }

        if (req.method === 'PATCH') {
            return handleMarkAsRead(req, res, user);
        }

        if (req.method === 'DELETE') {
            return handleDeleteNotification(req, res, user);
        }

        return res.status(405).json({ error: 'Method not allowed' });

    } catch (e) {
        logError(e, {
            endpoint: '/api/notifications',
            method: req.method,
            userId: user?.id
        });
        return res.status(500).json(
            createErrorResponse(e, {
                includeDebug: process.env.NODE_ENV === 'development',
                hint: 'Erreur lors de la récupération des notifications'
            })
        );
    }
}

// ===== GET - List notifications =====

async function handleGetNotifications(req, res, user) {
    const { unread, limit, cursor } = req.query;
    
    // Just get unread count
    if (unread === 'true' || unread === 'count') {
        const { count, error } = await supabase
            .from('notifications')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .eq('read', false);
        
        if (error) throw error;
        
        return res.json({ unreadCount: count || 0 });
    }
    
    // Get full notifications list
    const safeLimit = Math.min(Math.max(1, parseInt(limit) || DEFAULT_FETCH_LIMIT), MAX_FETCH_LIMIT);
    
    let query = supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(safeLimit);
    
    // Cursor-based pagination
    if (cursor) {
        try {
            const cursorDate = new Date(cursor);
            if (!isNaN(cursorDate.getTime())) {
                query = query.lt('created_at', cursorDate.toISOString());
            }
        } catch {}
    }
    
    const { data: notifications, error } = await query;
    
    if (error) throw error;
    
    // Enrich with actor info
    const actorCache = {};
    const enriched = await Promise.all(notifications.map(async (notif) => {
        if (notif.actor_id && !actorCache[notif.actor_id]) {
            actorCache[notif.actor_id] = await getUserInfo(notif.actor_id);
        }
        return {
            ...notif,
            actor: notif.actor_id ? actorCache[notif.actor_id] : null
        };
    }));
    
    // Next cursor
    const nextCursor = notifications.length === safeLimit && notifications.length > 0
        ? notifications[notifications.length - 1].created_at
        : null;
    
    // Also return unread count
    const { count: unreadCount } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('read', false);
    
    return res.json({
        notifications: enriched,
        unreadCount: unreadCount || 0,
        nextCursor,
        hasMore: notifications.length === safeLimit
    });
}

// ===== PATCH - Mark as read =====

async function handleMarkAsRead(req, res, user) {
    const { id, all } = req.query;
    
    // Mark all as read
    if (all === 'true') {
        const { error } = await supabase
            .from('notifications')
            .update({ read: true })
            .eq('user_id', user.id)
            .eq('read', false);
        
        if (error) throw error;
        
        return res.json({ success: true, message: 'Toutes les notifications marquées comme lues' });
    }
    
    // Mark single notification as read
    if (!id) {
        return res.status(400).json({ error: 'id ou all=true requis' });
    }
    
    if (!isValidUUID(id)) {
        return res.status(400).json({ error: 'Format id invalide' });
    }
    
    const { data, error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single();
    
    if (error) {
        if (error.code === 'PGRST116') {
            return res.status(404).json({ error: 'Notification non trouvée' });
        }
        throw error;
    }
    
    return res.json({ success: true, notification: data });
}

// ===== DELETE - Delete notification =====

async function handleDeleteNotification(req, res, user) {
    const { id } = req.query;
    
    if (!id) {
        return res.status(400).json({ error: 'id requis' });
    }
    
    if (!isValidUUID(id)) {
        return res.status(400).json({ error: 'Format id invalide' });
    }
    
    const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);
    
    if (error) throw error;
    
    return res.json({ success: true });
}

// ===== HELPER: Create mention notification =====

/**
 * Create a notification for a mention
 * @param {Object} options
 * @param {string} options.mentionedUserId - User who was mentioned
 * @param {string} options.actorId - User who made the mention
 * @param {string} options.type - 'post_mention' or 'message_mention'
 * @param {string} options.referenceId - Post ID or Message ID
 * @param {string} options.content - Preview of the content
 */
export async function createMentionNotification({ mentionedUserId, actorId, type, referenceId, content }) {
    // Don't notify yourself
    if (mentionedUserId === actorId) return;
    
    try {
        const { data, error } = await supabase
            .from('notifications')
            .insert({
                user_id: mentionedUserId,
                actor_id: actorId,
                type,
                reference_id: referenceId,
                content: content?.substring(0, 200) || '',
                read: false
            })
            .select()
            .single();
        
        if (error) throw error;
        
        // Send push notification
        const actorInfo = await getUserInfo(actorId);
        const actorName = actorInfo?.display_name || actorInfo?.email?.split('@')[0] || 'Quelqu\'un';
        
        const title = type === 'post_mention' 
            ? `${actorName} t'a mentionné dans un post`
            : `${actorName} t'a mentionné dans un message`;
        
        sendPushNotification(mentionedUserId, {
            title,
            body: content?.substring(0, 100) || 'Clique pour voir',
            tag: `mention-${referenceId}`,
            data: { type, referenceId, actorId }
        });
        
        logInfo('Mention notification created', { 
            userId: mentionedUserId, 
            actorId, 
            type, 
            referenceId 
        });
        
        return data;
    } catch (e) {
        logError(e, { context: 'createMentionNotification', mentionedUserId, actorId, type });
        return null;
    }
}

// ===== HELPER: Parse mentions from text =====

/**
 * Extract @mentions from text
 * Returns array of usernames mentioned
 * @param {string} text
 * @returns {string[]} - Array of usernames (without @)
 */
export function parseMentions(text) {
    if (!text) return [];
    
    // Match @username (alphanumeric, underscores, dots, hyphens)
    // Username must be 2-30 chars
    const mentionRegex = /@([a-zA-Z0-9_.-]{2,30})\b/g;
    const mentions = [];
    let match;
    
    while ((match = mentionRegex.exec(text)) !== null) {
        const username = match[1].toLowerCase();
        if (!mentions.includes(username)) {
            mentions.push(username);
        }
    }
    
    return mentions;
}

/**
 * Resolve usernames to user IDs
 * @param {string[]} usernames
 * @returns {Promise<Object>} - Map of username -> userId
 */
export async function resolveUsernames(usernames) {
    if (!usernames || usernames.length === 0) return {};
    
    // Usernames are derived from email (before @) or display_name
    // We search in both fields
    const results = {};
    
    for (const username of usernames) {
        // Try to find by display_name first (case-insensitive)
        let { data: user } = await supabase
            .from('users')
            .select('id, display_name, email')
            .ilike('display_name', username)
            .limit(1)
            .single();
        
        // If not found by display_name, try email prefix
        if (!user) {
            const { data: userByEmail } = await supabase
                .from('users')
                .select('id, display_name, email')
                .ilike('email', `${username}@%`)
                .limit(1)
                .single();
            user = userByEmail;
        }
        
        if (user) {
            results[username] = user.id;
        }
    }
    
    return results;
}

/**
 * Process mentions in content and create notifications
 * @param {string} content - The text content
 * @param {string} actorId - User who created the content
 * @param {string} type - 'post_mention' or 'message_mention'
 * @param {string} referenceId - Post ID or Message ID
 * @returns {Promise<string[]>} - Array of notified user IDs
 */
export async function processMentions(content, actorId, type, referenceId) {
    const mentions = parseMentions(content);
    if (mentions.length === 0) return [];
    
    const usernameToId = await resolveUsernames(mentions);
    const notifiedUserIds = [];
    
    for (const [username, userId] of Object.entries(usernameToId)) {
        if (userId && userId !== actorId) {
            await createMentionNotification({
                mentionedUserId: userId,
                actorId,
                type,
                referenceId,
                content
            });
            notifiedUserIds.push(userId);
        }
    }
    
    return notifiedUserIds;
}
