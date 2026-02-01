/**
 * Contacts API - Manage user's 5 contacts
 * 
 * Endpoints:
 * - GET / - List contacts
 * - GET ?action=search&search=email - Search user by email
 * - GET ?action=followers - Get followers
 * - POST - Add contact by ID or email
 * - DELETE ?id=xxx - Remove contact
 */

import { supabase, requireAuth, getUserEmail, getUserProfile, handleCors } from './_supabase.js';
import { checkRateLimit, RATE_LIMITS } from './_rate-limit.js';
import { isValidUUID, isValidEmail } from './_validation.js';
import { logError, createErrorResponse } from './_error-logger.js';
import { logActivity } from './activity-log.js';

const MAX_CONTACTS = 5;

export default async function handler(req, res) {
    if (handleCors(req, res, ['GET', 'POST', 'DELETE', 'OPTIONS'])) return;

    const user = await requireAuth(req, res);
    if (!user) return;

    // Rate limiting
    const rateLimitConfig = req.method === 'GET' ? RATE_LIMITS.READ : RATE_LIMITS.CREATE;
    if (!checkRateLimit(req, res, { ...rateLimitConfig, keyPrefix: 'contacts', userId: user.id })) {
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

    return listContacts(res, user);
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

async function listContacts(res, user) {
    const { data, error } = await supabase
        .from('contacts')
        .select('id, contact_user_id, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });

    if (error) throw error;
    if (!data || data.length === 0) {
        return res.json({ contacts: [], count: 0, max: MAX_CONTACTS });
    }

    const contactIds = data.map(c => c.contact_user_id);
    
    // Batch fetch user profiles (avoid N+1 queries)
    const { data: profiles } = await supabase
        .from('users')
        .select('id, email, display_name, avatar_url')
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

    const contacts = data.map(c => ({
        ...c,
        contact: { 
            id: c.contact_user_id, 
            email: profileMap[c.contact_user_id]?.email || null,
            display_name: profileMap[c.contact_user_id]?.display_name || null,
            avatar_url: profileMap[c.contact_user_id]?.avatar_url || null
        },
        mutual: mutualSet.has(c.contact_user_id)
    }));

    return res.json({ contacts, count: data.length, max: MAX_CONTACTS });
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

    // Check limit
    const { count } = await supabase
        .from('contacts')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

    if (count >= MAX_CONTACTS) {
        return res.status(400).json({ 
            error: `Limite atteinte ! Tu as déjà ${MAX_CONTACTS} contacts.`
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
