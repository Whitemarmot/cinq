/**
 * Message Reactions API - Emoji reactions on messages
 * 
 * Endpoints:
 * - GET ?message_id=xxx - Get reactions for a message
 * - POST - Add reaction { message_id, emoji }
 * - DELETE ?message_id=xxx&emoji=xxx - Remove reaction
 * 
 * Supported emojis: ❤️ 😂 😮 😢 👏 🔥 👍 👎
 */

import { supabase, requireAuth, handleCors } from './_supabase.js';
import { checkRateLimit, RATE_LIMITS } from './_rate-limit.js';
import { isValidUUID } from './_validation.js';
import { logError, logInfo, createErrorResponse } from './_error-logger.js';
import { sendPushNotification } from './_push-helper.js';

// Allowed reaction emojis
const ALLOWED_EMOJIS = ['❤️', '😂', '😮', '😢', '👏', '🔥', '👍', '👎'];

export default async function handler(req, res) {
    if (handleCors(req, res, ['GET', 'POST', 'DELETE', 'OPTIONS'])) return;

    const user = await requireAuth(req, res);
    if (!user) return;

    // Rate limiting
    const rateLimitConfig = req.method === 'GET' ? RATE_LIMITS.READ : RATE_LIMITS.CREATE;
    if (!(await checkRateLimit(req, res, { ...rateLimitConfig, keyPrefix: 'message_reactions', userId: user.id }))) {
        return;
    }

    try {
        if (req.method === 'GET') {
            return handleGetReactions(req, res, user);
        }

        if (req.method === 'POST') {
            return handleAddReaction(req, res, user);
        }

        if (req.method === 'DELETE') {
            return handleRemoveReaction(req, res, user);
        }

        return res.status(405).json({ error: 'Method not allowed' });

    } catch (e) {
        logError(e, {
            endpoint: '/api/message-reactions',
            method: req.method,
            userId: user?.id 
        });
        return res.status(500).json(
            createErrorResponse(e, { 
                includeDebug: process.env.NODE_ENV === 'development',
                genericMessage: 'Failed to process message reaction'
            })
        );
    }
}

async function handleGetReactions(req, res, user) {
    const { message_id } = req.query;

    if (!message_id || !isValidUUID(message_id)) {
        return res.status(400).json({ error: 'Valid message_id required' });
    }

    try {
        // First verify user can see this message
        const { data: message, error: messageError } = await supabase
            .from('messages')
            .select('id, sender_id, receiver_id')
            .eq('id', message_id)
            .single();

        if (messageError || !message) {
            return res.status(404).json({ error: 'Message not found' });
        }

        // Check if user is involved in this message
        if (message.sender_id !== user.id && message.receiver_id !== user.id) {
            return res.status(403).json({ error: 'Access denied' });
        }

        // Get reactions for this message with user info
        const { data: reactions, error } = await supabase
            .from('message_reactions')
            .select(`
                emoji,
                created_at,
                user_id,
                users:user_id (display_name, avatar_url, avatar_emoji)
            `)
            .eq('message_id', message_id)
            .order('created_at', { ascending: true });

        if (error) {
            throw new Error(`Failed to fetch reactions: ${error.message}`);
        }

        // Group reactions by emoji
        const groupedReactions = {};
        reactions?.forEach(reaction => {
            if (!groupedReactions[reaction.emoji]) {
                groupedReactions[reaction.emoji] = {
                    emoji: reaction.emoji,
                    count: 0,
                    users: [],
                    user_reacted: false
                };
            }
            
            groupedReactions[reaction.emoji].count++;
            groupedReactions[reaction.emoji].users.push({
                id: reaction.user_id,
                display_name: reaction.users?.display_name || 'Anonymous',
                avatar_url: reaction.users?.avatar_url,
                avatar_emoji: reaction.users?.avatar_emoji
            });
            
            if (reaction.user_id === user.id) {
                groupedReactions[reaction.emoji].user_reacted = true;
            }
        });

        const result = Object.values(groupedReactions);

        return res.status(200).json({
            success: true,
            reactions: result
        });

    } catch (e) {
        logError(e, { userId: user.id, messageId: message_id });
        throw e;
    }
}

