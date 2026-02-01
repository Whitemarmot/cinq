/**
 * Contacts API - Manage user's 5 contacts
 * 
 * Endpoints:
 * - GET / - List contacts (excludes archived by default)
 * - GET ?archived=true - List archived contacts only
 * - GET ?include_archived=true - List all contacts
 * - GET ?action=search&search=email - Search user by email
 * - GET ?action=followers - Get followers
 * - POST - Add contact by ID or email
 * - PATCH ?id=xxx&action=archive - Archive/unarchive contact
 * - PATCH ?id=xxx&action=mute&duration=1h|8h|24h|forever - Mute/unmute contact notifications
 * - DELETE ?id=xxx - Remove contact
 */

import { supabase, requireAuth, getUserEmail, getUserProfile, handleCors, getCachedUserContacts, invalidateUserCache } from './_supabase.js';
import { checkRateLimit, RATE_LIMITS } from './_rate-limit.js';
import { isValidUUID, isValidEmail } from './_validation.js';
import { logError, createErrorResponse } from './_error-logger.js';
import { logActivity } from './activity-log.js';

const MAX_CONTACTS_FREE = 5;
const MAX_CONTACTS_PREMIUM = 25;

// Get user's contact limit based on premium status
async function getContactLimit(userId) {
    const { data: user } = await supabase
        .from('users')
        .select('is_premium')
        .eq('id', userId)
        .single();
    return user?.is_premium ? MAX_CONTACTS_PREMIUM : MAX_CONTACTS_FREE;
}

