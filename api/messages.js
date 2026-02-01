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
import { logError, logInfo, createErrorResponse } from './_error-logger.js';
import { processMentions } from './notifications.js';

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
    const { contact_id, limit = 50, before, since, count } = req.query;
    
    // If 'since' is provided, return unread count (for polling)
    if (since && !contact_id) {
        return handleGetUnreadCount(req, res, user, since, count === 'true');
    }

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

    // Build query - include read_at for read receipts, file attachment fields, and sticker_id
    let query = supabase
        .from('messages')
        .select('id, sender_id, receiver_id, content, is_ping, sticker_id, created_at, read_at, file_url, file_name, file_size, file_type')
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
    const now = new Date().toISOString();
    
    // Get unread messages from this sender to this user
    const { data: unreadMessages } = await supabase
        .from('messages')
        .select('id')
        .eq('receiver_id', userId)
        .eq('sender_id', senderId)
        .is('read_at', null);
    
    if (!unreadMessages || unreadMessages.length === 0) return;
    
    // Create read receipts for each message
    const receipts = unreadMessages.map(msg => ({
        message_id: msg.id,
        reader_id: userId,
        read_at: now
    }));
    
    // Insert read receipts (ignore duplicates with ON CONFLICT)
    await supabase
        .from('read_receipts')
        .upsert(receipts, { onConflict: 'message_id,reader_id' });
    
    // Also update read_at on messages for backwards compatibility
    await supabase
        .from('messages')
        .update({ read_at: now })
        .eq('receiver_id', userId)
        .eq('sender_id', senderId)
        .is('read_at', null);
}

/**
 * Get count of unread messages since a timestamp (for polling)
 */
async function handleGetUnreadCount(req, res, user, since, includeLatest) {
    const sinceDate = new Date(parseInt(since));
    if (isNaN(sinceDate.getTime())) {
        return res.status(400).json({ error: 'Format since invalide' });
    }

    // Get count of unread messages
    const { count, error: countError } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('receiver_id', user.id)
        .is('read_at', null);

    if (countError) throw countError;

    const response = { 
        success: true, 
        newCount: count || 0
    };

    // Optionally include the latest unread message for notification display
    if (includeLatest && count > 0) {
        const { data: latestData, error: latestError } = await supabase
            .from('messages')
            .select(`
                id, 
                sender_id, 
                content, 
                is_ping, 
                created_at,
                sender:profiles!sender_id(email)
            `)
            .eq('receiver_id', user.id)
            .is('read_at', null)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (!latestError && latestData) {
            response.latestMessage = {
                id: latestData.id,
                senderId: latestData.sender_id,
                senderName: latestData.sender?.email?.split('@')[0] || 'Quelqu\'un',
                content: latestData.content,
                isPing: latestData.is_ping,
                createdAt: latestData.created_at
            };
        }
    }

    return res.json(response);
}

// ===== POST - Send message =====

// Valid stickers
const VALID_STICKERS = ['cinq', 'love', 'hug', 'laugh', 'thinking', 'fire', 'star', 'party', 'cool', 'sleepy', 'coffee', 'sad'];

