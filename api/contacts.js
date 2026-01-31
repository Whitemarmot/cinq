/**
 * CINQ Contacts API - Netlify Function
 * RESTful contact management
 * 
 * GET    /api/contacts           - Liste les contacts de l'utilisateur
 * POST   /api/contacts           - Ajoute un contact (max 5)
 * DELETE /api/contacts?id=xxx    - Supprime un contact
 * 
 * Requires: Authorization: Bearer <access_token>
 */

const { createClient } = require('@supabase/supabase-js');
const { success, error, headers } = require('./gift-utils');

// ============================================
// Supabase Clients
// ============================================

function getSupabaseAdmin() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
    
    if (!url || !key) {
        throw new Error('Missing Supabase configuration');
    }
    
    return createClient(url, key, {
        auth: { autoRefreshToken: false, persistSession: false }
    });
}

function getSupabaseWithToken(token) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!url || !key) {
        throw new Error('Missing Supabase configuration');
    }
    
    return createClient(url, key, {
        global: {
            headers: { Authorization: `Bearer ${token}` }
        },
        auth: { autoRefreshToken: false, persistSession: false }
    });
}

// ============================================
// Auth Helper
// ============================================

function getAuthToken(event) {
    const authHeader = event.headers['authorization'] || event.headers['Authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null;
    }
    return authHeader.slice(7);
}

// ============================================
// Handler
// ============================================

exports.handler = async (event, context) => {
    // CORS preflight
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers, body: '' };
    }

    // ========================================
    // 1. Authentication
    // ========================================
    
    const token = getAuthToken(event);
    if (!token) {
        return error('Authorization required', 401);
    }

    const supabaseAdmin = getSupabaseAdmin();
    const supabase = getSupabaseWithToken(token);

    // Verify token and get user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
        return error('Invalid or expired token', 401);
    }

    // ========================================
    // GET - Liste les contacts
    // ========================================
    
    if (event.httpMethod === 'GET') {
        try {
            const { data: contacts, error: fetchError } = await supabaseAdmin
                .from('contacts')
                .select(`
                    id,
                    contact_user_id,
                    created_at,
                    contact:users!contacts_contact_user_id_fkey (
                        id,
                        email,
                        created_at
                    )
                `)
                .eq('user_id', user.id)
                .order('created_at', { ascending: true });

            if (fetchError) {
                console.error('Fetch contacts error:', fetchError);
                return error('Failed to fetch contacts', 500);
            }

            return success({
                contacts: (contacts || []).map(c => ({
                    id: c.id,
                    user_id: c.contact_user_id,
                    email: c.contact?.email || null,
                    added_at: c.created_at
                })),
                count: contacts?.length || 0,
                limit: 5,
                remaining: 5 - (contacts?.length || 0)
            });

        } catch (err) {
            console.error('GET contacts error:', err);
            return error('Server error', 500);
        }
    }

    // ========================================
    // POST - Ajouter un contact
    // ========================================
    
    if (event.httpMethod === 'POST') {
        try {
            const body = JSON.parse(event.body || '{}');
            const { email: contactEmail } = body;

            // Validation
            if (!contactEmail) {
                return error('Email du contact requis', 400);
            }

            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(contactEmail)) {
                return error('Format email invalide', 400);
            }

            const normalizedEmail = contactEmail.toLowerCase().trim();

            // Check: not self
            if (normalizedEmail === user.email.toLowerCase()) {
                return error('Tu ne peux pas t\'ajouter toi-même 😅', 400, { code: 'SELF_ADD' });
            }

            // Find target user
            const { data: contactUser, error: findError } = await supabaseAdmin
                .from('users')
                .select('id, email')
                .eq('email', normalizedEmail)
                .single();

            if (findError || !contactUser) {
                return error('Cette personne n\'est pas encore sur Cinq. Offre-lui un accès !', 404, { code: 'USER_NOT_FOUND' });
            }

            // Check: already a contact?
            const { data: existing } = await supabaseAdmin
                .from('contacts')
                .select('id')
                .eq('user_id', user.id)
                .eq('contact_user_id', contactUser.id)
                .single();

            if (existing) {
                return error('Cette personne est déjà dans ton cercle', 409, { code: 'ALREADY_CONTACT' });
            }

            // Check: limit reached?
            const { count: currentCount } = await supabaseAdmin
                .from('contacts')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', user.id);

            if (currentCount >= 5) {
                return error('5 contacts max. C\'est le concept ! Retire quelqu\'un d\'abord.', 400, {
                    code: 'LIMIT_REACHED',
                    current: currentCount,
                    limit: 5
                });
            }

            // Add contact
            const { data: newContact, error: addError } = await supabaseAdmin
                .from('contacts')
                .insert({
                    user_id: user.id,
                    contact_user_id: contactUser.id
                })
                .select()
                .single();

            if (addError) {
                // Trigger might have caught the limit
                if (addError.message && addError.message.includes('CINQ limit')) {
                    return error('5 contacts max. C\'est le concept !', 400, { code: 'LIMIT_REACHED' });
                }
                console.error('Add contact error:', addError);
                return error('Échec de l\'ajout du contact', 500);
            }

            return success({
                message: 'Contact ajouté !',
                contact: {
                    id: newContact.id,
                    user_id: contactUser.id,
                    email: contactUser.email,
                    added_at: newContact.created_at
                },
                count: currentCount + 1,
                remaining: 4 - currentCount
            }, 201);

        } catch (err) {
            console.error('POST contacts error:', err);
            return error('Server error', 500);
        }
    }

    // ========================================
    // DELETE - Supprimer un contact
    // ========================================
    
    if (event.httpMethod === 'DELETE') {
        try {
            // Get contact ID from query params or body
            const params = event.queryStringParameters || {};
            let contactId = params.id || params.contact_id;
            
            // Also check body for ID
            if (!contactId && event.body) {
                try {
                    const body = JSON.parse(event.body);
                    contactId = body.id || body.contact_id;
                } catch (e) {}
            }

            if (!contactId) {
                return error('ID du contact requis', 400);
            }

            // Delete (only own contacts)
            const { data: deleted, error: deleteError } = await supabaseAdmin
                .from('contacts')
                .delete()
                .eq('id', contactId)
                .eq('user_id', user.id)
                .select()
                .single();

            if (deleteError || !deleted) {
                return error('Contact non trouvé ou déjà supprimé', 404);
            }

            // Get updated count
            const { count: newCount } = await supabaseAdmin
                .from('contacts')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', user.id);

            return success({
                message: 'Contact retiré',
                removed_id: contactId,
                count: newCount || 0,
                remaining: 5 - (newCount || 0)
            });

        } catch (err) {
            console.error('DELETE contacts error:', err);
            return error('Server error', 500);
        }
    }

    return error('Method not allowed', 405);
};
