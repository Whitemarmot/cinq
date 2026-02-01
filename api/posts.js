/**
 * Posts API - Social feed for Cinq
 * 
 * Endpoints:
 * - GET / - Get feed (own posts + contacts)
 * - GET ?user_id=xxx - Get specific user's posts
 * - POST - Create new post
 * - DELETE ?id=xxx - Delete own post
 */

import { supabase, requireAuth, getUserInfo, handleCors } from './_supabase.js';
import { checkRateLimit, RATE_LIMITS } from './_rate-limit.js';
import { isValidUUID, sanitizeText } from './_validation.js';
import { logError, logInfo, createErrorResponse } from './_error-logger.js';
import { processMentions } from './notifications.js';
import { savePostTags } from './tags.js';

const MAX_CONTENT_LENGTH = 1000;
const MAX_IMAGE_URL_LENGTH = 2000;
const MAX_FETCH_LIMIT = 100;
const DEFAULT_FETCH_LIMIT = 50;
const MIN_POLL_OPTIONS = 2;
const MAX_POLL_OPTIONS = 4;
const MAX_POLL_OPTION_LENGTH = 100;
const MAX_REPLY_DEPTH = 1; // Only allow direct replies, no nested threads

export default async function handler(req, res) {
    if (handleCors(req, res, ['GET', 'POST', 'DELETE', 'PATCH', 'OPTIONS'])) return;

    const user = await requireAuth(req, res);
    if (!user) return;

    // Rate limiting
    const rateLimitConfig = req.method === 'GET' ? RATE_LIMITS.READ : RATE_LIMITS.CREATE;
    if (!checkRateLimit(req, res, { ...rateLimitConfig, keyPrefix: 'posts', userId: user.id })) {
        return;
    }

    try {
        if (req.method === 'GET') {
            return handleGetPosts(req, res, user);
        }

        if (req.method === 'POST') {
            return handleCreatePost(req, res, user);
        }

        if (req.method === 'DELETE') {
            return handleDeletePost(req, res, user);
        }
        
        if (req.method === 'PATCH') {
            return handlePollVote(req, res, user);
        }

        return res.status(405).json({ error: 'Method not allowed' });

    } catch (e) {
        logError(e, {
            endpoint: '/api/posts',
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

// ===== GET - List posts =====

async function handleGetPosts(req, res, user) {
    const { limit, offset, user_id, cursor, parent_id } = req.query;
    
    // Parse and validate pagination params
    const safeLimit = Math.min(Math.max(1, parseInt(limit) || DEFAULT_FETCH_LIMIT), MAX_FETCH_LIMIT);
    const safeOffset = Math.max(0, parseInt(offset) || 0);
    
    // Parse cursor (ISO date string for cursor-based pagination)
    const parsedCursor = cursor ? parseCursor(cursor) : null;
    
    // Get replies to a specific post
    if (parent_id) {
        return getReplies(res, user, parent_id, safeLimit, safeOffset, parsedCursor);
    }
    
    // Specific user's posts
    if (user_id) {
        return getSpecificUserPosts(res, user, user_id, safeLimit, safeOffset, parsedCursor);
    }
    
    // Default: feed (self + contacts)
    return getFeed(res, user, safeLimit, safeOffset, parsedCursor);
}

/**
 * Parse cursor string (ISO date) for pagination
 */
function parseCursor(cursorStr) {
    if (!cursorStr) return null;
    
    try {
        // Cursor is the created_at of the last post
        const date = new Date(cursorStr);
        if (isNaN(date.getTime())) return null;
        return date.toISOString();
    } catch {
        return null;
    }
}

/**
 * Get replies to a specific post
 */
async function getReplies(res, user, parentId, limit, offset, cursor = null) {
    if (!isValidUUID(parentId)) {
        return res.status(400).json({ error: 'Format parent_id invalide' });
    }
    
    // Verify the parent post exists
    const { data: parentPost, error: parentError } = await supabase
        .from('posts')
        .select('id, user_id')
        .eq('id', parentId)
        .single();
    
    if (parentError || !parentPost) {
        return res.status(404).json({ error: 'Post parent non trouvé' });
    }
    
    // Build query for replies
    let query = supabase
        .from('posts')
        .select('*')
        .eq('parent_id', parentId)
        .order('created_at', { ascending: true }); // Oldest first for thread readability
    
    // Cursor-based pagination
    if (cursor) {
        query = query.gt('created_at', cursor);
    } else if (offset > 0) {
        query = query.range(offset, offset + limit - 1);
    }
    
    query = query.limit(limit);
    
    const { data: replies, error } = await query;
    
    if (error) throw error;
    
    // Get user's poll votes for these replies
    const replyIds = replies.map(r => r.id);
    const userPollVotes = await getUserPollVotes(user.id, replyIds);
    
    // Enrich with author info
    const authorCache = {};
    const enriched = await Promise.all(replies.map(async (reply) => {
        if (!authorCache[reply.user_id]) {
            authorCache[reply.user_id] = await getUserInfo(reply.user_id);
        }
        const enrichedReply = { ...reply, author: authorCache[reply.user_id] };
        if (reply.poll_options) {
            enrichedReply.user_poll_vote = userPollVotes[reply.id] ?? null;
            enrichedReply.poll_total_votes = reply.poll_votes 
                ? Object.values(reply.poll_votes).reduce((sum, c) => sum + c, 0) 
                : 0;
        }
        return enrichedReply;
    }));
    
    // Generate next cursor (created_at of last reply)
    const nextCursor = replies.length === limit && replies.length > 0 
        ? replies[replies.length - 1].created_at 
        : null;
    
    return res.json({ 
        replies: enriched, 
        count: replies.length,
        parentId,
        nextCursor,
        hasMore: replies.length === limit
    });
}

async function getSpecificUserPosts(res, user, userId, limit, offset, cursor = null) {
    if (!isValidUUID(userId)) {
        return res.status(400).json({ error: 'Format user_id invalide' });
    }
    
    // Check access: must be self or contact
    if (userId !== user.id) {
        const { data: contact } = await supabase
            .from('contacts')
            .select('id')
            .eq('user_id', user.id)
            .eq('contact_user_id', userId)
            .single();
        
        if (!contact) {
            return res.status(403).json({ error: 'Tu ne peux voir que les posts de tes contacts' });
        }
    }
    
    // Build query - exclude replies (only show root posts)
    let query = supabase
        .from('posts')
        .select('*')
        .eq('user_id', userId)
        .is('parent_id', null)
        .order('created_at', { ascending: false });
    
    // Cursor-based pagination (preferred) or offset-based
    if (cursor) {
        query = query.lt('created_at', cursor);
    } else if (offset > 0) {
        query = query.range(offset, offset + limit - 1);
    }
    
    // Always limit results
    query = query.limit(limit);
    
    const { data: posts, error } = await query;
    
    if (error) throw error;
    
    const authorInfo = await getUserInfo(userId);
    
    // Get user's poll votes for these posts
    const postIds = posts.map(p => p.id);
    const userPollVotes = await getUserPollVotes(user.id, postIds);
    
    // Get reply counts for all posts
    const replyCounts = await getReplyCountsForPosts(postIds);
    
    const enriched = posts.map(post => {
        const enrichedPost = { 
            ...post, 
            author: authorInfo,
            reply_count: replyCounts[post.id] || 0
        };
        if (post.poll_options) {
            enrichedPost.user_poll_vote = userPollVotes[post.id] ?? null;
            enrichedPost.poll_total_votes = post.poll_votes 
                ? Object.values(post.poll_votes).reduce((sum, c) => sum + c, 0) 
                : 0;
        }
        return enrichedPost;
    });
    
    // Generate next cursor (created_at of last post)
    const nextCursor = posts.length === limit && posts.length > 0 
        ? posts[posts.length - 1].created_at 
        : null;
    
    return res.json({ 
        posts: enriched, 
        count: posts.length,
        nextCursor,
        hasMore: posts.length === limit
    });
}

async function getFeed(res, user, limit, offset, cursor = null) {
    // Get contact IDs
    const { data: contacts } = await supabase
        .from('contacts')
        .select('contact_user_id')
        .eq('user_id', user.id);
    
    const contactIds = contacts?.map(c => c.contact_user_id) || [];
    const allUserIds = [user.id, ...contactIds];
    
    // Build query - exclude replies (only show root posts)
    let query = supabase
        .from('posts')
        .select('*')
        .in('user_id', allUserIds)
        .is('parent_id', null)
        .order('created_at', { ascending: false });
    
    // Cursor-based pagination (preferred) or offset-based fallback
    if (cursor) {
        // Get posts older than cursor
        query = query.lt('created_at', cursor);
    } else if (offset > 0) {
        // Fallback to offset for backwards compat
        query = query.range(offset, offset + limit - 1);
    }
    
    // Always limit results
    query = query.limit(limit);
    
    const { data: posts, error } = await query;
    
    if (error) throw error;
    
    // Get user's poll votes for these posts
    const postIds = posts.map(p => p.id);
    const userPollVotes = await getUserPollVotes(user.id, postIds);
    
    // Get reply counts for all posts
    const replyCounts = await getReplyCountsForPosts(postIds);
    
    // Enrich with author info (cached)
    const authorCache = {};
    const enriched = await Promise.all(posts.map(async (post) => {
        if (!authorCache[post.user_id]) {
            authorCache[post.user_id] = await getUserInfo(post.user_id);
        }
        const enrichedPost = { 
            ...post, 
            author: authorCache[post.user_id],
            reply_count: replyCounts[post.id] || 0
        };
        if (post.poll_options) {
            enrichedPost.user_poll_vote = userPollVotes[post.id] ?? null;
            enrichedPost.poll_total_votes = post.poll_votes 
                ? Object.values(post.poll_votes).reduce((sum, c) => sum + c, 0) 
                : 0;
        }
        return enrichedPost;
    }));
    
    // Generate next cursor (created_at of last post)
    const nextCursor = posts.length === limit && posts.length > 0 
        ? posts[posts.length - 1].created_at 
        : null;
    
    return res.json({ 
        posts: enriched, 
        count: posts.length,
        contactCount: contactIds.length,
        nextCursor,
        hasMore: posts.length === limit
    });
}

/**
 * Get reply counts for a list of post IDs
 * @returns {Object} { postId: replyCount }
 */
async function getReplyCountsForPosts(postIds) {
    if (!postIds || postIds.length === 0) return {};
    
    // Use a raw SQL query for efficient counting
    const { data, error } = await supabase
        .from('posts')
        .select('parent_id')
        .in('parent_id', postIds);
    
    if (error || !data) return {};
    
    // Count replies per parent
    const counts = {};
    data.forEach(row => {
        counts[row.parent_id] = (counts[row.parent_id] || 0) + 1;
    });
    
    return counts;
}

/**
 * Get user's poll votes for a list of posts
 * @returns {Object} { postId: optionIndex }
 */
async function getUserPollVotes(userId, postIds) {
    if (!postIds || postIds.length === 0) return {};
    
    const { data: votes } = await supabase
        .from('poll_votes')
        .select('post_id, option_index')
        .eq('user_id', userId)
        .in('post_id', postIds);
    
    if (!votes) return {};
    
    return votes.reduce((acc, vote) => {
        acc[vote.post_id] = vote.option_index;
        return acc;
    }, {});
}

// ===== POST - Create post =====

async function handleCreatePost(req, res, user) {
    const { content, image_url, is_gif, poll_options, parent_id } = req.body;
    
    // Validate content
    if (!content || typeof content !== 'string') {
        return res.status(400).json({ error: 'Contenu requis' });
    }
    
    // Sanitize content - removes dangerous characters and trims
    const sanitizedContent = sanitizeText(content, { 
        maxLength: MAX_CONTENT_LENGTH, 
        allowNewlines: true 
    });
    
    if (sanitizedContent.length === 0) {
        return res.status(400).json({ error: 'Le contenu ne peut pas être vide' });
    }
    
    // Validate parent_id if replying to a post
    let parentPost = null;
    if (parent_id) {
        if (!isValidUUID(parent_id)) {
            return res.status(400).json({ error: 'Format parent_id invalide' });
        }
        
        // Check parent post exists
        const { data: parent, error: parentError } = await supabase
            .from('posts')
            .select('id, user_id, parent_id')
            .eq('id', parent_id)
            .single();
        
        if (parentError || !parent) {
            return res.status(404).json({ error: 'Post parent non trouvé' });
        }
        
        // Prevent nested replies (replies to replies)
        if (parent.parent_id !== null) {
            return res.status(400).json({ error: 'Les réponses imbriquées ne sont pas autorisées' });
        }
        
        parentPost = parent;
    }
    
    // Validate image URL
    const validatedImageUrl = validateImageUrl(image_url);
    if (validatedImageUrl.error) {
        return res.status(400).json({ error: validatedImageUrl.error });
    }
    
    // Validate poll options if provided (not allowed in replies)
    if (parent_id && poll_options) {
        return res.status(400).json({ error: 'Les sondages ne sont pas autorisés dans les réponses' });
    }
    
    const validatedPollOptions = validatePollOptions(poll_options);
    if (validatedPollOptions.error) {
        return res.status(400).json({ error: validatedPollOptions.error });
    }
    
    // Build post data
    const postData = {
        user_id: user.id,
        content: sanitizedContent,
        image_url: validatedImageUrl.url,
        is_gif: !!is_gif && !!validatedImageUrl.url, // Only set is_gif if there's actually an image
        parent_id: parent_id || null
    };
    
    // Add poll options if valid
    if (validatedPollOptions.options) {
        postData.poll_options = validatedPollOptions.options;
        postData.poll_votes = {}; // Initialize empty votes object {optionIndex: count}
    }
    
    // Create post
    const { data: post, error } = await supabase
        .from('posts')
        .insert(postData)
        .select()
        .single();
    
    if (error) throw error;
    
    const authorInfo = await getUserInfo(user.id);
    
    // Process @mentions and create notifications (fire and forget)
    const mentionType = parent_id ? 'reply_mention' : 'post_mention';
    processMentions(sanitizedContent, user.id, mentionType, post.id)
        .catch(e => logError(e, { context: 'processMentions', postId: post.id }));
    
    // If this is a reply, notify the parent post author (if not self)
    if (parentPost && parentPost.user_id !== user.id) {
        createReplyNotification(parentPost.user_id, user.id, post.id, parent_id)
            .catch(e => logError(e, { context: 'createReplyNotification', postId: post.id }));
    }
    
    // Extract and save hashtags (fire and forget)
    savePostTags(post.id, sanitizedContent)
        .catch(e => logError(e, { context: 'savePostTags', postId: post.id }));
    
    logInfo('Post created', { 
        postId: post.id, 
        userId: user.id, 
        hasPoll: !!validatedPollOptions.options,
        isReply: !!parent_id,
        parentId: parent_id || null
    });
    
    // Add poll metadata for response
    const responsePost = { ...post, author: authorInfo, reply_count: 0 };
    if (post.poll_options) {
        responsePost.poll_total_votes = 0;
        responsePost.user_poll_vote = null;
    }
    
    return res.status(201).json({
        success: true,
        post: responsePost
    });
}

/**
 * Create a notification for a reply to a post
 */
async function createReplyNotification(recipientId, senderId, replyId, parentPostId) {
    try {
        await supabase
            .from('notifications')
            .insert({
                user_id: recipientId,
                type: 'reply',
                from_user_id: senderId,
                post_id: replyId,
                related_post_id: parentPostId
            });
    } catch (e) {
        logError(e, { context: 'createReplyNotification' });
    }
}

function validatePollOptions(pollOptions) {
    if (!pollOptions) return { options: null };
    
    if (!Array.isArray(pollOptions)) {
        return { error: 'Les options de sondage doivent être un tableau' };
    }
    
    if (pollOptions.length < MIN_POLL_OPTIONS || pollOptions.length > MAX_POLL_OPTIONS) {
        return { error: `Le sondage doit avoir entre ${MIN_POLL_OPTIONS} et ${MAX_POLL_OPTIONS} options` };
    }
    
    const sanitizedOptions = [];
    for (const option of pollOptions) {
        if (typeof option !== 'string') {
            return { error: 'Chaque option doit être du texte' };
        }
        
        const sanitized = sanitizeText(option, { maxLength: MAX_POLL_OPTION_LENGTH });
        if (sanitized.length === 0) {
            return { error: 'Les options ne peuvent pas être vides' };
        }
        
        sanitizedOptions.push(sanitized);
    }
    
    // Check for duplicates
    const uniqueOptions = new Set(sanitizedOptions.map(o => o.toLowerCase()));
    if (uniqueOptions.size !== sanitizedOptions.length) {
        return { error: 'Les options doivent être uniques' };
    }
    
    return { options: sanitizedOptions };
}

function validateImageUrl(imageUrl) {
    if (!imageUrl) return { url: null };
    
    if (typeof imageUrl !== 'string' || imageUrl.length > MAX_IMAGE_URL_LENGTH) {
        return { error: 'URL image invalide' };
    }
    
    try {
        const url = new URL(imageUrl);
        if (!['http:', 'https:'].includes(url.protocol)) {
            return { error: 'URL image doit être HTTP ou HTTPS' };
        }
        return { url: imageUrl };
    } catch {
        return { error: 'Format URL image invalide' };
    }
}

// ===== DELETE - Remove post =====

async function handleDeletePost(req, res, user) {
    const postId = req.query.id;
    
    if (!postId) {
        return res.status(400).json({ error: 'id requis' });
    }
    
    if (!isValidUUID(postId)) {
        return res.status(400).json({ error: 'Format id invalide' });
    }
    
    // Verify ownership
    const { data: existing } = await supabase
        .from('posts')
        .select('id, user_id')
        .eq('id', postId)
        .single();
    
    if (!existing) {
        return res.status(404).json({ error: 'Post non trouvé' });
    }
    
    if (existing.user_id !== user.id) {
        return res.status(403).json({ error: 'Tu ne peux supprimer que tes propres posts' });
    }
    
    const { error } = await supabase
        .from('posts')
        .delete()
        .eq('id', postId)
        .eq('user_id', user.id);
    
    if (error) throw error;
    
    return res.json({ success: true });
}

// ===== PATCH - Vote on poll =====

async function handlePollVote(req, res, user) {
    const { action } = req.query;
    
    if (action !== 'vote') {
        return res.status(400).json({ error: 'Action invalide' });
    }
    
    const { post_id, option_index } = req.body;
    
    if (!post_id || !isValidUUID(post_id)) {
        return res.status(400).json({ error: 'post_id invalide' });
    }
    
    if (typeof option_index !== 'number' || option_index < 0) {
        return res.status(400).json({ error: 'option_index invalide' });
    }
    
    // Get the post
    const { data: post, error: postError } = await supabase
        .from('posts')
        .select('*')
        .eq('id', post_id)
        .single();
    
    if (postError || !post) {
        return res.status(404).json({ error: 'Post non trouvé' });
    }
    
    // Check if post has a poll
    if (!post.poll_options || !Array.isArray(post.poll_options)) {
        return res.status(400).json({ error: 'Ce post n\'a pas de sondage' });
    }
    
    // Check if option_index is valid
    if (option_index >= post.poll_options.length) {
        return res.status(400).json({ error: 'Option invalide' });
    }
    
    // Check if user already voted
    const { data: existingVote } = await supabase
        .from('poll_votes')
        .select('id')
        .eq('post_id', post_id)
        .eq('user_id', user.id)
        .single();
    
    if (existingVote) {
        return res.status(400).json({ error: 'Tu as déjà voté sur ce sondage' });
    }
    
    // Record the vote
    const { error: voteError } = await supabase
        .from('poll_votes')
        .insert({
            post_id,
            user_id: user.id,
            option_index
        });
    
    if (voteError) throw voteError;
    
    // Update the aggregated votes on the post
    const currentVotes = post.poll_votes || {};
    currentVotes[option_index] = (currentVotes[option_index] || 0) + 1;
    
    const { error: updateError } = await supabase
        .from('posts')
        .update({ poll_votes: currentVotes })
        .eq('id', post_id);
    
    if (updateError) throw updateError;
    
    // Calculate total votes
    const totalVotes = Object.values(currentVotes).reduce((sum, count) => sum + count, 0);
    
    logInfo('Poll vote recorded', { postId: post_id, userId: user.id, optionIndex: option_index });
    
    return res.json({
        success: true,
        poll: {
            votes: currentVotes,
            userVote: option_index,
            totalVotes
        }
    });
}
