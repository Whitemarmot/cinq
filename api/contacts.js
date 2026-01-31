import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
);

const MAX_CONTACTS = 5;

// Email validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    if (req.method === 'OPTIONS') return res.status(200).end();

    const user = await getUser(req);
    if (!user) {
        return res.status(401).json({ 
            error: 'Non authentifié',
            hint: 'Ajoute le header Authorization: Bearer <token>'
        });
    }

    try {
        // ============ GET - List contacts, search by email, or get followers ============
        if (req.method === 'GET') {
            const { action, search } = req.query;

            // -------- Search user by email --------
            if (action === 'search') {
                if (!search) {
                    return res.status(400).json({ 
                        error: 'Paramètre search requis',
                        hint: 'GET /api/contacts?action=search&search=email@example.com'
                    });
                }

                const email = search.toLowerCase().trim();
                
                if (!EMAIL_REGEX.test(email)) {
                    return res.status(400).json({ 
                        error: 'Format email invalide',
                        hint: 'Vérifie que l\'adresse est bien formée (ex: nom@domaine.com)'
                    });
                }

                // Don't let users search for themselves
                if (email === user.email?.toLowerCase()) {
                    return res.status(400).json({ 
                        error: 'Tu ne peux pas t\'ajouter toi-même !',
                        hint: 'Cherche l\'email d\'un ami'
                    });
                }

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

            // -------- Get who added you (followers) --------
            if (action === 'followers') {
                const { data, error } = await supabase
                    .from('contacts')
                    .select(`
                        id,
                        user_id,
                        created_at,
                        follower:users!contacts_user_id_fkey(id, email, display_name, avatar_url)
                    `)
                    .eq('contact_user_id', user.id)
                    .order('created_at', { ascending: false });

                if (error) throw error;

                // Check which ones you follow back
                const followerIds = data.map(f => f.user_id);
                const { data: following } = await supabase
                    .from('contacts')
                    .select('contact_user_id')
                    .eq('user_id', user.id)
                    .in('contact_user_id', followerIds);

                const followingSet = new Set(following?.map(f => f.contact_user_id) || []);

                const followers = data.map(f => ({
                    ...f,
                    youFollowBack: followingSet.has(f.user_id)
                }));

                return res.json({ 
                    followers,
                    count: data.length,
                    message: data.length === 0 
                        ? 'Personne ne t\'a encore ajouté' 
                        : `${data.length} personne(s) t'ont ajouté`
                });
            }

            // -------- Default: List your contacts --------
            const { data, error } = await supabase
                .from('contacts')
                .select(`
                    id,
                    contact_user_id,
                    created_at,
                    contact:users!contacts_contact_user_id_fkey(id, email, display_name, avatar_url)
                `)
                .eq('user_id', user.id)
                .order('created_at', { ascending: true });

            if (error) throw error;

            // Check if each contact follows you back
            const contactIds = data.map(c => c.contact_user_id);
            const { data: mutuals } = await supabase
                .from('contacts')
                .select('user_id')
                .eq('contact_user_id', user.id)
                .in('user_id', contactIds);

            const mutualSet = new Set(mutuals?.map(m => m.user_id) || []);

            const contacts = data.map(c => ({
                ...c,
                mutual: mutualSet.has(c.contact_user_id)
            }));

            return res.json({ 
                contacts, 
                count: data.length, 
                max: MAX_CONTACTS,
                slotsAvailable: MAX_CONTACTS - data.length
            });
        }

        // ============ POST - Add contact (by ID or email) ============
        if (req.method === 'POST') {
            const { contactId, email } = req.body;

            // Validate input
            if (!contactId && !email) {
                return res.status(400).json({ 
                    error: 'contactId ou email requis',
                    hint: 'Envoie soit {contactId: "uuid"} soit {email: "user@example.com"}'
                });
            }

            let targetUserId = contactId;

            // If email provided, look up the user
            if (email) {
                const cleanEmail = email.toLowerCase().trim();
                
                if (!EMAIL_REGEX.test(cleanEmail)) {
                    return res.status(400).json({ 
                        error: 'Format email invalide',
                        hint: 'Vérifie que l\'adresse est bien formée'
                    });
                }

                if (cleanEmail === user.email?.toLowerCase()) {
                    return res.status(400).json({ 
                        error: 'Tu ne peux pas t\'ajouter toi-même !'
                    });
                }

                const { data: foundUser, error } = await supabase
                    .from('users')
                    .select('id')
                    .eq('email', cleanEmail)
                    .single();

                if (error || !foundUser) {
                    return res.status(404).json({ 
                        error: 'Utilisateur non trouvé',
                        hint: 'Cet email n\'est pas inscrit sur Cinq'
                    });
                }

                targetUserId = foundUser.id;
            }

            // Validate UUID format
            if (!UUID_REGEX.test(targetUserId)) {
                return res.status(400).json({ 
                    error: 'Format contactId invalide',
                    hint: 'Le contactId doit être un UUID valide'
                });
            }

            // Can't add yourself
            if (targetUserId === user.id) {
                return res.status(400).json({ 
                    error: 'Tu ne peux pas t\'ajouter toi-même !'
                });
            }

            // Check if target user exists
            const { data: targetUser, error: userError } = await supabase
                .from('users')
                .select('id, email')
                .eq('id', targetUserId)
                .single();

            if (userError || !targetUser) {
                return res.status(404).json({ 
                    error: 'Utilisateur non trouvé',
                    hint: 'Cet ID ne correspond à aucun utilisateur'
                });
            }

            // Check limit
            const { count } = await supabase
                .from('contacts')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', user.id);

            if (count >= MAX_CONTACTS) {
                return res.status(400).json({ 
                    error: `Limite atteinte ! Tu as déjà ${MAX_CONTACTS} contacts.`,
                    hint: 'Supprime un contact pour en ajouter un nouveau.',
                    current: count,
                    max: MAX_CONTACTS
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
                return res.status(409).json({ 
                    error: 'Déjà dans tes contacts',
                    hint: 'Cette personne est déjà dans ta liste'
                });
            }

            // Add contact
            const { data, error } = await supabase
                .from('contacts')
                .insert({
                    user_id: user.id,
                    contact_user_id: targetUserId
                })
                .select(`
                    id,
                    contact_user_id,
                    created_at,
                    contact:users!contacts_contact_user_id_fkey(id, email, display_name)
                `)
                .single();

            if (error) throw error;

            // Check if mutual
            const { data: reverse } = await supabase
                .from('contacts')
                .select('id')
                .eq('user_id', targetUserId)
                .eq('contact_user_id', user.id)
                .single();

            return res.status(201).json({ 
                success: true, 
                contact: {
                    ...data,
                    mutual: !!reverse
                },
                message: reverse 
                    ? `${targetUser.email} ajouté ! Vous êtes maintenant mutuels 🤝`
                    : `${targetUser.email} ajouté à tes contacts !`,
                slotsRemaining: MAX_CONTACTS - count - 1
            });
        }

        // ============ DELETE - Remove contact ============
        if (req.method === 'DELETE') {
            const contactId = req.query.id;
            
            if (!contactId) {
                return res.status(400).json({ 
                    error: 'id requis',
                    hint: 'DELETE /api/contacts?id=<contact_row_id>'
                });
            }

            // Verify ownership before delete
            const { data: existing } = await supabase
                .from('contacts')
                .select('id, contact:users!contacts_contact_user_id_fkey(email)')
                .eq('id', contactId)
                .eq('user_id', user.id)
                .single();

            if (!existing) {
                return res.status(404).json({ 
                    error: 'Contact non trouvé',
                    hint: 'Ce contact n\'existe pas ou ne t\'appartient pas'
                });
            }

            const { error } = await supabase
                .from('contacts')
                .delete()
                .eq('id', contactId)
                .eq('user_id', user.id);

            if (error) throw error;

            return res.json({ 
                success: true, 
                message: `Contact ${existing.contact?.email || ''} supprimé`,
                hint: 'Tu as maintenant une place libre dans tes contacts'
            });
        }

        return res.status(405).json({ 
            error: 'Method not allowed',
            hint: 'Méthodes supportées: GET, POST, DELETE'
        });

    } catch (e) {
        console.error('Contacts error:', e);
        return res.status(500).json({ 
            error: 'Erreur serveur',
            details: process.env.NODE_ENV === 'development' ? e.message : undefined
        });
    }
}
