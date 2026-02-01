/**
 * Tags API - Hashtag system for Cinq
 * 
 * Endpoints:
 * - GET ?t=xxx - Get posts with a specific tag
 * - GET /trending - Get trending tags (last 7 days)
 */

import { supabase, requireAuth, getUserInfo, handleCors } from './_supabase.js';
import { checkRateLimit, RATE_LIMITS } from './_rate-limit.js';
import { sanitizeText } from './_validation.js';
import { logError, createErrorResponse } from './_error-logger.js';

const MAX_FETCH_LIMIT = 50;
const DEFAULT_FETCH_LIMIT = 20;
const TRENDING_DAYS = 7;
const TRENDING_LIMIT = 10;

export default async function handler(req, res) {
    if (handleCors(req, res, ['GET', 'OPTIONS'])) return;

    const user = await requireAuth(req, res);
    if (!user) return;

    // Rate limiting
    if (!checkRateLimit(req, res, { ...RATE_LIMITS.READ, keyPrefix: 'tags', userId: user.id })) {
        return;
    }

    try {
        if (req.method === 'GET') {
            const { t, trending, limit, cursor } = req.query;
            
            // Get trending tags
            if (trending !== undefined) {
                return getTrendingTags(req, res, user);
            }
            
            // Get posts by tag
            if (t) {
                return getPostsByTag(req, res, user, t, limit, cursor);
            }
            
            return res.status(400).json({ error: 'Tag (t) or trending param required' });
        }

        return res.status(405).json({ error: 'Method not allowed' });

    } catch (e) {
        logError(e, {
            endpoint: '/api/tags',
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
 * Get posts by tag
 */
async function getPostsByTag(req, res, user, tag, limit, cursor) {
    // Normalize tag (lowercase, no #)
    const normalizedTag = normalizeTag(tag);
    
    if (!normalizedTag || normalizedTag.length < 1) {
        return res.status(400).json({ error: 'Tag invalide' });
    }
    
    const safeLimit = Math.min(Math.max(1, parseInt(limit) || DEFAULT_FETCH_LIMIT), MAX_FETCH_LIMIT);
    
    // Get contact IDs for visibility filtering
    const { data: contacts } = await supabase
        .from('contacts')
        .select('contact_user_id')
        .eq('user_id', user.id);
    
    const contactIds = contacts?.map(c => c.contact_user_id) || [];
    const visibleUserIds = [user.id, ...contactIds];
    
    // Build query - get post_ids with this tag
    let query = supabase
        .from('post_tags')
        .select(`
            post_id,
            created_at,
            posts!inner(
                id,
                user_id,
                content,
                image_url,
                created_at
            )
        `)
        .eq('tag', normalizedTag)
        .in('posts.user_id', visibleUserIds)
        .order('created_at', { ascending: false });
    
    // Cursor-based pagination
    if (cursor) {
        try {
            const cursorDate = new Date(cursor);
            if (!isNaN(cursorDate.getTime())) {
                query = query.lt('created_at', cursorDate.toISOString());
            }
        } catch { /* ignore invalid cursor */ }
    }
    
    query = query.limit(safeLimit);
    
    const { data, error } = await query;
    
    if (error) throw error;
    
    // Extract posts and enrich with author info
    const authorCache = {};
    const posts = await Promise.all((data || []).map(async (row) => {
        const post = row.posts;
        if (!authorCache[post.user_id]) {
            authorCache[post.user_id] = await getUserInfo(post.user_id);
        }
        return { ...post, author: authorCache[post.user_id] };
    }));
    
    // Generate next cursor
    const nextCursor = data && data.length === safeLimit && data.length > 0
        ? data[data.length - 1].created_at
        : null;
    
    return res.json({
        tag: normalizedTag,
        posts,
        count: posts.length,
        nextCursor,
        hasMore: (data?.length || 0) === safeLimit
    });
}

/**
 * Get trending tags (most used in last N days)
 */
async function getTrendingTags(req, res, user) {
    // Get contact IDs for visibility filtering
    const { data: contacts } = await supabase
        .from('contacts')
        .select('contact_user_id')
        .eq('user_id', user.id);
    
    const contactIds = contacts?.map(c => c.contact_user_id) || [];
    const visibleUserIds = [user.id, ...contactIds];
    
    // Calculate date threshold
    const since = new Date();
    since.setDate(since.getDate() - TRENDING_DAYS);
    
    // Get tag counts - using raw query for aggregation
    const { data, error } = await supabase.rpc('get_trending_tags', {
        visible_user_ids: visibleUserIds,
        since_date: since.toISOString(),
        max_tags: TRENDING_LIMIT
    });
    
    // If RPC doesn't exist, fallback to manual query
    if (error && error.message.includes('function')) {
        // Fallback: fetch all recent tags and count manually
        const { data: tagData, error: fallbackError } = await supabase
            .from('post_tags')
            .select(`
                tag,
                posts!inner(user_id)
            `)
            .in('posts.user_id', visibleUserIds)
            .gte('created_at', since.toISOString());
        
        if (fallbackError) throw fallbackError;
        
        // Count tags manually
        const tagCounts = {};
        (tagData || []).forEach(row => {
            tagCounts[row.tag] = (tagCounts[row.tag] || 0) + 1;
        });
        
        // Sort by count and get top N
        const trending = Object.entries(tagCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, TRENDING_LIMIT)
            .map(([tag, count]) => ({ tag, count }));
        
        return res.json({ 
            trending,
            period: `${TRENDING_DAYS} jours`
        });
    }
    
    if (error) throw error;
    
    return res.json({
        trending: data || [],
        period: `${TRENDING_DAYS} jours`
    });
}

/**
 * Normalize a tag (lowercase, remove #, sanitize)
 */
export function normalizeTag(tag) {
    if (!tag || typeof tag !== 'string') return '';
    
    return tag
        .toLowerCase()
        .replace(/^#/, '')
        .replace(/[^\w\u00C0-\u017F]/g, '') // Keep alphanumeric + accented chars
        .substring(0, 50);
}

/**
 * Extract hashtags from content
 */
export function extractTags(content) {
    if (!content || typeof content !== 'string') return [];
    
    // Match #hashtag pattern (alphanumeric, underscore, accented chars)
    const tagRegex = /#([\w\u00C0-\u017F]{1,50})/g;
    const matches = [...content.matchAll(tagRegex)];
    
    // Dedupe and normalize
    const tags = [...new Set(matches.map(m => normalizeTag(m[1])))];
    
    // Limit to 10 tags per post
    return tags.filter(t => t.length > 0).slice(0, 10);
}

/**
 * Save tags for a post (called from posts.js)
 */
export async function savePostTags(postId, content) {
    const tags = extractTags(content);
    
    if (tags.length === 0) return;
    
    // Insert all tags
    const tagRecords = tags.map(tag => ({
        post_id: postId,
        tag
    }));
    
    const { error } = await supabase
        .from('post_tags')
        .upsert(tagRecords, { onConflict: 'post_id,tag' });
    
    if (error) {
        console.error('Error saving post tags:', error);
    }
    
    return tags;
}
