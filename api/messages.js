/**
 * Messages API - Direct messaging between contacts
 * 
 * Endpoints:
 * - GET ?contact_id=xxx - Get message history with a contact
 * - POST - Send message or ping to contact
 */

import { supabase, requireAuth, handleCors } from './_supabase.js';
import { sendPushNotification } from './_push-helper.js';
import { checkRateLimit, RATE_LIMITS } from './_rate-limit.js';
import { isValidUUID, validateMessageContent } from './_validation.js';
import { logError, createErrorResponse } from './_error-logger.js';

const MAX_MESSAGE_LENGTH = 2000;
const MAX_FETCH_LIMIT = 100;

export default async function handler(req, res) {
    if (handleCors(req, res, ['GET', 'POST', 'OPTIONS'])) return;

    const user = await requireAuth(req, res);
    if (!user) return;

    // Rate limiting
    const rateLimitConfig = req.method === 'POST' ? RATE_LIMITS.CREATE : RATE_LIMITS.READ;
    if (!checkRateLimit(req, res, { ...rateLimitConfig, keyPrefix: 'messages', userId: user.id })) {
        return;
    }

    try {
        if (req.method === 'GET') {
            return handleGetMessages(req, res, user);
        }

        if (req.method === 'POST') {
            return handleSendMessage(req, res, user);
        }

        return res.status(405).json({ error: 'Method not allowed' });

    } catch (e) {
        logError(e, { 
            endpoint: '/api/messages',
            method: req.method,
            userId: user?.id 
        });
        return res.status(500).json(
            createErrorResponse(e, { 
                includeDebug: process.env.NODE_ENV === 'development',
                hint: 'Ton message n\'a pas pu être envoyé. Réessaie.'
            })
        );
    }
}

// ===== GET - Fetch messages =====

async function handleGetMessages(req, res, user) {
    const { contact_id, limit = 50, before } = req.query;

    if (!contact_id) {
        return res.status(400).json({ error: 'contact_id requis' });
    }

    if (!isValidUUID(contact_id)) {
        return res.status(400).json({ error: 'Format contact_id invalide' });
    }

    // Verify contact relationship
    const isContact = await verifyContactRelationship(user.id, contact_id);
    if (!isContact) {
        return res.status(403).json({ error: 'Pas dans tes contacts' });
    }

    const safeLimit = Math.min(Math.max(1, parseInt(limit) || 50), MAX_FETCH_LIMIT);

    // Build query
    let query = supabase
        .from('messages')
        .select('*')
        .or(`and(sender_id.eq.${user.id},receiver_id.eq.${contact_id}),and(sender_id.eq.${contact_id},receiver_id.eq.${user.id})`)
        .order('created_at', { ascending: false })
        .limit(safeLimit);

    // Pagination via timestamp
    if (before) {
        const beforeDate = new Date(before);
        if (!isNaN(beforeDate.getTime())) {
            query = query.lt('created_at', before);
        }
    }

    const { data, error } = await query;
    if (error) throw error;

    // Mark received messages as read
    await markMessagesAsRead(user.id, contact_id);

    // Return in chronological order
    return res.json({ messages: data.reverse() });
}

async function verifyContactRelationship(userId, contactId) {
    const { data } = await supabase
        .from('contacts')
        .select('id')
        .eq('user_id', userId)
        .eq('contact_user_id', contactId)
        .single();
    return !!data;
}

async function markMessagesAsRead(userId, senderId) {
    await supabase
        .from('messages')
        .update({ read_at: new Date().toISOString() })
        .eq('receiver_id', userId)
        .eq('sender_id', senderId)
        .is('read_at', null);
}

// ===== POST - Send message =====

async function handleSendMessage(req, res, user) {
    const { contact_id, content, is_ping = false } = req.body;

    if (!contact_id) {
        return res.status(400).json({ error: 'contact_id requis' });
    }

    if (!isValidUUID(contact_id)) {
        return res.status(400).json({ error: 'Format contact_id invalide' });
    }

    // Validate content (unless it's a ping)
    if (!is_ping) {
        const contentResult = validateMessageContent(content, { 
            maxLength: MAX_MESSAGE_LENGTH, 
            required: true 
        });
        if (!contentResult.valid) {
            return res.status(400).json({ error: contentResult.error });
        }
    }

    // Verify contact relationship
    const isContact = await verifyContactRelationship(user.id, contact_id);
    if (!isContact) {
        return res.status(403).json({ error: 'Pas dans tes contacts' });
    }

    // Sanitize content
    const safeContent = is_ping 
        ? '👋' 
        : validateMessageContent(content, { maxLength: MAX_MESSAGE_LENGTH }).content;

    // Create message
    const { data, error } = await supabase
        .from('messages')
        .insert({
            sender_id: user.id,
            receiver_id: contact_id,
            content: safeContent,
            is_ping
        })
        .select()
        .single();

    if (error) throw error;

    // Send push notification (fire and forget)
    sendPushToReceiver(contact_id, user, data, is_ping, safeContent);

    return res.status(201).json({ success: true, message: data });
}

function sendPushToReceiver(receiverId, sender, message, isPing, content) {
    const senderName = sender.email?.split('@')[0] || 'Quelqu\'un';
    
    sendPushNotification(receiverId, {
        title: isPing ? '👋 Ping !' : `Message de ${senderName}`,
        body: isPing ? `${senderName} te fait coucou` : content.substring(0, 100),
        tag: `msg-${message.id}`,
        data: { messageId: message.id, senderId: sender.id }
    });
}
