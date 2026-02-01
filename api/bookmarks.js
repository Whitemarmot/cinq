/**
 * Bookmarks API - Save posts as favorites
 * 
 * Endpoints:
 * - GET / - Get user's bookmarked posts
 * - GET ?post_id=xxx - Check if post is bookmarked
 * - POST - Add bookmark { post_id }
 * - DELETE ?post_id=xxx - Remove bookmark
 */

import { supabase, requireAuth, getUserInfo, handleCors } from './_supabase.js';
import { checkRateLimit, RATE_LIMITS } from './_rate-limit.js';
import { isValidUUID } from './_validation.js';
import { logError, logInfo, createErrorResponse } from './_error-logger.js';

const MAX_FETCH_LIMIT = 100;
const DEFAULT_FETCH_LIMIT = 50;

export default async function handler(req, res) {
    if (handleCors(req, res, ['GET', 'POST', 'DELETE', 'OPTIONS'])) return;

    const user = await requireAuth(req, res);
    if (!user) return;

    // Rate limiting
    const rateLimitConfig = req.method === 'GET' ? RATE_LIMITS.READ : RATE_LIMITS.CREATE;
    if (!checkRateLimit(req, res, { ...rateLimitConfig, keyPrefix: 'bookmarks', userId: user.id })) {
        return;
    }

    try {
        if (req.method === 'GET') {
            return handleGetBookmarks(req, res, user);
        }

        if (req.method === 'POST') {
            return handleAddBookmark(req, res, user);
        }

        if (req.method === 'DELETE') {
            return handleRemoveBookmark(req, res, user);
        }

        return res.status(405).json({ error: 'Method not allowed' });

    } catch (e) {
        logError(e, {
            endpoint: '/api/bookmarks',
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

// ===== GET - List bookmarks or check status =====

async function handleGetBookmarks(req, res, user) {
    const { post_id, post_ids, limit, cursor } = req.query;
    
    // Check if specific post is bookmarked
    if (post_id) {
        if (!isValidUUID(post_id)) {
            return res.status(400).json({ error: 'Format post_id invalide' });
        }
        return checkBookmarkStatus(res, user, post_id);
    }
    
    // Batch check for multiple posts
    if (post_ids) {
        const ids = post_ids.split(',').filter(id => isValidUUID(id.trim()));
        if (ids.length === 0) {
            return res.status(400).json({ error: 'post_ids invalides' });
        }
        return getBatchBookmarkStatus(res, user, ids);
    }
    
    // List all bookmarks
    return listBookmarks(req, res, user);
}

async function checkBookmarkStatus(res, user, postId) {
    const { data: bookmark } = await supabase
        .from('bookmarks')
        .select('id')
        .eq('user_id', user.id)
        .eq('post_id', postId)
        .single();
    
    return res.json({
        post_id: postId,
        bookmarked: !!bookmark
    });
}

async function getBatchBookmarkStatus(res, user, postIds) {
    const { data: bookmarks, error } = await supabase
        .from('bookmarks')
        .select('post_id')
        .eq('user_id', user.id)
        .in('post_id', postIds);
    
    if (error) throw error;
    
    const bookmarkedIds = new Set(bookmarks?.map(b => b.post_id) || []);
    
    const result = {};
    postIds.forEach(id => {
        result[id] = bookmarkedIds.has(id);
    });
    
    return res.json({ bookmarks: result });
}

async function listBookmarks(req, res, user) {
    const { limit, cursor } = req.query;
    
    const safeLimit = Math.min(Math.max(1, parseInt(limit) || DEFAULT_FETCH_LIMIT), MAX_FETCH_LIMIT);
    
    // Build query - join with posts to get post data
    let query = supabase
        .from('bookmarks')
        .select(`
            id,
            created_at,
            post:posts (
                id,
                user_id,
                content,
                image_url,
                created_at
            )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
    
    // Cursor-based pagination
    if (cursor) {
        query = query.lt('created_at', cursor);
    }
    
    query = query.limit(safeLimit);
    
    const { data: bookmarks, error } = await query;
    
    if (error) throw error;
    
    // Filter out null posts (deleted posts)
    const validBookmarks = bookmarks?.filter(b => b.post) || [];
    
    // Enrich posts with author info
    const authorCache = {};
    const enrichedBookmarks = await Promise.all(validBookmarks.map(async (bookmark) => {
        const post = bookmark.post;
        if (!authorCache[post.user_id]) {
            authorCache[post.user_id] = await getUserInfo(post.user_id);
        }
        return {
            id: bookmark.id,
            bookmarked_at: bookmark.created_at,
            post: {
                ...post,
                author: authorCache[post.user_id]
            }
        };
    }));
    
    // Generate next cursor
    const nextCursor = validBookmarks.length === safeLimit && validBookmarks.length > 0
        ? validBookmarks[validBookmarks.length - 1].created_at
        : null;
    
    return res.json({
        bookmarks: enrichedBookmarks,
        count: enrichedBookmarks.length,
        nextCursor,
        hasMore: validBookmarks.length === safeLimit
    });
}

// ===== POST - Add bookmark =====

async function handleAddBookmark(req, res, user) {
    const { post_id } = req.body;
    
    if (!post_id) {
        return res.status(400).json({ error: 'post_id requis' });
    }
    
    if (!isValidUUID(post_id)) {
        return res.status(400).json({ error: 'Format post_id invalide' });
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
    
    // Check if already bookmarked
    const { data: existing } = await supabase
        .from('bookmarks')
        .select('id')
        .eq('user_id', user.id)
        .eq('post_id', post_id)
        .single();
    
    if (existing) {
        return res.status(409).json({ error: 'Post déjà en favoris' });
    }
    
    // Add bookmark
    const { data: bookmark, error } = await supabase
        .from('bookmarks')
        .insert({
            user_id: user.id,
            post_id
        })
        .select()
        .single();
    
    if (error) throw error;
    
    logInfo('Bookmark added', { postId: post_id, userId: user.id });
    
    return res.status(201).json({
        success: true,
        bookmark
    });
}

// ===== DELETE - Remove bookmark =====

async function handleRemoveBookmark(req, res, user) {
    const { post_id } = req.query;
    
    if (!post_id) {
        return res.status(400).json({ error: 'post_id requis' });
    }
    
    if (!isValidUUID(post_id)) {
        return res.status(400).json({ error: 'Format post_id invalide' });
    }
    
    const { error, count } = await supabase
        .from('bookmarks')
        .delete()
        .eq('user_id', user.id)
        .eq('post_id', post_id);
    
    if (error) throw error;
    
    logInfo('Bookmark removed', { postId: post_id, userId: user.id });
    
    return res.json({
        success: true,
        removed: count > 0
    });
}
