/**
 * Suggestions API - Friends of friends recommendations
 * 
 * Endpoints:
 * - GET / - Get suggested contacts based on friends of friends
 * - POST - Ignore a suggestion
 */

import { supabase, requireAuth, handleCors } from './_supabase.js';
import { checkRateLimit, RATE_LIMITS } from './_rate-limit.js';
import { isValidUUID } from './_validation.js';
import { logError, createErrorResponse } from './_error-logger.js';

const MAX_SUGGESTIONS = 10;

export default async function handler(req, res) {
    if (handleCors(req, res, ['GET', 'POST', 'OPTIONS'])) return;

    const user = await requireAuth(req, res);
    if (!user) return;

    // Rate limiting
    const rateLimitConfig = req.method === 'GET' ? RATE_LIMITS.READ : RATE_LIMITS.CREATE;
    if (!checkRateLimit(req, res, { ...rateLimitConfig, keyPrefix: 'suggestions', userId: user.id })) {
        return;
    }

    try {
        if (req.method === 'GET') {
            return getSuggestions(req, res, user);
        }

        if (req.method === 'POST') {
            return ignoreSuggestion(req, res, user);
        }

        return res.status(405).json({ error: 'Method not allowed' });

    } catch (e) {
        logError(e, { 
            endpoint: '/api/suggestions',
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
 * Get friend-of-friend suggestions
 * Algorithm:
 * 1. Get user's current contacts
 * 2. Get contacts of those contacts (friends of friends)
 * 3. Exclude: self, existing contacts, ignored suggestions
 * 4. Rank by number of mutual connections
 */
async function getSuggestions(req, res, user) {
    // 1. Get user's current contacts
    const { data: myContacts, error: contactsError } = await supabase
        .from('contacts')
        .select('contact_user_id')
        .eq('user_id', user.id);

    if (contactsError) throw contactsError;
    
    if (!myContacts || myContacts.length === 0) {
        return res.json({ 
            suggestions: [], 
            message: 'Ajoute d\'abord des contacts pour voir des suggestions !' 
        });
    }

    const myContactIds = myContacts.map(c => c.contact_user_id);

    // 2. Get contacts of my contacts (friends of friends)
    const { data: friendsOfFriends, error: fofError } = await supabase
        .from('contacts')
        .select('user_id, contact_user_id')
        .in('user_id', myContactIds);

    if (fofError) throw fofError;

    if (!friendsOfFriends || friendsOfFriends.length === 0) {
        return res.json({ 
            suggestions: [], 
            message: 'Tes contacts n\'ont pas encore ajouté de proches' 
        });
    }

    // 3. Get ignored suggestions
    const { data: ignoredData } = await supabase
        .from('ignored_suggestions')
        .select('ignored_user_id')
        .eq('user_id', user.id);
    
    const ignoredIds = new Set((ignoredData || []).map(i => i.ignored_user_id));

    // 4. Build suggestion map with mutual count
    const suggestionMap = new Map();
    
    for (const fof of friendsOfFriends) {
        const suggestedId = fof.contact_user_id;
        const throughContactId = fof.user_id;
        
        // Exclude self and existing contacts
        if (suggestedId === user.id) continue;
        if (myContactIds.includes(suggestedId)) continue;
        if (ignoredIds.has(suggestedId)) continue;

        if (!suggestionMap.has(suggestedId)) {
            suggestionMap.set(suggestedId, {
                userId: suggestedId,
                mutualContacts: [],
                mutualCount: 0
            });
        }
        
        const suggestion = suggestionMap.get(suggestedId);
        if (!suggestion.mutualContacts.includes(throughContactId)) {
            suggestion.mutualContacts.push(throughContactId);
            suggestion.mutualCount++;
        }
    }

    // 5. Sort by mutual count and take top suggestions
    const sortedSuggestions = Array.from(suggestionMap.values())
        .sort((a, b) => b.mutualCount - a.mutualCount)
        .slice(0, MAX_SUGGESTIONS);

    if (sortedSuggestions.length === 0) {
        return res.json({ 
            suggestions: [], 
            message: 'Pas de nouvelles suggestions pour le moment' 
        });
    }

    // 6. Fetch user profiles for suggestions
    const suggestionIds = sortedSuggestions.map(s => s.userId);
    const { data: profiles } = await supabase
        .from('users')
        .select('id, email, display_name, avatar_url')
        .in('id', suggestionIds);

    const profileMap = (profiles || []).reduce((acc, p) => {
        acc[p.id] = p;
        return acc;
    }, {});

    // 7. Fetch mutual contact profiles for context
    const allMutualIds = [...new Set(sortedSuggestions.flatMap(s => s.mutualContacts))];
    const { data: mutualProfiles } = await supabase
        .from('users')
        .select('id, display_name, avatar_url')
        .in('id', allMutualIds);

    const mutualProfileMap = (mutualProfiles || []).reduce((acc, p) => {
        acc[p.id] = p;
        return acc;
    }, {});

    // 8. Build final response
    const suggestions = sortedSuggestions.map(s => ({
        user: {
            id: s.userId,
            email: profileMap[s.userId]?.email || null,
            display_name: profileMap[s.userId]?.display_name || null,
            avatar_url: profileMap[s.userId]?.avatar_url || null
        },
        mutualCount: s.mutualCount,
        mutualContacts: s.mutualContacts.slice(0, 3).map(mId => ({
            id: mId,
            display_name: mutualProfileMap[mId]?.display_name || null,
            avatar_url: mutualProfileMap[mId]?.avatar_url || null
        }))
    }));

    return res.json({ suggestions });
}

/**
 * Ignore a suggestion
 */
async function ignoreSuggestion(req, res, user) {
    const { userId } = req.body;

    if (!userId) {
        return res.status(400).json({ error: 'userId requis' });
    }

    if (!isValidUUID(userId)) {
        return res.status(400).json({ error: 'Format userId invalide' });
    }

    if (userId === user.id) {
        return res.status(400).json({ error: 'Action invalide' });
    }

    // Insert or ignore if already exists
    const { error } = await supabase
        .from('ignored_suggestions')
        .upsert({ 
            user_id: user.id, 
            ignored_user_id: userId 
        }, { 
            onConflict: 'user_id,ignored_user_id',
            ignoreDuplicates: true 
        });

    if (error) throw error;

    return res.json({ success: true });
}
