/**
 * Single Post API (Public) - For social sharing and OG metadata
 * 
 * Endpoints:
 * - GET ?id=xxx - Get a single post by ID (public, for OG/sharing)
 */

import { supabase, getUserInfo, handleCors } from './_supabase.js';
import { isValidUUID } from './_validation.js';
import { logError, createErrorResponse } from './_error-logger.js';

export default async function handler(req, res) {
    if (handleCors(req, res, ['GET', 'OPTIONS'])) return;

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { id } = req.query;
        
        if (!id) {
            return res.status(400).json({ error: 'id requis' });
        }
        
        if (!isValidUUID(id)) {
            return res.status(400).json({ error: 'Format id invalide' });
        }
        
        // Fetch the post
        const { data: post, error } = await supabase
            .from('posts')
            .select('*')
            .eq('id', id)
            .single();
        
        if (error || !post) {
            return res.status(404).json({ error: 'Post non trouvé' });
        }
        
        // Get author info
        const author = await getUserInfo(post.user_id);
        
        // Return post with author (public data only)
        return res.json({
            post: {
                id: post.id,
                content: post.content,
                image_url: post.image_url,
                created_at: post.created_at,
                author: {
                    display_name: author?.display_name || 'Anonyme',
                    avatar_url: author?.avatar_url || null
                }
            }
        });

    } catch (e) {
        logError(e, {
            endpoint: '/api/post',
            method: req.method
        });
        return res.status(500).json(
            createErrorResponse(e, {
                includeDebug: process.env.NODE_ENV === 'development'
            })
        );
    }
}
