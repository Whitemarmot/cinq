/**
 * Stories API - Ephemeral stories (24h) for Cinq
 * 
 * Endpoints:
 * - GET / - Get active stories (own + contacts, not expired)
 * - POST - Create new story (image/text, expires in 24h)
 * - DELETE ?id=xxx - Delete own story
 */

import { supabase, requireAuth, getUserInfo, handleCors } from './_supabase.js';
import { checkRateLimit, RATE_LIMITS } from './_rate-limit.js';
import { isValidUUID, sanitizeText } from './_validation.js';
import { logError, logInfo, createErrorResponse } from './_error-logger.js';

const MAX_CONTENT_LENGTH = 500;
const MAX_IMAGE_URL_LENGTH = 2000;
const STORY_DURATION_HOURS = 24;

export default async function handler(req, res) {
    if (handleCors(req, res, ['GET', 'POST', 'DELETE', 'OPTIONS'])) return;

    const user = await requireAuth(req, res);
    if (!user) return;

    // Rate limiting
    const rateLimitConfig = req.method === 'GET' ? RATE_LIMITS.READ : RATE_LIMITS.CREATE;
    if (!checkRateLimit(req, res, { ...rateLimitConfig, keyPrefix: 'stories', userId: user.id })) {
        return;
    }

    try {
        if (req.method === 'GET') {
            return handleGetStories(req, res, user);
        }

        if (req.method === 'POST') {
            return handleCreateStory(req, res, user);
        }

        if (req.method === 'DELETE') {
            return handleDeleteStory(req, res, user);
        }

        return res.status(405).json({ error: 'Method not allowed' });

    } catch (e) {
        logError(e, {
            endpoint: '/api/stories',
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

// ===== GET - List active stories =====

async function handleGetStories(req, res, user) {
    // Get contact IDs
    const { data: contacts } = await supabase
        .from('contacts')
        .select('contact_user_id')
        .eq('user_id', user.id);
    
    const contactIds = contacts?.map(c => c.contact_user_id) || [];
    const allUserIds = [user.id, ...contactIds];
    
    // Get active (non-expired) stories from self + contacts
    const { data: stories, error } = await supabase
        .from('stories')
        .select('*')
        .in('user_id', allUserIds)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    // Enrich with author info
    const authorCache = {};
    const enriched = await Promise.all(stories.map(async (story) => {
        if (!authorCache[story.user_id]) {
            authorCache[story.user_id] = await getUserInfo(story.user_id);
        }
        return { 
            ...story, 
            author: authorCache[story.user_id],
            isOwn: story.user_id === user.id,
            timeRemaining: getTimeRemaining(story.expires_at)
        };
    }));
    
    // Group stories by user for story-ring UI
    const grouped = groupStoriesByUser(enriched);
    
    return res.json({ 
        stories: enriched,
        grouped,
        count: stories.length,
        contactCount: contactIds.length
    });
}

/**
 * Group stories by user for Instagram-like story rings
 */
function groupStoriesByUser(stories) {
    const groups = {};
    
    for (const story of stories) {
        const userId = story.user_id;
        if (!groups[userId]) {
            groups[userId] = {
                user: story.author,
                userId,
                stories: [],
                latestAt: story.created_at,
                isOwn: story.isOwn
            };
        }
        groups[userId].stories.push(story);
        
        // Track latest story time for sorting
        if (story.created_at > groups[userId].latestAt) {
            groups[userId].latestAt = story.created_at;
        }
    }
    
    // Sort: own stories first, then by latest story time
    return Object.values(groups).sort((a, b) => {
        if (a.isOwn && !b.isOwn) return -1;
        if (!a.isOwn && b.isOwn) return 1;
        return new Date(b.latestAt) - new Date(a.latestAt);
    });
}

/**
 * Calculate time remaining for story
 */
function getTimeRemaining(expiresAt) {
    const now = new Date();
    const expires = new Date(expiresAt);
    const diffMs = expires - now;
    
    if (diffMs <= 0) return null;
    
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
        return `${hours}h`;
    }
    return `${minutes}min`;
}

// ===== POST - Create story =====

async function handleCreateStory(req, res, user) {
    const { content, image_url, background_color } = req.body;
    
    // Must have either content or image
    if (!content && !image_url) {
        return res.status(400).json({ error: 'Contenu ou image requis' });
    }
    
    // Sanitize content if provided
    let sanitizedContent = null;
    if (content) {
        sanitizedContent = sanitizeText(content, { 
            maxLength: MAX_CONTENT_LENGTH, 
            allowNewlines: true 
        });
    }
    
    // Validate image URL if provided
    let validatedImageUrl = null;
    if (image_url) {
        const result = validateImageUrl(image_url);
        if (result.error) {
            return res.status(400).json({ error: result.error });
        }
        validatedImageUrl = result.url;
    }
    
    // Validate background color (hex)
    let validatedBgColor = null;
    if (background_color) {
        if (/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(background_color)) {
            validatedBgColor = background_color;
        }
    }
    
    // Calculate expiration (24 hours from now)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + STORY_DURATION_HOURS);
    
    // Create story
    const { data: story, error } = await supabase
        .from('stories')
        .insert({
            user_id: user.id,
            content: sanitizedContent,
            image_url: validatedImageUrl,
            background_color: validatedBgColor || '#1a1a2e',
            expires_at: expiresAt.toISOString()
        })
        .select()
        .single();
    
    if (error) throw error;
    
    const authorInfo = await getUserInfo(user.id);
    
    logInfo('Story created', { storyId: story.id, userId: user.id, expiresAt: story.expires_at });
    
    return res.status(201).json({
        success: true,
        story: { 
            ...story, 
            author: authorInfo,
            isOwn: true,
            timeRemaining: getTimeRemaining(story.expires_at)
        }
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

// ===== DELETE - Remove story =====

async function handleDeleteStory(req, res, user) {
    const storyId = req.query.id;
    
    if (!storyId) {
        return res.status(400).json({ error: 'id requis' });
    }
    
    if (!isValidUUID(storyId)) {
        return res.status(400).json({ error: 'Format id invalide' });
    }
    
    // Verify ownership
    const { data: existing } = await supabase
        .from('stories')
        .select('id, user_id')
        .eq('id', storyId)
        .single();
    
    if (!existing) {
        return res.status(404).json({ error: 'Story non trouvée' });
    }
    
    if (existing.user_id !== user.id) {
        return res.status(403).json({ error: 'Tu ne peux supprimer que tes propres stories' });
    }
    
    const { error } = await supabase
        .from('stories')
        .delete()
        .eq('id', storyId)
        .eq('user_id', user.id);
    
    if (error) throw error;
    
    logInfo('Story deleted', { storyId, userId: user.id });
    
    return res.json({ success: true });
}

// ===== Mark story as viewed =====
export async function markStoryViewed(storyId, viewerId) {
    try {
        // Insert view (ignore if already viewed)
        await supabase
            .from('story_views')
            .upsert({
                story_id: storyId,
                viewer_id: viewerId,
                viewed_at: new Date().toISOString()
            }, { onConflict: 'story_id,viewer_id' });
    } catch (e) {
        logError(e, { context: 'markStoryViewed', storyId, viewerId });
    }
}
