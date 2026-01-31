import { createClient } from '@supabase/supabase-js';
import { checkRateLimit, RATE_LIMITS } from './_rate-limit.js';
import { isValidUUID } from './_validation.js';
import { logError, createErrorResponse } from './_error-logger.js';

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
);

const MAX_CONTENT_LENGTH = 1000;
const MAX_IMAGE_URL_LENGTH = 2000;

async function getUser(req) {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) return null;
    
    try {
        const { data: { user }, error } = await supabase.auth.getUser(auth.split(' ')[1]);
        if (error) return null;
        return user;
    } catch {
        return null;
    }
}

// Get user info (email, display_name) from users table or auth
async function getUserInfo(userId) {
    // Try public.users first for display_name
    const { data: profile } = await supabase
        .from('users')
        .select('email, display_name, avatar_url')
        .eq('id', userId)
        .single();
    
    if (profile) {
        return {
            id: userId,
            email: profile.email,
            display_name: profile.display_name,
            avatar_url: profile.avatar_url
        };
    }
    
    // Fallback to auth.users
    const { data } = await supabase.auth.admin.getUserById(userId);
    return {
        id: userId,
        email: data?.user?.email || null,
        display_name: null,
        avatar_url: null
    };
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    if (req.method === 'OPTIONS') return res.status(200).end();

    const user = await getUser(req);
    if (!user) {
        return res.status(401).json({ error: 'Non authentifié' });
    }

    // Rate limiting
    const rateLimitConfig = req.method === 'GET' ? RATE_LIMITS.READ : RATE_LIMITS.CREATE;
    if (!checkRateLimit(req, res, { ...rateLimitConfig, keyPrefix: 'posts', userId: user.id })) {
        return;
    }

    try {
        // ============ GET - List posts from contacts ============
        if (req.method === 'GET') {
            const { limit = 50, offset = 0, user_id } = req.query;
            
            // If specific user_id requested, check if it's self or a contact
            if (user_id) {
                if (!isValidUUID(user_id)) {
                    return res.status(400).json({ error: 'Format user_id invalide' });
                }
                
                if (user_id !== user.id) {
                    // Check if user_id is a contact
                    const { data: contact } = await supabase
                        .from('contacts')
                        .select('id')
                        .eq('user_id', user.id)
                        .eq('contact_user_id', user_id)
                        .single();
                    
                    if (!contact) {
                        return res.status(403).json({ error: 'Tu ne peux voir que les posts de tes contacts' });
                    }
                }
                
                // Get posts from specific user
                const { data: posts, error } = await supabase
                    .from('posts')
                    .select('*')
                    .eq('user_id', user_id)
                    .order('created_at', { ascending: false })
                    .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);
                
                if (error) throw error;
                
                // Enrich with user info
                const authorInfo = await getUserInfo(user_id);
                const enriched = posts.map(post => ({
                    ...post,
                    author: authorInfo
                }));
                
                return res.json({ posts: enriched, count: posts.length });
            }
            
            // Default: Get posts from all contacts + self (feed)
            // First get contact IDs
            const { data: contacts } = await supabase
                .from('contacts')
                .select('contact_user_id')
                .eq('user_id', user.id);
            
            const contactIds = contacts?.map(c => c.contact_user_id) || [];
            const allUserIds = [user.id, ...contactIds];
            
            // Get posts from contacts + self
            const { data: posts, error } = await supabase
                .from('posts')
                .select('*')
                .in('user_id', allUserIds)
                .order('created_at', { ascending: false })
                .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);
            
            if (error) throw error;
            
            // Enrich with author info
            const authorCache = {};
            const enriched = await Promise.all(posts.map(async (post) => {
                if (!authorCache[post.user_id]) {
                    authorCache[post.user_id] = await getUserInfo(post.user_id);
                }
                return {
                    ...post,
                    author: authorCache[post.user_id]
                };
            }));
            
            return res.json({ 
                posts: enriched, 
                count: posts.length,
                contactCount: contactIds.length
            });
        }

        // ============ POST - Create new post ============
        if (req.method === 'POST') {
            const { content, image_url } = req.body;
            
            // Validation
            if (!content || typeof content !== 'string') {
                return res.status(400).json({ error: 'Contenu requis' });
            }
            
            const trimmedContent = content.trim();
            if (trimmedContent.length === 0) {
                return res.status(400).json({ error: 'Le contenu ne peut pas être vide' });
            }
            
            if (trimmedContent.length > MAX_CONTENT_LENGTH) {
                return res.status(400).json({ 
                    error: `Le contenu est trop long (max ${MAX_CONTENT_LENGTH} caractères)` 
                });
            }
            
            // Validate image URL if provided
            let validatedImageUrl = null;
            if (image_url) {
                if (typeof image_url !== 'string' || image_url.length > MAX_IMAGE_URL_LENGTH) {
                    return res.status(400).json({ error: 'URL image invalide' });
                }
                // Basic URL validation
                try {
                    const url = new URL(image_url);
                    if (!['http:', 'https:'].includes(url.protocol)) {
                        return res.status(400).json({ error: 'URL image doit être HTTP ou HTTPS' });
                    }
                    validatedImageUrl = image_url;
                } catch {
                    return res.status(400).json({ error: 'Format URL image invalide' });
                }
            }
            
            // Create post
            const { data: post, error } = await supabase
                .from('posts')
                .insert({
                    user_id: user.id,
                    content: trimmedContent,
                    image_url: validatedImageUrl
                })
                .select()
                .single();
            
            if (error) throw error;
            
            // Enrich with author info
            const authorInfo = await getUserInfo(user.id);
            
            return res.status(201).json({
                success: true,
                post: {
                    ...post,
                    author: authorInfo
                }
            });
        }

        // ============ DELETE - Delete own post ============
        if (req.method === 'DELETE') {
            const postId = req.query.id;
            
            if (!postId) {
                return res.status(400).json({ error: 'id requis' });
            }
            
            if (!isValidUUID(postId)) {
                return res.status(400).json({ error: 'Format id invalide' });
            }
            
            // Verify ownership before delete
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