export default async function handler(req, res) {
    if (handleCors(req, res, ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'])) return;

    const user = await requireAuth(req, res);
    if (!user) return;

    // Rate limiting (now async)
    const rateLimitConfig = req.method === 'GET' ? RATE_LIMITS.READ : RATE_LIMITS.CREATE;
    if (!(await checkRateLimit(req, res, { ...rateLimitConfig, keyPrefix: 'contacts', userId: user.id }))) {
        return;
    }

    try {
        // ============ GET ============
        if (req.method === 'GET') {
            return handleGet(req, res, user);
        }

        // ============ POST - Add contact ============
        if (req.method === 'POST') {
            return handlePost(req, res, user);
        }

        // ============ PATCH - Archive/unarchive contact ============
        if (req.method === 'PATCH') {
            return handlePatch(req, res, user);
        }

        // ============ DELETE ============
        if (req.method === 'DELETE') {
            return handleDelete(req, res, user);
        }

        return res.status(405).json({ error: 'Method not allowed' });

    } catch (e) {
        logError(e, { 
            endpoint: '/api/contacts',
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

// ===== GET HANDLERS =====

async function handleGet(req, res, user) {
    const { action, search } = req.query;

    if (action === 'search') {
        return searchUser(req, res, user, search);
    }

    if (action === 'followers') {
        return getFollowers(res, user);
    }

    if (action === 'birthdays') {
        return listBirthdays(res, user);
    }

    return listContacts(req, res, user);
}

async function searchUser(req, res, user, search) {
    if (!search) {
        return res.status(400).json({ error: 'Paramètre search requis' });
    }

    const email = search.toLowerCase().trim();
    if (!isValidEmail(email)) {
        return res.status(400).json({ error: 'Format email invalide' });
    }

    if (email === user.email?.toLowerCase()) {
        return res.status(400).json({ error: 'Tu ne peux pas t\'ajouter toi-même !' });
    }

    // Search in users table (much faster than listUsers)
    const { data: foundUser, error } = await supabase
        .from('users')
        .select('id, email, display_name, avatar_url')
        .eq('email', email)
        .single();

    if (error || !foundUser) {
        return res.status(404).json({ 
            error: 'Utilisateur non trouvé',
            hint: 'Cet email n\'est pas inscrit sur Cinq. Invite-le avec un code cadeau !'
        });
    }

    // Check if already in contacts
    const { data: existing } = await supabase
        .from('contacts')
        .select('id')
        .eq('user_id', user.id)
        .eq('contact_user_id', foundUser.id)
        .single();

    return res.json({ 
        user: { 
            id: foundUser.id, 
            email: foundUser.email,
            display_name: foundUser.display_name,
            avatar_url: foundUser.avatar_url
        },
        alreadyContact: !!existing
    });
}

async function getFollowers(res, user) {
    const { data, error } = await supabase
        .from('contacts')
        .select('id, user_id, created_at')
        .eq('contact_user_id', user.id)
        .order('created_at', { ascending: false });

    if (error) throw error;
    if (!data || data.length === 0) {
        return res.json({ followers: [], count: 0 });
    }

    const followerIds = data.map(f => f.user_id);
    
    // Batch fetch user profiles (avoid N+1)
    const { data: profiles } = await supabase
        .from('users')
        .select('id, email, display_name, avatar_url')
        .in('id', followerIds);
    
    const profileMap = (profiles || []).reduce((acc, p) => {
        acc[p.id] = p;
        return acc;
    }, {});

    // Batch check reverse contacts (who you follow back)
    const { data: reverseContacts } = await supabase
        .from('contacts')
        .select('contact_user_id')
        .eq('user_id', user.id)
        .in('contact_user_id', followerIds);
    
    const followBackSet = new Set((reverseContacts || []).map(c => c.contact_user_id));

    const followers = data.map(f => ({
        ...f,
        email: profileMap[f.user_id]?.email || null,
        display_name: profileMap[f.user_id]?.display_name || null,
        avatar_url: profileMap[f.user_id]?.avatar_url || null,
        youFollowBack: followBackSet.has(f.user_id)
    }));

    return res.json({ followers, count: data.length });
}

async function listContacts(req, res, user) {
    const { archived, include_archived } = req.query;
    
    let query = supabase
        .from('contacts')
        .select('id, contact_user_id, created_at, is_favorite, archived, muted_until, private_note, contact_group, nickname')
        .eq('user_id', user.id);
    
    // Filter by archived status
    if (archived === 'true') {
        query = query.eq('archived', true);
    } else if (include_archived !== 'true') {
        // By default, exclude archived contacts
        query = query.or('archived.is.null,archived.eq.false');
    }
    
    query = query
        .order('is_favorite', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: true });

    const { data, error } = await query;

    if (error) throw error;
    if (!data || data.length === 0) {
        const maxContacts = await getContactLimit(user.id);
        return res.json({ contacts: [], count: 0, max: maxContacts });
    }

    const contactIds = data.map(c => c.contact_user_id);
    
    // Batch fetch user profiles (avoid N+1 queries) - include last_seen fields and mood
    const { data: profiles } = await supabase
        .from('users')
        .select('id, email, display_name, avatar_url, status_emoji, status_text, last_seen_at, hide_last_seen, mood, mood_updated_at')
        .in('id', contactIds);
    
    const profileMap = (profiles || []).reduce((acc, p) => {
        acc[p.id] = p;
        return acc;
    }, {});

    // Batch check mutual contacts
    const { data: mutualContacts } = await supabase
        .from('contacts')
        .select('user_id')
        .in('user_id', contactIds)
        .eq('contact_user_id', user.id);
    
    const mutualSet = new Set((mutualContacts || []).map(c => c.user_id));

    const now = new Date();
    const contacts = data.map(c => {
        const profile = profileMap[c.contact_user_id];
        // Only include last_seen if user hasn't hidden it
        const lastSeenAt = profile?.hide_last_seen ? null : (profile?.last_seen_at || null);
        
        // Calculate if contact is currently muted
        let isMuted = false;
        if (c.muted_until) {
            const mutedUntil = new Date(c.muted_until);
            // Check for 'infinity' timestamp (year 9999) or future date
            isMuted = mutedUntil.getFullYear() >= 9999 || mutedUntil > now;
        }
        
        return {
            ...c,
            is_favorite: c.is_favorite || false,
            archived: c.archived || false,
            muted_until: c.muted_until || null,
            is_muted: isMuted,
            contact_group: c.contact_group || null,
            contact: { 
                id: c.contact_user_id, 
                email: profile?.email || null,
                display_name: profile?.display_name || null,
                avatar_url: profile?.avatar_url || null,
                status_emoji: profile?.status_emoji || null,
                status_text: profile?.status_text || null,
                last_seen_at: lastSeenAt,
                mood: profile?.mood || null,
                mood_updated_at: profile?.mood_updated_at || null
            },
            mutual: mutualSet.has(c.contact_user_id)
        };
    });

    const maxContacts = await getContactLimit(user.id);
    return res.json({ contacts, count: data.length, max: maxContacts });
}

async function listBirthdays(res, user) {
    const { data, error } = await supabase
        .from('contacts')
        .select('id, contact_user_id, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });

    if (error) throw error;
    if (!data || data.length === 0) {
        return res.json({ contacts: [], count: 0 });
    }

    const contactIds = data.map(c => c.contact_user_id);
    
    // Fetch profiles with birthdays
    const { data: profiles } = await supabase
        .from('users')
        .select('id, email, display_name, avatar_url, birthday')
        .in('id', contactIds);
    
    const profileMap = (profiles || []).reduce((acc, p) => {
        acc[p.id] = p;
        return acc;
    }, {});

    const contacts = data.map(c => ({
        ...c,
        contact: { 
            id: c.contact_user_id, 
            email: profileMap[c.contact_user_id]?.email || null,
            display_name: profileMap[c.contact_user_id]?.display_name || null,
            avatar_url: profileMap[c.contact_user_id]?.avatar_url || null,
            birthday: profileMap[c.contact_user_id]?.birthday || null
        }
    }));

    return res.json({ contacts, count: data.length });
}

// ===== POST HANDLER =====

async function handlePost(req, res, user) {
    const { contactId, email } = req.body;

    if (!contactId && !email) {
        return res.status(400).json({ error: 'contactId ou email requis' });
    }

    let targetUserId = contactId;
    let targetEmail = null;

    // Resolve email to user ID
    if (email) {
        const result = await resolveEmailToUserId(email, user);
        if (result.error) {
            return res.status(result.status).json({ error: result.error });
        }
        targetUserId = result.userId;
        targetEmail = result.email;
    }

    // Validate UUID format
    if (!isValidUUID(targetUserId)) {
        return res.status(400).json({ error: 'Format contactId invalide' });
    }

    if (targetUserId === user.id) {
        return res.status(400).json({ error: 'Tu ne peux pas t\'ajouter toi-même !' });
    }

    // Verify user exists
    if (!targetEmail) {
        targetEmail = await getUserEmail(targetUserId);
        if (!targetEmail) {
            return res.status(404).json({ error: 'Utilisateur non trouvé' });
        }
    }

    // Check limit (premium = 25, free = 5)
    const maxContacts = await getContactLimit(user.id);
    const { count } = await supabase
        .from('contacts')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

    if (count >= maxContacts) {
        const isPremium = maxContacts === MAX_CONTACTS_PREMIUM;
        return res.status(400).json({ 
            error: isPremium 
                ? `Limite atteinte ! Tu as déjà ${maxContacts} contacts.`
                : `Limite atteinte ! Passe à 5² pour avoir 25 contacts.`,
            code: isPremium ? 'LIMIT_REACHED' : 'UPGRADE_REQUIRED',
            maxContacts
        });
    }

    // Check if already contact
    const { data: existing } = await supabase
        .from('contacts')
        .select('id')
        .eq('user_id', user.id)
        .eq('contact_user_id', targetUserId)
        .single();

    if (existing) {
        return res.status(409).json({ error: 'Déjà dans tes contacts' });
    }

    // Add contact
    const { data, error } = await supabase
        .from('contacts')
        .insert({ user_id: user.id, contact_user_id: targetUserId })
        .select()
        .single();

    if (error) throw error;

    // Log activity
    logActivity(user.id, 'contact_added', { contact_email: targetEmail }, req);

    return res.status(201).json({ 
        success: true, 
        contact: { ...data, contact: { id: targetUserId, email: targetEmail } }
    });
}

async function resolveEmailToUserId(email, currentUser) {
    const cleanEmail = email.toLowerCase().trim();
    
    if (!isValidEmail(cleanEmail)) {
        return { error: 'Format email invalide', status: 400 };
    }

    if (cleanEmail === currentUser.email?.toLowerCase()) {
        return { error: 'Tu ne peux pas t\'ajouter toi-même !', status: 400 };
    }

    // Use users table instead of listUsers (much faster)
    const { data: foundUser, error } = await supabase
        .from('users')
        .select('id, email')
        .eq('email', cleanEmail)
        .single();

    if (error || !foundUser) {
        return { error: 'Utilisateur non trouvé', status: 404 };
    }

    return { userId: foundUser.id, email: foundUser.email };
}

// ===== PATCH HANDLER - Toggle Favorite or Archive =====

async function handlePatch(req, res, user) {
    const contactId = req.query.id;
    const action = req.query.action; // 'favorite' or 'archive'
    
    if (!contactId) {
        return res.status(400).json({ error: 'id requis' });
    }

    if (!isValidUUID(contactId)) {
        return res.status(400).json({ error: 'Format id invalide' });
    }

    // Get current contact status
    const { data: contact, error: fetchError } = await supabase
        .from('contacts')
        .select('id, is_favorite, archived, muted_until, contact_group')
        .eq('id', contactId)
        .eq('user_id', user.id)
        .single();

    if (fetchError || !contact) {
        return res.status(404).json({ error: 'Contact non trouvé' });
    }

    // Handle archive action
    if (action === 'archive') {
        const newArchivedStatus = !contact.archived;
        
        const { data, error } = await supabase
            .from('contacts')
            .update({ archived: newArchivedStatus })
            .eq('id', contactId)
            .eq('user_id', user.id)
            .select()
            .single();

        if (error) throw error;

        // Log activity
        logActivity(user.id, newArchivedStatus ? 'contact_archived' : 'contact_unarchived', { contact_id: contactId }, req);

        return res.json({ 
            success: true, 
            archived: newArchivedStatus,
            contact: data
        });
    }

    // Handle private note update
    if (action === 'note') {
        const { private_note } = req.body;
        
        // Allow null/empty to clear the note, otherwise validate max length
        const noteValue = private_note ? private_note.trim().slice(0, 1000) : null;
        
        const { data, error } = await supabase
            .from('contacts')
            .update({ private_note: noteValue })
            .eq('id', contactId)
            .eq('user_id', user.id)
            .select()
            .single();

        if (error) throw error;

        // Log activity
        logActivity(user.id, 'contact_note_updated', { contact_id: contactId }, req);

        return res.json({ 
            success: true, 
            private_note: noteValue,
            contact: data
        });
    }

    // Handle nickname update (personal nickname visible only to current user)
    if (action === 'nickname') {
        const { nickname } = req.body;
        
        // Allow null/empty to clear the nickname, otherwise validate max length (50 chars)
        const nicknameValue = nickname ? nickname.trim().slice(0, 50) : null;
        
        const { data, error } = await supabase
            .from('contacts')
            .update({ nickname: nicknameValue })
            .eq('id', contactId)
            .eq('user_id', user.id)
            .select()
            .single();

        if (error) throw error;

        // Log activity
        logActivity(user.id, 'contact_nickname_updated', { contact_id: contactId }, req);

        return res.json({ 
            success: true, 
            nickname: nicknameValue,
            contact: data
        });
    }

    // Handle mute action
    if (action === 'mute') {
        const duration = req.query.duration; // '1h', '8h', '24h', 'forever', or 'off'
        let mutedUntil = null;
        let isMuted = false;
        
        if (duration && duration !== 'off') {
            const now = new Date();
            switch (duration) {
                case '1h':
                    mutedUntil = new Date(now.getTime() + 1 * 60 * 60 * 1000);
                    break;
                case '8h':
                    mutedUntil = new Date(now.getTime() + 8 * 60 * 60 * 1000);
                    break;
                case '24h':
                    mutedUntil = new Date(now.getTime() + 24 * 60 * 60 * 1000);
                    break;
                case 'forever':
                    // Use year 9999 for "forever" mute
                    mutedUntil = new Date('9999-12-31T23:59:59.999Z');
                    break;
                default:
                    return res.status(400).json({ error: 'Durée invalide. Utilise: 1h, 8h, 24h, forever, ou off' });
            }
            isMuted = true;
        }
        
        const { data, error } = await supabase
            .from('contacts')
            .update({ muted_until: mutedUntil })
            .eq('id', contactId)
            .eq('user_id', user.id)
            .select()
            .single();

        if (error) throw error;

        // Log activity
        logActivity(user.id, isMuted ? 'contact_muted' : 'contact_unmuted', { 
            contact_id: contactId, 
            duration: duration || 'off' 
        }, req);

        return res.json({ 
            success: true, 
            muted_until: mutedUntil,
            is_muted: isMuted,
            contact: data
        });
    }

    // Handle contact group update
    if (action === 'group' || req.body?.contact_group !== undefined) {
        const contactGroup = req.body?.contact_group || req.query.group;
        
        // Validate group value
        const validGroups = ['famille', 'travail', 'amis', 'autres', null];
        const groupValue = contactGroup && validGroups.includes(contactGroup) ? contactGroup : null;
        
        const { data, error } = await supabase
            .from('contacts')
            .update({ contact_group: groupValue })
            .eq('id', contactId)
            .eq('user_id', user.id)
            .select()
            .single();

        if (error) throw error;

        // Log activity
        logActivity(user.id, 'contact_group_updated', { contact_id: contactId, group: groupValue }, req);

        return res.json({ 
            success: true, 
            contact_group: groupValue,
            contact: data
        });
    }

    // Default: Toggle favorite status
    const newFavoriteStatus = !contact.is_favorite;
    
    const { data, error } = await supabase
        .from('contacts')
        .update({ is_favorite: newFavoriteStatus })
        .eq('id', contactId)
        .eq('user_id', user.id)
        .select()
        .single();

    if (error) throw error;

    // Log activity
    logActivity(user.id, newFavoriteStatus ? 'contact_favorited' : 'contact_unfavorited', { contact_id: contactId }, req);

    return res.json({ 
        success: true, 
        is_favorite: newFavoriteStatus,
        contact: data
    });
}

// ===== DELETE HANDLER =====

async function handleDelete(req, res, user) {
    const contactId = req.query.id;
    
    if (!contactId) {
        return res.status(400).json({ error: 'id requis' });
    }

    if (!isValidUUID(contactId)) {
        return res.status(400).json({ error: 'Format id invalide' });
    }

    const { error } = await supabase
        .from('contacts')
        .delete()
        .eq('id', contactId)
        .eq('user_id', user.id);

    if (error) throw error;

    // Log activity
    logActivity(user.id, 'contact_removed', {}, req);

    return res.json({ success: true });
}
