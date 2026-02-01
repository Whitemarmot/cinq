/**
 * Pinned Messages API - Pin important messages in conversations
 * 
 * Endpoints:
 * - GET ?contact_id=xxx - Get pinned messages for a conversation
 * - POST - Pin a message
 * - DELETE ?message_id=xxx - Unpin a message
 */

import { supabase, requireAuth, handleCors } from './_supabase.js';
import { checkRateLimit, RATE_LIMITS } from './_rate-limit.js';
import { isValidUUID } from './_validation.js';
import { logError, logInfo, createErrorResponse } from './_error-logger.js';

const MAX_PINS_PER_CONVERSATION = 10;

export default async function handler(req, res) {
    if (handleCors(req, res, ['GET', 'POST', 'DELETE', 'OPTIONS'])) return;

    const user = await requireAuth(req, res);
    if (!user) return;

    // Rate limiting
    const rateLimitConfig = req.method === 'GET' ? RATE_LIMITS.READ : RATE_LIMITS.CREATE;
    if (!checkRateLimit(req, res, { ...rateLimitConfig, keyPrefix: 'pinned-messages', userId: user.id })) {
        return;
    }

    try {
        if (req.method === 'GET') {
            return handleGetPinnedMessages(req, res, user);
        }

        if (req.method === 'POST') {
            return handlePinMessage(req, res, user);
        }

        if (req.method === 'DELETE') {
            return handleUnpinMessage(req, res, user);
        }

        return res.status(405).json({ error: 'Method not allowed' });

    } catch (e) {
        logError(e, { 
            endpoint: '/api/pinned-messages',
            method: req.method,
            userId: user?.id 
        });
        return res.status(500).json(
            createErrorResponse(e, { 
                includeDebug: process.env.NODE_ENV === 'development',
                hint: 'Impossible de gérer les messages épinglés. Réessaie.'
            })
        );
    }
}

// ===== GET - Fetch pinned messages for a conversation =====

async function handleGetPinnedMessages(req, res, user) {
    const { contact_id } = req.query;

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

    // Get pinned messages with message content
    const { data, error } = await supabase
        .from('pinned_messages')
        .select(`
            id,
            message_id,
            pinned_at,
            message:messages!message_id (
                id,
                sender_id,
                receiver_id,
                content,
                is_ping,
                sticker_id,
                gif_url,
                file_url,
                file_name,
                created_at
            )
        `)
        .eq('user_id', user.id)
        .eq('contact_id', contact_id)
        .order('pinned_at', { ascending: false });

    if (error) throw error;

    // Filter out any null messages (deleted)
    const pinnedMessages = (data || [])
        .filter(pm => pm.message)
        .map(pm => ({
            pin_id: pm.id,
            pinned_at: pm.pinned_at,
            ...pm.message
        }));

    return res.json({ pinned_messages: pinnedMessages });
}

// ===== POST - Pin a message =====

async function handlePinMessage(req, res, user) {
    const { message_id, contact_id } = req.body;

    if (!message_id) {
        return res.status(400).json({ error: 'message_id requis' });
    }

    if (!contact_id) {
        return res.status(400).json({ error: 'contact_id requis' });
    }

    if (!isValidUUID(message_id) || !isValidUUID(contact_id)) {
        return res.status(400).json({ error: 'Format ID invalide' });
    }

    // Verify contact relationship
    const isContact = await verifyContactRelationship(user.id, contact_id);
    if (!isContact) {
        return res.status(403).json({ error: 'Pas dans tes contacts' });
    }

    // Verify the message belongs to this conversation
    const { data: messageData, error: messageError } = await supabase
        .from('messages')
        .select('id, sender_id, receiver_id')
        .eq('id', message_id)
        .single();

    if (messageError || !messageData) {
        return res.status(404).json({ error: 'Message non trouvé' });
    }

    // Check message is part of this conversation
    const isInConversation = 
        (messageData.sender_id === user.id && messageData.receiver_id === contact_id) ||
        (messageData.sender_id === contact_id && messageData.receiver_id === user.id);

    if (!isInConversation) {
        return res.status(403).json({ error: 'Message pas dans cette conversation' });
    }

    // Check if already pinned
    const { data: existingPin } = await supabase
        .from('pinned_messages')
        .select('id')
        .eq('message_id', message_id)
        .eq('user_id', user.id)
        .single();

    if (existingPin) {
        return res.status(400).json({ error: 'Message déjà épinglé' });
    }

    // Check pin limit per conversation
    const { count, error: countError } = await supabase
        .from('pinned_messages')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('contact_id', contact_id);

    if (countError) throw countError;

    if (count >= MAX_PINS_PER_CONVERSATION) {
        return res.status(400).json({ 
            error: `Maximum ${MAX_PINS_PER_CONVERSATION} messages épinglés par conversation` 
        });
    }

    // Pin the message
    const { data, error } = await supabase
        .from('pinned_messages')
        .insert({
            message_id,
            user_id: user.id,
            contact_id
        })
        .select()
        .single();

    if (error) throw error;

    logInfo('Message pinned', { 
        messageId: message_id, 
        userId: user.id, 
        contactId: contact_id 
    });

    return res.status(201).json({ success: true, pinned: data });
}

// ===== DELETE - Unpin a message =====

async function handleUnpinMessage(req, res, user) {
    const { message_id } = req.query;

    if (!message_id) {
        return res.status(400).json({ error: 'message_id requis' });
    }

    if (!isValidUUID(message_id)) {
        return res.status(400).json({ error: 'Format message_id invalide' });
    }

    // Delete the pin
    const { error } = await supabase
        .from('pinned_messages')
        .delete()
        .eq('message_id', message_id)
        .eq('user_id', user.id);

    if (error) throw error;

    logInfo('Message unpinned', { 
        messageId: message_id, 
        userId: user.id 
    });

    return res.json({ success: true });
}

// ===== Helper functions =====

async function verifyContactRelationship(userId, contactId) {
    const { data } = await supabase
        .from('contacts')
        .select('id')
        .eq('user_id', userId)
        .eq('contact_user_id', contactId)
        .single();
    return !!data;
}
