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
        const { id, user: username } = req.query;
        
        // Support both id and username lookup
        if (!id && !username) {
            return res.status(400).json({ error: 'id ou user requis' });
        }
        
        let user;
        let userError;
        
        if (id) {
            // Lookup by UUID
            if (!isValidUUID(id)) {
                return res.status(400).json({ error: 'Format id invalide' });
            }
            
            const result = await supabase
                .from('users')
                .select('id, display_name, avatar_url, bio, created_at')
                .eq('id', id)
                .eq('banned', false)
                .single();
            user = result.data;
            userError = result.error;
        } else if (username) {
            // Lookup by username (display_name or email prefix)
            // First try display_name (case-insensitive)
            let result = await supabase
                .from('users')
                .select('id, display_name, avatar_url, bio, created_at')
                .ilike('display_name', username)
                .eq('banned', false)
                .limit(1)
                .single();
            
            // If not found by display_name, try email prefix
            if (result.error || !result.data) {
                result = await supabase
                    .from('users')
                    .select('id, display_name, avatar_url, bio, created_at')
                    .ilike('email', `${username}@%`)
                    .eq('banned', false)
                    .limit(1)
                    .single();
            }
            
            user = result.data;
            userError = result.error;
        }
        
        // Use id variable to store user id for later queries
        const userId = user?.id;
        
        if (userError || !user) {
            return res.status(404).json({ error: 'Profil non trouvé' });
        }
        
        // Fetch user's public posts (most recent)
        const { data: posts, error: postsError } = await supabase
            .from('posts')
            .select('id, content, image_url, created_at')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(MAX_PUBLIC_POSTS);
        
        if (postsError) {
            throw postsError;
        }
        
        // Get contact count (public stat)
        const { count: contactCount } = await supabase
            .from('contacts')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId);
        
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
