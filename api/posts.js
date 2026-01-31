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

const MAX_CONTENT_LENGTH = 1000;
const MAX_IMAGE_URL_LENGTH = 2000;
const MAX_FETCH_LIMIT = 100;
const DEFAULT_FETCH_LIMIT = 50;

export default async function handler(req, res) {
    if (handleCors(req, res, ['GET', 'POST', 'DELETE', 'OPTIONS'])) return;

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
    const { limit = 50, offset = 0, user_id } = req.query;
    
    // Specific user's posts
    if (user_id) {
        return getSpecificUserPosts(res, user, user_id, parseInt(limit), parseInt(offset));
    }
    
    // Default: feed (self + contacts)
    return getFeed(res, user, parseInt(limit), parseInt(offset));
}

async function getSpecificUserPosts(res, user, userId, limit, offset) {
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
    
    const { data: posts, error } = await supabase
        .from('posts')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);
    
    if (error) throw error;
    
    const authorInfo = await getUserInfo(userId);
    const enriched = posts.map(post => ({ ...post, author: authorInfo }));
    
    return res.json({ posts: enriched, count: posts.length });
}

async function getFeed(res, user, limit, offset) {
    // Get contact IDs
    const { data: contacts } = await supabase
        .from('contacts')
        .select('contact_user_id')
        .eq('user_id', user.id);
    
    const contactIds = contacts?.map(c => c.contact_user_id) || [];
    const allUserIds = [user.id, ...contactIds];
    
    // Get posts
    const { data: posts, error } = await supabase
        .from('posts')
        .select('*')
        .in('user_id', allUserIds)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);
    
    if (error) throw error;
    
    // Enrich with author info (cached)
    const authorCache = {};
    const enriched = await Promise.all(posts.map(async (post) => {
        if (!authorCache[post.user_id]) {
            authorCache[post.user_id] = await getUserInfo(post.user_id);
        }
        return { ...post, author: authorCache[post.user_id] };
    }));
    
    return res.json({ 
        posts: enriched, 
        count: posts.length,
        contactCount: contactIds.length
    });
}

// ===== POST - Create post =====

async function handleCreatePost(req, res, user) {
    const { content, image_url } = req.body;
    
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
    
    // Validate image URL
    const validatedImageUrl = validateImageUrl(image_url);
    if (validatedImageUrl.error) {
        return res.status(400).json({ error: validatedImageUrl.error });
    }
    
    // Create post
    const { data: post, error } = await supabase
        .from('posts')
        .insert({
            user_id: user.id,
            content: sanitizedContent,
            image_url: validatedImageUrl.url
        })
        .select()
        .single();
    
    if (error) throw error;
    
    const authorInfo = await getUserInfo(user.id);
    
    logInfo('Post created', { postId: post.id, userId: user.id });
    
    return res.status(201).json({
        success: true,
        post: { ...post, author: authorInfo }
    });
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
