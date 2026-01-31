/**
 * CINQ User Profile - Netlify Function
 * Profile & Account Management
 * 
 * GET /api/user-profile
 *   - Returns user profile with stats
 *   - ?action=export - GDPR data export
 * 
 * PUT /api/user-profile
 *   - Update display_name, bio, avatar_url
 * 
 * DELETE /api/user-profile
 *   - Delete account (requires { confirmation: "SUPPRIMER" })
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

// Validation helpers
function sanitizeText(str, maxLength = 1000, allowNewlines = false) {
    if (typeof str !== 'string') return '';
    let clean = str
        .replace(/\0/g, '')
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
        .trim();
    if (!allowNewlines) {
        clean = clean.replace(/[\r\n]+/g, ' ');
    }
    return clean.substring(0, maxLength);
}

function validateDisplayName(name) {
    if (!name) return { valid: true, name: null };
    const sanitized = sanitizeText(name, 50, false);
    if (sanitized.length < 2) {
        return { valid: false, error: 'Nom trop court (min 2 caractères)' };
    }
    return { valid: true, name: sanitized };
}

function validateBio(bio) {
    if (!bio) return { valid: true, bio: null };
    return { valid: true, bio: sanitizeText(bio, 500, true) };
}

function validateURL(url) {
    if (!url) return { valid: true, url: null };
    try {
        const parsed = new URL(url);
        if (parsed.protocol !== 'https:') {
            return { valid: false, error: 'URL doit être HTTPS' };
        }
        if (url.length > 500) {
            return { valid: false, error: 'URL trop longue' };
        }
        return { valid: true, url };
    } catch {
        return { valid: false, error: 'Format URL invalide' };
    }
}

exports.handler = async (event, context) => {
    // CORS preflight
    if (event.httpMethod === 'OPTIONS') {
        return { 
            statusCode: 204, 
            headers: { ...headers, 'Access-Control-Allow-Methods': 'GET, PUT, DELETE, OPTIONS' }, 
            body: '' 
        };
    }

    // ========================================
    // Authentication Check
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

    // Parse query params
    const params = event.queryStringParameters || {};
    const action = params.action;

    // ========================================
    // GET - Fetch Profile or Export Data
    // ========================================
    
    if (event.httpMethod === 'GET') {
        try {
            // ===== GDPR DATA EXPORT =====
            if (action === 'export') {
                const exportData = {
                    exportDate: new Date().toISOString(),
                    user: null,
                    contacts: [],
                    messages: [],
                    proposals: [],
                    giftCodesCreated: [],
                    pushSubscriptions: []
                };

                // User profile
                const { data: profile } = await supabaseAdmin
                    .from('users')
                    .select('id, email, display_name, bio, avatar_url, created_at, updated_at, gift_code_used')
                    .eq('id', user.id)
                    .single();
                exportData.user = profile;

                // Contacts
                const { data: contacts } = await supabaseAdmin
                    .from('contacts')
                    .select('id, contact_user_id, nickname, created_at')
                    .eq('user_id', user.id);
                exportData.contacts = contacts || [];

                // Messages
                const { data: messages } = await supabaseAdmin
                    .from('messages')
                    .select('id, sender_id, receiver_id, content, is_ping, read_at, created_at')
                    .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
                    .order('created_at', { ascending: true });
                exportData.messages = messages || [];

                // Proposals
                const { data: proposals } = await supabaseAdmin
                    .from('proposals')
                    .select('id, sender_id, receiver_id, proposed_at, location, message, status, responded_at, created_at')
                    .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
                    .order('created_at', { ascending: true });
                exportData.proposals = proposals || [];

                // Gift codes
                const { data: giftCodes } = await supabaseAdmin
                    .from('gift_codes')
                    .select('id, code, status, redeemed_at, expires_at, created_at')
                    .eq('created_by', user.id);
                exportData.giftCodesCreated = giftCodes || [];

                // Push subscriptions
                const { data: pushSubs } = await supabaseAdmin
                    .from('push_subscriptions')
                    .select('id, endpoint, created_at')
                    .eq('user_id', user.id);
                exportData.pushSubscriptions = pushSubs || [];

                return {
                    statusCode: 200,
                    headers: {
                        ...headers,
                        'Content-Type': 'application/json',
                        'Content-Disposition': `attachment; filename="cinq-data-export-${new Date().toISOString().split('T')[0]}.json"`
                    },
                    body: JSON.stringify(exportData, null, 2)
                };
            }

            // ===== Regular profile fetch =====
            const { data: profile, error: profileError } = await supabaseAdmin
                .from('users')
                .select('*')
                .eq('id', user.id)
                .single();

            if (profileError) {
                return error('Profile not found', 404);
            }

            // Get contact count
            const { count } = await supabaseAdmin
                .from('contacts')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', user.id);

            return success({
                profile,
                stats: {
                    contactCount: count || 0,
                    maxContacts: 5
                }
            });

        } catch (err) {
            console.error('Profile fetch error:', err);
            return error('Failed to fetch profile', 500);
        }
    }

    // ========================================
    // PUT - Update Profile
    // ========================================
    
    if (event.httpMethod === 'PUT') {
        try {
            const body = JSON.parse(event.body || '{}');
            const { display_name, avatar_url, bio } = body;

            const updates = {};
            
            if (display_name !== undefined) {
                const result = validateDisplayName(display_name);
                if (!result.valid) {
                    return error(result.error, 400);
                }
                updates.display_name = result.name;
            }
            
            if (avatar_url !== undefined) {
                const result = validateURL(avatar_url);
                if (!result.valid) {
                    return error(result.error, 400);
                }
                updates.avatar_url = result.url;
            }
            
            if (bio !== undefined) {
                const result = validateBio(bio);
                if (!result.valid) {
                    return error(result.error, 400);
                }
                updates.bio = result.bio;
            }

            if (Object.keys(updates).length === 0) {
                return error('Aucun champ à mettre à jour', 400);
            }

            updates.updated_at = new Date().toISOString();

            const { data, error: updateError } = await supabaseAdmin
                .from('users')
                .update(updates)
                .eq('id', user.id)
                .select()
                .single();

            if (updateError) throw updateError;
            
            return success({ success: true, profile: data });

        } catch (err) {
            console.error('Profile update error:', err);
            return error('Failed to update profile', 500);
        }
    }

    // ========================================
    // DELETE - Delete Account
    // ========================================
    
    if (event.httpMethod === 'DELETE') {
        try {
            const body = JSON.parse(event.body || '{}');
            const { confirmation } = body;

            if (confirmation !== 'SUPPRIMER') {
                return error('Confirmation requise. Envoie { "confirmation": "SUPPRIMER" }', 400);
            }

            // Delete in order to respect foreign key constraints
            // 1. Push subscriptions
            await supabaseAdmin
                .from('push_subscriptions')
                .delete()
                .eq('user_id', user.id);

            // 2. Proposals
            await supabaseAdmin
                .from('proposals')
                .delete()
                .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`);

            // 3. Messages
            await supabaseAdmin
                .from('messages')
                .delete()
                .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`);

            // 4. Contacts
            await supabaseAdmin
                .from('contacts')
                .delete()
                .or(`user_id.eq.${user.id},contact_user_id.eq.${user.id}`);

            // 5. Nullify gift codes
            await supabaseAdmin
                .from('gift_codes')
                .update({ created_by: null })
                .eq('created_by', user.id);

            // 6. Delete user profile
            await supabaseAdmin
                .from('users')
                .delete()
                .eq('id', user.id);

            // 7. Delete auth user
            const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(user.id);
            
            if (authDeleteError) {
                console.error('Error deleting auth user:', authDeleteError);
            }

            return success({ 
                success: true, 
                message: 'Compte supprimé définitivement. Adieu ! 👋'
            });

        } catch (err) {
            console.error('Delete account error:', err);
            return error('Failed to delete account', 500);
        }
    }

    return error('Method not allowed', 405);
};
