/**
 * Reactions API - Emoji reactions on posts
 * 
 * Endpoints:
 * - GET ?post_id=xxx - Get reactions for a post
 * - POST - Add reaction { post_id, emoji }
 * - DELETE ?post_id=xxx&emoji=xxx - Remove reaction
 * 
 * Supported emojis: ❤️ 😂 😮 😢 👏
 */

import { supabase, requireAuth, handleCors } from './_supabase.js';
import { checkRateLimit, RATE_LIMITS } from './_rate-limit.js';
import { isValidUUID } from './_validation.js';
import { logError, logInfo, createErrorResponse } from './_error-logger.js';

// Allowed reaction emojis
const ALLOWED_EMOJIS = ['❤️', '😂', '😮', '😢', '👏'];

export default async function handler(req, res) {
    if (handleCors(req, res, ['GET', 'POST', 'DELETE', 'OPTIONS'])) return;

    const user = await requireAuth(req, res);
    if (!user) return;

    // Rate limiting
    const rateLimitConfig = req.method === 'GET' ? RATE_LIMITS.READ : RATE_LIMITS.CREATE;
    if (!checkRateLimit(req, res, { ...rateLimitConfig, keyPrefix: 'reactions', userId: user.id })) {
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
            endpoint: '/api/reactions',
            method: req.method,
            userId: user?.id
        });
        return res.status(500).json(
            createErrorResponse(e, {
                includeDebug: process.env.NODE_ENV === 'development',
                hint: 'Vérifie ta connexion et réessaie'
            })
        );
    }
}

// ===== GET - Get reactions for post(s) =====

async function handleGetReactions(req, res, user) {
    const { post_id, post_ids } = req.query;
    
    // Support batch fetch for multiple posts
    if (post_ids) {
        const ids = post_ids.split(',').filter(id => isValidUUID(id.trim()));
        if (ids.length === 0) {
            return res.status(400).json({ error: 'post_ids invalides' });
        }
        return getBatchReactions(res, user, ids);
    }
    
    // Single post
    if (!post_id) {
        return res.status(400).json({ error: 'post_id requis' });
    }
    
    if (!isValidUUID(post_id)) {
        return res.status(400).json({ error: 'Format post_id invalide' });
    }
    
    return getSinglePostReactions(res, user, post_id);
}

async function getSinglePostReactions(res, user, postId) {
    // Get all reactions for this post
    const { data: reactions, error } = await supabase
        .from('post_reactions')
        .select('emoji, user_id')
        .eq('post_id', postId);
    
    if (error) throw error;
    
    // Aggregate by emoji
    const counts = {};
    const userReactions = [];
    
    ALLOWED_EMOJIS.forEach(e => counts[e] = 0);
    
    reactions?.forEach(r => {
        if (counts[r.emoji] !== undefined) {
            counts[r.emoji]++;
        }
        if (r.user_id === user.id) {
            userReactions.push(r.emoji);
        }
    });
    
    return res.json({
        post_id: postId,
        counts,
        userReactions,
        total: reactions?.length || 0
    });
}

async function getBatchReactions(res, user, postIds) {
    // Get all reactions for multiple posts
    const { data: reactions, error } = await supabase
        .from('post_reactions')
        .select('post_id, emoji, user_id')
        .in('post_id', postIds);
    
    if (error) throw error;
    
    // Build result map
    const result = {};
    
    postIds.forEach(id => {
        result[id] = {
            counts: Object.fromEntries(ALLOWED_EMOJIS.map(e => [e, 0])),
            userReactions: [],
            total: 0
        };
    });
    
    reactions?.forEach(r => {
        if (result[r.post_id]) {
            if (result[r.post_id].counts[r.emoji] !== undefined) {
                result[r.post_id].counts[r.emoji]++;
                result[r.post_id].total++;
            }
            if (r.user_id === user.id) {
                result[r.post_id].userReactions.push(r.emoji);
            }
        }
    });
    
    return res.json({ reactions: result });
}

// ===== POST - Add reaction =====

async function handleAddReaction(req, res, user) {
    const { post_id, emoji } = req.body;
    
    // Validate inputs
    if (!post_id || !emoji) {
        return res.status(400).json({ error: 'post_id et emoji requis' });
    }
    
    if (!isValidUUID(post_id)) {
        return res.status(400).json({ error: 'Format post_id invalide' });
    }
    
    if (!ALLOWED_EMOJIS.includes(emoji)) {
        return res.status(400).json({ 
            error: 'Emoji non supporté',
            allowed: ALLOWED_EMOJIS
        });
    }
    
    // Check post exists
    const { data: post } = await supabase
        .from('posts')
        .select('id')
        .eq('id', post_id)
        .single();
    
    if (!post) {
        return res.status(404).json({ error: 'Post non trouvé' });
    }
    
    // Check if already reacted with this emoji
    const { data: existing } = await supabase
        .from('post_reactions')
        .select('id')
        .eq('post_id', post_id)
        .eq('user_id', user.id)
        .eq('emoji', emoji)
        .single();
    
    if (existing) {
        return res.status(409).json({ error: 'Tu as déjà réagi avec cet emoji' });
    }
    
    // Add reaction
    const { data: reaction, error } = await supabase
        .from('post_reactions')
        .insert({
            post_id,
            user_id: user.id,
            emoji
        })
        .select()
        .single();
    
    if (error) throw error;
    
    logInfo('Reaction added', { postId: post_id, userId: user.id, emoji });
    
    // Get updated counts
    const counts = await getReactionCounts(post_id);
    
    return res.status(201).json({
        success: true,
        reaction,
        counts
    });
}

// ===== DELETE - Remove reaction =====

async function handleRemoveReaction(req, res, user) {
    const { post_id, emoji } = req.query;
    
    if (!post_id || !emoji) {
        return res.status(400).json({ error: 'post_id et emoji requis' });
    }
    
    if (!isValidUUID(post_id)) {
        return res.status(400).json({ error: 'Format post_id invalide' });
    }
    
    // Decode emoji from URL
    const decodedEmoji = decodeURIComponent(emoji);
    
    if (!ALLOWED_EMOJIS.includes(decodedEmoji)) {
        return res.status(400).json({ error: 'Emoji non supporté' });
    }
    
    // Delete reaction
    const { error, count } = await supabase
        .from('post_reactions')
        .delete()
        .eq('post_id', post_id)
        .eq('user_id', user.id)
        .eq('emoji', decodedEmoji);
    
    if (error) throw error;
    
    // Get updated counts
    const counts = await getReactionCounts(post_id);
    
    return res.json({
        success: true,
        removed: count > 0,
        counts
    });
}

// ===== Helper =====

async function getReactionCounts(postId) {
    const { data: reactions } = await supabase
        .from('post_reactions')
        .select('emoji')
        .eq('post_id', postId);
    
    const counts = Object.fromEntries(ALLOWED_EMOJIS.map(e => [e, 0]));
    
    reactions?.forEach(r => {
        if (counts[r.emoji] !== undefined) {
            counts[r.emoji]++;
        }
    });
    
    return counts;
}