async function handleSendMessage(req, res, user) {
    const { contact_id, content, is_ping = false, sticker_id, file_url, file_name, file_size, file_type } = req.body;

    if (!contact_id) {
        return res.status(400).json({ error: 'contact_id requis' });
    }

    if (!isValidUUID(contact_id)) {
        return res.status(400).json({ error: 'Format contact_id invalide' });
    }

    // Validate sticker_id if present
    const isSticker = sticker_id && VALID_STICKERS.includes(sticker_id);
    if (sticker_id && !isSticker) {
        return res.status(400).json({ error: 'Sticker invalide' });
    }

    // Validate content (unless it's a ping, sticker, or file attachment)
    const hasFile = file_url && file_name;
    if (!is_ping && !isSticker && !hasFile) {
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
        : isSticker
        ? `[sticker:${sticker_id}]`
        : validateMessageContent(content || '', { maxLength: MAX_MESSAGE_LENGTH }).content || '';

    // Build message object
    const messageData = {
        sender_id: user.id,
        receiver_id: contact_id,
        content: safeContent,
        is_ping
    };

    // Add sticker_id if present
    if (isSticker) {
        messageData.sticker_id = sticker_id;
    }

    // Add file attachment fields if present
    if (hasFile) {
        messageData.file_url = file_url;
        messageData.file_name = file_name;
        if (file_size) messageData.file_size = file_size;
        if (file_type) messageData.file_type = file_type;
    }

    // Create message
    const { data, error } = await supabase
        .from('messages')
        .insert(messageData)
        .select()
        .single();

    if (error) throw error;

    logInfo('Message sent', { 
        messageId: data.id, 
        senderId: user.id, 
        receiverId: contact_id,
        isPing: is_ping,
        isSticker: !!sticker_id,
        hasFile: !!file_url
    });

    // Send push notification (fire and forget)
    sendPushToReceiver(contact_id, user, data, is_ping, isSticker ? sticker_id : safeContent, isSticker);
    
    // Process @mentions in message and create notifications (fire and forget)
    if (!is_ping && safeContent) {
        processMentions(safeContent, user.id, 'message_mention', data.id)
            .catch(e => logError(e, { context: 'processMentions', messageId: data.id }));
    }

    // Check if receiver is in vacation mode and send auto-reply
    await sendVacationAutoReply(contact_id, user.id);

    return res.status(201).json({ success: true, message: data });
}

/**
 * Send automatic vacation reply if receiver has vacation mode enabled
 * Only sends once per hour to avoid spam
 */
async function sendVacationAutoReply(receiverId, senderId) {
    try {
        // Check if receiver has vacation mode enabled
        const { data: receiverProfile, error: profileError } = await supabase
            .from('users')
            .select('vacation_mode, vacation_message, display_name, email')
            .eq('id', receiverId)
            .single();

        if (profileError || !receiverProfile?.vacation_mode) {
            return; // No vacation mode or error
        }

        // Check if we already sent a vacation reply recently (within 1 hour)
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
        const { data: recentAutoReply } = await supabase
            .from('messages')
            .select('id')
            .eq('sender_id', receiverId)
            .eq('receiver_id', senderId)
            .eq('is_vacation_reply', true)
            .gte('created_at', oneHourAgo)
            .limit(1);

        if (recentAutoReply && recentAutoReply.length > 0) {
            return; // Already sent a vacation reply recently
        }

        const vacationMessage = receiverProfile.vacation_message || 
            'Je suis en vacances ! Je te réponds dès mon retour 🌴';

        // Send automatic reply
        const { error: insertError } = await supabase
            .from('messages')
            .insert({
                sender_id: receiverId,
                receiver_id: senderId,
                content: `🌴 ${vacationMessage}`,
                is_ping: false,
                is_vacation_reply: true
            });

        if (!insertError) {
            logInfo('Vacation auto-reply sent', { 
                from: receiverId, 
                to: senderId 
            });
        }
    } catch (err) {
        // Log but don't fail the main request
        logError(err, { context: 'vacation_auto_reply', receiverId, senderId });
    }
}

function sendPushToReceiver(receiverId, sender, message, isPing, content, isSticker = false) {
    const senderName = sender.email?.split('@')[0] || 'Quelqu\'un';
    
    let title, body;
    if (isPing) {
        title = '👋 Ping !';
        body = `${senderName} te fait coucou`;
    } else if (isSticker) {
        title = `Sticker de ${senderName}`;
        body = `${senderName} t'a envoyé un sticker`;
    } else {
        title = `Message de ${senderName}`;
        body = content.substring(0, 100);
    }
    
    sendPushNotification(receiverId, {
        title,
        body,
        tag: `msg-${message.id}`,
        data: { messageId: message.id, senderId: sender.id }
    });
}
