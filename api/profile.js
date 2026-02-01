/**
 * Public Profile API - View user profile and public posts
 * 
 * Endpoints:
 * - GET ?id=xxx - Get user public profile (name, bio, avatar, posts)
 */

import { supabase, handleCors } from './_supabase.js';
import { isValidUUID } from './_validation.js';
import { logError, createErrorResponse } from './_error-logger.js';

const MAX_PUBLIC_POSTS = 20;

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
        
        // Fetch user profile
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('id, display_name, avatar_url, bio, created_at')
            .eq('id', id)
            .eq('banned', false)
            .single();
        
        if (userError || !user) {
            return res.status(404).json({ error: 'Profil non trouvé' });
        }
        
        // Fetch user's public posts (most recent)
        const { data: posts, error: postsError } = await supabase
            .from('posts')
            .select('id, content, image_url, created_at')
            .eq('user_id', id)
            .order('created_at', { ascending: false })
            .limit(MAX_PUBLIC_POSTS);
        
        if (postsError) {
            throw postsError;
        }
        
        // Get contact count (public stat)
        const { count: contactCount } = await supabase
            .from('contacts')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', id);
        
        // Return public profile
        return res.json({
            profile: {
                id: user.id,
                display_name: user.display_name || 'Anonyme',
                avatar_url: user.avatar_url || null,
                bio: user.bio || null,
                created_at: user.created_at,
                stats: {
                    contactCount: contactCount || 0,
                    postCount: posts?.length || 0
                }
            },
            posts: posts || []
        });

    } catch (e) {
        logError(e, {
            endpoint: '/api/profile',
            method: req.method
        });
        return res.status(500).json(
            createErrorResponse(e, {
                includeDebug: process.env.NODE_ENV === 'development',
                hint: 'Impossible de charger le profil. Réessaie.'
            })
        );
    }
}
