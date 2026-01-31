import { createClient } from '@supabase/supabase-js';
import { checkRateLimit, RATE_LIMITS } from './_rate-limit.js';
import { isValidUUID, isValidEmail } from './_validation.js';
import { logError, logInfo, createErrorResponse } from './_error-logger.js';

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
);

const MAX_CONTACTS = 5;

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

// Helper to get user info from auth.users (not public.users)
async function getUserEmail(userId) {
    const { data } = await supabase.auth.admin.getUserById(userId);
    return data?.user?.email || null;
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
    if (!checkRateLimit(req, res, { ...rateLimitConfig, keyPrefix: 'contacts', userId: user.id })) {
        return;
    }

    try {
        // ============ GET ============
        if (req.method === 'GET') {
            const { action, search } = req.query;

            // Search user by email
            if (action === 'search') {
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

                // Search in auth.users via admin API
                // Note: In production, consider using a more efficient indexed search
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

            // Get followers
            if (action === 'followers') {
                const { data, error } = await supabase
                    .from('contacts')
                    .select('id, user_id, created_at')
                    .eq('contact_user_id', user.id)
                    .order('created_at', { ascending: false });

                if (error) throw error;

                // Enrich with emails
                const followers = await Promise.all(data.map(async (f) => {
                    const email = await getUserEmail(f.user_id);
                    
                    // Check if you follow back
                    const { data: reverse } = await supabase
                        .from('contacts')
                        .select('id')
                        .eq('user_id', user.id)
                        .eq('contact_user_id', f.user_id)
                        .single();

                    return {
                        ...f,
                        email,
                        youFollowBack: !!reverse
                    };
                }));

                return res.json({ followers, count: data.length });
            }

            // Default: List contacts
            const { data, error } = await supabase
                .from('contacts')
                .select('id, contact_user_id, created_at')
                .eq('user_id', user.id)
                .order('created_at', { ascending: true });

            if (error) throw error;

            // Enrich with emails and mutual status
            const contacts = await Promise.all(data.map(async (c) => {
                const email = await getUserEmail(c.contact_user_id);
                
                // Check if mutual
                const { data: reverse } = await supabase
                    .from('contacts')
                    .select('id')
                    .eq('user_id', c.contact_user_id)
                    .eq('contact_user_id', user.id)
                    .single();

                return {
                    ...c,
                    contact: { id: c.contact_user_id, email },
                    mutual: !!reverse
                };
            }));

            return res.json({ contacts, count: data.length, max: MAX_CONTACTS });
        }

        // ============ POST - Add contact ============
        if (req.method === 'POST') {
            const { contactId, email } = req.body;

            if (!contactId && !email) {
                return res.status(400).json({ error: 'contactId ou email requis' });
            }

            let targetUserId = contactId;
            let targetEmail = null;

            // If email provided, look up the user
            if (email) {
                const cleanEmail = email.toLowerCase().trim();
                if (!isValidEmail(cleanEmail)) {
                    return res.status(400).json({ error: 'Format email invalide' });
                }

                if (cleanEmail === user.email?.toLowerCase()) {
                    return res.status(400).json({ error: 'Tu ne peux pas t\'ajouter toi-même !' });
                }

                const { data: { users } } = await supabase.auth.admin.listUsers({ perPage: 1000 });
                const foundUser = users?.find(u => u.email?.toLowerCase() === cleanEmail);

                if (!foundUser) {
                    return res.status(404).json({ error: 'Utilisateur non trouvé' });
                }

                targetUserId = foundUser.id;
                targetEmail = foundUser.email;
            }

            // SECURITY FIX: Validate UUID format
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

        // ============ DELETE ============
        if (req.method === 'DELETE') {
            const contactId = req.query.id;
            if (!contactId) {
                return res.status(400).json({ error: 'id requis' });
            }

            // SECURITY FIX: Validate UUID format
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
