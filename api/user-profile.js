import { createClient } from '@supabase/supabase-js';
import { checkRateLimit, RATE_LIMITS } from './_rate-limit.js';
import { validateDisplayName, validateBio, validateURL } from './_validation.js';

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
);

async function getUser(req) {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) return null;
    const { data: { user } } = await supabase.auth.getUser(auth.split(' ')[1]);
    return user;
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    if (req.method === 'OPTIONS') return res.status(200).end();

    const user = await getUser(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });

    const action = req.query.action;

    // Rate limiting
    const rateLimitConfig = req.method === 'GET' ? RATE_LIMITS.READ : RATE_LIMITS.CREATE;
    if (!checkRateLimit(req, res, { ...rateLimitConfig, keyPrefix: 'profile', userId: user.id })) {
        return;
    }

    try {
        // ============ GET - Get profile or Export data ============
        if (req.method === 'GET') {
            
            // ===== GDPR DATA EXPORT =====
            if (action === 'export') {
                // Gather all user data for GDPR export
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
                const { data: profile } = await supabase
                    .from('users')
                    .select('id, email, display_name, bio, avatar_url, created_at, updated_at, gift_code_used')
                    .eq('id', user.id)
                    .single();
                exportData.user = profile;

                // Contacts
                const { data: contacts } = await supabase
                    .from('contacts')
                    .select('id, contact_user_id, nickname, created_at')
                    .eq('user_id', user.id);
                exportData.contacts = contacts || [];

                // Messages (sent and received)
                const { data: messages } = await supabase
                    .from('messages')
                    .select('id, sender_id, receiver_id, content, is_ping, read_at, created_at')
                    .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
                    .order('created_at', { ascending: true });
                exportData.messages = messages || [];

                // Proposals (sent and received)
                const { data: proposals } = await supabase
                    .from('proposals')
                    .select('id, sender_id, receiver_id, proposed_at, location, message, status, responded_at, created_at')
                    .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
                    .order('created_at', { ascending: true });
                exportData.proposals = proposals || [];

                // Gift codes created by user
                const { data: giftCodes } = await supabase
                    .from('gift_codes')
                    .select('id, code, status, redeemed_at, expires_at, created_at')
                    .eq('created_by', user.id);
                exportData.giftCodesCreated = giftCodes || [];

                // Push subscriptions
                const { data: pushSubs } = await supabase
                    .from('push_subscriptions')
                    .select('id, endpoint, created_at')
                    .eq('user_id', user.id);
                exportData.pushSubscriptions = pushSubs || [];

                // Set headers for file download
                res.setHeader('Content-Type', 'application/json');
                res.setHeader('Content-Disposition', `attachment; filename="cinq-data-export-${new Date().toISOString().split('T')[0]}.json"`);
                
                return res.json(exportData);
            }

            // ===== Regular profile fetch =====
            const { data, error } = await supabase
                .from('users')
                .select('*')
                .eq('id', user.id)
                .single();

            if (error) throw error;

            // Get contact count
            const { count } = await supabase
                .from('contacts')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', user.id);

            return res.json({ 
                profile: data,
                stats: {
                    contactCount: count || 0,
                    maxContacts: 5
                }
            });
        }

        // ============ PUT - Update profile ============
        if (req.method === 'PUT') {
            const { display_name, avatar_url, bio } = req.body;

            const updates = {};
            
            // Validate and sanitize display_name
            if (display_name !== undefined) {
                const result = validateDisplayName(display_name);
                if (!result.valid) {
                    return res.status(400).json({ error: result.error, field: 'display_name' });
                }
                updates.display_name = result.name;
            }
            
            // Validate and sanitize avatar_url
            if (avatar_url !== undefined) {
                const result = validateURL(avatar_url);
                if (!result.valid) {
                    return res.status(400).json({ error: result.error, field: 'avatar_url' });
                }
                updates.avatar_url = result.url;
            }
            
            // Validate and sanitize bio
            if (bio !== undefined) {
                const result = validateBio(bio);
                if (!result.valid) {
                    return res.status(400).json({ error: result.error, field: 'bio' });
                }
                updates.bio = result.bio;
            }

            // Nothing to update
            if (Object.keys(updates).length === 0) {
                return res.status(400).json({ error: 'Aucun champ à mettre à jour' });
            }

            updates.updated_at = new Date().toISOString();

            const { data, error } = await supabase
                .from('users')
                .update(updates)
                .eq('id', user.id)
                .select()
                .single();

            if (error) throw error;
            return res.json({ success: true, profile: data });
        }

        // ============ DELETE - Delete account ============
        if (req.method === 'DELETE') {
            const { confirmation } = req.body || {};

            // Require explicit confirmation
            if (confirmation !== 'SUPPRIMER') {
                return res.status(400).json({ 
                    error: 'Confirmation requise',
                    hint: 'Envoie { "confirmation": "SUPPRIMER" } pour confirmer la suppression définitive'
                });
            }

            // Delete in order to respect foreign key constraints
            // 1. Delete push subscriptions
            await supabase
                .from('push_subscriptions')
                .delete()
                .eq('user_id', user.id);

            // 2. Delete proposals (sent and received)
            await supabase
                .from('proposals')
                .delete()
                .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`);

            // 3. Delete messages (sent and received)
            await supabase
                .from('messages')
                .delete()
                .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`);

            // 4. Delete contacts (where user is owner or is a contact)
            await supabase
                .from('contacts')
                .delete()
                .or(`user_id.eq.${user.id},contact_user_id.eq.${user.id}`);

            // 5. Nullify gift codes created_by (don't delete, keep history)
            await supabase
                .from('gift_codes')
                .update({ created_by: null })
                .eq('created_by', user.id);

            // 6. Delete user profile
            await supabase
                .from('users')
                .delete()
                .eq('id', user.id);

            // 7. Delete auth user (this will cascade due to ON DELETE CASCADE)
            const { error: authError } = await supabase.auth.admin.deleteUser(user.id);
            
            if (authError) {
                console.error('Error deleting auth user:', authError);
                // Continue anyway - profile data is already deleted
            }

            return res.json({ 
                success: true, 
                message: 'Compte supprimé définitivement. Adieu ! 👋'
            });
        }

        return res.status(405).json({ error: 'Method not allowed' });

    } catch (e) {
        console.error('Profile error:', e);
        return res.status(500).json({ error: e.message });
    }
}