async function handleAddReaction(req, res, user) {
    const { message_id, emoji } = req.body;

    if (!message_id || !emoji) {
        return res.status(400).json({ error: 'message_id and emoji required' });
    }

    if (!isValidUUID(message_id)) {
        return res.status(400).json({ error: 'Invalid message_id' });
    }

    if (!ALLOWED_EMOJIS.includes(emoji)) {
        return res.status(400).json({ 
            error: 'Invalid emoji', 
            allowed: ALLOWED_EMOJIS 
        });
    }

    try {
        // Verify user can access this message
        const { data: message, error: messageError } = await supabase
            .from('messages')
            .select('id, sender_id, receiver_id, content')
            .eq('id', message_id)
            .single();

        if (messageError || !message) {
            return res.status(404).json({ error: 'Message not found' });
        }

        if (message.sender_id !== user.id && message.receiver_id !== user.id) {
            return res.status(403).json({ error: 'Access denied' });
        }

        // Add reaction (upsert to avoid duplicates)
        const { data: reaction, error } = await supabase
            .from('message_reactions')
            .upsert({
                message_id,
                user_id: user.id,
                emoji
            }, {
                onConflict: 'message_id,user_id,emoji'
            })
            .select()
            .single();

        if (error) {
            throw new Error(`Failed to add reaction: ${error.message}`);
        }

        // Send push notification to the other person if it's not their own message
        const otherUserId = message.sender_id === user.id ? message.receiver_id : message.sender_id;
        if (otherUserId !== user.id) {
            try {
                await sendPushNotification(otherUserId, {
                    title: "Nouvelle réaction",
                    body: `${user.display_name || 'Quelqu\'un'} a réagi ${emoji} à votre message`,
                    data: {
                        type: 'message_reaction',
                        message_id,
                        emoji,
                        user_id: user.id
                    }
                });
            } catch (pushError) {
                logError(pushError, { 
                    context: 'Push notification failed for message reaction',
                    userId: user.id,
                    targetUserId: otherUserId
                });
                // Continue execution even if push fails
            }
        }

        logInfo('Message reaction added', { 
            userId: user.id, 
            messageId: message_id,
            emoji,
            otherUserId
        });

        return res.status(201).json({
            success: true,
            reaction
        });

    } catch (e) {
        logError(e, { userId: user.id, messageId: message_id, emoji });
        throw e;
    }
}

async function handleRemoveReaction(req, res, user) {
    const { message_id, emoji } = req.query;

    if (!message_id || !emoji) {
        return res.status(400).json({ error: 'message_id and emoji required' });
    }

    if (!isValidUUID(message_id)) {
        return res.status(400).json({ error: 'Invalid message_id' });
    }

    try {
        // Verify user can access this message
        const { data: message, error: messageError } = await supabase
            .from('messages')
            .select('id, sender_id, receiver_id')
            .eq('id', message_id)
            .single();

        if (messageError || !message) {
            return res.status(404).json({ error: 'Message not found' });
        }

        if (message.sender_id !== user.id && message.receiver_id !== user.id) {
            return res.status(403).json({ error: 'Access denied' });
        }

        // Remove reaction
        const { error } = await supabase
            .from('message_reactions')
            .delete()
            .eq('message_id', message_id)
            .eq('user_id', user.id)
            .eq('emoji', emoji);

        if (error) {
            throw new Error(`Failed to remove reaction: ${error.message}`);
        }

        logInfo('Message reaction removed', { 
            userId: user.id, 
            messageId: message_id,
            emoji
        });

        return res.status(200).json({
            success: true,
            message: 'Reaction removed'
        });

    } catch (e) {
        logError(e, { userId: user.id, messageId: message_id, emoji });
        throw e;
    }
}