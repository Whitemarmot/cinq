/**
 * CINQ User Profile - Netlify Function
 * SARAH Backend - Profile & Contacts Management
 * 
 * GET /api/user-profile
 *   - Returns user profile with contacts
 * 
 * POST /api/user-profile
 *   - action: "add_contact" - Add a contact (max 5)
 *   - action: "remove_contact" - Remove a contact
 *   - action: "update_profile" - Update profile settings
 * 
 * Requires: Authorization: Bearer <access_token>
 */

const { createClient } = require('@supabase/supabase-js');
const { success, error, headers } = require('./gift-utils');

// Supabase clients
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

// Extract Bearer token from headers
function getAuthToken(event) {
    const authHeader = event.headers['authorization'] || event.headers['Authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null;
    }
    return authHeader.slice(7);
}

exports.handler = async (event, context) => {
    // CORS preflight
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers, body: '' };
    }

    // ========================================
    // 1. Authentication Check
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
    // GET - Fetch Profile
    // ========================================
    
    if (event.httpMethod === 'GET') {
        try {
            // Get user profile
            const { data: profile, error: profileError } = await supabaseAdmin
                .from('users')
                .select('id, email, created_at, gift_code_used')
                .eq('id', user.id)
                .single();

            if (profileError) {
                return error('Profile not found', 404);
            }

            // Get contacts with user info
            const { data: contacts, error: contactsError } = await supabaseAdmin
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
                .eq('user_id', user.id);

            // Get recent messages count (simple version - no read tracking yet)
            const { count: messageCount } = await supabaseAdmin
                .from('messages')
                .select('*', { count: 'exact', head: true })
                .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`);

            return success({
                profile: {
                    id: profile.id,
                    email: profile.email,
                    created_at: profile.created_at,
                    member_since: profile.created_at
                },
                contacts: {
                    count: contacts?.length || 0,
                    limit: 5,
                    remaining: 5 - (contacts?.length || 0),
                    list: (contacts || []).map(c => ({
                        id: c.id,
                        user_id: c.contact_user_id,
                        email: c.contact?.email,
                        added_at: c.created_at
                    }))
                },
                messages: {
                    total: messageCount || 0
                }
            });

        } catch (err) {
            console.error('Profile fetch error:', err);
            return error('Failed to fetch profile', 500);
        }
    }

    // ========================================
    // POST - Profile Actions
    // ========================================
    
    if (event.httpMethod === 'POST') {
        try {
            const body = JSON.parse(event.body || '{}');
            const { action } = body;

            if (!action) {
                return error('Action is required', 400);
            }

            // -----------------------------------
            // ADD CONTACT
            // -----------------------------------
            if (action === 'add_contact') {
                const { email: contactEmail } = body;

                if (!contactEmail) {
                    return error('Contact email is required', 400);
                }

                // Find user by email
                const { data: contactUser, error: findError } = await supabaseAdmin
                    .from('users')
                    .select('id, email')
                    .eq('email', contactEmail.toLowerCase().trim())
                    .single();

                if (findError || !contactUser) {
                    return error('User not found. They must have a CINQ account.', 404);
                }

                // Can't add yourself
                if (contactUser.id === user.id) {
                    return error('You cannot add yourself as a contact', 400);
                }

                // Check if already a contact
                const { data: existing } = await supabaseAdmin
                    .from('contacts')
                    .select('id')
                    .eq('user_id', user.id)
                    .eq('contact_user_id', contactUser.id)
                    .single();

                if (existing) {
                    return error('This user is already in your contacts', 409);
                }

                // Check current contact count (should be handled by trigger, but double-check)
                const { count: currentCount } = await supabaseAdmin
                    .from('contacts')
                    .select('*', { count: 'exact', head: true })
                    .eq('user_id', user.id);

                if (currentCount >= 5) {
                    return error('CINQ limit reached: you can only have 5 contacts. Remove someone first.', 400, {
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
                    if (addError.message.includes('CINQ limit')) {
                        return error('CINQ limit reached: maximum 5 contacts', 400);
                    }
                    console.error('Add contact error:', addError);
                    return error('Failed to add contact', 500);
                }

                return success({
                    message: 'Contact added successfully',
                    contact: {
                        id: newContact.id,
                        user_id: contactUser.id,
                        email: contactUser.email,
                        added_at: newContact.created_at
                    },
                    contacts_remaining: 4 - currentCount
                }, 201);
            }

            // -----------------------------------
            // REMOVE CONTACT
            // -----------------------------------
            if (action === 'remove_contact') {
                const { contact_id, contact_user_id } = body;

                if (!contact_id && !contact_user_id) {
                    return error('contact_id or contact_user_id is required', 400);
                }

                let query = supabaseAdmin
                    .from('contacts')
                    .delete()
                    .eq('user_id', user.id);

                if (contact_id) {
                    query = query.eq('id', contact_id);
                } else {
                    query = query.eq('contact_user_id', contact_user_id);
                }

                const { data: deleted, error: deleteError } = await query.select().single();

                if (deleteError) {
                    return error('Contact not found or already removed', 404);
                }

                // Get updated count
                const { count: newCount } = await supabaseAdmin
                    .from('contacts')
                    .select('*', { count: 'exact', head: true })
                    .eq('user_id', user.id);

                return success({
                    message: 'Contact removed',
                    contacts_remaining: 5 - (newCount || 0)
                });
            }

            // -----------------------------------
            // UPDATE PROFILE
            // -----------------------------------
            if (action === 'update_profile') {
                // Future: encrypted profile data for E2E
                // For now, limited profile updates
                
                return success({
                    message: 'Profile update not yet implemented'
                });
            }

            return error('Unknown action', 400);

        } catch (err) {
            console.error('Profile action error:', err);
            return error('Failed to process action', 500);
        }
    }

    return error('Method not allowed', 405);
};
