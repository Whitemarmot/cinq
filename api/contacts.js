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

    // Search in auth.users
    const { data: { users }, error } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    const foundUser = users?.find(u => u.email?.toLowerCase() === email);

    if (!foundUser) {
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
        user: { id: foundUser.id, email: foundUser.email },
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

    const followers = await Promise.all(data.map(async (f) => {
        const email = await getUserEmail(f.user_id);
        
        const { data: reverse } = await supabase
            .from('contacts')
            .select('id')
            .eq('user_id', user.id)
            .eq('contact_user_id', f.user_id)
            .single();

        return { ...f, email, youFollowBack: !!reverse };
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

    const contacts = await Promise.all(data.map(async (c) => {
        const email = await getUserEmail(c.contact_user_id);
        const profile = await getUserProfile(c.contact_user_id);
        
        const { data: reverse } = await supabase
            .from('contacts')
            .select('id')
            .eq('user_id', c.contact_user_id)
            .eq('contact_user_id', user.id)
            .single();

        return {
            ...c,
            contact: { 
                id: c.contact_user_id, 
                email,
                display_name: profile.display_name || null,
                avatar_url: profile.avatar_url || null
            },
            mutual: !!reverse
        };
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

    const { data: { users } } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    const foundUser = users?.find(u => u.email?.toLowerCase() === cleanEmail);

    if (!foundUser) {
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
    return res.json({ success: true });
}
