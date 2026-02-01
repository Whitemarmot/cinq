/**
 * Search API - Search across contacts and posts
 * 
 * Endpoints:
 * - GET /?q=query - Search contacts and posts
 * - GET /?q=query&type=contacts - Search only contacts
 * - GET /?q=query&type=posts - Search only posts
 */

import { supabase, requireAuth, getUserInfo, handleCors } from './_supabase.js';
import { checkRateLimit, RATE_LIMITS } from './_rate-limit.js';
import { sanitizeText } from './_validation.js';
import { logError, createErrorResponse } from './_error-logger.js';

const MIN_QUERY_LENGTH = 2;
const MAX_QUERY_LENGTH = 100;
const MAX_RESULTS = 20;

export default async function handler(req, res) {
    if (handleCors(req, res, ['GET', 'OPTIONS'])) return;

    const user = await requireAuth(req, res);
    if (!user) return;

    // Rate limiting
    if (!checkRateLimit(req, res, { ...RATE_LIMITS.READ, keyPrefix: 'search', userId: user.id })) {
        return;
    }

    try {
        if (req.method !== 'GET') {
            return res.status(405).json({ error: 'Method not allowed' });
        }

        const { q, type } = req.query;

        // Validate query
        if (!q || typeof q !== 'string') {
            return res.status(400).json({ error: 'Paramètre q requis' });
        }

        const query = sanitizeText(q, { maxLength: MAX_QUERY_LENGTH }).toLowerCase().trim();
        
        if (query.length < MIN_QUERY_LENGTH) {
            return res.status(400).json({ 
                error: `La recherche doit contenir au moins ${MIN_QUERY_LENGTH} caractères` 
            });
        }

        // Determine what to search
        const searchContacts = !type || type === 'contacts' || type === 'all';
        const searchPosts = !type || type === 'posts' || type === 'all';

        const results = {
            contacts: [],
            posts: [],
            query
        };

        // Search contacts
        if (searchContacts) {
            results.contacts = await searchUserContacts(user.id, query);
        }

        // Search posts
        if (searchPosts) {
            results.posts = await searchUserPosts(user.id, query);
        }

        return res.json(results);

    } catch (e) {
        logError(e, {
            endpoint: '/api/search',
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
 * Search user's contacts by display name or email
 */
async function searchUserContacts(userId, query) {
    // Get user's contact IDs
    const { data: contactLinks, error: contactError } = await supabase
        .from('contacts')
        .select('contact_user_id')
        .eq('user_id', userId);

    if (contactError) throw contactError;
    if (!contactLinks || contactLinks.length === 0) return [];

    const contactIds = contactLinks.map(c => c.contact_user_id);

    // Search in users table for contacts matching the query
    const { data: users, error: usersError } = await supabase
        .from('users')
        .select('id, email, display_name, avatar_url')
        .in('id', contactIds);

    if (usersError) throw usersError;
    if (!users) return [];

    // Filter by query (case-insensitive search in display_name and email)
    const filtered = users.filter(u => {
        const displayName = (u.display_name || '').toLowerCase();
        const email = (u.email || '').toLowerCase();
        return displayName.includes(query) || email.includes(query);
    });

    // Add mutual status
    const { data: mutualContacts } = await supabase
        .from('contacts')
        .select('user_id')
        .in('user_id', filtered.map(u => u.id))
        .eq('contact_user_id', userId);

    const mutualSet = new Set((mutualContacts || []).map(c => c.user_id));

    return filtered.slice(0, MAX_RESULTS).map(u => ({
        id: u.id,
        email: u.email,
        display_name: u.display_name,
        avatar_url: u.avatar_url,
        mutual: mutualSet.has(u.id)
    }));
}

/**
 * Search posts from user and their contacts
 */
async function searchUserPosts(userId, query) {
    // Get contact IDs
    const { data: contacts } = await supabase
        .from('contacts')
        .select('contact_user_id')
        .eq('user_id', userId);

    const contactIds = contacts?.map(c => c.contact_user_id) || [];
    const allUserIds = [userId, ...contactIds];

    // Search posts with ilike for partial text match
    const { data: posts, error: postsError } = await supabase
        .from('posts')
        .select('*')
        .in('user_id', allUserIds)
        .ilike('content', `%${query}%`)
        .order('created_at', { ascending: false })
        .limit(MAX_RESULTS);

    if (postsError) throw postsError;
    if (!posts || posts.length === 0) return [];

    // Enrich with author info
    const authorCache = {};
    const enriched = await Promise.all(posts.map(async (post) => {
        if (!authorCache[post.user_id]) {
            authorCache[post.user_id] = await getUserInfo(post.user_id);
        }
        return { 
            ...post, 
            author: authorCache[post.user_id],
            isOwn: post.user_id === userId
        };
    }));

    return enriched;
}
