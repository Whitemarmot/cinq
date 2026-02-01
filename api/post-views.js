/**
 * Post Views API - "Seen by" feature for Cinq
 * 
 * Track who viewed posts (limited to recent posts < 24h)
 * 
 * Endpoints:
 * - GET ?post_id=xxx - Get viewers for a post (only for post owner)
 * - POST - Mark a post as viewed
 * - POST (batch) - Mark multiple posts as viewed
 */

import { supabase, requireAuth, getUserInfo, handleCors } from './_supabase.js';
import { checkRateLimit, RATE_LIMITS } from './_rate-limit.js';
import { isValidUUID } from './_validation.js';
import { logError, logInfo, createErrorResponse } from './_error-logger.js';

const MAX_HOURS_FOR_VIEWS = 24; // Only track views for posts < 24h old
const MAX_BATCH_SIZE = 50;

export default async function handler(req, res) {
    if (handleCors(req, res, ['GET', 'POST', 'OPTIONS'])) return;

    const user = await requireAuth(req, res);
    if (!user) return;

    // Rate limiting
    const rateLimitConfig = req.method === 'GET' ? RATE_LIMITS.READ : RATE_LIMITS.CREATE;
    if (!checkRateLimit(req, res, { ...rateLimitConfig, keyPrefix: 'post-views', userId: user.id })) {
        return;
    }

    try {
        if (req.method === 'GET') {
            return handleGetViewers(req, res, user);
        }

        if (req.method === 'POST') {
            return handleMarkViewed(req, res, user);
        }

        return res.status(405).json({ error: 'Method not allowed' });

    } catch (e) {
        logError(e, {
            endpoint: '/api/post-views',
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

/**
 * Check if a post is recent enough to show views (< 24h)
 */
function isRecentPost(createdAt) {
    const postDate = new Date(createdAt);
    const now = new Date();
    const diffMs = now - postDate;
    const diffHours = diffMs / (1000 * 60 * 60);
    return diffHours < MAX_HOURS_FOR_VIEWS;
}

/**
 * GET - Get viewers for a specific post (only for post owner)
 */
async function handleGetViewers(req, res, user) {
    const { post_id } = req.query;
    
    if (!post_id || !isValidUUID(post_id)) {
        return res.status(400).json({ error: 'post_id invalide' });
    }
    
    // Get the post
    const { data: post, error: postError } = await supabase
        .from('posts')
        .select('id, user_id, created_at')
        .eq('id', post_id)
        .single();
    
    if (postError || !post) {
        return res.status(404).json({ error: 'Post non trouvé' });
    }
    
    // Only post owner can see viewers
    if (post.user_id !== user.id) {
        return res.status(403).json({ error: 'Seul l\'auteur peut voir les vues' });
    }
    
    // Check if post is recent enough
    if (!isRecentPost(post.created_at)) {
        return res.json({ 
            viewers: [], 
            count: 0, 
            expired: true,
            message: 'Les vues ne sont visibles que pour les posts de moins de 24h' 
        });
    }
    
    // Get viewers
    const { data: views, error } = await supabase
        .from('post_views')
        .select('viewer_id, viewed_at')
        .eq('post_id', post_id)
        .order('viewed_at', { ascending: false });
    
    if (error) throw error;
    
    // Enrich with viewer info (exclude self)
    const viewersWithInfo = await Promise.all(
        views
            .filter(v => v.viewer_id !== user.id) // Don't show self
            .map(async (view) => {
                const viewerInfo = await getUserInfo(view.viewer_id);
                return {
                    ...view,
                    viewer: viewerInfo
                };
            })
    );
    
    return res.json({
        viewers: viewersWithInfo,
        count: viewersWithInfo.length,
        expired: false
    });
}

/**
 * POST - Mark post(s) as viewed
 */
async function handleMarkViewed(req, res, user) {
    const { post_id, post_ids } = req.body;
    
    // Support single or batch
    let postIdsToMark = [];
    
    if (post_ids && Array.isArray(post_ids)) {
        // Batch mode
        postIdsToMark = post_ids.filter(id => isValidUUID(id)).slice(0, MAX_BATCH_SIZE);
    } else if (post_id && isValidUUID(post_id)) {
        // Single mode
        postIdsToMark = [post_id];
    } else {
        return res.status(400).json({ error: 'post_id ou post_ids requis' });
    }
    
    if (postIdsToMark.length === 0) {
        return res.status(400).json({ error: 'Aucun post_id valide fourni' });
    }
    
    // Get posts to check if they're recent and not owned by viewer
    const { data: posts, error: postsError } = await supabase
        .from('posts')
        .select('id, user_id, created_at')
        .in('id', postIdsToMark);
    
    if (postsError) throw postsError;
    
    // Filter to recent posts not owned by the viewer
    const validPostIds = posts
        .filter(p => p.user_id !== user.id && isRecentPost(p.created_at))
        .map(p => p.id);
    
    if (validPostIds.length === 0) {
        return res.json({ 
            success: true, 
            marked: 0,
            message: 'Aucun post éligible pour le tracking des vues' 
        });
    }
    
    // Insert views (ignore conflicts)
    const viewsToInsert = validPostIds.map(id => ({
        post_id: id,
        viewer_id: user.id,
        viewed_at: new Date().toISOString()
    }));
    
    const { error: insertError } = await supabase
        .from('post_views')
        .upsert(viewsToInsert, { 
            onConflict: 'post_id,viewer_id',
            ignoreDuplicates: true 
        });
    
    if (insertError) throw insertError;
    
    logInfo('Post views marked', { 
        userId: user.id, 
        postCount: validPostIds.length 
    });
    
    return res.json({
        success: true,
        marked: validPostIds.length
    });
}

/**
 * Get view counts and viewer preview for multiple posts
 * Used internally by the posts API
 */
export async function getPostViewsForOwner(userId, postIds) {
    if (!postIds || postIds.length === 0) return {};
    
    try {
        // Get posts owned by user
        const { data: ownPosts } = await supabase
            .from('posts')
            .select('id, created_at')
            .eq('user_id', userId)
            .in('id', postIds);
        
        if (!ownPosts || ownPosts.length === 0) return {};
        
        // Filter to recent posts only
        const recentOwnPostIds = ownPosts
            .filter(p => isRecentPost(p.created_at))
            .map(p => p.id);
        
        if (recentOwnPostIds.length === 0) return {};
        
        // Get view counts and some viewers
        const { data: views, error } = await supabase
            .from('post_views')
            .select('post_id, viewer_id, viewed_at')
            .in('post_id', recentOwnPostIds)
            .neq('viewer_id', userId) // Exclude self
            .order('viewed_at', { ascending: false });
        
        if (error || !views) return {};
        
        // Group by post
        const result = {};
        const viewerIdsToFetch = new Set();
        
        for (const view of views) {
            if (!result[view.post_id]) {
                result[view.post_id] = {
                    count: 0,
                    viewers: [],
                    viewerIds: []
                };
            }
            result[view.post_id].count++;
            if (result[view.post_id].viewerIds.length < 5) {
                result[view.post_id].viewerIds.push(view.viewer_id);
                viewerIdsToFetch.add(view.viewer_id);
            }
        }
        
        // Fetch viewer info
        const viewerInfoCache = {};
        for (const viewerId of viewerIdsToFetch) {
            viewerInfoCache[viewerId] = await getUserInfo(viewerId);
        }
        
        // Populate viewer info
        for (const postId of Object.keys(result)) {
            result[postId].viewers = result[postId].viewerIds.map(id => viewerInfoCache[id]);
            delete result[postId].viewerIds;
        }
        
        return result;
    } catch (e) {
        logError(e, { context: 'getPostViewsForOwner', userId });
        return {};
    }
}

/**
 * Check if user has viewed a post
 */
export async function hasUserViewedPost(userId, postId) {
    try {
        const { data } = await supabase
            .from('post_views')
            .select('id')
            .eq('post_id', postId)
            .eq('viewer_id', userId)
            .single();
        
        return !!data;
    } catch {
        return false;
    }
}
